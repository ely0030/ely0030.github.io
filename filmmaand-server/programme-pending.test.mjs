import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openState,emptyState} from './state.mjs';
import {createPlanningService} from './runtime/planning/service.mjs';

async function fixture(){
 const c=openState(emptyState());
 const s=createPlanningService({store:c.plans,adminToken:'admin',now:()=> '2026-09-08T07:00:00.000Z'});
 const seed=JSON.parse(await readFile(new URL('./runtime/planning/seed.json',import.meta.url)));
 seed.id='pending-contract';seed.round={shortlist:['blade','matrix','lotr'],derived:false};seed.roundSchedule={date:'2026-09-12'};
 await s.seed(seed);return {c,s,id:seed.id};
}
const pending={scheduledDate:'2026-09-12',selection:'pending',choices:[]};
const rejects=(action,code,status=400)=>assert.rejects(action,e=>e.code===code&&e.status===status);

test('explicit date-only pending projects without a film, time or voting association; replay is exact',async()=>{
 const {c,s,id}=await fixture();try{
  const before=await s.get(id),a=await s.planNight(id,'admin','pending-create-0001',pending);
  assert.deepEqual(Object.keys(a.night).sort(),['id','scheduledDate','selection','choices'].sort());
  assert.equal(a.night.scheduledDate,'2026-09-12');assert.equal(a.night.selection,'pending');assert.deepEqual(a.night.choices,[]);
  const after=await s.get(id);assert.deepEqual(after.programme,[a.night]);assert.deepEqual(after.round,before.round);
  assert.equal((await s.voteView(id,'a'.repeat(43))).round.planned,false);
  const stored=c.export();assert.deepEqual(await s.planNight(id,'admin','pending-create-0001',pending),a);assert.deepEqual(c.export(),stored);
  await rejects(s.planNight(id,'admin','pending-create-0001',{...pending,scheduledDate:'2026-09-13'}),'key_reused',409);
  assert.deepEqual(c.export(),stored);
 }finally{c.close()}
});

test('pending is never inferred and rejects mixed films, invalid timing and association fields without a write',async()=>{
 const {c,s,id}=await fixture();try{
  const before=c.export();
  const cases=[
   [{scheduledDate:'2026-09-12',choices:[]},'choices'],
   [{...pending,choices:['blade']},'choices'],[{...pending,choices:null},'choices'],
   [{scheduledDate:pending.scheduledDate,selection:'pending'},'choices'],
   [{...pending,scheduledDate:'2026-09-31'},'event_time'],[{...pending,scheduledDate:'2026-10-01'},'event_time'],
   [{selection:'pending',choices:[]},'event_time'],
   [{...pending,startsAt:'2026-09-12T18:00:00Z'},'event_time'],
   [{...pending,selection:'voting'},'selection'],[{...pending,selection:'mystery'},'selection'],
   [{...pending,selection:null},'selection'],[{...pending,selection:'chosen',choices:['blade']},'selection'],
   ...['roundId','round','roundAssociation','activeRoundId','id','confirmedAt'].map(k=>[{...pending,[k]:'not-authoritative'},'selection'])
  ];
  for(const [body,code] of cases)await rejects(s.planNight(id,'admin','rejected-pending-0001',body),code);
  await rejects(s.planNight(id,'not-admin','rejected-pending-0001',pending),'unauthorized',401);
  assert.deepEqual(c.export(),before);
 }finally{c.close()}
});

test('transition-shaped requests are unsupported and cannot update or append another night',async()=>{
 const {c,s,id}=await fixture();try{
  const {night}=await s.planNight(id,'admin','pending-create-0005',pending),before=c.export();
  for(const body of [
   {nightId:night.id,selection:'chosen',choices:['blade']},
   {...pending,nightId:night.id},
   {nightId:night.id,scheduledDate:'2026-09-13',choices:['blade']},
   {nightId:'missing',selection:'chosen',choices:['blade']},
   {nightId:null,selection:'chosen',choices:['blade']}
  ])await rejects(s.planNight(id,'admin','transition-fail-0005',body),'programme_transition');
  assert.deepEqual(c.export(),before);assert.deepEqual((await s.get(id)).programme,[night]);
 }finally{c.close()}
});

test('real timestamp pending preserves actual time; legacy chosen date/time shapes remain unchanged',async()=>{
 const {c,s,id}=await fixture();try{
  const {night}=await s.planNight(id,'admin','pending-time-0001',{startsAt:'2026-09-15T18:30:00Z',selection:'pending',choices:[]});
  assert.equal(night.startsAt,'2026-09-15T18:30:00.000Z');assert.equal('scheduledDate' in night,false);
  for(const timing of [{scheduledDate:'2026-09-17'},{startsAt:'2026-09-18T18:30:00Z'}]){
   const result=await s.planNight(id,'admin','legacy-shape-'+Object.keys(timing)[0],{...timing,choices:['indiana']});
   assert.equal('selection' in result.night,false);assert.deepEqual(result.night.choices,['indiana']);assert.ok(result.night.confirmedAt);
   assert.equal(Object.keys(result.night).length,4);
  }
 }finally{c.close()}
});

test('pending creation leaves personal votes/preferences/receipts and active round untouched, even on its date',async()=>{
 const {c,s,id}=await fixture();try{
  const actor='a'.repeat(43);await s.submit(id,actor,'personal-save-0001',{expectedRevision:0,name:'Synthetic',dates:['2026-09-12'],choices:['blade','matrix'],rankingOrder:['matrix','blade']});
  await s.vote(id,actor,'personal-vote-0001',{expectedRevision:0,final:'matrix'});
  const before=c.export().plans[id].data,view=await s.voteView(id,actor);
  await s.planNight(id,'admin','pending-personal-0001',pending);
  const after=c.export().plans[id].data;
  for(const key of ['responses','votes','round','roundSchedule','confirmation','displayProfiles'])assert.deepEqual(after[key],before[key]);
  for(const [key,value] of Object.entries(before.receipts))assert.deepEqual(after.receipts[key],value);
  assert.deepEqual(await s.voteView(id,actor),view);assert.equal((await s.get(id)).programme[0].selection,'pending');
 }finally{c.close()}
});

test('concurrent exact create retries append one pending entry',async()=>{
 const {c,s,id}=await fixture();try{
  const outcomes=await Promise.all([s.planNight(id,'admin','pending-race-0001',pending),s.planNight(id,'admin','pending-race-0001',pending)]);
  assert.deepEqual(outcomes[0],outcomes[1]);assert.deepEqual((await s.get(id)).programme,[outcomes[0].night]);
 }finally{c.close()}
});
