import { bootstrapApplication } from '@angular/platform-browser';
import { Component } from '@angular/core';
@Component({selector:'app-root',standalone:true,template:`<main><h1>Hebrews ☕</h1><p>Café & Restaurant Management System</p><h2>Owner Dashboard — Phase 1 Preview</h2><p>Sales ₱0 · Profit ₱0 · Low Stock 0</p><hr><h2>Staff</h2><p>No staff dashboard. Authorized daily sales page will be implemented in a later phase.</p><small>Preview only. No live data or authentication yet.</small></main>`,styles:[`main{max-width:900px;margin:8vh auto;padding:32px;background:white;border-radius:20px;font-family:Arial,sans-serif;color:#6f4e37}body{background:#f7f3ec}`]})
class AppComponent {}
bootstrapApplication(AppComponent).catch(console.error);
