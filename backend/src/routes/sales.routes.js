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
 res.json(await DailySale.find(filter).sort({createdAt:-1}).limit(100).lean());
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
  const byRecipe=new Map(recipes.map(x=>[String(x.product),x]));
  const demand=new Map(),lines=[];
  for(const entry of items){
   const product=byProduct.get(entry.productId),qty=entry.quantity;
   let components=[];
   if(product.kind==='prepared'&&!product.inventoryItem){
    const recipe=byRecipe.get(entry.productId);
    if(!recipe||!recipe.ingredients.length)throw Object.assign(new Error('Prepared product requires recipe'),{status:409});
    components=[...recipe.ingredients,...recipe.packaging];
   }else{
    if(!product.inventoryItem)throw Object.assign(new Error('Ready-made product needs inventory link'),{status:409});
    components=[{inventoryItem:product.inventoryItem,quantity:1}];
   }
   for(const c of components){const key=String(c.inventoryItem);demand.set(key,(demand.get(key)||0)+c.quantity*qty);}
   lines.push({product:product._id,quantity:qty,unitPriceSnapshot:product.sellingPrice});
  }
  const ids=[...demand.keys()];
  const stock=await InventoryItem.find({_id:{$in:ids},active:true}).session(session);
  if(stock.length!==ids.length)throw Object.assign(new Error('Required inventory missing'),{status:409});
  const stockById=new Map(stock.map(s=>[String(s._id),s]));
  for(const [key,qty] of demand){
   const item=stockById.get(key);
   if(item.quantity+1e-8<qty)throw Object.assign(new Error('Insufficient stock: '+item.name),{status:409});
  }
  for(const line of lines){
   const product=byProduct.get(String(line.product)),recipe=byRecipe.get(String(line.product));
   const components=product.kind==='prepared'&&!product.inventoryItem?[...recipe.ingredients,...recipe.packaging]:[{inventoryItem:product.inventoryItem,quantity:1}];
   const cost=components.reduce((sum,c)=>sum+c.quantity*stockById.get(String(c.inventoryItem)).averageUnitCost,0);
   line.unitCostSnapshot=Math.round(cost*100)/100;
   line.lineRevenue=Math.round(line.unitPriceSnapshot*line.quantity*100)/100;
   line.lineCost=Math.round(line.unitCostSnapshot*line.quantity*100)/100;
  }
  // Conditional atomic decrements protect against overselling when sales race.
  for(const [key,qty] of [...demand].sort(([a],[b])=>a.localeCompare(b))){
   const changed=await InventoryItem.updateOne({_id:key,active:true,quantity:{$gte:qty}},{$inc:{quantity:-qty}},{session});
   if(changed.modifiedCount!==1)throw Object.assign(new Error('Stock changed; retry sale'),{status:409});
  }
  const totalRevenue=Math.round(lines.reduce((s,l)=>s+l.lineRevenue,0)*100)/100;
  const totalCost=Math.round(lines.reduce((s,l)=>s+l.lineCost,0)*100)/100;
  [saved]=await DailySale.create([{businessDate,entryKey,items:lines,totalRevenue,totalCost,recordedBy:req.user._id}],{session});
  await StockMovement.create([...demand].map(([key,qty])=>({item:key,kind:'sale',quantityDelta:-qty,unitCostSnapshot:stockById.get(key).averageUnitCost,referenceId:saved._id,createdBy:req.user._id})),{session});
  await AuditLog.create([{actor:req.user._id,action:'sale.post',entity:'DailySale',entityId:saved._id,details:{businessDate,entryKey,totalRevenue,totalCost}}],{session});
 });
 res.status(201).json(saved);
 }catch(e){if(e.code===11000)return res.status(409).json({error:'Entry key already posted'});if(e.status)return res.status(e.status).json({error:e.message});throw e;}finally{await session.endSession();}
}));
export default r;
