import 'dotenv/config';
import mongoose from 'mongoose';
import dns from 'node:dns';
import { isIP } from 'node:net';
import { Category } from '../models/Category.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { Product } from '../models/Product.js';

// Explicit opt-in: npm run seed-sample-products -- --apply
// Creates sample ready-made items with linked stock. Does not modify existing products.
const samples = [
 ['Iced Coffee','Beverages',95,35,32],
 ['Chicken Rice Meal','Rice Meals',149,78,20],
 ['Cheesecake','Desserts',120,48,16],
 ['Hot Latte','Beverages',85,30,25],
 ['French Fries','Snacks',79,29,30],
 ['Bottled Water','Beverages',25,10,40],
 ['Iced Matcha Latte','Beverages',110,42,24],
 ['Burger Steak','Rice Meals',135,70,20],
 ['Chocolate Frappe','Beverages',125,49,22],
 ['Spaghetti','Rice Meals',99,45,18]
];
if (!process.argv.includes('--apply')) {
 console.log('PREVIEW ONLY. To add 10 sample products to your configured database, run: npm run seed-sample-products -- --apply');
 samples.forEach(([name,category,price,cost,quantity])=>console.log(name,category,'₱'+price,'cost ₱'+cost,'stock '+quantity));
 process.exit(0);
}
if (!process.env.MONGODB_URI) { console.error('Missing MONGODB_URI'); process.exit(1); }
const servers=process.env.MONGODB_DNS_SERVERS?.split(',').map(x=>x.trim()).filter(Boolean);
dns.setServers(servers?.length&&servers.every(isIP)?servers:['8.8.8.8','1.1.1.1']);
try {
 await mongoose.connect(process.env.MONGODB_URI,{dbName:process.env.MONGODB_DB_NAME||'hebrews_db',serverSelectionTimeoutMS:12000});
 let created=0,skipped=0;
 for (const [name,categoryName,price,cost,quantity] of samples) {
  if (await Product.exists({name,active:true})) { console.log('SKIP existing:',name);skipped++;continue; }
  let category=await Category.findOne({name:categoryName});
  if (!category) category=await Category.create({name:categoryName,description:'Sample product category'});
  else if (!category.active) { console.log('SKIP inactive category:',name);skipped++;continue; }
  const stockName='DEMO - '+name+' Stock';
  let inventory=await InventoryItem.findOne({name:stockName,kind:'ready_made'});
  if (inventory && (inventory.unit!=='pcs'||!inventory.active||await Product.exists({inventoryItem:inventory._id,active:true}))) {
   console.log('SKIP stock conflict:',name);skipped++;continue;
  }
  if (!inventory) inventory=await InventoryItem.create({name:stockName,kind:'ready_made',unit:'pcs',quantity,averageUnitCost:cost,reorderLevel:5});
  await Product.create({name,category:category._id,kind:'ready_made',sellingPrice:price,purchaseCost:0,inventoryItem:inventory._id});
  console.log('ADDED:',name);created++;
 }
 console.log('Completed. Created:',created,'Skipped:',skipped);
} catch(e) { console.error('Sample seed failed:',e.message);process.exitCode=1; }
finally { await mongoose.disconnect().catch(()=>{}); }
