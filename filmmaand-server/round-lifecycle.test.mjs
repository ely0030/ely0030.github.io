import test from 'node:test';
import assert from 'node:assert/strict';
import {createPlanningService} from './runtime/planning/service.mjs';
class Memory{
 row=null;etag=0;beforeCAS=null;
 async read(){return this.row?{data:structuredClone(this.row),etag:String(this.etag)}:null;}
 async compareAndSwap(id,etag,value){if(this.beforeCAS&&await this.beforeCAS(value)===false)return false;if(etag!==(this.row?String(this.etag):null))return false;this.row=structuredClone(value);this.etag++;return true;}
}
const actor='a'.repeat(43),other='b'.repeat(43),admin='organizer-test';
async function fixture(){const store=new Memory();let clock='2026-09-08T12:00:00.000Z',serial=0;const service=createPlanningService({store,adminToken:admin,now:()=>clock});const id='round-proof';await service.seed({id,title:'Isolated',window:{start:'2026-09-01',end:'2026-09-30'},options:['a','b','c','d','e','f','g','h'].map(id=>({id,title:id.toUpperCase()}))});const key=()=>('fixture-key-'+(++serial)).padEnd(22,'x');await service.setRound(id,admin,key(),{shortlist:['a','b','c']});const current=async()=>(await service.voteView(id,actor)).round;const change=async(action,body={})=>{const round=await current();return service.setRound(id,admin,key(),{action,expectedRoundId:round.id,expectedRevision:round.revision,...body});};const submit=(who,choices,rankingOrder)=>service.submit(id,who,key(),{expectedRevision:0,dates:['2026-09-12'],choices,rankingOrder});return {store,service,id,key,current,change,submit,setClock:t=>clock=t};}

test('deadline preserves existing ballot; server boundary blocks changes and old acknowledged receipt replays exactly',async()=>{
 const f=await fixture(),before=await f.current(),k=f.key(),body={expectedRevision:0,final:'a'};
 const receipt=await f.service.vote(f.id,actor,k,body),saved=structuredClone(f.store.row.votes);
 const result=await f.change('deadline',{closesAt:'2026-09-08T12:01:00Z'});assert.equal(result.round.id,before.id);assert.deepEqual(f.store.row.votes,saved);
 await assert.rejects(f.service.vote(f.id,other,f.key(),{expectedRevision:0,final:'b'}),e=>e.code==='round_changed');
 f.setClock('2026-09-08T12:00:59.999Z');await f.service.vote(f.id,other,f.key(),{roundId:before.id,expectedRevision:0,final:'b'});
 f.setClock('2026-09-08T12:01:00.000Z');assert.equal((await f.current()).status,'closed');
 const state=structuredClone(f.store.row);for(const final of ['c',null])await assert.rejects(f.service.vote(f.id,actor,f.key(),{roundId:before.id,expectedRevision:1,final}),e=>e.code==='round_closed');
 assert.deepEqual(await f.service.vote(f.id,actor,k,body),receipt);assert.deepEqual(f.store.row,state);
 assert.equal((await f.service.get(f.id)).round.status,'closed');
 await assert.rejects(f.change('deadline',{closesAt:'2026-09-09T12:00:00Z'}),e=>e.code==='round_closed');
});

test('CAS retry crossing deadline rejects stale attempt rather than accepting a late vote',async()=>{
 const f=await fixture();await f.change('deadline',{closesAt:'2026-09-08T12:01:00Z'});const round=await f.current();let attempts=0;
 f.store.beforeCAS=async p=>{if(p.votes&&++attempts===1){f.setClock('2026-09-08T12:01:00Z');return false;}};
 await assert.rejects(f.service.vote(f.id,actor,f.key(),{roundId:round.id,expectedRevision:0,final:'a'}),e=>e.code==='round_closed');assert.equal(f.store.row.votes,undefined);
});

test('ranked pipeline archives old votes, starts empty, and rejects stale writes even when a film returns later',async()=>{
 const f=await fixture();await f.submit(actor,['a','b','c','d','e','f'],['d','e','f','a','b','c']);await f.change('deadline',{closesAt:'2026-09-08T13:00:00Z'});
 const first=await f.current(),oldKey=f.key(),oldBody={roundId:first.id,expectedRevision:0,final:'a'},oldReceipt=await f.service.vote(f.id,actor,oldKey,oldBody),responses=structuredClone(f.store.row.responses);
 await f.change('close');await f.change('resolve',{choice:'a'});
 let next=(await f.service.get(f.id)).nextRound;assert.deepEqual(next.shortlist,['d','e','f']);assert.deepEqual(['d','e','f'].map(id=>next.points[id]),[5,4,3]);
 const opened=await f.change('open',{selectionSnapshot:next.snapshot,shortlist:next.shortlist,closesAt:'2026-09-09T12:00:00Z',scheduledDate:'2026-09-14'});assert.notEqual(opened.round.id,first.id);assert.equal((await f.service.voteView(f.id,actor)).own.final,null);assert.deepEqual(f.store.row.responses,responses);
 const second=await f.current();await f.service.vote(f.id,actor,f.key(),{roundId:second.id,expectedRevision:0,final:'d'});await f.change('close');await f.change('resolve',{choice:'d'});
 next=(await f.service.get(f.id)).nextRound;assert.deepEqual(next.shortlist,['a','b','c']);await f.change('open',{selectionSnapshot:next.snapshot,shortlist:next.shortlist,closesAt:'2026-09-10T12:00:00Z',scheduledDate:'2026-09-16'});
 assert.equal(f.store.row.roundHistory.length,2);assert.equal(Object.values(f.store.row.roundHistory[0].votes)[0].final,'a');
 await assert.rejects(f.service.vote(f.id,actor,f.key(),oldBody),e=>e.code==='round_changed');assert.deepEqual(await f.service.vote(f.id,actor,oldKey,oldBody),oldReceipt);assert.equal((await f.service.voteView(f.id,actor)).own.final,null);assert.deepEqual(f.store.row.responses,responses);
});

