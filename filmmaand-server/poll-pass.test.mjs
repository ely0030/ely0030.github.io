import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createApi} from './api.mjs';import {openState,emptyState} from './state.mjs';import {createPlanningService} from './runtime/planning/service.mjs';
// The real target: wo 23 – za 26 september 2026, poll closes the evening before the first candidate night.
const ORIGIN='https://example.test',NIGHTS=['2026-09-23','2026-09-24','2026-09-25','2026-09-26'],CLOSES='2026-09-22T21:00:00.000Z';
const sha=x=>createHash('sha256').update(x).digest('hex');
// manual:true is the real target after Chris's 23 Sept decision: today wo 23, nights do 24 – za 26, the organiser picks, no deadline.
const MANUAL_NIGHTS=NIGHTS.slice(1);
async function fixture({manual=false}={}){
 const c=openState(emptyState()),s=createPlanningService({store:c.plans,adminToken:'secret'});
 for(const id of ['proof','other'])await s.seed({id,title:id,window:{start:'2026-09-01',end:'2026-09-30'},options:['a','b','c'].map(x=>({id:x,title:x}))});
 let writes=0;const store={data:c.export(),etag:1,async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}},async setJSON(k,v,{onlyIfMatch}){if(onlyIfMatch!==String(this.etag))return {modified:false};writes++;this.data=structuredClone(v);this.etag++;return {modified:true}}};c.close();
 const clock={now:manual?'2026-09-23T10:00:00.000Z':'2026-09-22T10:00:00.000Z'},ids=[];let code;
 const api=createApi({store,mailActive:()=>true,blobs:{},adminToken:'secret',organizerIds:ids,origin:ORIGIN,queueMail:async(c,m)=>{code=m.code},now:()=>clock.now});
 async function request(path,method='GET',body,headers={}){const r=await api(new Request(ORIGIN+'/filmmaand/api/'+path,{method,headers:{Origin:ORIGIN,...headers},...(body?{body:JSON.stringify(body)}:{})}),{ip:'fixture'});return {status:r.status,body:await r.json(),headers:r.headers}}
 async function login(email){const ch=await request('auth/code','POST',{email}),r=await request('auth/verify','POST',{challengeId:ch.body.challengeId,code});assert.equal(r.status,200,JSON.stringify(r.body));return {cookie:r.headers.get('set-cookie').split(';')[0],participant:r.body.participant}}
 async function account(email,name,avatarId,onboard=true){const {cookie,participant}=await login(email),id=participant.id;if(onboard)assert.equal((await request('auth/profile','PUT',{expectedRevision:0,name,animal:'otter',avatarId},{Cookie:cookie,'Idempotency-Key':'profile-key-'+avatarId+'-000000'})).status,200);return {cookie,id,email,name}}
 const admin=(key,extra={})=>({Authorization:'Bearer secret','Idempotency-Key':key,...extra});
 async function openPoll(plan,key,window=manual?{start:MANUAL_NIGHTS[0],end:MANUAL_NIGHTS[2]}:{start:NIGHTS[0],end:NIGHTS[3]},closesAt=manual?undefined:CLOSES){const r=await request('plans/'+plan+'/date-poll','POST',{action:'open',mode:'availability',window,choices:[],...(closesAt?{closesAt}:{}),...(manual?{pick:'manual'}:{})},admin(key));assert.equal(r.status,200,JSON.stringify(r.body));return r.body.datePoll.id}
 const noor=await account('noor@example.test','Noor',4),sam=await account('sam@example.test','Sam',7),joep=await account('joep@example.test','Joep',9),nieuw=await account('nieuw@example.test','',11,false);
 const pollId=await openPoll('proof','open-poll-proof-0001'),otherPollId=await openPoll('other','open-poll-other-0001');
 async function issue(emails,plan='proof',poll=pollId,extra={}){const r=await request('plans/'+plan+'/date-poll','POST',{action:'issue-passes',pollId:poll,emails,...extra},admin('unused-key-000000001'));assert.equal(r.status,200,JSON.stringify(r.body));return Object.fromEntries(r.body.passes.map(p=>[p.email,p]))}
 const minted=await issue([noor.email,sam.email,joep.email]);
 const pass=(who,extra={})=>({'X-Filmmaand-Poll-Pass':typeof who==='string'?who:minted[who.email].token,...extra});
 const answer=(revision,yes,favourite=null)=>({pollId,revision,availability:Object.fromEntries((manual?MANUAL_NIGHTS:NIGHTS).map(d=>[d,yes.includes(d)])),favourite});
 return {store,clock,ids,request,login,admin,openPoll,issue,minted,pass,answer,pollId,otherPollId,noor,sam,joep,nieuw,writes:()=>writes};
}
const snapshot=f=>JSON.stringify(f.store.data)+'#'+f.store.etag;

test('a scanner-style GET changes nothing: any pass state, any number of fetches, byte-identical state and no write',async()=>{
 const f=await fixture();await f.request('plans/proof/date-poll','POST',{action:'revoke-passes',pollId:f.pollId,emails:[f.joep.email]},f.admin('unused-key-000000002'));
 const before=snapshot(f),writes=f.writes();
 f.clock.now='2026-09-22T11:30:00.000Z';// the scanner fetches later than the mint; anything time-stamped on read would show
 for(let i=0;i<3;i++){
  assert.equal((await f.request('plans/proof/date-poll','GET',null,f.pass(f.noor))).status,200);
  assert.equal((await f.request('plans/proof/date-poll','GET',null,f.pass(f.joep))).status,401);// revoked
  assert.equal((await f.request('plans/other/date-poll','GET',null,f.pass(f.noor))).status,401);// wrong plan
  assert.equal((await f.request('plans/proof/date-poll','GET',null,f.pass('A'.repeat(43)))).status,401);// unknown
  assert.equal((await f.request('plans/proof/date-poll?pas='+f.minted[f.noor.email].token)).status,401);// a query param is not a credential for the API
  assert.equal((await f.request('plans/proof','GET',null,f.pass(f.noor))).status,200);// public plan GET ignores the pass
 }
 assert.equal(snapshot(f),before);assert.equal(f.writes(),writes);
});

