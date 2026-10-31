import {Router} from 'express';
import {requireAuth,allowRoles} from '../middleware/auth.js';
import {wrap,bad} from '../utils/validate.js';
import {DailySale} from '../models/DailySale.js';
import {Expense} from '../models/Expense.js';
import {AuditLog} from '../models/AuditLog.js';
const r=Router();r.use(requireAuth,allowRoles('owner'));
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
