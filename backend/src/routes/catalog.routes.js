import { Router } from 'express';
import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { AuditLog } from '../models/AuditLog.js';
import { requireAuth,allowRoles } from '../middleware/auth.js';
import { wrap,id,money,text,bad } from '../utils/validate.js';
const router=Router();router.use(requireAuth);
router.get('/categories',wrap(async(_req,res)=>res.json(await Category.find({active:true}).sort({name:1}).lean())));
router.post('/categories',allowRoles('owner'),wrap(async(req,res)=>{
 const name=req.body?.name;if(!text(name,100))return bad(res);
 const x=await Category.create({name:name.trim(),description:String(req.body?.description||'').slice(0,500)});
 await AuditLog.create({actor:req.user._id,action:'category.create',entity:'Category',entityId:x._id});res.status(201).json(x);
}));
router.get('/products',wrap(async(_req,res)=>res.json(await Product.find({active:true}).populate('category','name').sort({name:1}).lean())));
router.post('/products',allowRoles('owner'),wrap(async(req,res)=>{
 const {name,category,kind,sellingPrice,purchaseCost=0,inventoryItem}=req.body||{};
 if(!text(name,150)||!id(category)||!['prepared','ready_made'].includes(kind)||!money(sellingPrice)||!money(purchaseCost))return bad(res);
 if(!await Category.exists({_id:category,active:true}))return bad(res,'Category not found');
 if(kind==='ready_made'&&(!id(inventoryItem)||!await InventoryItem.exists({_id:inventoryItem,kind:'ready_made',active:true})))return bad(res,'Ready-made inventory item required');
 const x=await Product.create({name:name.trim(),category,kind,sellingPrice,purchaseCost,inventoryItem:kind==='ready_made'?inventoryItem:null});
 await AuditLog.create({actor:req.user._id,action:'product.create',entity:'Product',entityId:x._id});res.status(201).json(x);
}));
export default router;