test('vote via pass writes only that person\'s own dates for that poll, and the pass opens nothing else',async()=>{
 const f=await fixture();
 const sam=await f.request('plans/proof/date-poll','PUT',f.answer(0,[NIGHTS[1]]),f.pass(f.sam,{'Idempotency-Key':'sam-vote-key-000001'}));assert.equal(sam.status,200);
 const before=structuredClone(f.store.data);
 const r=await f.request('plans/proof/date-poll','PUT',f.answer(0,[NIGHTS[0],NIGHTS[2],NIGHTS[3]],NIGHTS[3]),f.pass(f.noor,{'Idempotency-Key':'noor-vote-key-00001'}));
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.revision,1);assert.equal(r.body.pollId,f.pollId);
 const view=await f.request('plans/proof/date-poll','GET',null,f.pass(f.noor));assert.equal(view.body.viewer.name,'Noor');assert.equal(view.body.poll.voteCount,2);assert.equal(view.body.poll.ranking.find(x=>x.date===NIGHTS[3]).available,1);
 assert.deepEqual(r.body.availability,{[NIGHTS[0]]:true,[NIGHTS[1]]:false,[NIGHTS[2]]:true,[NIGHTS[3]]:true});
 const after=f.store.data,votes=after.plans.proof.data.datePoll.votes;
 assert.deepEqual(Object.keys(votes).sort(),['p_'+f.noor.id,'p_'+f.sam.id].sort());
 assert.deepEqual(votes['p_'+f.sam.id],before.plans.proof.data.datePoll.votes['p_'+f.sam.id]);
 // Strip exactly what a vote may touch; everything else — auth, other plan, other people, programme — is identical.
 const strip=s=>{s=structuredClone(s);const p=s.plans.proof;delete p.data.datePoll.votes['p_'+f.noor.id];p.data.receipts=Object.fromEntries(Object.entries(p.data.receipts).filter(([k])=>!k.startsWith('p_'+f.noor.id+':')));delete p.version;delete p.data.version;return s};
 assert.deepEqual(strip(after),strip(before));
 // A body naming someone else is refused by the strict shape; there is no field that selects the voter.
 assert.equal((await f.request('plans/proof/date-poll','PUT',{...f.answer(1,[]),participantId:f.sam.id},f.pass(f.noor,{'Idempotency-Key':'noor-vote-key-00002'}))).status,400);
 // The pass is not a login: no cookie, and every other route treats the request as anonymous.
 assert.equal(r.headers.get('set-cookie'),null);
 assert.equal((await f.request('auth/session','GET',null,f.pass(f.noor))).body.participant,null);
 for(const [path,method,body] of [['plans/proof/response','GET'],['plans/proof/profile','GET'],['auth/profile','GET'],['plans/proof/vote','PUT',{}],['plans/proof/response','PUT',{}],['plans/proof/coordination','PUT',{}],['notifications','GET']]){
  const x=await f.request(path,method,body,f.pass(f.noor,{'Idempotency-Key':'other-route-key-0001'}));assert.ok(x.status===401,path+' '+method+' -> '+x.status);
 }
 // Organiser actions are not reachable with a pass.
 assert.equal((await f.request('plans/proof/date-poll','POST',{action:'issue-passes',pollId:f.pollId,emails:[f.noor.email]},f.pass(f.noor))).status,401);
 assert.equal((await f.request('plans/proof/date-poll','POST',{action:'close',pollId:f.pollId},f.pass(f.noor,{'Idempotency-Key':'close-by-pass-00001'}))).status,405);assert.equal(f.store.data.plans.proof.data.datePoll.status,'open');
});

test('a pass for poll A is rejected on poll B: other plan, and a newer poll on the same plan',async()=>{
 const f=await fixture(),vote=(plan,poll,key)=>f.request('plans/'+plan+'/date-poll','PUT',{...f.answer(0,[NIGHTS[0]]),pollId:poll},f.pass(f.noor,{'Idempotency-Key':key}));
 const before=JSON.stringify(f.store.data.plans.other);
 assert.equal((await f.request('plans/other/date-poll','GET',null,f.pass(f.noor))).body.error.code,'pass_invalid');
 assert.equal((await vote('other',f.otherPollId,'cross-plan-key-00001')).body.error.code,'pass_invalid');
 assert.equal(JSON.stringify(f.store.data.plans.other),before);
 assert.equal((await f.request('plans/proof/date-poll','POST',{action:'close',pollId:f.pollId},f.admin('close-poll-proof-001'))).status,200);
 const next=await f.openPoll('proof','open-poll-proof-0002');
 assert.equal((await f.request('plans/proof/date-poll','GET',null,f.pass(f.noor))).body.error.code,'pass_invalid');
 assert.equal((await vote('proof',next,'cross-poll-key-00001')).body.error.code,'pass_invalid');
 assert.deepEqual(f.store.data.plans.proof.data.datePoll.votes,{});
 // A pass minted for the new poll works there.
 const fresh=await f.issue([f.noor.email],'proof',next);
 assert.equal((await f.request('plans/proof/date-poll','GET',null,f.pass(fresh[f.noor.email].token))).body.pollId,next);
});

test('revoked, rotated and expired passes are rejected; within grace the poll is readable but closed',async()=>{
 const f=await fixture(),get=who=>f.request('plans/proof/date-poll','GET',null,f.pass(who));
 const revoke=await f.request('plans/proof/date-poll','POST',{action:'revoke-passes',pollId:f.pollId,emails:[f.noor.email]},f.admin('unused-key-000000003'));
 assert.deepEqual(revoke.body,{pollId:f.pollId,revoked:1});
 assert.equal((await get(f.noor)).body.error.code,'pass_invalid');
 assert.equal((await f.request('plans/proof/date-poll','PUT',f.answer(0,[NIGHTS[0]]),f.pass(f.noor,{'Idempotency-Key':'revoked-vote-key-001'}))).body.error.code,'pass_invalid');
 // Re-issuing to someone with a live link only rotates with an explicit rotate:true (Beheer never sends it).
 const oldSam=f.minted[f.sam.email].token,rotated=await f.issue([f.sam.email],'proof',f.pollId,{rotate:true});
 assert.notEqual(rotated[f.sam.email].token,oldSam);
 assert.equal((await get(oldSam)).body.error.code,'pass_invalid');assert.equal((await get(rotated[f.sam.email].token)).status,200);
 const list=await f.request('plans/proof/date-poll','POST',{action:'list-passes',pollId:f.pollId},f.admin('unused-key-000000004'));
 assert.deepEqual(list.body.passes.map(p=>[p.name,p.status]),[['Noor','revoked'],['Sam','revoked'],['Joep','active'],['Sam','active']]);
 assert.equal(JSON.stringify(list.body).includes(oldSam),false);
 f.clock.now='2026-09-23T08:00:00.000Z';// after close, inside grace
 const late=await get(f.joep);assert.equal(late.status,200);
 assert.equal((await f.request('plans/proof/date-poll','PUT',f.answer(0,[NIGHTS[0]]),f.pass(f.joep,{'Idempotency-Key':'late-vote-key-00001'}))).body.error.code,'date_poll_closed');
 f.clock.now=new Date(Date.parse(CLOSES)+24*3600e3).toISOString();// grace over
 assert.equal((await get(f.joep)).body.error.code,'pass_invalid');
});

