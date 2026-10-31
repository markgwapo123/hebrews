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
  <header *ngIf="!user() || user()?.role==='staff'"><strong>☕ HEBREWS</strong><span>Café & Restaurant Management</span><button *ngIf="user()" (click)="logout()">Sign out</button></header>
  <section *ngIf="!user()" class="login">
   <p class="eyebrow">WELCOME BACK</p><h1>Sign in</h1><p>Use your authorized Hebrews account.</p>
   <form (ngSubmit)="login()">
    <label>Email<input type="email" name="email" [(ngModel)]="email" required autocomplete="username"></label>
    <label>Password<input [type]="showPassword ? 'text' : 'password'" name="password" [(ngModel)]="password" required autocomplete="current-password"></label>
    <label class="show-password"><input type="checkbox" name="showPassword" [(ngModel)]="showPassword"> Show password</label>
    <button type="submit" [disabled]="loading()">{{loading()?'Signing in...':'Sign in'}}</button>
   </form><p *ngIf="error()" class="error">{{error()}}</p>
  </section>
  <div *ngIf="user()?.role==='owner'" class="owner-shell">
   <aside class="owner-sidebar" [class.open]="sidebarOpen" aria-label="Owner sidebar">
    <div class="sidebar-brand"><span class="brand-icon">☕</span><div><strong>HEBREWS</strong><small>CAFÉ & RESTAURANT</small></div></div>
    <p class="sidebar-label">WORKSPACE</p>
    <nav class="sidebar-menu" aria-label="Owner navigation">
     <button type="button" [class.selected]="ownerPage==='dashboard'" (click)="navigateOwner('dashboard')"><span class="nav-icon">▦</span><span>Dashboard</span></button>
     <button type="button" [class.selected]="ownerPage==='kiosk'" (click)="navigateOwner('kiosk')"><span class="nav-icon">▣</span><span>Kiosk Ordering</span></button>
     <button type="button" [class.selected]="ownerPage==='products'" (click)="navigateOwner('products')"><span class="nav-icon">▤</span><span>Products</span></button>
     <button type="button" [class.selected]="ownerPage==='inventory'" (click)="navigateOwner('inventory')"><span class="nav-icon">▥</span><span>Inventory</span></button>
     <button type="button" [class.selected]="ownerPage==='sales'" (click)="navigateOwner('sales')"><span class="nav-icon">▣</span><span>Daily Sales</span></button>
     <button type="button" [class.selected]="ownerPage==='financials'" (click)="navigateOwner('financials')"><span class="nav-icon">◇</span><span>Financials</span></button>
     <button type="button" [class.selected]="ownerPage==='reports'" (click)="navigateOwner('reports')"><span class="nav-icon">▧</span><span>Reports</span></button>
    </nav>
    <div class="sidebar-footer"><span class="status-dot"></span> OWNER ACCOUNT <button type="button" class="signout-link" (click)="logout()">Sign out</button></div>
   </aside>
   <div class="owner-content">
    <div class="owner-toolbar"><button type="button" class="sidebar-toggle" (click)="sidebarOpen=!sidebarOpen" [attr.aria-expanded]="sidebarOpen" aria-label="Toggle sidebar">☰</button><span>HEBREWS / {{pageTitle}}</span></div>

  <section *ngIf="user()?.role==='owner' && ownerPage==='dashboard'">
   <p class="eyebrow">HEBREWS / DASHBOARD</p><h1>Dashboard</h1>
   <p>Welcome back, {{user()?.name}}. Here’s an overview of your business performance.</p>
   <div class="cards financial-cards"><article><small>Total Products</small><h2>{{summary()?.products ?? '—'}}</h2></article><article><small>Total Sales</small><h2>₱{{summary()?.revenue ?? 0 | number:'1.2-2'}}</h2><small>Posted sales only</small></article><article><small>Total Capital Invested</small><h2>₱{{summary()?.capitalInvested ?? 0 | number:'1.2-2'}}</h2><small>Owner contributions</small></article><article><small>Net Capital Contributions</small><h2>₱{{summary()?.netCapital ?? 0 | number:'1.2-2'}}</h2><small>Contributions less withdrawals</small></article><article><small>Remaining Inventory Value</small><h2>₱{{summary()?.inventoryCostValue ?? 0 | number:'1.2-2'}}</h2><small>Stock quantity × average cost</small></article><article><small>Gross Profit</small><h2>₱{{summary()?.grossProfit ?? 0 | number:'1.2-2'}}</h2></article><article><small>Operating Expenses</small><h2>₱{{summary()?.operatingExpenses ?? 0 | number:'1.2-2'}}</h2></article><article><small>Net Profit</small><h2>₱{{summary()?.netProfit ?? 0 | number:'1.2-2'}}</h2></article><article><small>Low Stock Items</small><h2>{{summary()?.lowStock ?? '—'}}</h2></article></div>
   <section class="panel sales-chart-panel" aria-label="Sales overview">
    <div class="sales-chart-header"><div><h2>Sales Overview</h2><p>Recorded revenue over the last 7 days</p></div><span class="sales-chart-period">Last 7 days</span></div>
    <div *ngIf="salesTrendLoading()" class="chart-message">Loading sales data...</div>
    <div *ngIf="!salesTrendLoading() && salesTrendError()" class="chart-message error">{{salesTrendError()}}</div>
    <ng-container *ngIf="!salesTrendLoading() && !salesTrendError()">
      <div *ngIf="!hasSalesTrend" class="chart-empty"><strong>No sales recorded yet</strong><p>Once daily sales are posted, your revenue chart will appear here.</p></div>
      <div *ngIf="hasSalesTrend" class="chart-plot" role="img" aria-label="Seven-day posted sales revenue bar chart">
       <div class="chart-column" *ngFor="let point of salesTrend()">
        <span class="chart-value">₱{{point.revenue | number:'1.0-0'}}</span>
        <div class="chart-bar-track"><div class="chart-bar" [style.height.%]="(point.revenue / maxSalesRevenue) * 100" [attr.title]="point.date + ': ₱' + point.revenue"></div></div>
        <span class="chart-date">{{point.date.slice(5)}}</span>
       </div>
      </div>
      <p *ngIf="hasSalesTrend" class="chart-caption">Based on posted daily sales only · Dates shown as MM-DD</p>
    </ng-container>
   </section>
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
  <section *ngIf="user()?.role==='owner' && ownerPage==='products'" class="panel">
   <div class="products-heading"><div><h1>Products</h1><p>Manage your café and restaurant catalog.</p></div><button type="button" (click)="openAddProduct()">+ Add Product</button></div>
   <div class="products-actions"><button type="button" class="secondary-button" (click)="loadProducts()">Refresh products</button><button type="button" class="secondary-button" (click)="loadCategories()">Refresh categories</button></div>
   <div *ngFor="let product of products()" class="product"><strong>{{product.name}} <small>· {{product.category?.name || 'Uncategorized'}}</small></strong><span>₱{{product.sellingPrice | number:'1.2-2'}}</span></div>
   <p *ngIf="products().length===0">No products yet. Select Add Product to create one.</p>
  </section>
  <div *ngIf="showAddProduct" class="modal-backdrop" (click)="closeAddProduct()">
   <section class="product-modal" role="dialog" aria-modal="true" aria-labelledby="product-modal-title" (click)="$event.stopPropagation()">
    <div class="modal-title-row"><div><h2 id="product-modal-title">Add Product</h2><p>Product information is saved to your database.</p></div><button type="button" class="modal-close" (click)="closeAddProduct()" aria-label="Close">×</button></div>
    <form (ngSubmit)="saveProduct()">
     <label>Product Name<input name="productName" [(ngModel)]="productForm.name" maxlength="150" required placeholder="e.g. Iced Latte"></label>
     <label>Category<select name="productCategory" [(ngModel)]="productForm.category" required><option value="">Select category</option><option *ngFor="let category of categories()" [value]="category._id">{{category.name}}</option></select></label>
     <div class="category-create"><input name="newCategoryName" [(ngModel)]="newCategoryName" placeholder="New category name"><button type="button" class="secondary-button" [disabled]="savingCategory() || !newCategoryName.trim()" (click)="addCategory()">{{savingCategory()?'Adding...':'Add Category'}}</button></div>
     <label>Product Type<select name="productKind" [(ngModel)]="productForm.kind" required><option value="prepared">Prepared food / drink</option><option value="ready_made">Ready-made product</option></select></label>
     <div class="form-columns"><label>Selling Price (₱)<input type="number" name="sellingPrice" [(ngModel)]="productForm.sellingPrice" min="0" step="0.01" required></label><label>Purchase Cost (₱)<input type="number" name="purchaseCost" [(ngModel)]="productForm.purchaseCost" min="0" step="0.01" required></label></div>
     <label *ngIf="productForm.kind==='ready_made'">Linked Ready-Made Inventory<select name="inventoryItem" [(ngModel)]="productForm.inventoryItem" required><option value="">Select inventory item</option><option *ngFor="let item of readyMadeInventory()" [value]="item._id">{{item.name}} ({{item.quantity}} {{item.unit}})</option></select></label>
     <p *ngIf="productForm.kind==='ready_made' && readyMadeInventory().length===0" class="form-hint">Create a ready-made inventory item in Inventory first. Linking stock is required by the backend.</p>
     <p *ngIf="productFormError" class="error">{{productFormError}}</p>
     <div class="modal-actions"><button type="button" class="secondary-button" (click)="closeAddProduct()">Cancel</button><button type="submit" [disabled]="savingProduct()">{{savingProduct()?'Saving...':'Save Product'}}</button></div>
    </form>
   </section>
  </div>
  <section *ngIf="user()?.role==='owner' && ownerPage==='inventory'" class="panel"><h1>Inventory</h1><p>Inventory management interface is not yet connected in this frontend. Stock summaries are available on the dashboard.</p></section>
  <section *ngIf="user()?.role==='owner' && ownerPage==='sales'" class="panel"><h1>Daily Sales</h1><p>Daily sales posting is not yet enabled. Sales shown on the dashboard come from recorded transactions.</p></section>
  <section *ngIf="user()?.role==='owner' && ownerPage==='financials'" class="panel"><h1>Financials</h1><p>Capital, expenses, and profit are summarized on the dashboard. Detailed entry forms are not yet implemented in this frontend.</p></section>
  <section *ngIf="user()?.role==='owner' && ownerPage==='reports'" class="panel"><h1>Reports</h1><p>Detailed reports interface is planned. No sample data is shown as real records.</p></section>
   </div>
  </div>
  <section *ngIf="user()?.role==='staff'">
   <p class="eyebrow">STAFF OPERATIONS</p><h1>Daily Sales</h1>
   <div class="panel"><p>Only authorized operational pages are available to staff. There is no staff dashboard.</p>
   <p>Daily sales posting will be enabled after transactional inventory validation is completed.</p></div>
  </section>
  <p *ngIf="error() && user()" class="error">{{error()}}</p>
 </main>`,
 styles:[`.products-heading{display:flex;align-items:center;justify-content:space-between;gap:15px;margin-bottom:14px}.products-heading h1{margin:0 0 6px}.products-heading p{margin:0}.products-actions{display:flex;gap:9px;flex-wrap:wrap;margin:18px 0}.secondary-button{background:#f1ebe4;color:#5c4333}.secondary-button:hover{background:#e8ddd0}.product small{font-weight:400;color:#93877d}.modal-backdrop{position:fixed;inset:0;background:#201b17a8;display:flex;align-items:center;justify-content:center;padding:16px;z-index:1000}.product-modal{background:#fff;width:min(100%,520px);max-height:calc(100dvh - 32px);overflow-y:auto;border-radius:18px;padding:25px;box-shadow:0 22px 65px #0003}.modal-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:15px}.modal-title-row h2{margin:0 0 5px}.modal-title-row p{font-size:12px}.modal-close{background:#f3efeb;color:#5c4333;padding:4px 11px;font-size:24px}.product-modal label{font-size:12px;margin:13px 0}.product-modal input,.product-modal select{display:block;width:100%;border:1px solid #dcd6d0;background:#fff;color:#342a24;border-radius:9px;padding:11px;margin-top:6px;font:inherit}.form-columns{display:grid;grid-template-columns:1fr 1fr;gap:13px}.category-create{display:flex;gap:9px;align-items:center}.category-create input{margin:0;min-width:0;flex:1}.category-create button{white-space:nowrap}.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}.form-hint{font-size:12px;color:#956f42}@media(max-width:500px){.products-heading{align-items:flex-start;flex-direction:column}.product-modal{padding:17px}.form-columns{grid-template-columns:1fr}}.sales-chart-panel{margin:24px 0 28px;padding:25px}.sales-chart-header{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.sales-chart-header h2{font-size:18px;margin:0 0 5px}.sales-chart-header p{font-size:12px;margin:0}.sales-chart-period{border:1px solid #e6dfd6;border-radius:22px;padding:7px 11px;font-size:11px;color:#756858;white-space:nowrap}.chart-plot{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:12px;height:260px;margin-top:25px;border-bottom:1px solid #e9e5df}.chart-column{display:flex;flex-direction:column;align-items:center;min-width:0}.chart-value{font-size:10px;color:#796e64;white-space:nowrap}.chart-bar-track{flex:1;width:100%;max-width:68px;min-height:0;display:flex;align-items:flex-end}.chart-bar{width:100%;background:#b18a64;border-radius:7px 7px 0 0;min-height:0;transition:height .25s ease}.chart-date{font-size:11px;color:#817970;position:relative;top:23px;white-space:nowrap}.chart-caption{font-size:11px;margin:40px 0 0;color:#92887f}.chart-empty{padding:48px 18px;text-align:center;border:1px dashed #e4ddd5;border-radius:12px;margin-top:20px}.chart-empty strong{font-size:14px}.chart-empty p{font-size:12px;margin:8px 0 0}.chart-message{padding:35px 12px;text-align:center;color:#82766d}@media(max-width:560px){.sales-chart-panel{padding:16px}.chart-plot{gap:5px;height:190px}.chart-value{font-size:9px}.chart-date{font-size:9px}.sales-chart-period{font-size:10px}}:host:has(.login){height:100dvh;min-height:0;overflow:hidden;display:block}:host:has(.login) .layout{height:100dvh;min-height:0;overflow:hidden;display:flex;flex-direction:column;max-width:none;padding:clamp(12px,2vh,22px) clamp(16px,3vw,42px)}:host:has(.login) header{flex:0 0 auto;padding:8px 0 14px}:host:has(.login) .login{width:min(100%,430px);max-width:430px;margin:auto;flex:0 1 auto;min-height:0;overflow-y:auto;padding:clamp(18px,3vh,30px);border-radius:18px}:host:has(.login) .login .eyebrow{margin:0 0 9px}:host:has(.login) .login h1{font-size:clamp(27px,4.5vh,42px);margin:0 0 10px}:host:has(.login) .login p{margin-bottom:13px}:host:has(.login) .login label{margin:10px 0}:host:has(.login) .login input:not([type=checkbox]){padding:10px 12px;margin-top:5px}:host:has(.login) .login .show-password{margin:10px 0 15px}:host:has(.login) .login form>button{width:100%;padding:11px 14px}@media(max-height:580px){:host:has(.login) header{padding:0 0 5px}:host:has(.login) .login{padding:14px}:host:has(.login) .login .eyebrow{display:none}:host:has(.login) .login h1{font-size:26px}:host:has(.login) .login label{margin:6px 0}}.layout{max-width:1480px;padding:18px}:host{background:#f6f5f2;color:#30302e;font-family:Inter,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased}.owner-shell{grid-template-columns:230px minmax(0,1fr);min-height:calc(100vh - 36px);border-color:#e8e5e0;box-shadow:0 12px 32px #33281b0a}.owner-sidebar{background:#faf9f7;padding:28px 13px;border-color:#ece9e4}.sidebar-brand{padding-bottom:38px}.sidebar-brand strong{font-size:19px;letter-spacing:-.4px}.sidebar-brand small{letter-spacing:.13em}.sidebar-label{color:#a39a91;font-size:10px;letter-spacing:.15em}.sidebar-menu{gap:5px}.sidebar-menu button{font-size:13px;font-weight:550;padding:13px 14px;color:#77716b;transition:background .18s ease,color .18s ease}.sidebar-menu button:hover{background:#f0ebe5;color:#4b382c}.sidebar-menu button.selected{background:#eee8e1;color:#523d2e;font-weight:750}.nav-icon{font-size:19px}.owner-content{padding:20px clamp(18px,3vw,42px) 38px}.owner-toolbar{padding:10px 0 19px;font-size:12px;border-color:#efede8}.owner-content .eyebrow{margin-top:27px}.owner-content h1{font-size:clamp(26px,3vw,34px);letter-spacing:-.8px;margin-bottom:12px}.owner-content p{line-height:1.65;color:#77736e}.cards{grid-template-columns:repeat(3,minmax(0,1fr));gap:15px;margin:26px 0}.cards article{border-color:#ebe8e3;border-radius:14px;padding:20px;min-height:132px;transition:border-color .2s,box-shadow .2s}.cards article:hover{border-color:#d8c9b8;box-shadow:0 6px 20px #4b3b2c09}.cards small{font-size:12px;line-height:1.5}.cards h2{font-size:clamp(19px,2vw,26px);font-weight:760;letter-spacing:-.7px;margin-top:15px;font-variant-numeric:tabular-nums}.financial-cards article:nth-child(2),.financial-cards article:nth-child(8){border-top:3px solid #b89a78}.panel{border-color:#ebe8e3;border-radius:15px;padding:24px}.panel h2{font-size:18px;letter-spacing:-.3px}.product{gap:12px;font-size:13px}.product span{white-space:nowrap}.sidebar-footer{font-size:11px}.signout-link{text-decoration:none;font-weight:650}.signout-link:hover{text-decoration:underline}.kiosk-layout{gap:18px}.kiosk-card,.kiosk-cart{border-color:#ebe8e3;border-radius:15px;transition:box-shadow .2s}.kiosk-card:hover{box-shadow:0 8px 22px #4b3b2c0c}.kiosk-photo{background:#f6f1eb}.kiosk-info strong{font-size:13px}.kiosk-info button{width:100%}.kiosk-cart{align-self:start;position:sticky;top:18px}.cart-line{border-color:#eeeae5}.owner-content button:focus-visible,.sidebar-menu button:focus-visible{outline:3px solid #ceb69b;outline-offset:2px}@media(max-width:1100px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:850px){.kiosk-layout{grid-template-columns:1fr}.kiosk-cart{position:static}}@media(max-width:760px){.layout{padding:0}.owner-shell{min-height:100vh;border:0;border-radius:0}.owner-content{padding:16px}.cards{gap:11px}.cards article{padding:16px;min-height:116px}.cards h2{font-size:20px}.panel{padding:18px}}@media(max-width:420px){.cards{grid-template-columns:1fr}.kiosk-grid{grid-template-columns:1fr}}:host{display:block;background:#f7f3ec;min-height:100vh;color:#3c2d23;font-family:Inter,system-ui,sans-serif}.layout{max-width:1150px;margin:auto;padding:22px}header{display:flex;align-items:center;justify-content:space-between;gap:16px;border-bottom:1px solid #e5d8c9;padding:15px 0 22px;flex-wrap:wrap}header strong{color:#6f4e37;font-size:1.25rem}h1{font-size:clamp(2rem,4vw,3rem)}.eyebrow{font-size:.75rem;letter-spacing:.16em;color:#a07853;font-weight:700;margin-top:42px}.login{max-width:420px;margin:10vh auto;background:white;border-radius:22px;padding:32px;box-shadow:0 12px 30px #6f4e3710}label{display:block;margin:18px 0;font-size:.9rem}input{display:block;width:100%;box-sizing:border-box;margin-top:8px;padding:12px;border:1px solid #d5c8ba;border-radius:10px}button{border:0;border-radius:10px;background:#6f4e37;color:white;padding:12px 18px;cursor:pointer}button:disabled{opacity:.6}.cards{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px;margin:24px 0}.cards article,.panel{background:white;border:1px solid #e8dfd4;border-radius:18px;padding:22px}.cards small{color:#8c7867}.cards h2{margin:10px 0 6px;overflow-wrap:anywhere}.financial-cards article{min-width:0}.financial-cards article small{display:block}.panel{margin:20px 0}.product{display:flex;justify-content:space-between;padding:12px 0;border-bottom:1px solid #eee}.error{color:#a32121}.owner-shell{display:grid;grid-template-columns:235px minmax(0,1fr);gap:0;align-items:stretch;margin-top:0;border:1px solid #e8dfd4;border-radius:20px;overflow:hidden;background:#fff;min-height:88vh}.owner-sidebar{background:#fbfaf8;border-right:1px solid #e8dfd4;padding:24px 13px;min-height:670px;display:flex;flex-direction:column}.sidebar-brand{display:flex;gap:10px;align-items:center;padding:8px 9px 28px;color:#6f4e37}.sidebar-brand strong{display:block;font-size:17px;letter-spacing:.06em}.sidebar-brand small{display:block;font-size:10px;color:#9b8878;letter-spacing:.12em;margin-top:4px}.brand-icon{font-size:27px}.sidebar-label{color:#9b8878;font-size:10px;font-weight:800;letter-spacing:.13em;padding:0 13px}.sidebar-menu{display:flex;flex-direction:column;gap:7px;margin-top:12px}.sidebar-menu button{display:flex;align-items:center;gap:12px;width:100%;text-align:left;background:transparent;color:#685548;padding:13px;border-radius:11px;font-weight:650}.sidebar-menu button:hover{background:#f7f1e9}.sidebar-menu button.selected{background:#6f4e37;color:white}.nav-icon{font-size:21px;width:24px;text-align:center}.sidebar-footer{margin-top:auto;border-top:1px solid #eee5dc;padding:20px 12px 4px;color:#8c7867;font-size:12px}.status-dot{display:inline-block;background:#4c956c;width:8px;height:8px;border-radius:50%;margin-right:7px}.owner-content{min-width:0;padding:18px 28px 32px;background:#fff}.signout-link{display:block;margin-top:14px;background:transparent;color:#6f4e37;padding:6px 0;text-decoration:underline}.owner-toolbar{display:flex;align-items:center;gap:12px;font-weight:650;font-size:12px;color:#8c7867;padding:10px 0;border-bottom:1px solid #f0e9e1}.sidebar-toggle{display:none;padding:8px 12px}.owner-content .eyebrow{margin-top:22px}.owner-content h1{font-size:clamp(25px,3vw,34px);margin:10px 0 15px}.owner-content .cards article{padding:17px}.owner-content .cards h2{font-size:clamp(18px,2vw,24px)}@media(max-width:760px){.owner-shell{grid-template-columns:1fr;gap:0}.owner-sidebar{display:none;min-height:auto;border-right:0;border-bottom:1px solid #e8dfd4}.owner-sidebar.open{display:flex}.sidebar-toggle{display:inline-block}.owner-content{padding:14px}}.kiosk-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:20px;margin:22px 0}.kiosk-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px}.kiosk-card,.kiosk-cart{background:white;border:1px solid #e8dfd4;border-radius:16px;overflow:hidden}.kiosk-photo{background:#f2e7da;text-align:center;padding:30px;font-size:48px}.kiosk-info,.kiosk-cart{padding:18px}.kiosk-info p{font-weight:700}.cart-line{display:flex;justify-content:space-between;align-items:center;gap:8px;border-bottom:1px solid #eee;padding:12px 0;font-size:12px}.cart-line small{display:block;color:#8c7867;margin-top:4px}.cart-qty{display:flex;align-items:center;gap:7px}.cart-qty button{padding:6px 9px}.cart-total{display:flex;justify-content:space-between;margin:22px 0}.muted{color:#8c7867}@media(max-width:850px){.kiosk-layout{grid-template-columns:1fr}}.show-password{display:flex;align-items:center;gap:9px;margin:0 0 20px;cursor:pointer}.show-password input{width:auto;margin:0}@media(max-width:750px){.cards{grid-template-columns:repeat(2,1fr)}}@media(max-width:420px){.cards{grid-template-columns:1fr}.login{padding:22px}}`]
})
class AppComponent {
 private http=inject(HttpClient);
 private api='http://localhost:5000/api';
 email='';password='';showPassword=false;
 ownerPage:'dashboard'|'kiosk'|'products'|'inventory'|'sales'|'financials'|'reports'='dashboard';
 get pageTitle(){return ({dashboard:'Dashboard',kiosk:'Kiosk Ordering',products:'Products',inventory:'Inventory',sales:'Daily Sales',financials:'Financials',reports:'Reports'} as Record<string,string>)[this.ownerPage];}
 sidebarOpen=false;
 navigateOwner(page:AppComponent['ownerPage']){this.ownerPage=page;this.sidebarOpen=false;}
 cart:{id:string;name:string;price:number;qty:number}[]=[];
 get cartTotal(){return this.cart.reduce((sum,item)=>sum+item.price*item.qty,0);}
 addToCart(product:any){const id=String(product._id||product.id);const existing=this.cart.find(item=>item.id===id);if(existing){existing.qty++;}else{this.cart.push({id,name:product.name,price:Number(product.sellingPrice)||0,qty:1});}}
 changeCartQty(id:string,delta:number){const item=this.cart.find(i=>i.id===id);if(item){item.qty+=delta;this.cart=this.cart.filter(i=>i.qty>0);}}
 clearCart(){this.cart=[];}
 user=signal<User|null>(null);
 token=signal('');
 loading=signal(false);error=signal('');
 summary=signal<any>(null);products=signal<any[]>([]);
 categories=signal<any[]>([]);readyMadeInventory=signal<any[]>([]);
 showAddProduct=false;newCategoryName='';productFormError='';
 savingProduct=signal(false);savingCategory=signal(false);
 productForm={name:'',category:'',kind:'prepared',sellingPrice:0,purchaseCost:0,inventoryItem:''};
 openAddProduct(){this.productForm={name:'',category:'',kind:'prepared',sellingPrice:0,purchaseCost:0,inventoryItem:''};this.newCategoryName='';this.productFormError='';this.showAddProduct=true;this.loadCategories();this.loadReadyMadeInventory();}
 closeAddProduct(){if(!this.savingProduct())this.showAddProduct=false;}
 loadCategories(){this.http.get<any[]>(this.api+'/catalog/categories',{headers:this.headers()}).subscribe({next:r=>this.categories.set(r),error:()=>this.productFormError='Could not load categories.'});}
 loadReadyMadeInventory(){this.http.get<any[]>(this.api+'/inventory/items',{headers:this.headers()}).subscribe({next:r=>this.readyMadeInventory.set(r.filter(x=>x.kind==='ready_made'&&x.active!==false)),error:()=>this.readyMadeInventory.set([])});}
 addCategory(){const name=this.newCategoryName.trim();if(!name||this.savingCategory())return;this.savingCategory.set(true);this.productFormError='';this.http.post<any>(this.api+'/catalog/categories',{name},{headers:this.headers()}).subscribe({next:r=>{this.categories.update(a=>[...a,r].sort((x,y)=>x.name.localeCompare(y.name)));this.productForm.category=r._id;this.newCategoryName='';this.savingCategory.set(false);},error:e=>{this.productFormError=e.error?.error||'Could not create category.';this.savingCategory.set(false);}});}
 saveProduct(){if(this.savingProduct())return;const f=this.productForm;this.productFormError='';if(!f.name.trim()||!f.category||!Number.isFinite(Number(f.sellingPrice))||Number(f.sellingPrice)<0||!Number.isFinite(Number(f.purchaseCost))||Number(f.purchaseCost)<0){this.productFormError='Please complete all required fields with valid prices.';return;}if(f.kind==='ready_made'&&!f.inventoryItem){this.productFormError='Select a linked ready-made inventory item.';return;}this.savingProduct.set(true);const body={name:f.name.trim(),category:f.category,kind:f.kind,sellingPrice:Number(f.sellingPrice),purchaseCost:Number(f.purchaseCost),...(f.kind==='ready_made'?{inventoryItem:f.inventoryItem}:{})};this.http.post(this.api+'/catalog/products',body,{headers:this.headers()}).subscribe({next:()=>{this.savingProduct.set(false);this.showAddProduct=false;this.loadProducts();this.loadSummary();},error:e=>{this.productFormError=e.error?.error||'Could not save product.';this.savingProduct.set(false);}});}

