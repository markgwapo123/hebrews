import mongoose from 'mongoose';
const itemSchema=new mongoose.Schema({
 product:{type:mongoose.Schema.Types.ObjectId,ref:'Product',required:true},
 quantity:{type:Number,required:true,min:1},
 unitPriceSnapshot:{type:Number,required:true,min:0},
 unitCostSnapshot:{type:Number,required:true,min:0},
 lineRevenue:{type:Number,required:true,min:0},
 lineCost:{type:Number,required:true,min:0}
},{_id:false});
const schema=new mongoose.Schema({
 businessDate:{type:String,required:true,match:/^\d{4}-\d{2}-\d{2}$/},
 entryKey:{type:String,required:true,unique:true},
 items:{type:[itemSchema],required:true},
 totalRevenue:{type:Number,required:true,min:0},
 totalCost:{type:Number,required:true,min:0},
 recordedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User',required:true},
 status:{type:String,enum:['posted','void'],default:'posted'}
},{timestamps:true});
schema.index({businessDate:1,createdAt:-1});
export const DailySale=mongoose.model('DailySale',schema);