test('wrong or malformed tokens are rejected identically, without leaking whether a pass exists',async()=>{
 const f=await fixture();await f.request('plans/proof/date-poll','POST',{action:'revoke-passes',pollId:f.pollId,emails:[f.joep.email]},f.admin('unused-key-000000005'));
 const valid=f.minted[f.noor.email].token;
 const tokens=['','x','A'.repeat(43),valid+'A',valid.slice(0,42),valid.slice(0,42)+(valid[42]==='A'?'B':'A'),'fms_'+valid,'../'+valid,f.minted[f.joep.email].token];
 const seen=new Set();
 for(const t of tokens){const r=await f.request('plans/proof/date-poll','GET',null,f.pass(t));seen.add(JSON.stringify([r.status,r.body]));}
 const wrongPlan=await f.request('plans/other/date-poll','GET',null,f.pass(valid));seen.add(JSON.stringify([wrongPlan.status,wrongPlan.body]));
 const missingPlan=await f.request('plans/nope/date-poll','GET',null,f.pass(valid));seen.add(JSON.stringify([missingPlan.status,missingPlan.body]));
 assert.equal(seen.size,1,[...seen].join('\n'));
 const [status,body]=JSON.parse([...seen][0]);assert.equal(status,401);assert.equal(body.error.code,'pass_invalid');
 // Only the hash is stored.
 const state=JSON.stringify(f.store.data);assert.equal(state.includes(valid),false);assert.ok(f.store.data.auth.poll_passes.some(r=>r.token_hash===sha(valid)));
});

test('personal date-poll responses are private, no-store — success, error, organiser mint',async()=>{
 const f=await fixture();f.ids.push(f.noor.id);
 const responses=[
  await f.request('plans/proof/date-poll','GET',null,f.pass(f.noor)),
  await f.request('plans/proof/date-poll','PUT',f.answer(0,[NIGHTS[2]]),f.pass(f.noor,{'Idempotency-Key':'cache-vote-key-00001'})),
  await f.request('plans/proof/date-poll','GET',null,f.pass('B'.repeat(43))),
  await f.request('plans/proof/date-poll','GET',null,{Cookie:f.sam.cookie}),
  await f.request('plans/proof/date-poll','POST',{action:'issue-passes',pollId:f.pollId,emails:[f.sam.email],rotate:true},{Cookie:f.noor.cookie,'X-Filmmaand-Organizer-Id':f.noor.id,'X-Filmmaand-Reset-Generation':'0','Sec-Fetch-Site':'same-origin'}),
 ];
 responses.push(await f.request('plans/proof/date-poll','POST',{action:'list-passes',pollId:f.pollId},{Cookie:f.noor.cookie,'X-Filmmaand-Organizer-Id':f.noor.id,'Sec-Fetch-Site':'same-origin'}));assert.equal(responses[5].body.error.code,'reset_generation');
 for(const r of responses)assert.equal(r.headers.get('cache-control'),'private, no-store');
 assert.equal(responses[4].status,200);assert.match(responses[4].body.passes[0].url,/^https:\/\/example\.test\/filmmaand\/wanneer\/\?pas=[A-Za-z0-9_-]{43}$/);
});

test('an existing session still works; organiser-only minting; unknown and not-onboarded recipients refused',async()=>{
 const f=await fixture(),session=(who,extra={})=>({Cookie:who.cookie,'Sec-Fetch-Site':'same-origin',...extra});
 const own=await f.request('plans/proof/date-poll','GET',null,session(f.sam));assert.equal(own.status,200);assert.equal(own.body.pollId,f.pollId);assert.equal(own.body.viewer.name,'Sam');
 const put=await f.request('plans/proof/date-poll','PUT',f.answer(0,[NIGHTS[1]]),session(f.sam,{'Idempotency-Key':'session-vote-key-001'}));assert.equal(put.status,200,JSON.stringify(put.body));assert.equal(put.body.revision,1);
 // The same person continuing via their pass sees the answer written via the session.
 assert.equal((await f.request('plans/proof/date-poll','GET',null,f.pass(f.sam))).body.revision,1);
 // Pass sent alongside someone else's session: the pass decides the identity for this route; the session is not touched.
 const both=await f.request('plans/proof/date-poll','GET',null,session(f.sam,f.pass(f.noor)));assert.equal(both.body.viewer.name,'Noor');
 // Minting requires the organiser (cookie + allow-list) or the admin bearer.
 const body={action:'issue-passes',pollId:f.pollId,emails:[f.noor.email]};
 assert.equal((await f.request('plans/proof/date-poll','POST',body)).status,401);
 assert.equal((await f.request('plans/proof/date-poll','POST',body,session(f.sam,{'X-Filmmaand-Organizer-Id':f.sam.id,'X-Filmmaand-Reset-Generation':'0'}))).status,403);
 assert.equal((await f.request('plans/proof/date-poll','POST',body,{Authorization:'Bearer wrong'})).status,401);
 const unknown=await f.request('plans/proof/date-poll','POST',{...body,emails:[f.noor.email,'wie@example.test']},f.admin('unused-key-000000006'));assert.equal(unknown.body.error.code,'recipient_unknown');assert.deepEqual(unknown.body.error.details.emails,['wie@example.test']);
 const fresh=await f.request('plans/proof/date-poll','POST',{...body,emails:[f.nieuw.email]},f.admin('unused-key-000000007'));assert.equal(fresh.body.error.code,'recipient_not_onboarded');
 assert.equal((await f.request('plans/proof/date-poll','POST',{...body,pollId:'stale'},f.admin('unused-key-000000008'))).body.error.code,'date_poll_changed');
});

