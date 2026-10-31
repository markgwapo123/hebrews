import {Router} from 'express';
import {requireAuth,allowRoles} from '../middleware/auth.js';
import {wrap,money,text,bad} from '../utils/validate.js';
import {Expense} from '../models/Expense.js';
import {CapitalTransaction} from '../models/CapitalTransaction.js';
import {AuditLog} from '../models/AuditLog.js';
const r=Router();r.use(requireAuth,allowRoles('owner'));
r.get('/expenses',wrap(async(_req,res)=>res.json(await Expense.find().sort({date:-1}).limit(500).lean())));
r.post('/expenses',wrap(async(req,res)=>{
 const {date,category,description='',amount}=req.body||{};
 if(!date||!Number.isFinite(new Date(date).getTime())||!text(category,100)||!money(amount)||amount===0||typeof description!=='string'||description.length>1000)return bad(res);
 const x=await Expense.create({date:new Date(date),category:category.trim(),description,amount,recordedBy:req.user._id});
 await AuditLog.create({actor:req.user._id,action:'expense.create',entity:'Expense',entityId:x._id,details:{amount}});res.status(201).json(x);
}));
r.get('/capital',wrap(async(_req,res)=>res.json(await CapitalTransaction.find().sort({date:-1}).limit(500).lean())));
r.post('/capital',wrap(async(req,res)=>{
 const {date,kind,amount,note=''}=req.body||{};
 if(!date||!Number.isFinite(new Date(date).getTime())||!['contribution','withdrawal'].includes(kind)||!money(amount)||amount===0||typeof note!=='string'||note.length>1000)return bad(res);
 const x=await CapitalTransaction.create({date:new Date(date),kind,amount,note,recordedBy:req.user._id});
 await AuditLog.create({actor:req.user._id,action:'capital.create',entity:'CapitalTransaction',entityId:x._id,details:{kind,amount}});res.status(201).json(x);
}));
export default r;
