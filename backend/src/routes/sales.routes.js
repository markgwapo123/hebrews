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
  const lines=items.map(entry=>{
   const product=products.find(p=>String(p._id)===entry.productId);
   const qty=entry.quantity;
   const unitPriceSnapshot=Number(product.sellingPrice)||0;
   const unitCostSnapshot=Number(product.purchaseCost)||0;
   return {product:product._id,quantity:qty,unitPriceSnapshot,unitCostSnapshot,
    lineRevenue:Math.round(unitPriceSnapshot*qty*100)/100,
    lineCost:Math.round(unitCostSnapshot*qty*100)/100};
  });
  const totalRevenue=Math.round(lines.reduce((s,l)=>s+l.lineRevenue,0)*100)/100;
  const totalCost=Math.round(lines.reduce((s,l)=>s+l.lineCost,0)*100)/100;
  [saved]=await DailySale.create([{businessDate,entryKey,items:lines,totalRevenue,totalCost,recordedBy:req.user._id}],{session,ordered:true});
  await AuditLog.create([{actor:req.user._id,action:'sale.post',entity:'DailySale',entityId:saved._id,details:{businessDate,entryKey,totalRevenue,totalCost}}],{session,ordered:true});
 });
 res.status(201).json(saved);
 }catch(e){if(e.code===11000)return res.status(409).json({error:'Entry key already posted'});if(e.status)return res.status(e.status).json({error:e.message});throw e;}finally{await session.endSession();}
}));
export default r;