test('state from before this feature (no poll_passes key) is not rewritten by reads',async()=>{
 const f=await fixture();delete f.store.data.auth.poll_passes;const before=snapshot(f),writes=f.writes();
 assert.equal((await f.request('plans/proof/date-poll','GET',null,f.pass('C'.repeat(43)))).status,401);
 assert.equal((await f.request('plans/proof/date-poll','GET',null,{Cookie:f.sam.cookie})).status,200);
 assert.equal((await f.request('plans/proof')).status,200);
 assert.equal(snapshot(f),before);assert.equal(f.writes(),writes);assert.equal('poll_passes' in f.store.data.auth,false);
});

// ---- Manual mode (Chris, 23 Sept): the organiser picks the night; everyone sees who can come, WhatsApp-style. ----
const [DO,VR,ZA]=MANUAL_NIGHTS;
const pickBody=(f,date)=>({action:'pick',pollId:f.pollId,date});
const nightOf=(r,date)=>r.body.poll.ranking.find(x=>x.date===date);

test('manual poll for do 24 – za 26 opens without a deadline; passes expire 24h after the last night at the latest',async()=>{
 const f=await fixture({manual:true});const q=f.store.data.plans.proof.data.datePoll;
 assert.equal(q.pick,'manual');assert.equal(q.closesAt,null);assert.deepEqual(q.window,{start:DO,end:ZA});
 const again=await f.request('plans/proof/date-poll','POST',{action:'issue-passes',pollId:f.pollId,emails:[f.noor.email]},f.admin('unused-key-000000009'));
 assert.equal(again.body.expiresAt,'2026-09-28T00:00:00.000Z');
 // The auto rule is untouched on the API too: an auto poll closing on its first night is refused.
 assert.equal((await f.request('plans/other/date-poll','POST',{action:'close',pollId:f.otherPollId},f.admin('close-other-poll-001'))).status,200);
 const auto=await f.request('plans/other/date-poll','POST',{action:'open',mode:'availability',window:{start:DO,end:ZA},choices:[],closesAt:'2026-09-24T17:00:00.000Z'},f.admin('open-auto-late-00001'));
 assert.equal(auto.body.error.code,'date_poll_deadline');
 const manual=await f.request('plans/other/date-poll','POST',{action:'open',mode:'availability',pick:'manual',window:{start:DO,end:ZA},choices:[],closesAt:'2026-09-26T16:00:00.000Z'},f.admin('open-manual-late-001'));
 assert.equal(manual.status,200,JSON.stringify(manual.body));assert.equal(manual.body.datePoll.pick,'manual');
});

test('manual poll: GET shows per night who can come (name + avatar, self marked), only people with a profile',async()=>{
 const f=await fixture({manual:true});f.ids.push(f.joep.id);
 assert.equal((await f.request('plans/proof/date-poll','PUT',f.answer(0,[DO,ZA],ZA),f.pass(f.noor,{'Idempotency-Key':'noor-manual-key-0001'}))).status,200);
 assert.equal((await f.request('plans/proof/date-poll','PUT',f.answer(0,[ZA]),{Cookie:f.sam.cookie,'Sec-Fetch-Site':'same-origin','Idempotency-Key':'sam-manual-key-00001'})).status,200);
 // Answers from actors without a display profile (a not-onboarded account, a legacy anonymous key) are not counted or named.
 const votes=f.store.data.plans.proof.data.datePoll.votes,ghost={revision:1,availability:{[DO]:true,[ZA]:true},favourite:null,updatedAt:f.clock.now};
 votes['p_'+f.nieuw.id]=ghost;votes['a'.repeat(64)]=ghost;
 const noor=await f.request('plans/proof/date-poll','GET',null,f.pass(f.noor));assert.equal(noor.status,200);
 assert.deepEqual(nightOf(noor,ZA),{date:ZA,available:2,unavailable:0,favourites:1,people:[{name:'Noor',avatarId:4,self:true},{name:'Sam',avatarId:7}],no:[]});
 assert.deepEqual(nightOf(noor,DO),{date:DO,available:1,unavailable:1,favourites:0,people:[{name:'Noor',avatarId:4,self:true}],no:[{name:'Sam',avatarId:7}]});
 assert.deepEqual(nightOf(noor,VR).people,[]);assert.equal(noor.body.poll.voteCount,2);assert.equal(noor.body.poll.pick,'manual');
 const sam=await f.request('plans/proof/date-poll','GET',null,{Cookie:f.sam.cookie});
 assert.deepEqual(nightOf(sam,ZA).people,[{name:'Noor',avatarId:4},{name:'Sam',avatarId:7,self:true}]);
 // Organiser (Joep, allow-listed, cookie) and the operator bearer get the same names, without a self flag.
 const org=await f.request('plans/proof/date-poll','POST',{action:'list-availability',pollId:f.pollId},{Cookie:f.joep.cookie,'X-Filmmaand-Organizer-Id':f.joep.id,'X-Filmmaand-Reset-Generation':'0','Sec-Fetch-Site':'same-origin'});
 assert.equal(org.status,200,JSON.stringify(org.body));
 const bearer=await f.request('plans/proof/date-poll','POST',{action:'list-availability',pollId:f.pollId},f.admin('unused-key-000000010'));
 assert.deepEqual(bearer.body,org.body);assert.deepEqual(org.body.datePoll.ranking.find(x=>x.date===ZA).people,[{name:'Noor',avatarId:4},{name:'Sam',avatarId:7}]);
 assert.equal((await f.request('plans/proof/date-poll','POST',{action:'list-availability',pollId:'stale'},f.admin('unused-key-000000011'))).body.error.code,'date_poll_changed');
 const ghostless=JSON.stringify([noor.body,sam.body,org.body]);assert.equal(ghostless.includes(f.nieuw.id),false);assert.equal(ghostless.includes('a'.repeat(64)),false);
 // The public plan GET keeps counts only: names stay behind the date-poll route.
 const plan=await f.request('plans/proof');assert.equal(plan.status,200);assert.equal(JSON.stringify(plan.body.datePoll).includes('Noor'),false);
 assert.equal(plan.body.datePoll.ranking.find(x=>x.date===ZA).available,2);
 // Listing availability is organiser-only; a pass or a normal session cannot.
 assert.equal((await f.request('plans/proof/date-poll','POST',{action:'list-availability',pollId:f.pollId},f.pass(f.noor))).status,401);
 assert.equal((await f.request('plans/proof/date-poll','POST',{action:'list-availability',pollId:f.pollId},{Cookie:f.sam.cookie,'X-Filmmaand-Organizer-Id':f.sam.id,'X-Filmmaand-Reset-Generation':'0','Sec-Fetch-Site':'same-origin'})).status,403);
});

