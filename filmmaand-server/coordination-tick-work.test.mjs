// The scheduled tick reports which drains have work so an idle minute costs one state read instead
// of four. The only dangerous failure is a FALSE NEGATIVE — a hint that says "nothing queued" while
// something is queued would strand a send until a mutation happened to arrive. These pin that edge.
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyState} from './state.mjs';
import {runCoordinationTick} from './date-coordination-tick.mjs';

const NOW='2026-09-21T12:00:00.000Z';
function memoryStore(state){
 let data=structuredClone(state),etag='1';
 return {
  getWithMetadata:async()=>({data:structuredClone(data),etag}),
  setJSON:async(_k,next,opts={})=>{
   if(opts.onlyIfMatch&&opts.onlyIfMatch!==etag)return {modified:false};
   data=structuredClone(next);etag=String(Number(etag)+1);return {modified:true};
  },
  read:()=>data,
 };
}
const tick=state=>runCoordinationTick({store:memoryStore(state),now:()=>NOW});

test('an idle state reports no work, so no drain reads the blob again',async()=>{
 const {work}=await tick(emptyState());
 assert.deepEqual(work,{events:false,mail:false,tonight:false});
});

test('a queued login code is reported',async()=>{
 const s=emptyState();s.outbox={'code-1':{to:'x@example.test',subject:'s',text:'t',expiresAt:NOW,createdAt:NOW}};
 assert.equal((await tick(s)).work.mail,true);
});

test('an expired mail receipt is reported so pruning still happens',async()=>{
 const s=emptyState();s.mailReceipts=[{id:'r1',retainUntil:'2026-09-01T00:00:00.000Z'}];
 assert.equal((await tick(s)).work.mail,true);
 const fresh=emptyState();fresh.mailReceipts=[{id:'r1',retainUntil:'2027-01-01T00:00:00.000Z'}];
 assert.equal((await tick(fresh)).work.mail,false,'a receipt still inside retention is not work');
});

test('a pending event notification is reported, a delivered one is not',async()=>{
 const s=emptyState();
 s.eventNotifications={version:1,seen:{},receipts:[],outbox:{a:{id:'a',status:'pending'}}};
 assert.equal((await tick(s)).work.events,true);
 const done=structuredClone(s);done.eventNotifications.outbox.a.status='accepted';
 assert.equal((await tick(done)).work.events,false);
});

test('a pending organizer message is reported under any event id',async()=>{
 const s=emptyState();
 s.tonight={'tonight-2026-09-15':{responses:{},receipts:{},messages:{m1:{id:'m1',status:'pending'}}}};
 assert.equal((await tick(s)).work.tonight,true);
 const done=structuredClone(s);done.tonight['tonight-2026-09-15'].messages.m1.status='accepted';
 assert.equal((await tick(done)).work.tonight,false);
});
