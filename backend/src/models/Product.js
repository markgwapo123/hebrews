import mongoose from 'mongoose';
const schema=new mongoose.Schema({
 name:{type:String,required:true,trim:true},
 category:{type:mongoose.Schema.Types.ObjectId,ref:'Category',required:true},
 kind:{type:String,enum:['prepared','ready_made'],required:true},
 inventoryItem:{type:mongoose.Schema.Types.ObjectId,ref:'InventoryItem',default:null},
 sellingPrice:{type:Number,required:true,min:0},purchaseCost:{type:Number,min:0,default:0},
 imageUrl:{type:String,default:''},sku:{type:String,trim:true,sparse:true,unique:true},
 manuallyUnavailable:{type:Boolean,default:false},active:{type:Boolean,default:true}
},{timestamps:true});
schema.index({name:1,category:1});
schema.path('inventoryItem').validate(function(value){return this.kind!=='ready_made'||Boolean(value);},'Ready-made products require linked inventory');
export const Product=mongoose.model('Product',schema);