test('manual poll: the scheduled job never schedules, even long past any deadline; reads and ticks leave it open',async()=>{
 const {runCoordinationTick}=await import('./date-coordination-tick.mjs');
 const f=await fixture({manual:true});
 assert.equal((await f.request('plans/proof/date-poll','PUT',f.answer(0,[VR]),f.pass(f.noor,{'Idempotency-Key':'noor-manual-key-0002'}))).status,200);
 // The other plan gets a manual poll with a deadline that passes.
 await f.request('plans/other/date-poll','POST',{action:'close',pollId:f.otherPollId},f.admin('close-other-poll-002'));
 const other=await f.request('plans/other/date-poll','POST',{action:'open',mode:'availability',pick:'manual',window:{start:DO,end:ZA},choices:[],closesAt:'2026-09-24T12:00:00.000Z'},f.admin('open-manual-other-01'));assert.equal(other.status,200);
 await f.request('plans/other/date-poll','PUT',{pollId:other.body.datePoll.id,revision:0,availability:{[DO]:true},favourite:DO},{Cookie:f.sam.cookie,'Sec-Fetch-Site':'same-origin','Idempotency-Key':'sam-other-key-000001'});
 const decided=()=>['proof','other'].map(id=>{const p=f.store.data.plans[id].data;return [p.datePoll.status,p.programme?.length||0,(p.coordinationEvents||[]).length]});
 for(const at of ['2026-09-24T12:00:00.000Z','2026-09-25T20:00:00.000Z','2026-09-26T23:00:00.000Z','2026-10-15T00:00:00.000Z']){
  f.clock.now=at;assert.deepEqual(await runCoordinationTick({store:f.store,now:()=>at}),{changed:0,work:{events:false,mail:false,tonight:false}});
  await f.request('plans/proof');await f.request('plans/other');// the read path runs the same tick
  assert.deepEqual(decided(),[['open',0,0],['open',0,0]]);
 }
});

test('manual poll: the organiser picks, the night goes on the programme; pass holders keep read-only access for 24h',async()=>{
 const f=await fixture({manual:true});f.ids.push(f.joep.id);
 assert.equal((await f.request('plans/proof/date-poll','PUT',f.answer(0,[DO,VR]),f.pass(f.noor,{'Idempotency-Key':'noor-manual-key-0003'}))).status,200);
 // Answers still come in on the first night itself; there is no deadline.
 f.clock.now='2026-09-24T15:00:00.000Z';
 assert.equal((await f.request('plans/proof/date-poll','PUT',f.answer(0,[VR]),f.pass(f.sam,{'Idempotency-Key':'sam-manual-key-00002'}))).status,200);
 // Only the organiser can pick: not a pass, not a plain session, not a bad bearer.
 assert.equal((await f.request('plans/proof/date-poll','POST',pickBody(f,VR),f.pass(f.noor,{'Idempotency-Key':'pick-by-pass-000001'}))).status,405);
 assert.equal((await f.request('plans/proof/date-poll','POST',pickBody(f,VR),{Cookie:f.sam.cookie,'X-Filmmaand-Organizer-Id':f.sam.id,'X-Filmmaand-Reset-Generation':'0','Sec-Fetch-Site':'same-origin','Idempotency-Key':'pick-by-sam-0000001'})).status,403);
 assert.equal((await f.request('plans/proof/date-poll','POST',pickBody(f,VR),{Authorization:'Bearer wrong','Idempotency-Key':'pick-bad-bearer-001'})).status,401);
 assert.equal(f.store.data.plans.proof.data.datePoll.status,'open');
 assert.equal((await f.request('plans/proof/date-poll','POST',pickBody(f,'2026-09-27'),f.admin('pick-out-window-001'))).body.error.code,'date_poll_date');
 const pick=await f.request('plans/proof/date-poll','POST',pickBody(f,VR),{Cookie:f.joep.cookie,'X-Filmmaand-Organizer-Id':f.joep.id,'X-Filmmaand-Reset-Generation':'0','Sec-Fetch-Site':'same-origin','Idempotency-Key':'pick-by-joep-000001'});
 assert.equal(pick.status,200,JSON.stringify(pick.body));
 assert.equal(pick.body.datePoll.status,'confirmed');assert.equal(pick.body.datePoll.scheduledDate,VR);
 assert.deepEqual(pick.body.datePoll.ranking.find(x=>x.date===VR).people,[{name:'Noor',avatarId:4},{name:'Sam',avatarId:7}]);
 const p=f.store.data.plans.proof.data,night=p.programme.find(n=>n.id===p.datePoll.programmeId);
 assert.equal(night.scheduledDate,VR);assert.equal(night.selection,'pending');
 assert.deepEqual(p.coordinationEvents.map(e=>[e.type,e.scheduledDate]),[['date-confirmed',VR]]);
 assert.equal((await f.request('plans/proof')).body.programme.some(n=>n.id===night.id),true);
 assert.equal((await f.request('plans/proof/date-poll','POST',pickBody(f,ZA),f.admin('pick-again-0000001'))).body.error.code,'date_poll_closed');
 // After the pick (Cameo/Chris 23 Sept): the pass stays live until the end of the picked night (vr 25, Amsterdam) for
 // the chat, then 24h read-only, so until 26 Sept 22:00Z. Voting is closed from the pick on.
 f.clock.now='2026-09-26T21:59:00.000Z';
 const late=await f.request('plans/proof/date-poll','GET',null,f.pass(f.noor));assert.equal(late.status,200);assert.equal(late.body.poll.scheduledDate,VR);
 assert.equal((await f.request('plans/proof/date-poll','PUT',f.answer(1,[ZA]),f.pass(f.noor,{'Idempotency-Key':'noor-after-pick-001'}))).body.error.code,'date_poll_closed');
 f.clock.now='2026-09-26T22:00:00.000Z';
 const gone=await f.request('plans/proof/date-poll','GET',null,f.pass(f.noor));assert.equal(gone.status,401);assert.equal(gone.body.error.code,'pass_invalid');
 assert.equal((await f.request('plans/proof/date-poll','PUT',f.answer(1,[ZA]),f.pass(f.joep,{'Idempotency-Key':'joep-after-pick-001'}))).body.error.code,'pass_invalid');
 // The session path is not limited by the pass grace.
 assert.equal((await f.request('plans/proof/date-poll','GET',null,{Cookie:f.noor.cookie})).status,200);
});

