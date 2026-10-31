import mongoose from 'mongoose';
const schema=new mongoose.Schema({actor:{type:mongoose.Schema.Types.ObjectId,ref:'User'},action:{type:String,required:true},entity:{type:String,required:true},entityId:{type:mongoose.Schema.Types.ObjectId},details:{type:mongoose.Schema.Types.Mixed}},{timestamps:true});
schema.index({createdAt:-1});
export const AuditLog=mongoose.model('AuditLog',schema);
