import {Router} from 'express';
import mongoose from 'mongoose';
import {requireAuth} from '../middleware/auth.js';
import {wrap,id,positive,bad} from '../utils/validate.js';
import {Product} from '../models/Product.js';
import {Recipe} from '../models/Recipe.js';
import {ProductVariant} from '../models/ProductVariant.js';
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
r.get('/daily-summary',wrap(async(req,res)=>{
 const date=req.query.date;
 if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return bad(res,'Valid date required');
 const [totals,top]=await Promise.all([
  DailySale.aggregate([{$match:{businessDate:date,status:'posted'}},{$group:{_id:null,orders:{$sum:1},revenue:{$sum:'$totalRevenue'},cogs:{$sum:'$totalCost'}}}]),
  DailySale.aggregate([{$match:{businessDate:date,status:'posted'}},{$unwind:'$items'},{$group:{_id:'$items.product',quantity:{$sum:'$items.quantity'}}},{$sort:{quantity:-1}},{$limit:5},{$lookup:{from:'products',localField:'_id',foreignField:'_id',as:'product'}},{$project:{name:{$ifNull:[{$arrayElemAt:['$product.name',0]},'Product']},quantity:1}}])
 ]);
 const row=totals[0]||{};
 res.json({date,orders:row.orders||0,revenue:row.revenue||0,cogs:row.cogs||0,grossProfit:(row.revenue||0)-(row.cogs||0),topProducts:top});
}));
r.post('/',wrap(async(req,res)=>{
 const {businessDate,entryKey,items}=req.body||{};
 if(typeof businessDate!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)||Number.isNaN(Date.parse(businessDate+'T00:00:00Z'))||typeof entryKey!=='string'||entryKey.length<8||entryKey.length>100||!Array.isArray(items)||items.length<1||items.length>100)return bad(res);
 const seen=new Set();
 for(const line of items){const key=String(line.productId)+':'+String(line.sizeOz??'default');if(!id(line.productId)||!Number.isSafeInteger(line.quantity)||line.quantity<=0||(line.sizeOz!==undefined&&![6,12,16,22].includes(Number(line.sizeOz)))||seen.has(key))return bad(res,'Invalid or duplicate product/size line');seen.add(key);}
 const existing=await DailySale.findOne({entryKey}).lean();
 if(existing)return res.status(409).json({error:'Entry key already posted',saleId:existing._id});
 const session=await mongoose.startSession();let saved;
 try{
 await session.withTransaction(async()=>{
  const productIds=items.map(x=>x.productId);
  const products=await Product.find({_id:{$in:productIds},active:true,manuallyUnavailable:false}).session(session);
  if(products.length!==new Set(items.map(x=>x.productId)).size)throw Object.assign(new Error('Product missing or unavailable'),{status:409});
  const byProduct=new Map(products.map(p=>[String(p._id),p]));
  const variants=await ProductVariant.find({product:{$in:productIds},active:true}).session(session);
  const byVariant=new Map(variants.map(v=>[String(v.product)+':'+v.sizeOz,v]));
  const lines=[];
  for(const entry of items){
   const product=byProduct.get(String(entry.productId));
   const configured=variants.some(v=>String(v.product)===String(product._id));
   const variant=entry.sizeOz===undefined?null:byVariant.get(String(product._id)+':'+Number(entry.sizeOz));
   if(entry.sizeOz!==undefined&&!variant)throw Object.assign(new Error('Selected drink size is not configured'),{status:409});
   if(entry.sizeOz===undefined&&configured)throw Object.assign(new Error('Choose a cup size'),{status:409});
   const unitPrice=variant?variant.sellingPrice:product.sellingPrice;
   // Sales and inventory are independent. Product purchase cost is used for reporting.
   const unitCost=Number(product.purchaseCost)||0;
   lines.push({product:product._id,quantity:entry.quantity,...(variant?{sizeOz:variant.sizeOz}:{}),unitPriceSnapshot:unitPrice,unitCostSnapshot:unitCost,lineRevenue:Math.round(unitPrice*entry.quantity*100)/100,lineCost:Math.round(unitCost*entry.quantity*100)/100});
  }
  const totalRevenue=Math.round(lines.reduce((s,l)=>s+l.lineRevenue,0)*100)/100;
  const totalCost=Math.round(lines.reduce((s,l)=>s+l.lineCost,0)*100)/100;
  [saved]=await DailySale.create([{businessDate,entryKey,items:lines,totalRevenue,totalCost,recordedBy:req.user._id}],{session,ordered:true});
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
   // Voiding a sale does not change manually managed inventory.
   sale.status='void';await sale.save({session});
   await AuditLog.create([{actor:req.user._id,action:'sale.void',entity:'DailySale',entityId:sale._id,details:{reason:String(req.body?.reason||'Admin void').slice(0,300)}}],{session,ordered:true});
   result=sale;
  });
  res.json(result);
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});throw e;}finally{await session.endSession();}
}));
export default r;
