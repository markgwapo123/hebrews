import {Router} from 'express';
import mongoose from 'mongoose';
import {requireAuth} from '../middleware/auth.js';
import {wrap,id,positive,bad} from '../utils/validate.js';
import {Product} from '../models/Product.js';
import {Recipe} from '../models/Recipe.js';
import {InventoryItem} from '../models/InventoryItem.js';
import {DailySale} from '../models/DailySale.js';
import {StockMovement} from '../models/StockMovement.js';
import {AuditLog} from '../models/AuditLog.js';
const r=Router();r.use(requireAuth);
r.get('/',wrap(async(req,res)=>{
 const filter=req.user.role==='owner'?{}:{recordedBy:req.user._id};
 if(req.query.date){if(!/^\d{4}-\d{2}-\d{2}$/.test(req.query.date))return bad(res);filter.businessDate=req.query.date;}
 res.json(await DailySale.find(filter).populate('items.product','name').sort({createdAt:-1}).limit(100).lean());
}));
r.post('/',wrap(async(req,res)=>{
 const {businessDate,entryKey,items}=req.body||{};
 if(typeof businessDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)||Number.isNaN(Date.parse(businessDate+'T00:00:00Z'))||typeof entryKey!=='string'||entryKey.length<8||entryKey.length>100||!Array.isArray(items)||items.length<1||items.length>100)return bad(res);
 const seen=new Set();
 for(const line of items){if(!id(line.productId)||!Number.isSafeInteger(line.quantity)||line.quantity<=0||seen.has(line.productId))return bad(res,'Invalid or duplicate product line');seen.add(line.productId);}
 const existing=await DailySale.findOne({entryKey}).lean();
 if(existing)return res.status(409).json({error:'Entry key already posted',saleId:existing._id});
 const session=await mongoose.startSession();let saved;
 try{
 await session.withTransaction(async()=>{
  const productIds=items.map(x=>x.productId);
  const products=await Product.find({_id:{$in:productIds},active:true,manuallyUnavailable:false}).session(session);
  if(products.length!==items.length)throw Object.assign(new Error('Product missing or unavailable'),{status:409});
  const byProduct=new Map(products.map(p=>[String(p._id),p]));
  const recipes=await Recipe.find({product:{$in:productIds}}).session(session);
  const byRecipe=new Map(recipes.map(recipe=>[String(recipe.product),recipe]));
  const demand=new Map(),lines=[],componentByProduct=new Map();
  for(const entry of items){
   const product=byProduct.get(entry.productId),qty=entry.quantity;
   let components;
   if(product.inventoryItem){
    components=[{inventoryItem:product.inventoryItem,quantity:1}];
   }else{
    const recipe=byRecipe.get(entry.productId);
    if(!recipe||!(recipe.ingredients?.length||recipe.packaging?.length))throw Object.assign(new Error('Connect inventory or a recipe for '+product.name+' before checkout.'),{status:409});
    components=[...recipe.ingredients,...(recipe.packaging||[])];
   }
   componentByProduct.set(entry.productId,components);
   for(const component of components){
    const key=String(component.inventoryItem),amount=Number(component.quantity)*qty;
    if(!Number.isFinite(amount)||amount<=0)throw Object.assign(new Error('Invalid recipe quantity for '+product.name),{status:409});
    demand.set(key,(demand.get(key)||0)+amount);
   }
   lines.push({product:product._id,quantity:qty,unitPriceSnapshot:product.sellingPrice});
  }
  const stock=await InventoryItem.find({_id:{$in:[...demand.keys()]},active:true}).session(session);
  if(stock.length!==demand.size)throw Object.assign(new Error('Required inventory item is missing or inactive.'),{status:409});
  const stockById=new Map(stock.map(item=>[String(item._id),item]));
  for(const [key,qty] of demand){
   const item=stockById.get(key);
   if(item.quantity+1e-8<qty)throw Object.assign(new Error('Insufficient inventory: '+item.name),{status:409});
  }
  for(const line of lines){
   const components=componentByProduct.get(String(line.product));
   const cost=components.reduce((sum,c)=>sum+Number(c.quantity)*stockById.get(String(c.inventoryItem)).averageUnitCost,0);
   line.unitCostSnapshot=Math.round(cost*100)/100;
   line.lineRevenue=Math.round(line.unitPriceSnapshot*line.quantity*100)/100;
   line.lineCost=Math.round(line.unitCostSnapshot*line.quantity*100)/100;
  }
  for(const [key,qty] of [...demand].sort(([x],[y])=>x.localeCompare(y))){
   const updated=await InventoryItem.updateOne({_id:key,active:true,quantity:{$gte:qty}},{$inc:{quantity:-qty}},{session});
   if(updated.modifiedCount!==1)throw Object.assign(new Error('Inventory changed during checkout; please retry.'),{status:409});
  }
  const totalRevenue=Math.round(lines.reduce((s,l)=>s+l.lineRevenue,0)*100)/100;
  const totalCost=Math.round(lines.reduce((s,l)=>s+l.lineCost,0)*100)/100;
  [saved]=await DailySale.create([{businessDate,entryKey,items:lines,totalRevenue,totalCost,recordedBy:req.user._id}],{session,ordered:true});
  await StockMovement.create([...demand].map(([key,qty])=>({item:key,kind:'sale',quantityDelta:-qty,unitCostSnapshot:stockById.get(key).averageUnitCost,referenceId:saved._id,createdBy:req.user._id})),{session,ordered:true});
  await AuditLog.create([{actor:req.user._id,action:'sale.post',entity:'DailySale',entityId:saved._id,details:{businessDate,entryKey,totalRevenue,totalCost}}],{session,ordered:true});
 });
 res.status(201).json(saved);
 }catch(e){if(e.code===11000)return res.status(409).json({error:'Entry key already posted'});if(e.status)return res.status(e.status).json({error:e.message});throw e;}finally{await session.endSession();}
}));
r.post('/:saleId/void',wrap(async(req,res)=>{
 if(!id(req.params.saleId))return bad(res,'Invalid sale ID');
 const session=await mongoose.startSession();let result;
 try{
  await session.withTransaction(async()=>{
   const sale=await DailySale.findById(req.params.saleId).session(session);
   if(!sale)throw Object.assign(new Error('Sale not found'),{status:404});
   if(sale.status!=='posted')throw Object.assign(new Error('Sale already voided'),{status:409});
   const movements=await StockMovement.find({referenceId:sale._id,kind:'sale'}).session(session);
   if(!movements.length)throw Object.assign(new Error('Sale has no stock movement history; cannot safely restore inventory'),{status:409});
   for(const movement of movements){
    const updated=await InventoryItem.updateOne({_id:movement.item},{$inc:{quantity:-movement.quantityDelta}},{session});
    if(updated.modifiedCount!==1)throw Object.assign(new Error('Inventory item missing during void'),{status:409});
    await StockMovement.create([{item:movement.item,kind:'adjustment',quantityDelta:-movement.quantityDelta,unitCostSnapshot:movement.unitCostSnapshot,referenceId:sale._id,reason:'Void sale '+sale._id,createdBy:req.user._id}],{session,ordered:true});
   }
   sale.status='void';await sale.save({session});
   await AuditLog.create([{actor:req.user._id,action:'sale.void',entity:'DailySale',entityId:sale._id,details:{reason:String(req.body?.reason||'Admin void').slice(0,300)}}],{session,ordered:true});
   result=sale;
  });
  res.json(result);
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});throw e;}finally{await session.endSession();}
}));
export default r;
