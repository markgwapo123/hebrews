import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
export async function requireAuth(req,res,next){
 try {
  const token=req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
  if(!token)return res.status(401).json({error:'Authentication required'});
  const payload=jwt.verify(token,process.env.JWT_SECRET,{algorithms:['HS256']});
  const user=await User.findById(payload.sub).select('_id role active');
  if(!user?.active||user.role!=='owner')return res.status(403).json({error:'Owner access required'});
  req.user=user;next();
 }catch(error){return res.status(401).json({error:'Invalid or expired token'});}
}
export function allowRoles(...roles){return(req,res,next)=>roles.includes(req.user?.role)?next():res.status(403).json({error:'Forbidden'});}
