import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {openState,emptyState} from './state.mjs';
import {createPlanningService} from './runtime/planning/service.mjs';
import {createActorTransfer} from './runtime/planning/auth/transfer.mjs';
test('proposer-only public flag follows exact owner through claim; identical profiles cannot hide another liker',async()=>{
 const c=openState(emptyState()),s=createPlanningService({store:c.plans,adminToken:'admin'}),a='a'.repeat(43),b='b'.repeat(43),profile={name:'Bas',avatarId:7};
 try{
  const seed=JSON.parse(await readFile(new URL('./runtime/planning/seed.json',import.meta.url)));seed.id='proposer-liker';await s.seed(seed);
  const {option}=await s.suggest(seed.id,a,'suggest-proposer-0001',{title:'Exact owner fixture',recommender:profile});
  const flag=async()=>{const before=c.export(),p=await s.get(seed.id);assert.deepEqual(c.export(),before);return p.options.find(o=>o.id===option.id).proposerOnlyLiker;};
  assert.equal(await flag(),false);
  await s.updateProfile(seed.id,a,'profile-owner-0001',{expectedRevision:0,recommender:profile});
  await s.updateProfile(seed.id,b,'profile-other-0001',{expectedRevision:0,recommender:profile});
  await s.submit(seed.id,a,'like-proposer-0001',{expectedRevision:0,choices:[option.id],dates:[]});assert.equal(await flag(),true);
  await s.submit(seed.id,b,'like-other-000001',{expectedRevision:0,choices:[option.id],dates:[]});assert.equal(await flag(),false);
  await s.submit(seed.id,a,'unlike-proposer-001',{expectedRevision:1,choices:[],dates:[]});assert.equal(await flag(),false);
  await s.submit(seed.id,b,'unlike-other-00001',{expectedRevision:1,choices:[],dates:[]});
  await s.submit(seed.id,a,'relike-proposer-01',{expectedRevision:2,choices:[option.id],dates:[]});
  await createActorTransfer({store:c.plans})(seed.id,createHash('sha256').update(a).digest('hex'),'p_claimed-proposer','claim-proposer-0001');assert.equal(await flag(),true);
  assert.equal(Object.hasOwn((await s.get(seed.id)).options.find(o=>o.kind!=='suggestion'),'proposerOnlyLiker'),false);
 }finally{c.close();}
});
