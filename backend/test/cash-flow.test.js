import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCashFlow } from '../src/utils/cash-flow.js';

const d=(date)=>new Date(date+'T12:00:00+08:00');
test('cash carryover across purchases, sales, capital and expenses',()=>{
 const rows=calculateCashFlow({from:'2026-11-01',to:'2026-11-03',
 capital:[{date:d('2026-11-01'),kind:'contribution',amount:5000},{date:d('2026-11-02'),kind:'contribution',amount:7000}],
 expenses:[{date:d('2026-11-02'),amount:100}],
 stock:[{createdAt:d('2026-11-01'),quantityDelta:10,unitCostSnapshot:20}],
 sales:[{businessDate:'2026-11-02',totalRevenue:600,totalCost:240}]});
 assert.equal(rows.length,3);
 assert.deepEqual(rows.map(r=>r.openingCash),[0,4800,12300]);
 assert.deepEqual(rows.map(r=>r.closingCash),[4800,12300,12300]);
 assert.deepEqual(rows.map(r=>r.totalCapitalInvested),[5000,12000,12000]);
 assert.equal(rows[1].grossProfit,360);
 assert.equal(rows[1].netProfit,260);
});
test('opening cash includes events before selected range',()=>{
 const rows=calculateCashFlow({from:'2026-11-02',to:'2026-11-02',capital:[{date:d('2026-11-01'),kind:'contribution',amount:1000}],expenses:[],stock:[],sales:[]});
 assert.equal(rows[0].openingCash,1000);
 assert.equal(rows[0].closingCash,1000);
});
test('void sales excluded by caller query, and missing days have zero movements',()=>{
 const rows=calculateCashFlow({from:'2026-11-01',to:'2026-11-03',capital:[],expenses:[],stock:[],sales:[]});
 assert.equal(rows.length,3);
 assert.ok(rows.every(r=>r.openingCash===0&&r.closingCash===0));
});
test('invalid dates are rejected',()=>{
 for(const date of ['2026-02-30','2026-13-01','not-a-date','2026-1-1'])assert.throws(()=>calculateCashFlow({from:date,to:date,capital:[],expenses:[],stock:[],sales:[]}));
});
