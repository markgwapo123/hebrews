import mongoose from 'mongoose';
const schema=new mongoose.Schema({date:{type:Date,required:true},category:{type:String,required:true},description:String,amount:{type:Number,required:true,min:0},recordedBy:{type:mongoose.Schema.Types.ObjectId,ref:'User'}},{timestamps:true});
export const Expense=mongoose.model('Expense',schema);
