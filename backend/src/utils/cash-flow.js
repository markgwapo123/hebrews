export function calculateCashFlow({from,to,capital=[],expenses=[],stock=[],losses=[],sales=[]}){
 const valid=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
 if(!valid(from)||!valid(to)||from>to)throw new Error('Valid from/to dates required');
 const start=new Date(from+'T00:00:00+08:00'),end=new Date(new Date(to+'T00:00:00+08:00').getTime()+86400000);
 if((end-start)/86400000>365)throw new Error('Select at most 365 days');
 const ph=d=>{const parts=new Intl.DateTimeFormat('en-US',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));return p.year+'-'+p.month+'-'+p.day;};
 const daily=new Map();
 const get=date=>{if(!daily.has(date))daily.set(date,{date,capitalAdded:0,withdrawals:0,purchases:0,inventoryLoss:0,sales:0,cogs:0,expenses:0});return daily.get(date);};
 for(const c of capital)get(ph(c.date))[c.kind==='contribution'?'capitalAdded':'withdrawals']+=c.amount;
 for(const e of expenses)get(ph(e.date)).expenses+=e.amount;
 for(const m of stock)get(ph(m.createdAt)).purchases+=Math.abs(m.quantityDelta)*(m.unitCostSnapshot||0);
 for(const m of losses)get(ph(m.createdAt)).inventoryLoss+=Math.abs(m.quantityDelta)*(m.unitCostSnapshot||0);
 for(const sale of sales){const d=get(sale.businessDate);d.sales+=sale.totalRevenue;d.cogs+=sale.totalCost;}
 const dates=[...daily.keys()].sort();let cursor=0,cash=0,capitalInvested=0;
 const apply=date=>{const d=daily.get(date);cash+=d.capitalAdded+d.sales-d.withdrawals-d.purchases-d.expenses;capitalInvested+=d.capitalAdded;};
 while(cursor<dates.length&&dates[cursor]<from){apply(dates[cursor]);cursor++;}
 const days=[];
 for(let time=start.getTime();time<end.getTime();time+=86400000){
  const date=ph(new Date(time));
  while(cursor<dates.length&&dates[cursor]<date){apply(dates[cursor]);cursor++;}
  const openingCash=cash,d=get(date);apply(date);
  if(dates[cursor]===date)cursor++;
  days.push({...d,openingCash,closingCash:cash,totalCapitalInvested:capitalInvested,grossProfit:d.sales-d.cogs,netProfit:d.sales-d.cogs-d.expenses-d.inventoryLoss});
 }
 return days;
}
