import {Router} from 'express';
import {requireAuth,allowRoles} from '../middleware/auth.js';
import {wrap,id,money,positive,text,bad} from '../utils/validate.js';
import {Product} from '../models/Product.js';
import {Category} from '../models/Category.js';
import {InventoryItem} from '../models/InventoryItem.js';
import {Recipe} from '../models/Recipe.js';
import {AuditLog} from '../models/AuditLog.js';
const r=Router();r.use(requireAuth,allowRoles('owner'));
const audit=(req,action,entity,entityId,details)=>AuditLog.create({actor:req.user._id,action,entity,entityId,details});
r.patch('/categories/:id',wrap(async(req,res)=>{
 if(!id(req.params.id))return bad(res);
 const changes={};if(req.body.name!==undefined){if(!text(req.body.name,100))return bad(res);changes.name=req.body.name.trim();}
 if(req.body.description!==undefined)changes.description=String(req.body.description).slice(0,500);
 if(typeof req.body.active==='boolean')changes.active=req.body.active;
 const x=await Category.findByIdAndUpdate(req.params.id,{$set:changes},{new:true,runValidators:true});if(!x)return res.sendStatus(404);
 await audit(req,'category.update','Category',x._id,changes);res.json(x);
}));
r.patch('/products/:id',wrap(async(req,res)=>{
 if(!id(req.params.id))return bad(res);
 const changes={};for(const key of ['name','sellingPrice','purchaseCost','imageUrl','manuallyUnavailable','active','category']){
  if(req.body[key]===undefined)continue;
  const v=req.body[key];
  if(key==='name'&&!text(v,150)||['sellingPrice','purchaseCost'].includes(key)&&!money(v)||key==='category'&&!id(v)||key==='imageUrl'&&(typeof v!=='string'||v.length>1000)||['manuallyUnavailable','active'].includes(key)&&typeof v!=='boolean')return bad(res);
  changes[key]=key==='name'?v.trim():v;
 }
 if(changes.category&&!await Category.exists({_id:changes.category,active:true}))return bad(res,'Unknown category');
 const x=await Product.findByIdAndUpdate(req.params.id,{$set:changes},{new:true,runValidators:true});if(!x)return res.sendStatus(404);
 await audit(req,'product.update','Product',x._id,changes);res.json(x);
}));
r.patch('/products/:id/link-inventory',wrap(async(req,res)=>{
 if(!id(req.params.id)||!id(req.body?.inventoryItem))return bad(res,'Select a valid inventory item');
 const item=await InventoryItem.findOne({_id:req.body.inventoryItem,kind:'ready_made',unit:'pcs',active:true});
 if(!item)return bad(res,'Select an active ready-made inventory item measured in pcs');
 const product=await Product.findById(req.params.id);
 if(!product||!product.active)return res.status(404).json({error:'Product not found'});
 if(await Recipe.exists({product:product._id}))return res.status(409).json({error:'This product has a recipe. Remove or manage its recipe before linking finished stock.'});
 const existing=await Product.findOne({_id:{$ne:product._id},inventoryItem:item._id,active:true});
 if(existing)return res.status(409).json({error:'This inventory item is already linked to another product'});
 product.inventoryItem=item._id;
 product.kind='ready_made';
 await product.save();
 await audit(req,'product.link_inventory','Product',product._id,{inventoryItem:item._id});
 res.json(product);
}));
r.post('/inventory-items',wrap(async(req,res)=>{
 const {name,kind,unit,sizeOz,reorderLevel=0,sku}=req.body||{};
 if(!text(name,150)||!['ingredient','packaging','ready_made'].includes(kind)||!['g','kg','ml','l','pcs'].includes(unit)||!money(reorderLevel)||sizeOz!==undefined&&!positive(sizeOz))return bad(res);
 const x=await InventoryItem.create({name:name.trim(),kind,unit,sizeOz,reorderLevel,...(sku?{sku}: {})});
 await audit(req,'inventory.create','InventoryItem',x._id,{name:x.name,kind});res.status(201).json(x);
}));
r.patch('/inventory-items/:id',wrap(async(req,res)=>{
 if(!id(req.params.id))return bad(res);
 const changes={};if(req.body.reorderLevel!==undefined){if(!money(req.body.reorderLevel))return bad(res);changes.reorderLevel=req.body.reorderLevel;}
 if(req.body.name!==undefined){if(!text(req.body.name,150))return bad(res);changes.name=req.body.name.trim();}
 if(typeof req.body.active==='boolean')changes.active=req.body.active;
 const x=await InventoryItem.findByIdAndUpdate(req.params.id,{$set:changes},{new:true,runValidators:true});if(!x)return res.sendStatus(404);
 await audit(req,'inventory.update','InventoryItem',x._id,changes);res.json(x);
}));
r.get('/recipes',wrap(async(_req,res)=>res.json(await Recipe.find().populate('product','name').populate('ingredients.inventoryItem','name unit').populate('packaging.inventoryItem','name unit').lean())));
r.put('/recipes/:productId',wrap(async(req,res)=>{
 if(!id(req.params.productId))return bad(res);
 const product=await Product.findById(req.params.productId);
 if(!product||product.kind!=='prepared')return bad(res,'Prepared product required');
 const ingredients=req.body?.ingredients,packaging=req.body?.packaging;
 if(!Array.isArray(ingredients)||!Array.isArray(packaging)||ingredients.length+packaging.length===0)return bad(res,'Recipe components required');
 const all=[...ingredients,...packaging],keys=new Set();
 for(const c of all){if(!id(c.inventoryItem)||!positive(c.quantity)||keys.has(String(c.inventoryItem)))return bad(res,'Invalid or duplicate recipe component');keys.add(String(c.inventoryItem));}
 const items=await InventoryItem.find({_id:{$in:[...keys]},active:true});
 if(items.length!==keys.size)return bad(res,'Inventory item missing');
 const kinds=new Map(items.map(i=>[String(i._id),i.kind]));
 if(ingredients.some(c=>kinds.get(String(c.inventoryItem))!=='ingredient')||packaging.some(c=>kinds.get(String(c.inventoryItem))!=='packaging'))return bad(res,'Incorrect component type');
 const x=await Recipe.findOneAndUpdate({product:product._id},{$set:{ingredients,packaging}},{new:true,upsert:true,runValidators:true});
 await audit(req,'recipe.update','Recipe',x._id,{product:product.id});res.json(x);
}));
export default r;
