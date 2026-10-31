import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 name:{type:String,required:true,trim:true},
 kind:{type:String,enum:['ingredient','packaging','ready_made'],required:true},
 unit:{type:String,enum:['g','kg','ml','l','pcs'],required:true},
 sizeOz:{type:Number,min:0},sku:{type:String,unique:true,sparse:true},
 quantity:{type:Number,required:true,default:0,min:0},
 averageUnitCost:{type:Number,default:0,min:0},
 reorderLevel:{type:Number,default:0,min:0},active:{type:Boolean,default:true}
},{timestamps:true});
export const InventoryItem=mongoose.model('InventoryItem',schema);
