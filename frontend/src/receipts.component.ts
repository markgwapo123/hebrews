import {Component, Input, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';

@Component({
 selector:'app-receipts',standalone:true,imports:[CommonModule],
 template:`
 <section class="receipts">
  <div class="heading"><div><h1>Sales Receipts</h1><p>Completed orders saved in the sales database.</p></div><button type="button" (click)="refresh.emit()">Refresh receipts</button></div>
  <p *ngIf="loading">Loading receipts...</p><p *ngIf="error" class="error" role="alert">{{error}}</p>
  <div *ngIf="!loading && !error && receipts.length===0" class="empty">No completed sales yet.</div>
  <div class="receipt-list">
   <button type="button" *ngFor="let receipt of receipts" class="receipt-row" (click)="selected=receipt">
    <span><strong>#{{receipt._id.slice(-8).toUpperCase()}}</strong><small>{{receipt.createdAt | date:'medium'}} · {{receipt.items.length}} product line(s)</small></span>
    <strong>₱{{receipt.totalRevenue | number:'1.2-2'}}</strong>
   </button>
  </div>
 </section>
 <div *ngIf="selected" class="overlay" (click)="selected=null">
  <article class="paper" role="dialog" aria-modal="true" aria-label="Sale receipt" (click)="$event.stopPropagation()">
   <div class="paper-top"><div><strong>HEBREWS</strong><small>CAFÉ & RESTAURANT</small></div><button type="button" (click)="selected=null" aria-label="Close receipt">×</button></div>
   <h2>SALES RECEIPT</h2><p>Receipt #{{selected._id.slice(-8).toUpperCase()}}</p><p>{{selected.createdAt | date:'medium'}}</p>
   <div class="lines"><div *ngFor="let item of selected.items"><span>{{item.product?.name || 'Product'}}<small>{{item.quantity}} × ₱{{item.unitPriceSnapshot | number:'1.2-2'}}</small></span><strong>₱{{item.lineRevenue | number:'1.2-2'}}</strong></div></div>
   <div class="grand"><strong>TOTAL</strong><strong>₱{{selected.totalRevenue | number:'1.2-2'}}</strong></div>
   <p class="foot">Thank you for your purchase!</p>
   <button type="button" class="print" (click)="print()">Print Receipt</button>
  </article>
 </div>
 `,
 styles:[`
 .receipts{background:#fff;border:1px solid #e9e2da;border-radius:16px;padding:26px}.heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}.heading h1{margin:0 0 6px;font-size:28px}.heading p{margin:0;color:#81766d}.heading button,.print{background:#6f4e37;color:#fff;border:0;border-radius:9px;padding:11px 17px;cursor:pointer}.receipt-list{display:grid;gap:9px}.receipt-row{display:flex;justify-content:space-between;align-items:center;gap:12px;text-align:left;width:100%;padding:17px;background:#faf8f5;border:1px solid #eee7de;border-radius:11px;color:#352c25;cursor:pointer}.receipt-row:hover{background:#f1e9e0}.receipt-row small,.paper-top small{display:block;font-size:11px;color:#86766a;margin-top:6px}.empty{padding:40px;text-align:center;color:#8b8178}.error{color:#a73e35}.overlay{position:fixed;inset:0;background:#19130db8;display:flex;justify-content:center;align-items:center;padding:16px;z-index:1100}.paper{width:min(100%,390px);max-height:90dvh;overflow:auto;background:white;color:#252525;border-radius:13px;padding:26px;box-shadow:0 22px 60px #0003}.paper-top{display:flex;justify-content:space-between;align-items:start}.paper-top button{border:0;background:#eee;padding:5px 11px;border-radius:7px;font-size:22px;cursor:pointer}.paper h2{text-align:center;font-size:18px;margin:24px 0 12px}.paper>p{text-align:center;font-size:12px;color:#777;margin:5px}.lines{border-top:1px dashed #aaa;border-bottom:1px dashed #aaa;margin-top:24px;padding:10px 0}.lines>div{display:flex;justify-content:space-between;gap:12px;padding:9px 0;font-size:13px}.lines small{display:block;color:#777;margin-top:4px}.grand{display:flex;justify-content:space-between;font-size:19px;margin:19px 0}.paper .foot{margin:24px 0}.print{width:100%}@media print{body *{visibility:hidden!important}app-receipts .paper,app-receipts .paper *{visibility:visible!important}app-receipts .paper{position:fixed;inset:0;width:100%;max-height:none;box-shadow:none;overflow:visible}app-receipts .paper-top button,app-receipts .print{display:none!important}}
 @media(max-width:500px){.heading{flex-direction:column;align-items:flex-start}.receipts{padding:16px}}
 `]
})
export class ReceiptsComponent{
 @Input() receipts:any[]=[];
 @Input() loading=false;
 @Input() error='';
 @Output() refresh=new EventEmitter<void>();
 selected:any=null;
 print(){window.print();}
 open(receipt:any){this.selected=receipt;}
}
