import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';
const router=Router();
router.post('/login',async(req,res,next)=>{
 try{
  const email=String(req.body?.email||'').trim().toLowerCase();
  const password=req.body?.password;
  if(!email||typeof password!=='string')return res.status(400).json({error:'Email and password required'});
  const user=await User.findOne({email,active:true}).select('+passwordHash');
  if(!user||user.role!=='owner'||!await bcrypt.compare(password,user.passwordHash))return res.status(401).json({error:'Invalid credentials'});
  if(!process.env.JWT_SECRET||process.env.JWT_SECRET.length<32)return res.status(503).json({error:'Authentication not configured'});
  const token=jwt.sign({sub:user.id,role:user.role},process.env.JWT_SECRET,{expiresIn:'8h',algorithm:'HS256'});
  return res.json({token,user:{id:user.id,name:user.name,email:user.email,role:user.role}});
 }catch(error){next(error);}
});
router.get('/me',requireAuth,(req,res)=>res.json({id:req.user.id,role:req.user.role}));
export default router;
