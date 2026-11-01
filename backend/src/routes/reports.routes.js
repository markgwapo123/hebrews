import {Router} from 'express';
import {requireAuth,allowRoles} from '../middleware/auth.js';
import {wrap,bad} from '../utils/validate.js';
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
 if(typeof from!=='string'||typeof to!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(from)||!/^\d{4}-\d{2}-\d{2}$/.test(to)||from>to)return bad(res,'Valid from/to dates required');
 const [sales,expenses]=await Promise.all([
  DailySale.aggregate([{$match:{status:'posted',businessDate:{$gte:from,$lte:to}}},{$group:{_id:null,revenue:{$sum:'$totalRevenue'},cogs:{$sum:'$totalCost'},transactions:{$sum:1}}}]),
  Expense.aggregate([{$match:{date:{$gte:new Date(from+'T00:00:00.000Z'),$lt:new Date(new Date(to+'T00:00:00.000Z').getTime()+86400000)}}},{$group:{_id:null,total:{$sum:'$amount'}}}])
 ]);
 const revenue=sales[0]?.revenue||0,cogs=sales[0]?.cogs||0,operatingExpenses=expenses[0]?.total||0;
 res.json({from,to,revenue,cogs,grossProfit:revenue-cogs,operatingExpenses,netProfit:revenue-cogs-operatingExpenses,transactions:sales[0]?.transactions||0});
}));
r.get('/audit',wrap(async(_req,res)=>res.json(await AuditLog.find().sort({createdAt:-1}).limit(200).lean())));
export default r;
