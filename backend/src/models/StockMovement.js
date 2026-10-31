import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 item:{type:mongoose.Schema.Types.ObjectId,ref:'InventoryItem',required:true},
 kind:{type:String,enum:['stock_in','sale','waste','adjustment'],required:true},
 quantityDelta:{type:Number,required:true},
 unitCostSnapshot:{type:Number,min:0},
 referenceId:{type:mongoose.Schema.Types.ObjectId},
 reason:{type:String,default:''},createdBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}
},{timestamps:true});
schema.index({item:1,createdAt:-1});
export const StockMovement=mongoose.model('StockMovement',schema);