test('manual poll: a close by the organiser also starts the 24h grace; the pass still reaches nothing else',async()=>{
 const f=await fixture({manual:true});
 assert.equal((await f.request('plans/proof/date-poll','POST',{action:'close',pollId:f.pollId},f.admin('close-manual-00001'))).status,200);
 assert.equal(f.store.data.plans.proof.data.datePoll.closedAt,f.clock.now);
 assert.equal((await f.request('plans/proof/date-poll','GET',null,f.pass(f.sam))).status,200);
 for(const [path,method,body] of [['plans/proof/response','GET'],['plans/proof/coordination','PUT',{}],['auth/profile','GET']])assert.equal((await f.request(path,method,body,f.pass(f.sam,{'Idempotency-Key':'other-route-key-0002'}))).status,401,path);
 f.clock.now='2026-09-24T10:00:00.000Z';
 assert.equal((await f.request('plans/proof/date-poll','GET',null,f.pass(f.sam))).body.error.code,'pass_invalid');
});

// ---- Follow-up (Chris): accounts at mint time, explicit "no", organiser-triggered reminders, needsPick. ----
const organizer=(f,who,extra={})=>({Cookie:who.cookie,'X-Filmmaand-Organizer-Id':who.id,'X-Filmmaand-Reset-Generation':'0','Sec-Fetch-Site':'same-origin',...extra});
const manage=(f,body,headers)=>f.request('plans/proof/date-poll','POST',{pollId:f.pollId,...body},headers);
const participantRow=(f,email)=>f.store.data.auth.participants.find(p=>p.email===email);
const nudges=f=>Object.values(f.store.data.eventNotifications?.outbox||{}).filter(m=>m.notice.type==='poll-nudge');

test('issue-passes creates an account for a friend (name + avatar), so their vote counts; all-or-nothing',async()=>{
 const f=await fixture({manual:true});
 const passCount=()=>f.store.data.auth.poll_passes.length,before=passCount();
 // One bad entry (avatar already Noor's) refuses the whole request: no account, no profile change, no pass.
 const clash=await manage(f,{action:'issue-passes',people:[{email:'lotte@filmvrienden.nl',name:'Lotte'},{email:'Bram@Filmvrienden.nl',name:'Bram',avatarId:4}]},f.admin('unused-key-000000020'));
 assert.equal(clash.status,409);assert.equal(clash.body.error.code,'avatar_taken');assert.deepEqual(clash.body.error.details.emails,['bram@filmvrienden.nl']);
 assert.equal(participantRow(f,'lotte@filmvrienden.nl'),undefined);assert.equal(participantRow(f,'bram@filmvrienden.nl'),undefined);assert.equal(passCount(),before);
 for(const [people,code] of [[[{email:'x@filmvrienden.nl',name:''}],'name'],[[{email:'nope',name:'X'}],'recipients'],[[{email:'x@filmvrienden.nl',name:'X',avatarId:999}],'avatar'],[[{email:'x@filmvrienden.nl',name:'X',extra:1}],'recipients'],[[{email:'x@filmvrienden.nl',name:'X',avatarId:20},{email:'y@filmvrienden.nl',name:'Y',avatarId:20}],'avatar_taken']]){// the last: two new friends, one avatar; rolled back
  const r=await manage(f,{action:'issue-passes',people},f.admin('unused-key-000000021'));assert.equal(r.body.error.code,code,JSON.stringify(people));
 }
 assert.equal(participantRow(f,'x@filmvrienden.nl'),undefined);
 // A plain email for an unknown address is still refused; the hint says to give a name.
 assert.equal((await manage(f,{action:'issue-passes',emails:['wie@filmvrienden.nl']},f.admin('unused-key-000000022'))).body.error.code,'recipient_unknown');
 const ok=await manage(f,{action:'issue-passes',emails:[f.sam.email],people:[{email:'Lotte@Filmvrienden.nl',name:' Lotte '},{email:'bram@filmvrienden.nl',name:'Bram',avatarId:20},{email:f.nieuw.email,name:'Nieuw',avatarId:21},{email:f.noor.email,name:'Niet Noor',avatarId:22}]},f.admin('unused-key-000000023'));
 assert.equal(ok.status,200,JSON.stringify(ok.body));
 // Sam and Noor already hold a live pass for this poll: skipped, not rotated (their mailed links keep working).
 assert.deepEqual(ok.body.passes.map(p=>[p.email,p.name,p.created]),[['lotte@filmvrienden.nl','Lotte',true],['bram@filmvrienden.nl','Bram',true],[f.nieuw.email,'Nieuw',false]]);
 assert.deepEqual(ok.body.skipped.map(p=>[p.email,p.name]),[[f.sam.email,'Sam'],[f.noor.email,'Noor']]);
 const lotte=participantRow(f,'lotte@filmvrienden.nl');assert.equal(lotte.onboarded,1);assert.equal(lotte.name,'Lotte');assert.ok(Number.isInteger(lotte.avatar_id));
 assert.equal(participantRow(f,'bram@filmvrienden.nl').avatar_id,20);assert.equal(participantRow(f,f.nieuw.email).onboarded,1);
 assert.equal(participantRow(f,f.noor.email).name,'Noor');assert.equal(participantRow(f,f.noor.email).avatar_id,4);// an existing profile is never overwritten
 // The minted friend's answer counts and is named.
 const token=ok.body.passes.find(p=>p.email==='lotte@filmvrienden.nl').token;
 assert.equal((await f.request('plans/proof/date-poll','PUT',f.answer(0,[VR]),f.pass(token,{'Idempotency-Key':'lotte-vote-key-00001'}))).status,200);
 const view=await f.request('plans/proof/date-poll','GET',null,f.pass(token));assert.equal(view.body.viewer.name,'Lotte');
 assert.deepEqual(nightOf(view,VR).people,[{name:'Lotte',avatarId:lotte.avatar_id,self:true}]);assert.equal(view.body.poll.voteCount,1);
 // The new account is a normal account: the friend can later log in with an email code and is already onboarded.
 const later=await f.login('lotte@filmvrienden.nl');assert.equal(later.participant.id,lotte.id);assert.equal(later.participant.onboarded,true);
});