 salesTrend=signal<{date:string;revenue:number;entries:number}[]>([]);
 salesTrendLoading=signal(false);salesTrendError=signal('');
 get hasSalesTrend(){return this.salesTrend().some(p=>p.revenue>0);}
 get maxSalesRevenue(){return Math.max(1,...this.salesTrend().map(p=>p.revenue));}
 loadSalesTrend(){this.salesTrendLoading.set(true);this.salesTrendError.set('');this.http.get<{date:string;revenue:number;entries:number}[]>(this.api+'/owner/sales-trend',{headers:this.headers()}).subscribe({next:r=>{this.salesTrend.set(r);this.salesTrendLoading.set(false);},error:()=>{this.salesTrendError.set('Could not load sales chart.');this.salesTrendLoading.set(false);}});}
 login(){
  if(this.loading())return;
  this.error.set('');this.loading.set(true);
  this.http.post<{token:string,user:User}>(this.api+'/auth/login',{email:this.email,password:this.password}).subscribe({
   next:r=>{this.token.set(r.token);this.user.set(r.user);this.password='';this.loading.set(false);if(r.user.role==='owner'){this.loadSummary();this.loadProducts();this.loadSalesTrend();}},
   error:e=>{this.error.set(e.status===401?'Invalid email or password.':e.status===0?'Cannot reach the backend. Check that npm run dev is running on port 5000.':'Login failed. Please try again.');this.loading.set(false);}
  });
 }
 private headers(){return {Authorization:'Bearer '+this.token()};}
 loadSummary(){this.http.get<any>(this.api+'/owner/summary',{headers:this.headers()}).subscribe({next:r=>this.summary.set(r),error:()=>this.error.set('Could not load owner summary.')});}
 loadProducts(){this.http.get<any[]>(this.api+'/catalog/products',{headers:this.headers()}).subscribe({next:r=>this.products.set(r),error:()=>this.error.set('Could not load products.')});}
 logout(){this.cart=[];this.showAddProduct=false;this.ownerPage='dashboard';this.sidebarOpen=false;this.user.set(null);this.token.set('');this.summary.set(null);this.products.set([]);this.salesTrend.set([]);this.salesTrendError.set('');this.error.set('');}
}
bootstrapApplication(AppComponent,{providers:[provideHttpClient()]}).catch(console.error);
