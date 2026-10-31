import { Router } from 'express';
import mongoose from 'mongoose';
import { Category } from '../models/Category.js';
import { Product } from '../models/Product.js';
import { requireAuth,allowRoles } from '../middleware/auth.js';
const router=Router();
router.use(requireAuth);
router.get('/categories',async(req,res,next)=>{try{res.json(await Category.find({active:true}).sort({name:1}).lean());}catch(e){next(e);}});
router.post('/categories',allowRoles('owner'),async(req,res,next)=>{
 try{const name=String(req.body?.name||'').trim();if(!name||name.length>100)return res.status(400).json({error:'Invalid category name'});
 const category=await Category.create({name,description:String(req.body?.description||'').slice(0,500)});res.status(201).json(category);
 }catch(e){next(e);}
});
router.get('/products',async(req,res,next)=>{try{res.json(await Product.find({active:true}).populate('category','name').sort({name:1}).lean());}catch(e){next(e);}});
router.post('/products',allowRoles('owner'),async(req,res,next)=>{
 try{
 const {name,category,kind,sellingPrice,purchaseCost=0}=req.body||{};
 if(typeof name!=='string'||!name.trim()||name.length>150||!mongoose.isValidObjectId(category)||!['prepared','ready_made'].includes(kind)||!Number.isFinite(sellingPrice)||sellingPrice<0||!Number.isFinite(purchaseCost)||purchaseCost<0)return res.status(400).json({error:'Invalid product data'});
 if(!await Category.exists({_id:category,active:true}))return res.status(400).json({error:'Category not found'});
 const product=await Product.create({name:name.trim(),category,kind,sellingPrice,purchaseCost});res.status(201).json(product);
 }catch(e){next(e);}
});
export default router;