test('"I can\'t make any of these nights" is a saved answer: named under no per night and in declined, counted as responded',async()=>{
 const f=await fixture({manual:true});
 const no=await f.request('plans/proof/date-poll','PUT',f.answer(0,[]),f.pass(f.sam,{'Idempotency-Key':'sam-all-no-key-0001'}));
 assert.equal(no.status,200);assert.deepEqual(no.body.availability,{[DO]:false,[VR]:false,[ZA]:false});assert.equal(no.body.revision,1);
 assert.equal((await f.request('plans/proof/date-poll','PUT',f.answer(0,[ZA]),f.pass(f.noor,{'Idempotency-Key':'noor-za-key-0000001'}))).status,200);
 assert.equal((await f.request('plans/proof/date-poll','PUT',{pollId:f.pollId,revision:0,availability:{},favourite:null},f.pass(f.joep,{'Idempotency-Key':'joep-empty-key-0001'}))).status,200);// saved, but not an answer
 const view=await f.request('plans/proof/date-poll','GET',null,f.pass(f.sam));
 assert.deepEqual(view.body.availability,{[DO]:false,[VR]:false,[ZA]:false});
 assert.deepEqual(view.body.poll.declined,[{name:'Sam',avatarId:7,self:true}]);
 assert.deepEqual(nightOf(view,ZA).no,[{name:'Sam',avatarId:7,self:true}]);assert.deepEqual(nightOf(view,ZA).people,[{name:'Noor',avatarId:4}]);
 assert.deepEqual(nightOf(view,DO).no,[{name:'Noor',avatarId:4},{name:'Sam',avatarId:7,self:true}]);
 assert.equal(view.body.poll.voteCount,2);// Noor and Sam; Joep's empty answer is "not answered yet"
 // The public plan GET stays anonymous.
 const plan=await f.request('plans/proof');assert.equal(JSON.stringify(plan.body.datePoll).includes('Sam'),false);assert.equal('declined' in plan.body.datePoll,false);
});

test('nudge-list: pass holders who have not answered; anyone who answered (including all-no) is left out',async()=>{
 const f=await fixture({manual:true});f.ids.push(f.noor.id);
 await f.request('plans/proof/date-poll','PUT',f.answer(0,[DO]),f.pass(f.noor,{'Idempotency-Key':'noor-do-key-0000001'}));
 await f.request('plans/proof/date-poll','PUT',f.answer(0,[]),f.pass(f.sam,{'Idempotency-Key':'sam-all-no-key-0002'}));
 await f.request('plans/proof/date-poll','PUT',{pollId:f.pollId,revision:0,availability:{},favourite:null},f.pass(f.joep,{'Idempotency-Key':'joep-empty-key-0002'}));
 const list=await manage(f,{action:'nudge-list'},f.admin('unused-key-000000030'));
 assert.equal(list.status,200,JSON.stringify(list.body));assert.equal(list.body.answersOpen,true);
 assert.deepEqual(list.body.recipients,[{participantId:f.joep.id,email:f.joep.email,name:'Joep'}]);
 // Organiser cookie sees the same; a revoked pass drops out; an account without a pass is never listed.
 assert.deepEqual((await manage(f,{action:'nudge-list'},organizer(f,f.noor))).body,list.body);
 await manage(f,{action:'revoke-passes',emails:[f.joep.email]},f.admin('unused-key-000000031'));
 assert.deepEqual((await manage(f,{action:'nudge-list'},f.admin('unused-key-000000032'))).body.recipients,[]);
 // Organiser only.
 assert.equal((await manage(f,{action:'nudge-list'},f.pass(f.sam))).status,401);
 assert.equal((await manage(f,{action:'nudge-list'},organizer(f,f.sam))).status,403);
 assert.equal((await manage(f,{action:'nudge-list',pollId:'stale'},f.admin('unused-key-000000033'))).body.error.code,'date_poll_changed');
});

