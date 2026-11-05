import {Router} from 'express';
import {requireAuth,allowRoles} from '../middleware/auth.js';
import {wrap,bad} from '../utils/validate.js';
import {calculateCashFlow} from '../utils/cash-flow.js';
import {DailySale} from '../models/DailySale.js';
import {Expense} from '../models/Expense.js';
import {AuditLog} from '../models/AuditLog.js';
import {CapitalTransaction} from '../models/CapitalTransaction.js';
import {Product} from '../models/Product.js';
import {StockMovement} from '../models/StockMovement.js';
const r=Router();r.use(requireAuth,allowRoles('owner'));
r.get('/overview',wrap(async(_req,res)=>{
 const [sales,expenses,capital,byProduct,stockCosts]=await Promise.all([
  DailySale.aggregate([{$match:{status:'posted'}},{$group:{_id:null,revenue:{$sum:'$totalRevenue'},cogs:{$sum:'$totalCost'},transactions:{$sum:1},unitsSold:{$sum:{$sum:'$items.quantity'}}}}]),
  Expense.aggregate([{$group:{_id:null,total:{$sum:'$amount'}}}]),
  CapitalTransaction.aggregate([{$group:{_id:'$kind',total:{$sum:'$amount'}}}]),
  DailySale.aggregate([{$match:{status:'posted'}},{$unwind:'$items'},{$group:{_id:'$items.product',quantitySold:{$sum:'$items.quantity'},revenue:{$sum:'$items.lineRevenue'},cost:{$sum:'$items.lineCost'}}},{$sort:{quantitySold:-1}}]),
  StockMovement.aggregate([{$match:{kind:{$in:['stock_in','waste']}}},{$group:{_id:'$kind',total:{$sum:{$multiply:[{$abs:'$quantityDelta'},{$ifNull:['$unitCostSnapshot',0]}]}}}}])
 ]);
 const productIds=byProduct.map(p=>p._id);
 const names=await Product.find({_id:{$in:productIds}}).select('name').lean();
 const nameMap=new Map(names.map(p=>[String(p._id),p.name]));
 const revenue=sales[0]?.revenue||0,cogs=sales[0]?.cogs||0,operatingExpenses=expenses[0]?.total||0;
 const purchases=stockCosts.find(x=>x._id==='stock_in')?.total||0,inventoryLoss=stockCosts.find(x=>x._id==='waste')?.total||0;
 const capitalInvested=capital.find(c=>c._id==='contribution')?.total||0;
 const capitalWithdrawn=capital.find(c=>c._id==='withdrawal')?.total||0;
 res.json({capitalInvested,capitalWithdrawn,netCapital:capitalInvested-capitalWithdrawn,
  revenue,cogs,grossProfit:revenue-cogs,operatingExpenses,purchases,inventoryLoss,netProfit:revenue-cogs-operatingExpenses-inventoryLoss,margin:revenue?(revenue-cogs)/revenue*100:0,
  transactions:sales[0]?.transactions||0,unitsSold:sales[0]?.unitsSold||0,
  products:byProduct.map(p=>({id:p._id,name:nameMap.get(String(p._id))||'Deleted product',quantitySold:p.quantitySold,revenue:p.revenue,grossProfit:p.revenue-p.cost}))});
}));
r.get('/financial',wrap(async(req,res)=>{
 const {from,to}=req.query;
 const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 if(!validDate(from)||!validDate(to)||from>to)return bad(res,'Valid from/to dates required');
 const [sales,expenses,losses]=await Promise.all([
  DailySale.aggregate([{$match:{status:'posted',businessDate:{$gte:from,$lte:to}}},{$group:{_id:null,revenue:{$sum:'$totalRevenue'},cogs:{$sum:'$totalCost'},transactions:{$sum:1}}}]),
  Expense.aggregate([{$match:{date:{$gte:new Date(from+'T00:00:00+08:00'),$lt:new Date(new Date(to+'T00:00:00+08:00').getTime()+86400000)}}},{$group:{_id:null,total:{$sum:'$amount'}}}]),
  StockMovement.aggregate([{$match:{kind:'waste',createdAt:{$gte:new Date(from+'T00:00:00+08:00'),$lt:new Date(new Date(to+'T00:00:00+08:00').getTime()+86400000)}}},{$group:{_id:null,total:{$sum:{$multiply:[{$abs:'$quantityDelta'},{$ifNull:['$unitCostSnapshot',0]}]}}}}])
 ]);
 const revenue=sales[0]?.revenue||0,cogs=sales[0]?.cogs||0,operatingExpenses=expenses[0]?.total||0,inventoryLoss=losses[0]?.total||0;
 res.json({from,to,revenue,cogs,grossProfit:revenue-cogs,operatingExpenses,inventoryLoss,netProfit:revenue-cogs-operatingExpenses-inventoryLoss,transactions:sales[0]?.transactions||0});
}));

r.get('/cash-flow',wrap(async(req,res)=>{
 const {from,to}=req.query;
 const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 if(!valid(from)||!valid(to)||from>to)return bad(res,'Valid from/to dates required');
 const start=new Date(from+'T00:00:00+08:00');
 const end=new Date(new Date(to+'T00:00:00+08:00').getTime()+86400000);
 if((end-start)/86400000>365)return bad(res,'Select at most 365 days');
 const [capital,expenses,stock,sales]=await Promise.all([
  CapitalTransaction.find({date:{$lt:end}}).select('date kind amount').lean(),
  Expense.find({date:{$lt:end}}).select('date amount').lean(),
  StockMovement.find({kind:'stock_in',createdAt:{$lt:end}}).select('createdAt quantityDelta unitCostSnapshot').lean(),
  DailySale.find({status:'posted',businessDate:{$lte:to}}).select('businessDate totalRevenue totalCost').lean()
 ]);
 const days=calculateCashFlow({from,to,capital,expenses,stock,sales});
 res.json({from,to,days});
}));
r.get('/audit',wrap(async(_req,res)=>res.json(await AuditLog.find().sort({createdAt:-1}).limit(200).lean())));
export default r;
