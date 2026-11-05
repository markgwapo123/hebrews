import mongoose from 'mongoose';
const component=new mongoose.Schema({inventoryItem:{type:mongoose.Schema.Types.ObjectId,ref:'InventoryItem',required:true},quantity:{type:Number,required:true,min:0.000001}},{_id:false});
const schema=new mongoose.Schema({
 product:{type:mongoose.Schema.Types.ObjectId,ref:'Product',required:true},
 sizeOz:{type:Number,required:true,enum:[6,12,16,22]},
 sellingPrice:{type:Number,required:true,min:0},
 ingredients:{type:[component],default:[]},
 packaging:{type:[component],default:[]},
 active:{type:Boolean,default:true}
},{timestamps:true});
schema.index({product:1,sizeOz:1},{unique:true});
export const ProductVariant=mongoose.model('ProductVariant',schema);
