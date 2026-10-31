import mongoose from 'mongoose';
const component=new mongoose.Schema({inventoryItem:{type:mongoose.Schema.Types.ObjectId,ref:'InventoryItem',required:true},quantity:{type:Number,required:true,min:0.000001}},{_id:false});
const schema=new mongoose.Schema({
 product:{type:mongoose.Schema.Types.ObjectId,ref:'Product',required:true,unique:true},
 ingredients:{type:[component],default:[]},packaging:{type:[component],default:[]}
},{timestamps:true});
export const Recipe=mongoose.model('Recipe',schema);
