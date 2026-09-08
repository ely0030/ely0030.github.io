import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {openState,emptyState} from './state.mjs';
import {createPlanningService} from './runtime/planning/service.mjs';
const model={module:{exports:{}}};vm.runInNewContext(await readFile(new URL('../public/filmmaand/films/social-model.js',import.meta.url),'utf8'),model);
const plain=x=>JSON.parse(JSON.stringify(x));
test('five ranks agree across server/client; tail/unranked hearts retain one; reads/replay preserve stored state',async()=>{
 const c=openState(emptyState()),s=createPlanningService({store:c.plans,adminToken:'admin'});
 try{const seed=JSON.parse(await readFile(new URL('./runtime/planning/seed.json',import.meta.url)));seed.id='five-rank';seed.round={shortlist:['blade','matrix','lotr'],derived:false};await s.seed(seed);
 const choices=seed.options.slice(0,7).map(o=>o.id),order=choices.slice(0,6),actor='a'.repeat(43),draft={expectedRevision:0,choices,dates:['2026-09-12'],rankingOrder:order};
 const receipt=await s.submit(seed.id,actor,'ranking-five-save-0001',draft),stored=c.export(),ballot=await s.voteView(seed.id,actor),plan=await s.get(seed.id,actor),expected=Object.fromEntries(choices.map((id,i)=>[id,i<5?5-i:1]));
 assert.equal(plan.nextRound.rule,'rank-5-4-3-2-1');assert.deepEqual(plan.nextRound.ownPoints,expected);assert.deepEqual(plain(model.module.exports.contribution(choices,order)),expected);
 assert.deepEqual((await s.voteView(seed.id,actor)).round,ballot.round);assert.deepEqual(c.export(),stored);
 assert.deepEqual(await s.submit(seed.id,actor,'ranking-five-save-0001',draft),receipt);assert.deepEqual(c.export(),stored);
 }finally{c.close()}
});
test('client respects legacy rule and preview swaps aggregate scores without mutating likes',()=>{
 const choices=['a','b','c','d','e','f'],api=model.module.exports;
 assert.deepEqual(plain(api.contribution(choices,choices,'rank-3-2-1')),{a:3,b:2,c:1,d:1,e:1,f:1});
 const own=api.contribution(choices,choices),ctx={choices,plan:{options:choices.map(id=>({id})),people:[{self:true,choices,rankingOrder:choices}],round:{shortlist:[]},programme:[],nextRound:{rule:'rank-5-4-3-2-1',points:own,ownPoints:own}}};
 assert.deepEqual(plain(api.ranking(ctx,['b','a','c','d','e','f']).candidates.map(c=>[c.optionId,c.score])),[['b',5],['a',4],['c',3]]);
 assert.deepEqual(choices,['a','b','c','d','e','f']);assert.deepEqual(plain(api.contribution(choices,[])),Object.fromEntries(choices.map(id=>[id,1])));
});
