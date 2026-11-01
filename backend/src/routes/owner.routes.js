import { Router } from 'express';
import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Recipe } from '../models/Recipe.js';
import { StockMovement } from '../models/StockMovement.js';
import { AuditLog } from '../models/AuditLog.js';
import { requireAuth,allowRoles } from '../middleware/auth.js';
import { Product } from '../models/Product.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { DailySale } from '../models/DailySale.js';
import { Expense } from '../models/Expense.js';
import { CapitalTransaction } from '../models/CapitalTransaction.js';
const router=Router();router.use(requireAuth,allowRoles('owner'));
router.get('/summary',async(req,res,next)=>{try{
 const [products,inventory,sales,expenses,capital]=await Promise.all([Product.countDocuments({active:true}),InventoryItem.find({active:true}).lean(),DailySale.aggregate([{$match:{status:'posted'}},{$group:{_id:null,revenue:{$sum:'$totalRevenue'},cogs:{$sum:'$totalCost'},unitsSold:{$sum:{$sum:'$items.quantity'}}}}]),Expense.aggregate([{$group:{_id:null,total:{$sum:'$amount'}}}]),CapitalTransaction.aggregate([{$group:{_id:'$kind',total:{$sum:'$amount'}}}])]);
 const revenue=sales[0]?.revenue||0,cogs=sales[0]?.cogs||0,operatingExpenses=expenses[0]?.total||0;
 const inventoryCostValue=inventory.reduce((sum,i)=>sum+i.quantity*i.averageUnitCost,0);
 const capitalInvested=capital.filter(c=>c._id==='contribution').reduce((sum,c)=>sum+c.total,0);
 const capitalWithdrawn=capital.filter(c=>c._id==='withdrawal').reduce((sum,c)=>sum+c.total,0);
 res.json({products,unitsSold:sales[0]?.unitsSold||0,remainingUnits:inventory.reduce((sum,i)=>sum+(Number(i.quantity)||0),0),lowStock:inventory.filter(i=>i.quantity<=i.reorderLevel).length,revenue,cogs,grossProfit:revenue-cogs,operatingExpenses,netProfit:revenue-cogs-operatingExpenses,inventoryCostValue,capitalInvested,capitalWithdrawn,netCapital:capitalInvested-capitalWithdrawn});
}catch(e){next(e);}});
router.get('/sales-trend',async(req,res,next)=>{try{
 const validDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'));
 const from=req.query.from,to=req.query.to;
 let dates=[];
 if(from!==undefined||to!==undefined){
  if(!validDate(from)||!validDate(to)||from>to)return res.status(400).json({error:'Valid from and to dates required'});
  const start=new Date(from+'T00:00:00Z'),end=new Date(to+'T00:00:00Z');
  const days=Math.round((end-start)/86400000)+1;
  if(days>31)return res.status(400).json({error:'Select up to 31 days per chart'});
  dates=Array.from({length:days},(_,i)=>new Date(start.getTime()+i*86400000).toISOString().slice(0,10));
 }else{
  const now=new Date();
  dates=Array.from({length:7},(_,i)=>new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()-(6-i))).toISOString().slice(0,10));
 }
 const results=await DailySale.aggregate([{$match:{status:'posted',businessDate:{$gte:dates[0],$lte:dates[dates.length-1]}}},{$group:{_id:'$businessDate',revenue:{$sum:'$totalRevenue'},orders:{$sum:1}}},{$sort:{_id:1}}]);
 const byDate=new Map(results.map(x=>[x._id,x]));
 res.json(dates.map(date=>({date,revenue:byDate.get(date)?.revenue||0,entries:byDate.get(date)?.orders||0})));
}catch(e){next(e);}});
// Owner-only reset for TEST data. Keeps user accounts and credentials intact.
// Requires an explicit confirmation phrase; deletes business records atomically.
router.post('/reset-business-data',async(req,res,next)=>{
 if(req.body?.confirmation!=='RESET HEBREWS DATA')return res.status(400).json({error:'Confirmation phrase does not match'});
 const session=await mongoose.startSession();
 try{
  await session.withTransaction(async()=>{
   for(const Model of [DailySale,Expense,CapitalTransaction,StockMovement,Recipe,Product,Category,InventoryItem,AuditLog]){
    await Model.deleteMany({}, {session});
   }
  });
  res.json({message:'Business data reset successfully. User accounts were preserved.'});
 }catch(e){next(e);}finally{await session.endSession();}
});
export default router;
