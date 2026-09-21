// The public plan GET used to await one provider round trip per film before answering, so a cold
// instance paid the whole catalogue on every poll. It now enriches under a budget. These checks
// pin both halves: a warm instance still enriches everything, a slow one answers anyway.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {emptyState,openState} from './state.mjs';

const BUDGET=300;
process.env.FILMMAAND_ENRICH_BUDGET_MS=String(BUDGET);
const {createPlanningService}=await import('./runtime/planning/service.mjs');

const IDS=Array.from({length:24},(_,i)=>'tt'+String(1000001+i));
const STORED='https://m.media-amazon.com/images/M/stored@._V1_QL75_UX600_.jpg';

async function fixture({delay=0}={}){
 const asked=[];
 const details=async id=>{asked.push(id);if(delay)await new Promise(r=>setTimeout(r,delay));return {id}};
 const c=openState(emptyState());
 const s=createPlanningService({store:c.plans,adminToken:'fixture',movieCatalogue:{get:()=>null,details}});
 const seed=JSON.parse(await readFile(new URL('./runtime/planning/seed.json',import.meta.url)));
 seed.id='enrichment-fixture';
 seed.options=IDS.map((id,i)=>({id:'o'+i,title:'Film '+i,movie:{id,poster:STORED}}));
 await s.seed(seed);
 return {c,s,id:seed.id,asked};
}

test('a warm instance still enriches every film in the plan',async()=>{
 const {c,s,id,asked}=await fixture();                       // resolved entries cost no time
 try{
  const out=await s.get(id);
  assert.deepEqual([...new Set(asked)].sort(),[...IDS].sort());
  assert.equal(out.options.length,IDS.length);
 }finally{c.close()}
});

test('a cold instance answers within the budget instead of one round trip per film',async()=>{
 const perCall=200,{c,s,id,asked}=await fixture({delay:perCall});
 try{
  const started=Date.now();
  const out=await s.get(id);
  const elapsed=Date.now()-started;
  const unbounded=Math.ceil(IDS.length/4)*perCall;           // what the old loop would have cost
  assert.ok(elapsed<unbounded*0.75,'returned in '+elapsed+'ms, unbounded would be ~'+unbounded+'ms');
  assert.ok(asked.length>0&&asked.length<IDS.length,'asked for '+asked.length+' of '+IDS.length);
  // Artwork committed to the plan is served regardless; only provider extras wait for a later poll.
  assert.equal(out.options.at(-1).movie.poster,STORED);
 }finally{c.close()}
});
