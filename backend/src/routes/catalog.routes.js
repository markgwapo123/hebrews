import { Router } from 'express';
import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Recipe } from '../models/Recipe.js';
import { ProductVariant } from '../models/ProductVariant.js';
import { DailySale } from '../models/DailySale.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { AuditLog } from '../models/AuditLog.js';
import { StockMovement } from '../models/StockMovement.js';
import { requireAuth,allowRoles } from '../middleware/auth.js';
import { wrap,id,money,text,bad } from '../utils/validate.js';
const router=Router();router.use(requireAuth);
router.get('/categories',wrap(async(_req,res)=>res.json(await Category.find({active:true}).sort({name:1}).lean())));
router.post('/categories',allowRoles('owner'),wrap(async(req,res)=>{
 const name=req.body?.name;if(!text(name,100))return bad(res);
 const x=await Category.create({name:name.trim(),description:String(req.body?.description||'').slice(0,500)});
 await AuditLog.create({actor:req.user._id,action:'category.create',entity:'Category',entityId:x._id});res.status(201).json(x);
}));
router.get('/product-variants',wrap(async(_req,res)=>res.json(await ProductVariant.find({active:true}).lean())));
router.get('/products',wrap(async(_req,res)=>res.json(await Product.find({active:true}).populate('category','name').sort({name:1}).lean())));
router.get('/product-stock',allowRoles('owner'),wrap(async(_req,res)=>{
 const [products,sold,recipes,inventory]=await Promise.all([
  Product.find({active:true}).lean(),
  DailySale.aggregate([{$match:{status:'posted'}},{$unwind:'$items'},{$group:{_id:'$items.product',sold:{$sum:'$items.quantity'}}}]),
  Recipe.find().lean(),
  InventoryItem.find({active:true}).select('quantity').lean()
 ]);
 const soldByProduct=new Map(sold.map(x=>[String(x._id),x.sold]));
 const recipesByProduct=new Map(recipes.map(x=>[String(x.product),x]));
 const inventoryById=new Map(inventory.map(x=>[String(x._id),x]));
 const availability=parts=>Math.max(0,Math.floor(Math.min(...parts.map(part=>{
  const item=inventoryById.get(String(part.inventoryItem));
  return item&&Number(part.quantity)>0?Number(item.quantity)/Number(part.quantity):0;
 }))));
 res.json(products.map(p=>{
  const recipe=recipesByProduct.get(String(p._id));
  const parts=[...(recipe?.ingredients||[]),...(recipe?.packaging||[])];
  const item=p.inventoryItem?inventoryById.get(String(p.inventoryItem)):null;
  const stockTracked=Boolean(p.inventoryItem||parts.length);
  const available=p.inventoryItem?(item?Math.floor(Number(item.quantity)):0):parts.length?availability(parts):null;
  return {productId:String(p._id),available,sold:soldByProduct.get(String(p._id))||0,stockTracked,manuallyUnavailable:p.manuallyUnavailable};
 }));
}));
router.post('/products/:productId/stock',allowRoles('owner'),wrap(async(req,res)=>{
 const {productId}=req.params;
 const quantity=Number(req.body?.quantity),unitCost=Number(req.body?.unitCost);
 if(!id(productId)||!Number.isSafeInteger(quantity)||quantity<1||!Number.isFinite(unitCost)||unitCost<0)return bad(res,'Enter a positive whole-number quantity and valid unit cost');
 const session=await mongoose.startSession();
 try{
  let result;
  await session.withTransaction(async()=>{
   const product=await Product.findOne({_id:productId,active:true}).session(session);
   if(!product)throw Object.assign(new Error('Product not found'),{status:404});
   // Recipe-managed products must continue to derive availability from ingredients.
   if(product.kind==='prepared'&&!product.inventoryItem&&await Recipe.exists({product:product._id}).session(session))
    throw Object.assign(new Error('This product uses recipe-based stock. Add ingredient quantities in Inventory.'),{status:409});
   let item;
   if(product.inventoryItem){
    item=await InventoryItem.findOne({_id:product.inventoryItem,active:true}).session(session);
    if(!item||item.kind!=='ready_made'||item.unit!=='pcs')throw Object.assign(new Error('Product stock is not a piece-based inventory item'),{status:409});
   }else{
    [item]=await InventoryItem.create([{name:product.name+' - finished stock',kind:'ready_made',unit:'pcs',quantity:0,averageUnitCost:0,reorderLevel:0}],{session,ordered:true});
    product.inventoryItem=item._id;
    await product.save({session});
   }
   const before=item.quantity,after=before+quantity;
   item.averageUnitCost=Math.round(((before*item.averageUnitCost)+(quantity*unitCost))/after*10000)/10000;
   item.quantity=after;
   await item.save({session});
   await StockMovement.create([{item:item._id,kind:'stock_in',quantityDelta:quantity,unitCostSnapshot:unitCost,createdBy:req.user._id}],{session,ordered:true});
   await AuditLog.create([{actor:req.user._id,action:'product.stock_in',entity:'Product',entityId:product._id,details:{quantity,unitCost,inventoryItem:item._id}}],{session,ordered:true});
   result={productId:String(product._id),quantity:item.quantity};
  });
  res.status(201).json(result);
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});throw e;}finally{await session.endSession();}
}));
router.post('/products',allowRoles('owner'),wrap(async(req,res)=>{
 const {name,category,kind,sellingPrice,purchaseCost=0}=req.body||{};
 if(!text(name,150)||!id(category)||!['prepared','ready_made'].includes(kind)||!money(sellingPrice)||!money(purchaseCost))return bad(res,'Valid product details and prices required');
 if(!await Category.exists({_id:category,active:true}))return bad(res,'Category not found');
 // Inventory is independent; products can be created without recipes or linked stock.
 const session=await mongoose.startSession();let product;
 try{await session.withTransaction(async()=>{
  [product]=await Product.create([{name:name.trim(),category,kind,sellingPrice,purchaseCost,inventoryItem:null}],{session,ordered:true});
  await AuditLog.create([{actor:req.user._id,action:'product.create',entity:'Product',entityId:product._id}],{session,ordered:true});
 });}finally{await session.endSession();}
 res.status(201).json(product);
}));
export default router;
