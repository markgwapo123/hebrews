import {Router} from 'express';
import mongoose from 'mongoose';
import {requireAuth,allowRoles} from '../middleware/auth.js';
import {wrap,id,positive,money,bad} from '../utils/validate.js';
import {InventoryItem} from '../models/InventoryItem.js';
import {StockMovement} from '../models/StockMovement.js';
import {AuditLog} from '../models/AuditLog.js';
const r=Router();r.use(requireAuth,allowRoles('owner'));
r.get('/movements',wrap(async(req,res)=>{
 const query={};if(req.query.item){if(!id(req.query.item))return bad(res);query.item=req.query.item;}
 res.json(await StockMovement.find(query).sort({createdAt:-1}).limit(200).lean());
}));
r.post('/receive',wrap(async(req,res)=>{
 const {itemId,quantity,unitCost}=req.body||{};
 if(!id(itemId)||!positive(quantity)||!money(unitCost))return bad(res);
 const session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{
  const item=await InventoryItem.findOne({_id:itemId,active:true}).session(session);
  if(!item)throw Object.assign(new Error('Inventory item not found'),{status:404});
  if(item.unit==='pcs'&&!Number.isSafeInteger(quantity))throw Object.assign(new Error('Piece-based stock-in must use a whole number'),{status:400});
  const before=item.quantity,after=before+quantity;
  item.averageUnitCost=Math.round(((before*item.averageUnitCost)+(quantity*unitCost))/after*10000)/10000;
  item.quantity=after;await item.save({session});
  const [movement]=await StockMovement.create([{item:item._id,kind:'stock_in',quantityDelta:quantity,unitCostSnapshot:unitCost,createdBy:req.user._id}],{session,ordered:true});
  await AuditLog.create([{actor:req.user._id,action:'stock.receive',entity:'InventoryItem',entityId:item._id,details:{quantity,unitCost}}],{session,ordered:true});
  result={item,movement};
 });res.status(201).json(result);
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});throw e;}finally{await session.endSession();}
}));
r.post('/adjust',wrap(async(req,res)=>{
 const {itemId,quantityDelta,reason}=req.body||{};
 if(!id(itemId)||!Number.isFinite(quantityDelta)||quantityDelta===0||typeof reason!=='string'||reason.trim().length<5)return bad(res,'Adjustment and reason required');
 const session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{
  const item=await InventoryItem.findOne({_id:itemId,active:true}).session(session);
  if(!item)throw Object.assign(new Error('Inventory item not found'),{status:404});
  if(item.unit==='pcs'&&!Number.isSafeInteger(quantityDelta))throw Object.assign(new Error('Piece-based adjustment must use a whole number'),{status:400});
  if(item.quantity+quantityDelta<0)throw Object.assign(new Error('Insufficient stock'),{status:409});
  item.quantity+=quantityDelta;await item.save({session});
  const [movement]=await StockMovement.create([{item:item._id,kind:quantityDelta<0?'waste':'adjustment',quantityDelta,reason:reason.trim(),unitCostSnapshot:item.averageUnitCost,createdBy:req.user._id}],{session,ordered:true});
  await AuditLog.create([{actor:req.user._id,action:'stock.adjust',entity:'InventoryItem',entityId:item._id,details:{quantityDelta,reason}}],{session,ordered:true});
  result={item,movement};
 });res.json(result);
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});throw e;}finally{await session.endSession();}
}));

r.post('/count',wrap(async(req,res)=>{
 const {itemId,actualQuantity,reason='Physical stock count'}=req.body||{};
 if(!id(itemId)||typeof actualQuantity!=='number'||!Number.isFinite(actualQuantity)||actualQuantity<0||typeof reason!=='string'||reason.trim().length<3||reason.length>300)return bad(res,'Valid actual quantity and reason required');
 const session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{
  const item=await InventoryItem.findOne({_id:itemId,active:true}).session(session);
  if(!item)throw Object.assign(new Error('Inventory item not found'),{status:404});
  if(item.unit==='pcs'&&!Number.isSafeInteger(actualQuantity))throw Object.assign(new Error('Piece-based stock count must be a whole number'),{status:400});
  const expectedQuantity=item.quantity,quantityDelta=actualQuantity-expectedQuantity;
  item.quantity=actualQuantity;await item.save({session});
  const [movement]=await StockMovement.create([{item:item._id,kind:'adjustment',quantityDelta,reason:'Physical count: '+reason.trim(),unitCostSnapshot:item.averageUnitCost,createdBy:req.user._id}],{session,ordered:true});
  await AuditLog.create([{actor:req.user._id,action:'stock.count',entity:'InventoryItem',entityId:item._id,details:{expectedQuantity,actualQuantity,quantityDelta,reason:reason.trim(),movementId:movement._id}}],{session,ordered:true});
  result={item,movement,expectedQuantity,actualQuantity,quantityDelta,calculatedStockOut:Math.max(0,-quantityDelta),positiveAdjustment:Math.max(0,quantityDelta)};
 });res.status(201).json(result);
 }catch(e){if(e.status)return res.status(e.status).json({error:e.message});throw e;}finally{await session.endSession();}
}));
export default r;
