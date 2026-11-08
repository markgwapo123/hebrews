// Real browser recordings. NEVER connect this recorder to the live hebrews_db.
import 'dotenv/config';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, copyFile, writeFile, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const backend=join(root,'backend');
const out=join(root,'frontend','src','assets','tutorials');
const db='hebrews_tutorial_db';
const email='tutorial-owner@example.invalid';
const password='TutorialOnly!2026-Strong';
const origin='http://localhost:4200';
const api='http://localhost:5000';
let server;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(url){try{return (await fetch(url,{signal:AbortSignal.timeout(1800)})).ok}catch{return false}}
async function wait(url){for(let i=0;i<40;i++){if(await ready(url))return;await sleep(500)}throw Error('Timed out waiting for '+url)}
async function main(){
 if(await ready(api+'/api/health'))throw Error('Port 5000 is occupied. STOP your existing backend first! The recorder refuses to use the running hebrews_db.');
 if(!await ready(origin))throw Error('Start Angular at http://localhost:4200 before recording.');
 const envPath=join(backend,'.env');if(!existsSync(envPath))throw Error('Missing backend/.env (MongoDB URI and JWT secret required).');
 const {parse}=await import('dotenv');const local=parse(await readFile(envPath));
 if(!local.MONGODB_URI&&!process.env.MONGODB_URI)throw Error('Missing MongoDB URI');
 const env={...process.env,...local,MONGODB_DB_NAME:db,PORT:'5000',FRONTEND_ORIGIN:origin,OWNER_EMAIL:email,OWNER_PASSWORD:password,OWNER_NAME:'Tutorial Owner'};
 if(env.MONGODB_DB_NAME!=='hebrews_tutorial_db')throw Error('Unsafe database name');
 const seed=spawn(process.execPath,['src/scripts/create-owner.js'],{cwd:backend,env,stdio:'inherit'});
 const seedCode=await new Promise((res,rej)=>{seed.on('error',rej);seed.on('exit',res)});
 // A prior tutorial run may already have an owner; this is safe only in the isolated tutorial DB.
 if(seedCode!==0)console.log('Owner bootstrap did not create a new user; existing demo owner may already be present.');
 server=spawn(process.execPath,['src/server.js'],{cwd:backend,env,stdio:'inherit'});
 await wait(api+'/api/health');
 await mkdir(out,{recursive:true});
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out,size:{width:1280,height:800}},deviceScaleFactor:1});
  const page=await context.newPage();
  await page.goto(origin,{waitUntil:'domcontentloaded'});
  await page.locator('input[type=email]').fill(email);
  await page.locator('input[type=password]').fill(password);
  await page.getByRole('button',{name:'Sign in'}).click();
  await page.locator('.owner-sidebar').waitFor({timeout:15000});
  const topics=[
   ['dashboard','Dashboard',/Dashboard/i],['products','Products',/^Products$/i],['inventory','Inventory',/^Inventory$/i],
   ['recipes','Recipes',/^Products$/i],['financials','Financials',/^Financials$/i],['kiosk','Kiosk',/Kiosk Ordering/i],
   ['receipts','Receipts',/Sales Receipts/i],['reports','Reports',/^Reports$/i],['data-management','Data Management',/Data Management/i]
  ];
  const results=[];
  for(const [id,title,nav] of topics){
   const tab=await context.newPage();
   await tab.goto(origin,{waitUntil:'domcontentloaded'});
   // Authentication is stored in localStorage; new pages in this context share it.
   await tab.locator('.owner-sidebar').waitFor({timeout:15000});
   await tab.locator('.owner-sidebar').getByRole('button',{name:nav}).click();
   await sleep(800);
   const h=await tab.locator('h1').allTextContents();
   // Interact only with read-only UI, to avoid creating business records.
   const date=tab.locator('input[type=date]:visible').first();
   if(await date.count()){await date.focus();await sleep(450)}
   const cards=tab.locator('.panel button:visible');if(await cards.count())await cards.first().hover().catch(()=>{});
   await sleep(1900);
   const video=tab.video();await tab.close();
   const temp=await video.path();await copyFile(temp,join(out,id+'.webm'));
   results.push({id,title,file:id+'.webm',heading:h[0]||title});
   console.log('Recorded:',title);
  }
  await page.close();await context.close();
  await writeFile(join(out,'manifest.json'),JSON.stringify(results,null,2)+'\n');
  console.log('Tutorial recordings saved to frontend/src/assets/tutorials');
 }finally{await browser.close()}
}
try{await main()}catch(e){console.error('Tutorial recording stopped:',e.message);process.exitCode=1}finally{if(server){server.kill();await sleep(500)}}
