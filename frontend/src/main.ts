import { bootstrapApplication } from '@angular/platform-browser';
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { provideHttpClient, HttpClient } from '@angular/common/http';
import { inject } from '@angular/core';
type User = { id:string; name:string; email:string; role:'owner'|'staff' };
@Component({
 selector:'app-root',standalone:true,imports:[CommonModule,FormsModule],
 template:`
 <main class="layout">
  <header><strong>☕ HEBREWS</strong><span>Café & Restaurant Management</span><button *ngIf="user()" (click)="logout()">Sign out</button></header>
  <section *ngIf="!user()" class="login">
   <p class="eyebrow">WELCOME BACK</p><h1>Sign in</h1><p>Use your authorized Hebrews account.</p>
   <form (ngSubmit)="login()">
    <label>Email<input type="email" name="email" [(ngModel)]="email" required autocomplete="username"></label>
    <label>Password<input [type]="showPassword ? 'text' : 'password'" name="password" [(ngModel)]="password" required autocomplete="current-password"></label>
    <label class="show-password"><input type="checkbox" name="showPassword" [(ngModel)]="showPassword"> Show password</label>
    <button type="submit" [disabled]="loading()">{{loading()?'Signing in...':'Sign in'}}</button>
   </form><p *ngIf="error()" class="error">{{error()}}</p>
  </section>
  <nav *ngIf="user()?.role==='owner'" class="owner-nav" aria-label="Owner navigation"><button type="button" [class.selected]="ownerPage==='dashboard'" (click)="ownerPage='dashboard'">Dashboard</button><button type="button" [class.selected]="ownerPage==='kiosk'" (click)="ownerPage='kiosk'">Kiosk Ordering</button></nav>
  <section *ngIf="user()?.role==='owner' && ownerPage==='dashboard'">
   <p class="eyebrow">OWNER OVERVIEW</p><h1>Welcome, {{user()?.name}}</h1>
   <p>Manage your café and restaurant operations.</p>
   <div class="cards"><article><small>Products</small><h2>{{summary()?.products ?? '—'}}</h2></article><article><small>Revenue (all recorded)</small><h2>₱{{summary()?.revenue ?? 0 | number:'1.2-2'}}</h2></article><article><small>Net Profit (all recorded)</small><h2>₱{{summary()?.netProfit ?? 0 | number:'1.2-2'}}</h2></article><article><small>Low Stock</small><h2>{{summary()?.lowStock ?? '—'}}</h2></article></div>
   <section class="panel"><h2>Products</h2><p>View current catalog</p><button (click)="loadProducts()">Refresh products</button>
    <div *ngFor="let product of products()" class="product"><strong>{{product.name}}</strong><span>₱{{product.sellingPrice | number:'1.2-2'}}</span></div>
    <p *ngIf="products().length===0">No products loaded yet.</p>
   </section>
  </section>
  <section *ngIf="user()?.role==='owner' && ownerPage==='kiosk'" class="kiosk">
    <p class="eyebrow">QUICK ORDER · PREVIEW</p><h1>Kiosk Ordering</h1><p>Select a product to calculate an order. Preview only: no sales are posted and no stock is deducted.</p>
    <div class="kiosk-layout"><div class="kiosk-grid">
      <article class="kiosk-card" *ngFor="let product of products()"><div class="kiosk-photo">{{product.kind==='prepared'?'🍽️':'🥡'}}</div><div class="kiosk-info"><strong>{{product.name}}</strong><p>₱{{product.sellingPrice | number:'1.2-2'}}</p><button type="button" (click)="addToCart(product)">+ Add to Order</button></div></article>
      <p *ngIf="products().length===0" class="muted">No products yet. Add products to the catalog first.</p>
    </div><aside class="kiosk-cart"><h2>Current Order</h2><div class="cart-line" *ngFor="let item of cart"><div><strong>{{item.name}}</strong><small>₱{{item.price | number:'1.2-2'}} each</small></div><div class="cart-qty"><button type="button" (click)="changeCartQty(item.id,-1)">−</button><span>{{item.qty}}</span><button type="button" (click)="changeCartQty(item.id,1)">+</button></div><strong>₱{{item.qty*item.price | number:'1.2-2'}}</strong></div><p *ngIf="cart.length===0">Your cart is empty.</p><div class="cart-total"><strong>Grand Total</strong><strong>₱{{cartTotal | number:'1.2-2'}}</strong></div><button type="button" [disabled]="cart.length===0" (click)="clearCart()">Clear Order</button><p class="muted">Demo calculator — no checkout or database changes.</p></aside></div>
  </section>
  <section *ngIf="user()?.role==='staff'">
   <p class="eyebrow">STAFF OPERATIONS</p><h1>Daily Sales</h1>
   <div class="panel"><p>Only authorized operational pages are available to staff. There is no staff dashboard.</p>
   <p>Daily sales posting will be enabled after transactional inventory validation is completed.</p></div>
  </section>
  <p *ngIf="error() && user()" class="error">{{error()}}</p>
 </main>`,
 styles:[`:host{display:block;background:#f7f3ec;min-height:100vh;color:#3c2d23;font-family:Inter,system-ui,sans-serif}.layout{max-width:1150px;margin:auto;padding:22px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #e5d8c9;padding:15px 0 22px;flex-wrap:wrap}header strong{color:#6f4e37;font-size:1.25rem}h1{font-size:clamp(2rem,4vw,3rem)}.eyebrow{font-size:.75rem;letter-spacing:.16em;color:#a07853;font-weight:700;margin-top:42px}.login{max-width:420px;margin:10vh auto;background:white;border-radius:22px;padding:32px;box-shadow:0 12px 30px #6f4e3710}label{display:block;margin:18px 0;font-size:.9rem}input{display:block;width:100%;box-sizing:border-box;margin-top:8px;padding:12px;border:1px solid #d5c8ba;border-radius:10px}button{border:0;border-radius:10px;background:#6f4e37;color:white;padding:12px 18px;cursor:pointer}button:disabled{opacity:.6}.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:24px 0}.cards article,.panel{background:white;border:1px solid #e8dfd4;border-radius:18px;padding:22px}.cards small{color:#8c7867}.cards h2{margin:10px 0 0}.panel{margin:20px 0}.product{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee}.error{color:#a32121}.owner-nav{display:flex;gap:8px;margin:20px 0;flex-wrap:wrap}.owner-nav button{background:#e9ded0;color:#4c3628}.owner-nav button.selected{background:#6f4e37;color:#fff}.kiosk-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:20px;margin:22px 0}.kiosk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.kiosk-card,.kiosk-cart{background:white;border:1px solid #e8dfd4;border-radius:16px;overflow:hidden}.kiosk-photo{background:#f2e7da;text-align:center;padding:30px;font-size:48px}.kiosk-info,.kiosk-cart{padding:18px}.kiosk-info p{font-weight:700}.cart-line{display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid #eee;padding:12px 0;font-size:12px}.cart-line small{display:block;color:#8c7867;margin-top:4px}.cart-qty{display:flex;align-items:center;gap:7px}.cart-qty button{padding:6px 9px}.cart-total{display:flex;justify-content:space-between;margin:22px 0}.muted{color:#8c7867}@media(max-width:850px){.kiosk-layout{grid-template-columns:1fr}}.show-password{display:flex;align-items:center;gap:9px;margin:0 0 20px;cursor:pointer}.show-password input{width:auto;margin:0}@media(max-width:750px){.cards{grid-template-columns:repeat(2,1fr)}}@media(max-width:420px){.cards{grid-template-columns:1fr}.login{padding:22px}}`]
})
class AppComponent {
 private http=inject(HttpClient);
 private api='http://localhost:5000/api';
 email='';password='';showPassword=false;
 ownerPage:'dashboard'|'kiosk'='dashboard';
 cart:{id:string;name:string;price:number;qty:number}[]=[];
 get cartTotal(){return this.cart.reduce((sum,item)=>sum+item.price*item.qty,0);}
 addToCart(product:any){const id=String(product._id||product.id);const existing=this.cart.find(item=>item.id===id);if(existing){existing.qty++;}else{this.cart.push({id,name:product.name,price:Number(product.sellingPrice)||0,qty:1});}}
 changeCartQty(id:string,delta:number){const item=this.cart.find(i=>i.id===id);if(item){item.qty+=delta;this.cart=this.cart.filter(i=>i.qty>0);}}
 clearCart(){this.cart=[];}
 user=signal<User|null>(null);
 token=signal('');
 loading=signal(false);error=signal('');
 summary=signal<any>(null);products=signal<any[]>([]);
 login(){
  if(this.loading())return;
  this.error.set('');this.loading.set(true);
  this.http.post<{token:string,user:User}>(this.api+'/auth/login',{email:this.email,password:this.password}).subscribe({
   next:r=>{this.token.set(r.token);this.user.set(r.user);this.password='';this.loading.set(false);if(r.user.role==='owner'){this.loadSummary();this.loadProducts();}},
   error:e=>{this.error.set(e.status===401?'Invalid email or password.':e.status===0?'Cannot reach the backend. Check that npm run dev is running on port 5000.':'Login failed. Please try again.');this.loading.set(false);}
  });
 }
 private headers(){return {Authorization:'Bearer '+this.token()};}
 loadSummary(){this.http.get<any>(this.api+'/owner/summary',{headers:this.headers()}).subscribe({next:r=>this.summary.set(r),error:()=>this.error.set('Could not load owner summary.')});}
 loadProducts(){this.http.get<any[]>(this.api+'/catalog/products',{headers:this.headers()}).subscribe({next:r=>this.products.set(r),error:()=>this.error.set('Could not load products.')});}
 logout(){this.cart=[];this.ownerPage='dashboard';this.user.set(null);this.token.set('');this.summary.set(null);this.products.set([]);this.error.set('');}
}
bootstrapApplication(AppComponent,{providers:[provideHttpClient()]}).catch(console.error);
