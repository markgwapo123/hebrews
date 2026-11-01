import { Router } from 'express';
import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { Recipe } from '../models/Recipe.js';
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
router.get('/products',wrap(async(_req,res)=>res.json(await Product.find({active:true}).populate('category','name').sort({name:1}).lean())));
router.get('/product-stock',allowRoles('owner'),wrap(async(_req,res)=>{
 const [products,sold,recipes,inventory]=await Promise.all([
  Product.find({active:true}).lean(),
  DailySale.aggregate([{$match:{status:'posted'}},{$unwind:'$items'},{$group:{_id:'$items.product',sold:{$sum:'$items.quantity'}}}]),
  Recipe.find().lean(),
  InventoryItem.find({active:true}).lean()
 ]);
 const soldByProduct=new Map(sold.map(x=>[String(x._id),x.sold]));
 const recipeByProduct=new Map(recipes.map(x=>[String(x.product),x]));
 const stockById=new Map(inventory.map(x=>[String(x._id),x]));
 res.json(products.map(p=>{
  let available=0,stockTracked=false;
  if(p.kind==='ready_made'&&p.inventoryItem){
   const item=stockById.get(String(p.inventoryItem));
   if(item){available=Math.floor(item.quantity);stockTracked=true;}
  }else if(p.kind==='prepared'){
   const recipe=recipeByProduct.get(String(p._id));
   const components=[...(recipe?.ingredients||[]),...(recipe?.packaging||[])];
   if(components.length){
    stockTracked=true;
    available=Math.max(0,Math.floor(Math.min(...components.map(c=>{
     const item=stockById.get(String(c.inventoryItem));
     return item&&Number(c.quantity)>0?item.quantity/Number(c.quantity):0;
    }))));
   }
  }
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
 const {name,category,kind,sellingPrice,inventoryItem,ingredients,packaging}=req.body||{};
 if(!text(name,150)||!id(category)||!['prepared','ready_made'].includes(kind)||!money(sellingPrice))return bad(res,'Valid product details and prices required');
 if(!await Category.exists({_id:category,active:true}))return bad(res,'Category not found');
 let recipeIngredients=[],recipePackaging=[];
 if(kind==='prepared'){
  if(!Array.isArray(ingredients)||!Array.isArray(packaging))return bad(res,'Recipe ingredients and packaging required');
  recipeIngredients=ingredients;recipePackaging=packaging;
  const all=[...recipeIngredients,...recipePackaging],keys=new Set();
  if(!all.length)return bad(res,'Add at least one ingredient or packaging item');
  for(const c of all){if(!id(c.inventoryItem)||!Number.isFinite(Number(c.quantity))||Number(c.quantity)<=0||keys.has(String(c.inventoryItem)))return bad(res,'Invalid or duplicate recipe component');keys.add(String(c.inventoryItem));}
  const stock=await InventoryItem.find({_id:{$in:[...keys]},active:true}).lean();
  if(stock.length!==keys.size)return bad(res,'Inventory item missing or inactive');
  const types=new Map(stock.map(i=>[String(i._id),i.kind]));
  if(recipeIngredients.some(c=>types.get(String(c.inventoryItem))!=='ingredient')||recipePackaging.some(c=>types.get(String(c.inventoryItem))!=='packaging'))return bad(res,'Recipe component type does not match inventory');
 }else if(!id(inventoryItem)||!await InventoryItem.exists({_id:inventoryItem,kind:'ready_made',unit:'pcs',active:true})){
  return bad(res,'Choose a ready-made inventory item');
 }
 if(kind==='ready_made'&&await Product.exists({inventoryItem,active:true}))return res.status(409).json({error:'This ready-made inventory item is already linked to a product'});
 const session=await mongoose.startSession();let product;
 try{await session.withTransaction(async()=>{
  [product]=await Product.create([{name:name.trim(),category,kind,sellingPrice,purchaseCost:0,inventoryItem:kind==='ready_made'?inventoryItem:null}],{session,ordered:true});
  if(kind==='prepared')await Recipe.create([{product:product._id,ingredients:recipeIngredients,packaging:recipePackaging}],{session,ordered:true});
  await AuditLog.create([{actor:req.user._id,action:'product.create',entity:'Product',entityId:product._id}],{session,ordered:true});
 });}finally{await session.endSession();}
 res.status(201).json(product);
}));
export default router;
