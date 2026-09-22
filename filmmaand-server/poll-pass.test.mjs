import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {createApi} from './api.mjs';import {openState,emptyState} from './state.mjs';import {createPlanningService} from './runtime/planning/service.mjs';
// The real target: wo 23 – za 26 september 2026, poll closes the evening before the first candidate night.
const ORIGIN='https://example.test',NIGHTS=['2026-09-23','2026-09-24','2026-09-25','2026-09-26'],CLOSES='2026-09-22T21:00:00.000Z';
const sha=x=>createHash('sha256').update(x).digest('hex');
async function fixture(){
 const c=openState(emptyState()),s=createPlanningService({store:c.plans,adminToken:'secret'});
 for(const id of ['proof','other'])await s.seed({id,title:id,window:{start:'2026-09-01',end:'2026-09-30'},options:['a','b','c'].map(x=>({id:x,title:x}))});
 let writes=0;const store={data:c.export(),etag:1,async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}},async setJSON(k,v,{onlyIfMatch}){if(onlyIfMatch!==String(this.etag))return {modified:false};writes++;this.data=structuredClone(v);this.etag++;return {modified:true}}};c.close();
 const clock={now:'2026-09-22T10:00:00.000Z'},ids=[];let code;
 const api=createApi({store,blobs:{},adminToken:'secret',organizerIds:ids,origin:ORIGIN,queueMail:async(c,m)=>{code=m.code},now:()=>clock.now});
 async function request(path,method='GET',body,headers={}){const r=await api(new Request(ORIGIN+'/filmmaand/api/'+path,{method,headers:{Origin:ORIGIN,...headers},...(body?{body:JSON.stringify(body)}:{})}),{ip:'fixture'});return {status:r.status,body:await r.json(),headers:r.headers}}
 async function account(email,name,avatarId,onboard=true){const ch=await request('auth/code','POST',{email}),login=await request('auth/verify','POST',{challengeId:ch.body.challengeId,code});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';')[0],id=login.body.participant.id;if(onboard)assert.equal((await request('auth/profile','PUT',{expectedRevision:0,name,animal:'otter',avatarId},{Cookie:cookie,'Idempotency-Key':'profile-key-'+avatarId+'-000000'})).status,200);return {cookie,id,email,name}}
 const admin=(key,extra={})=>({Authorization:'Bearer secret','Idempotency-Key':key,...extra});
 async function openPoll(plan,key,window={start:NIGHTS[0],end:NIGHTS[3]},closesAt=CLOSES){const r=await request('plans/'+plan+'/date-poll','POST',{action:'open',mode:'availability',window,choices:[],closesAt},admin(key));assert.equal(r.status,200,JSON.stringify(r.body));return r.body.datePoll.id}
 const noor=await account('noor@example.test','Noor',4),sam=await account('sam@example.test','Sam',7),joep=await account('joep@example.test','Joep',9),nieuw=await account('nieuw@example.test','',11,false);
 const pollId=await openPoll('proof','open-poll-proof-0001'),otherPollId=await openPoll('other','open-poll-other-0001');
 async function issue(emails,plan='proof',poll=pollId){const r=await request('plans/'+plan+'/date-poll','POST',{action:'issue-passes',pollId:poll,emails},admin('unused-key-000000001'));assert.equal(r.status,200,JSON.stringify(r.body));return Object.fromEntries(r.body.passes.map(p=>[p.email,p]))}
 const minted=await issue([noor.email,sam.email,joep.email]);
 const pass=(who,extra={})=>({'X-Filmmaand-Poll-Pass':typeof who==='string'?who:minted[who.email].token,...extra});
 const answer=(revision,yes,favourite=null)=>({pollId,revision,availability:Object.fromEntries(NIGHTS.map(d=>[d,yes.includes(d)])),favourite});
 return {store,clock,ids,request,admin,openPoll,issue,minted,pass,answer,pollId,otherPollId,noor,sam,joep,nieuw,writes:()=>writes};
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
 const oldSam=f.minted[f.sam.email].token,rotated=await f.issue([f.sam.email]);
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
  await f.request('plans/proof/date-poll','POST',{action:'issue-passes',pollId:f.pollId,emails:[f.sam.email]},{Cookie:f.noor.cookie,'X-Filmmaand-Organizer-Id':f.noor.id,'X-Filmmaand-Reset-Generation':'0','Sec-Fetch-Site':'same-origin'}),
 ];
 responses.push(await f.request('plans/proof/date-poll','POST',{action:'list-passes',pollId:f.pollId},{Cookie:f.noor.cookie,'X-Filmmaand-Organizer-Id':f.noor.id,'Sec-Fetch-Site':'same-origin'}));assert.equal(responses[5].body.error.code,'reset_generation');
 for(const r of responses)assert.equal(r.headers.get('cache-control'),'private, no-store');
 assert.equal(responses[4].status,200);assert.match(responses[4].body.passes[0].url,/^https:\/\/example\.test\/filmmaand\/\?pas=[A-Za-z0-9_-]{43}$/);
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