test('nudge queues exactly the unanswered pass holders, once per request key; nothing is ever queued without it',async()=>{
 const {runCoordinationTick}=await import('./date-coordination-tick.mjs');
 const f=await fixture({manual:true});f.ids.push(f.noor.id);
 await f.request('plans/proof/date-poll','PUT',f.answer(0,[]),f.pass(f.sam,{'Idempotency-Key':'sam-all-no-key-0003'}));
 // Time passes, the scheduled job runs, everyone reads: no reminder appears by itself.
 for(const at of ['2026-09-24T09:00:00.000Z','2026-09-25T09:00:00.000Z','2026-09-26T09:00:00.000Z']){f.clock.now=at;await runCoordinationTick({store:f.store,now:()=>at});await f.request('plans/proof');await f.request('plans/proof/date-poll','GET',null,f.pass(f.joep));await manage(f,{action:'nudge-list'},f.admin('unused-key-000000040'));}
 assert.deepEqual(nudges(f),[]);f.clock.now='2026-09-23T12:00:00.000Z';
 assert.equal((await manage(f,{action:'nudge'},f.admin(undefined))).body.error.code,'request_key');
 assert.equal((await manage(f,{action:'nudge'},organizer(f,f.noor))).body.error.code,'request_key');
 assert.equal((await manage(f,{action:'nudge'},f.pass(f.sam,{'Idempotency-Key':'nudge-by-pass-00001'}))).status,401);
 assert.equal((await manage(f,{action:'nudge'},organizer(f,f.sam,{'Idempotency-Key':'nudge-by-sam-000001'}))).status,403);
 assert.deepEqual(nudges(f),[]);
 const r=await manage(f,{action:'nudge'},organizer(f,f.noor,{'Idempotency-Key':'nudge-first-000001'}));
 assert.equal(r.status,200,JSON.stringify(r.body));
 assert.deepEqual(r.body,{pollId:f.pollId,recipients:[{participantId:f.noor.id,name:'Noor'},{participantId:f.joep.id,name:'Joep'}]});// Sam said no to all: never reminded
 assert.deepEqual(nudges(f).map(m=>[m.to,m.status,m.notice.eventId]).sort(),[[f.joep.email,'pending',f.pollId],[f.noor.email,'pending',f.pollId]]);
 // No plaintext pass in state: the link is minted at delivery.
 assert.equal(JSON.stringify(f.store.data.eventNotifications).includes('pas='),false);
 // Exact retry: same receipt, nothing queued twice. Same key, other body: refused.
 const again=await manage(f,{action:'nudge'},organizer(f,f.noor,{'Idempotency-Key':'nudge-first-000001'}));assert.deepEqual(again.body,r.body);assert.equal(nudges(f).length,2);
 assert.equal((await manage(f,{action:'nudge',pollId:'other-poll'},organizer(f,f.noor,{'Idempotency-Key':'nudge-first-000001'}))).body.error.code,'key_reused');
 // Once someone answers, a new nudge leaves them out.
 await f.request('plans/proof/date-poll','PUT',f.answer(0,[ZA]),f.pass(f.noor,{'Idempotency-Key':'noor-za-key-0000002'}));
 assert.deepEqual((await manage(f,{action:'nudge'},f.admin('nudge-second-00001'))).body.recipients,[{participantId:f.joep.id,name:'Joep'}]);
 // After the pick: no more reminders.
 await manage(f,{action:'pick',date:ZA},f.admin('pick-before-nudge1'));
 assert.equal((await manage(f,{action:'nudge'},f.admin('nudge-third-000001'))).body.error.code,'date_poll_closed');
});

test('nudge delivery: rendered from the Dutch template with a fresh working pass link; dropped if the person answered meanwhile',async()=>{
 const {createEventNotifications}=await import('./event-notifications.mjs');
 const f=await fixture({manual:true}),sent=[];
 const minted=(await manage(f,{action:'issue-passes',people:[{email:'lotte@filmvrienden.nl',name:'Lotte'},{email:'bram@filmvrienden.nl',name:'Bram'}]},f.admin('unused-key-000000050'))).body.passes;
 const events=createEventNotifications({store:f.store,enabled:true,activatedAt:'2026-01-01T00:00:00.000Z',allowAnyRecipient:true,origin:ORIGIN,now:()=>f.clock.now,send:async(m,{id})=>{sent.push(m);return {providerId:'stub-'+id}}});
 await events.drain({limit:20});assert.equal(sent.length,0);// nothing queued, nothing sent
 await manage(f,{action:'nudge'},f.admin('nudge-delivery-0001'));
 // Bram answers "no to everything" before the drain: his reminder is dropped, not sent.
 const bram=minted.find(p=>p.name==='Bram').token;
 await f.request('plans/proof/date-poll','PUT',f.answer(0,[]),f.pass(bram,{'Idempotency-Key':'bram-all-no-key-001'}));
 await events.drain({limit:20});
 assert.deepEqual(sent.map(m=>m.to),['lotte@filmvrienden.nl']);// .test addresses are never mailed by policy; Bram answered
 const [mail]=sent;assert.equal(mail.subject,'nog niet gestemd?');
 assert.match(mail.text,/^vergeet niet te stemmen… 👀😈\n\nMovie deze week: do 24, vr 25 of za 26 september\. Je hebt nog niet gestemd\./);assert.match(mail.html,/\/filmmaand\/assets\/mail\/herinnering\.gif/);
 const link=mail.text.match(/Kies je avond: (https:\/\/example\.test\/filmmaand\/wanneer\/\?pas=([A-Za-z0-9_-]{43}))/);assert.ok(link,mail.text);assert.ok(mail.html.includes(link[1]));
 assert.equal((await f.request('plans/proof/date-poll','GET',null,f.pass(link[2]))).body.viewer.name,'Lotte');
 assert.equal((await f.request('plans/proof/date-poll','GET',null,f.pass(minted.find(p=>p.name==='Lotte').token))).status,200);// the earlier link still works
 assert.deepEqual(nudges(f),[]);assert.equal(JSON.stringify(f.store.data).includes(link[2]),false);
 await events.drain({limit:20});assert.equal(sent.length,1);
 // Replaying the same nudge request after delivery queues nothing again.
 assert.deepEqual((await manage(f,{action:'nudge'},f.admin('nudge-delivery-0001'))).body.recipients.map(r=>r.name),['Noor','Sam','Joep','Lotte','Bram']);
 assert.deepEqual(nudges(f),[]);await events.drain({limit:20});assert.equal(sent.length,1);
});

test('needsPick: organiser flag from the day before the last night while nothing is picked; never a mail',async()=>{
 const f=await fixture({manual:true}),flag=async()=>(await manage(f,{action:'list-availability'},f.admin('unused-key-000000060'))).body.datePoll.needsPick;
 assert.equal(await flag(),false);f.clock.now='2026-09-24T21:59:00.000Z';assert.equal(await flag(),false);// do 24, 23:59
 f.clock.now='2026-09-24T22:00:00.000Z';assert.equal(await flag(),true);// vr 25, 00:00 Amsterdam
 assert.equal(nudges(f).length,0);assert.equal(Object.keys(f.store.data.eventNotifications?.outbox||{}).length,0);
 const picked=await manage(f,{action:'pick',date:ZA},f.admin('pick-needs-flag-001'));assert.equal(picked.body.datePoll.needsPick,false);assert.equal(await flag(),false);
 // Participants never see the flag.
 assert.equal('needsPick' in (await f.request('plans/proof/date-poll','GET',null,{Cookie:f.sam.cookie})).body.poll,false);
});
