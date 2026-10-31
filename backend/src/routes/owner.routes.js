import { Router } from 'express';
import { requireAuth,allowRoles } from '../middleware/auth.js';
import { Product } from '../models/Product.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { DailySale } from '../models/DailySale.js';
import { Expense } from '../models/Expense.js';
import { CapitalTransaction } from '../models/CapitalTransaction.js';
const router=Router();router.use(requireAuth,allowRoles('owner'));
router.get('/summary',async(req,res,next)=>{try{
 const [products,inventory,sales,expenses,capital]=await Promise.all([Product.countDocuments({active:true}),InventoryItem.find({active:true}).lean(),DailySale.aggregate([{$match:{status:'posted'}},{$group:{_id:null,revenue:{$sum:'$totalRevenue'},cogs:{$sum:'$totalCost'}}}]),Expense.aggregate([{$group:{_id:null,total:{$sum:'$amount'}}}]),CapitalTransaction.aggregate([{$group:{_id:'$kind',total:{$sum:'$amount'}}}])]);
 const revenue=sales[0]?.revenue||0,cogs=sales[0]?.cogs||0,operatingExpenses=expenses[0]?.total||0;
 const inventoryCostValue=inventory.reduce((sum,i)=>sum+i.quantity*i.averageUnitCost,0);
 const capitalInvested=capital.filter(c=>c._id==='contribution').reduce((sum,c)=>sum+c.total,0);
 const capitalWithdrawn=capital.filter(c=>c._id==='withdrawal').reduce((sum,c)=>sum+c.total,0);
 res.json({products,lowStock:inventory.filter(i=>i.quantity<=i.reorderLevel).length,revenue,cogs,grossProfit:revenue-cogs,operatingExpenses,netProfit:revenue-cogs-operatingExpenses,inventoryCostValue,capitalInvested,capitalWithdrawn,netCapital:capitalInvested-capitalWithdrawn});
}catch(e){next(e);}});
router.get('/sales-trend',async(req,res,next)=>{try{
 const days=7;
 const now=new Date();
 const dates=Array.from({length:days},(_,i)=>{const d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-(days-1-i)));return d.toISOString().slice(0,10);});
 const results=await DailySale.aggregate([{$match:{status:'posted',businessDate:{$gte:dates[0],$lte:dates[days-1]}}},{$group:{_id:'$businessDate',revenue:{$sum:'$totalRevenue'},orders:{$sum:1}}},{$sort:{_id:1}}]);
 const byDate=new Map(results.map(x=>[x._id,x]));
 res.json(dates.map(date=>({date,revenue:byDate.get(date)?.revenue||0,entries:byDate.get(date)?.orders||0})));
}catch(e){next(e);}});
export default router;
