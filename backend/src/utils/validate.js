import mongoose from 'mongoose';
export const id=v=>mongoose.isValidObjectId(v);
export const money=v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&Math.round(v*100)===v*100;
export const positive=v=>typeof v==='number'&&Number.isFinite(v)&&v>0;
export const text=(v,max=200)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max;
export function bad(res,message='Invalid input'){return res.status(400).json({error:message});}
export function wrap(fn){return(req,res,next)=>Promise.resolve(fn(req,res,next)).catch(next);}
