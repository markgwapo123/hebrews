import { Router } from 'express';
import { requireAuth,allowRoles } from '../middleware/auth.js';
import { Product } from '../models/Product.js';
import { InventoryItem } from '../models/InventoryItem.js';
import { DailySale } from '../models/DailySale.js';
import { Expense } from '../models/Expense.js';
const router=Router();router.use(requireAuth,allowRoles('owner'));
router.get('/summary',async(req,res,next)=>{try{
 const [products,inventory,sales,expenses]=await Promise.all([Product.countDocuments({active:true}),InventoryItem.find({active:true}).lean(),DailySale.aggregate([{$match:{status:'posted'}},{$group:{_id:null,revenue:{$sum:'$totalRevenue'},cogs:{$sum:'$totalCost'}}}]),Expense.aggregate([{$group:{_id:null,total:{$sum:'$amount'}}}])]);
 const revenue=sales[0]?.revenue||0,cogs=sales[0]?.cogs||0,operatingExpenses=expenses[0]?.total||0;
 res.json({products,lowStock:inventory.filter(i=>i.quantity<=i.reorderLevel).length,revenue,cogs,grossProfit:revenue-cogs,operatingExpenses,netProfit:revenue-cogs-operatingExpenses});
}catch(e){next(e);}});
export default router;
