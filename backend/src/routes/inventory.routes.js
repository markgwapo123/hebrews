import { Router } from 'express';
import { InventoryItem } from '../models/InventoryItem.js';
import { requireAuth,allowRoles } from '../middleware/auth.js';
const router=Router();router.use(requireAuth);
router.get('/',allowRoles('owner'),async(req,res,next)=>{try{res.json(await InventoryItem.find({active:true}).sort({kind:1,name:1}).lean());}catch(e){next(e);}});
router.get('/low-stock',allowRoles('owner'),async(req,res,next)=>{try{
 const items=await InventoryItem.find({active:true}).lean();res.json(items.filter(x=>x.quantity<=x.reorderLevel));
}catch(e){next(e);}});
export default router;
