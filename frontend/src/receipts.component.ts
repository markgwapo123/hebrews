import {Component, Input, Output, EventEmitter} from '@angular/core';
import {CommonModule} from '@angular/common';
import {FormsModule} from '@angular/forms';

@Component({
 selector:'app-receipts',standalone:true,imports:[CommonModule,FormsModule],
 template:`
 <section class="receipts">
  <div class="heading"><div><p class="receipt-eyebrow">TRANSACTION HISTORY</p><h1>Sales Receipts</h1><p>Review completed and voided transactions in one place.</p></div><button type="button" (click)="refresh.emit()" [disabled]="loading">{{loading?'Refreshing...':'Refresh Receipts'}}</button></div>
  <div class="receipt-summary"><article><small>Total Receipts</small><strong>{{receipts.length}}</strong></article><article><small>Completed</small><strong>{{completedCount}}</strong></article><article><small>Voided</small><strong>{{voidedCount}}</strong></article><article><small>Completed Sales</small><strong>₱{{completedRevenue | number:'1.2-2'}}</strong></article></div>
  <div class="receipt-tools"><div><h2>Receipt History</h2><p>Search receipts and filter by status.</p></div><div class="receipt-filters"><input type="search" [(ngModel)]="search" placeholder="Search receipt number..." aria-label="Search receipt number"><select [(ngModel)]="statusFilter" aria-label="Filter receipt status"><option value="all">All receipts</option><option value="posted">Completed</option><option value="void">Voided</option></select></div></div>
  <p *ngIf="loading">Loading receipts...</p><p *ngIf="error" class="error" role="alert">{{error}}</p>
  <div *ngIf="!loading && !error && filteredReceipts.length===0" class="empty">No receipts match your search or filter.</div>
  <div class="receipt-list">
   <button type="button" *ngFor="let receipt of filteredReceipts" class="receipt-row" (click)="selected=receipt">
    <span><strong>#{{receipt._id.slice(-8).toUpperCase()}}</strong><small>{{receipt.createdAt | date:'medium'}} · {{receipt.items.length}} product line(s)</small></span>
    <span *ngIf="receipt.status==='void'" class="void-label">VOIDED</span><strong>₱{{receipt.totalRevenue | number:'1.2-2'}}</strong>
   </button>
  </div>
 </section>
 <div *ngIf="selected" class="overlay" (click)="selected=null">
  <article class="paper" role="dialog" aria-modal="true" aria-label="Sale receipt" (click)="$event.stopPropagation()">
   <div class="paper-top"><div><strong>HEBREWS</strong><small>CAFÉ & RESTAURANT</small></div><button type="button" (click)="selected=null" aria-label="Close receipt">×</button></div>
   <h2>SALES RECEIPT</h2><p>Receipt #{{selected._id.slice(-8).toUpperCase()}}</p><p>{{selected.createdAt | date:'medium'}}</p>
   <div class="lines"><div *ngFor="let item of selected.items"><span>{{item.product?.name || 'Product'}}<small>{{item.quantity}} × ₱{{item.unitPriceSnapshot | number:'1.2-2'}}</small></span><strong>₱{{item.lineRevenue | number:'1.2-2'}}</strong></div></div>
   <p *ngIf="selected.status==='void'" class="void-label">VOIDED — excluded from sales totals</p><div class="grand"><strong>TOTAL</strong><strong>₱{{selected.totalRevenue | number:'1.2-2'}}</strong></div>
   <p class="foot">Thank you for your purchase!</p>
   <p *ngIf="voidError" class="error">{{voidError}}</p><button *ngIf="selected.status!=='void'" type="button" class="void-button" [disabled]="voiding" (click)="requestVoid()">{{voiding?'Voiding...':'Void Sale'}}</button><button type="button" class="print" (click)="print()">Print Receipt</button>
  </article>
 </div>
 `,
 styles:[`
.void-label{color:#a13b32;font-weight:700;font-size:12px}.void-button{width:100%;border:1px solid #b13f35;background:#fff;color:#a13b32;padding:11px;margin-bottom:10px;border-radius:9px;cursor:pointer}.void-button:disabled{opacity:.5} .receipts{background:#fff;border:1px solid #e9e2da;border-radius:16px;padding:26px}.heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:20px}.heading h1{margin:0 0 6px;font-size:28px}.heading p{margin:0;color:#81766d}.heading button,.print{background:#6f4e37;color:#fff;border:0;border-radius:9px;padding:11px 17px;cursor:pointer}.receipt-list{display:grid;gap:9px}.receipt-row{display:flex;justify-content:space-between;align-items:center;gap:12px;text-align:left;width:100%;padding:17px;background:#faf8f5;border:1px solid #eee7de;border-radius:11px;color:#352c25;cursor:pointer}.receipt-row:hover{background:#f1e9e0}.receipt-row small,.paper-top small{display:block;font-size:11px;color:#86766a;margin-top:6px}.empty{padding:40px;text-align:center;color:#8b8178}.error{color:#a73e35}.overlay{position:fixed;inset:0;background:#19130db8;display:flex;justify-content:center;align-items:center;padding:16px;z-index:1100}.paper{width:min(100%,390px);max-height:90dvh;overflow:auto;background:white;color:#252525;border-radius:13px;padding:26px;box-shadow:0 22px 60px #0003}.paper-top{display:flex;justify-content:space-between;align-items:start}.paper-top button{border:0;background:#eee;padding:5px 11px;border-radius:7px;font-size:22px;cursor:pointer}.paper h2{text-align:center;font-size:18px;margin:24px 0 12px}.paper>p{text-align:center;font-size:12px;color:#777;margin:5px}.lines{border-top:1px dashed #aaa;border-bottom:1px dashed #aaa;margin-top:24px;padding:10px 0}.lines>div{display:flex;justify-content:space-between;gap:12px;padding:9px 0;font-size:13px}.lines small{display:block;color:#777;margin-top:4px}.grand{display:flex;justify-content:space-between;font-size:19px;margin:19px 0}.paper .foot{margin:24px 0}.print{width:100%}@media print{body *{visibility:hidden!important}app-receipts .paper,app-receipts .paper *{visibility:visible!important}app-receipts .paper{position:fixed;inset:0;width:100%;max-height:none;box-shadow:none;overflow:visible}app-receipts .paper-top button,app-receipts .print{display:none!important}}
 @media(max-width:500px){.heading{flex-direction:column;align-items:flex-start}.receipts{padding:16px}}
 `]
})
export class ReceiptsComponent{
 @Input() receipts:any[]=[];
 @Input() loading=false;
 @Input() error='';
 @Output() refresh=new EventEmitter<void>();
 @Output() voidSale=new EventEmitter<string>();
 @Input() voiding=false;
 @Input() voidError='';
 search='';
 statusFilter='all';
 get filteredReceipts(){const q=this.search.trim().toLowerCase();return this.receipts.filter(r=>(this.statusFilter==='all'||(this.statusFilter==='void'?r.status==='void':r.status!=='void'))&&(!q||String(r._id||'').toLowerCase().includes(q)));}
 get completedCount(){return this.receipts.filter(r=>r.status!=='void').length;}
 get voidedCount(){return this.receipts.filter(r=>r.status==='void').length;}
 get completedRevenue(){return this.receipts.filter(r=>r.status!=='void').reduce((sum,r)=>sum+(Number(r.totalRevenue)||0),0);}
 selected:any=null;
 requestVoid(){if(!this.selected||this.selected.status==='void'||this.voiding)return;if(window.confirm('Void this sale? The sale will be excluded from totals. Inventory stock will not change.'))this.voidSale.emit(this.selected._id);}
 print(){window.print();}
 open(receipt:any){this.selected=receipt;}
}
