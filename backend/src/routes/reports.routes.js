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

r.get('/cash-flow',wrap(async(req,res)=>{
 const {from,to}=req.query;
 const valid=v=>typeof v==='string'&&/^\\d{4}-\\d{2}-\\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'));
 if(!valid(from)||!valid(to)||from>to)return bad(res,'Valid from/to dates required');
 const start=new Date(from+'T00:00:00+08:00'),end=new Date(new Date(to+'T00:00:00+08:00').getTime()+86400000);
 if((end-start)/86400000>366)return bad(res,'Select at most 365 days');
 const [capital,expenses,stock,sales]=await Promise.all([
  CapitalTransaction.find({date:{$lt:end}}).select('date kind amount').lean(),
  Expense.find({date:{$lt:end}}).select('date amount').lean(),
  StockMovement.find({kind:'stock_in',createdAt:{$lt:end}}).select('createdAt quantityDelta unitCostSnapshot').lean(),
  DailySale.find({status:'posted',businessDate:{$lte:to}}).select('businessDate totalRevenue totalCost').lean()
 ]);
 const ph=d=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(d);
 const daily=new Map();const get=d=>{if(!daily.has(d))daily.set(d,{date:d,capitalAdded:0,withdrawals:0,purchases:0,sales:0,cogs:0,expenses:0});return daily.get(d);};
 for(const c of capital){const row=get(ph(c.date));row[c.kind==='contribution'?'capitalAdded':'withdrawals']+=c.amount;}
 for(const e of expenses)get(ph(e.date)).expenses+=e.amount;
 for(const m of stock)get(ph(m.createdAt)).purchases+=Math.abs(m.quantityDelta)*(m.unitCostSnapshot||0);
 for(const sale of sales){const row=get(sale.businessDate);row.sales+=sale.totalRevenue;row.cogs+=sale.totalCost;}
 let cash=0,capitalInvested=0;const rows=[];
 const sorted=[...daily.keys()].sort();
 for(const date of sorted){
  const d=daily.get(date),openingCash=cash;
  cash+=d.capitalAdded+d.sales-d.withdrawals-d.purchases-d.expenses;
  capitalInvested+=d.capitalAdded;
  if(date<from)continue;
  rows.push({...d,openingCash,closingCash:cash,totalCapitalInvested:capitalInvested,grossProfit:d.sales-d.cogs,netProfit:d.sales-d.cogs-d.expenses});
 }
 // Include dates without transactions, preserving the carried-forward cash balance.
 const byDate=new Map(rows.map(row=>[row.date,row]));const output=[];
 for(let day=start;day<end;day=new Date(day.getTime()+86400000)){
  const date=ph(day),record=byDate.get(date);
  if(record){cash=record.closingCash;capitalInvested=record.totalCapitalInvested;output.push(record);}
  else {
   const previous=output.at(-1);
   const openingCash=previous?previous.closingCash:sorted.filter(d=>d<date).reduce((n,d)=>{const x=daily.get(d);return n+x.capitalAdded+x.sales-x.withdrawals-x.purchases-x.expenses;},0);
   const invested=previous?previous.totalCapitalInvested:sorted.filter(d=>d<date).reduce((n,d)=>n+daily.get(d).capitalAdded,0);
   output.push({date,openingCash,closingCash:openingCash,totalCapitalInvested:invested,capitalAdded:0,withdrawals:0,purchases:0,sales:0,cogs:0,expenses:0,grossProfit:0,netProfit:0});
  }
 }
 res.json({from,to,days:output});
}));
r.get('/audit',wrap(async(_req,res)=>res.json(await AuditLog.find().sort({createdAt:-1}).limit(200).lean())));
export default r;