test('cutoff ties are explicit; higher places are required and stale ranking snapshots cannot open',async()=>{
 const f=await fixture();await f.submit(actor,['d','e','f','g'],['d']);await f.change('close');await f.change('resolve',{choice:'a'});
 let next=(await f.service.get(f.id)).nextRound;assert.equal(next.ready,false);assert.deepEqual(next.cutoffTieIds,['e','f','g']);
 await assert.rejects(f.change('open',{selectionSnapshot:next.snapshot,shortlist:['e','f','g'],closesAt:'2026-09-09T12:00:00Z',scheduledDate:'2026-09-14'}),e=>e.code==='shortlist');
 const stale=next.snapshot;await f.submit(other,['h'],['h']);
 await assert.rejects(f.change('open',{selectionSnapshot:stale,shortlist:['d','e','f'],closesAt:'2026-09-09T12:00:00Z',scheduledDate:'2026-09-14'}),e=>e.code==='ranking_changed');
 next=(await f.service.get(f.id)).nextRound;await f.change('open',{selectionSnapshot:next.snapshot,shortlist:['d','h','g'],closesAt:'2026-09-09T12:00:00Z',scheduledDate:'2026-09-14'});assert.deepEqual((await f.current()).shortlist,['d','h','g']);
});

test('resolve links the explicit pending screening once, requires actual tied leader, retains dates and exact admin replay',async()=>{
 const f=await fixture();await f.service.scheduleRound(f.id,admin,f.key(),{date:'2026-09-12'});const night=await f.service.planNight(f.id,admin,f.key(),{scheduledDate:'2026-09-12',selection:'pending',choices:[]});
 await f.change('deadline',{closesAt:'2026-09-08T13:00:00Z'});const r=await f.current();for(const [who,final]of [[actor,'a'],[other,'b']])await f.service.vote(f.id,who,f.key(),{roundId:r.id,expectedRevision:0,final});await f.change('close');
 await assert.rejects(f.change('resolve',{choice:'c'}),e=>e.code==='round_choice');
 const before=await f.current(),key=f.key(),body={action:'resolve',expectedRoundId:before.id,expectedRevision:before.revision,choice:'b',programme:true,programmeId:night.night.id};
 const result=await f.service.setRound(f.id,admin,key,body);assert.equal(result.round.result.kind,'tie-resolved');assert.deepEqual(await f.service.setRound(f.id,admin,key,body),result);assert.equal(f.store.row.programme.length,1);assert.equal(f.store.row.programme[0].scheduledDate,'2026-09-12');assert.equal(f.store.row.programme[0].startsAt,undefined);assert.deepEqual(f.store.row.programme[0].choices,['b']);assert.equal(f.store.row.programme[0].roundId,r.id);
});

test('invalid deadline, stale admin, unsafe legacy replacement and unauthorized calls leave state intact',async()=>{
 const f=await fixture();let r=await f.current(),before=structuredClone(f.store.row);
 for(const closesAt of [null,'2026-02-31T12:00:00Z','2026-09-08T11:00:00Z','tomorrow'])await assert.rejects(f.change('deadline',{closesAt}),e=>e.code==='round_deadline');assert.deepEqual(f.store.row,before);
 await assert.rejects(f.service.setRound(f.id,'wrong',f.key(),{action:'close',expectedRoundId:r.id,expectedRevision:r.revision}),e=>e.status===401);
 await f.change('deadline',{closesAt:'2026-09-08T13:00:00Z'});await assert.rejects(f.service.setRound(f.id,admin,f.key(),{action:'close',expectedRoundId:r.id,expectedRevision:r.revision}),e=>e.code==='round_conflict');
 await assert.rejects(f.service.setRound(f.id,admin,f.key(),{shortlist:['d','e','f']}),e=>e.code==='round_lifecycle');
 assert.equal((await f.service.voteView(f.id,other)).final,null);
});

test('zero votes and too few ranked candidates require explicit decisions, never invented ballots',async()=>{
 const f=await fixture();await f.change('close');assert.equal((await f.current()).result,null);assert.deepEqual(f.store.row.round.finalTally.leaderIds,[]);await f.change('resolve',{choice:'b'});assert.equal((await f.current()).result.kind,'organizer-choice');
 const next=(await f.service.get(f.id)).nextRound;assert.equal(next.ready,false);assert.deepEqual(next.shortlist,[]);const before=structuredClone(f.store.row);
 await assert.rejects(f.change('open',{selectionSnapshot:next.snapshot,shortlist:['d','e','f'],closesAt:'2026-09-09T12:00:00Z',scheduledDate:'2026-09-14'}),e=>e.code==='shortlist');assert.deepEqual(f.store.row,before);
});
