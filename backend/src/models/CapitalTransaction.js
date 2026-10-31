import mongoose from 'mongoose';
const schema=new mongoose.Schema({date:{type:Date,required:true},kind:{type:String,enum:['contribution','withdrawal'],required:true},amount:{type:Number,required:true,min:0},note:String,recordedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}},{timestamps:true});
export const CapitalTransaction=mongoose.model('CapitalTransaction',schema);
