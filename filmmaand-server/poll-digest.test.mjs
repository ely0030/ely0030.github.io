import test from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from './api.mjs';
import {openState,emptyState} from './state.mjs';
import {createPlanningService} from './runtime/planning/service.mjs';
import {renderPollDigest,createEventNotifications} from './event-notifications.mjs';

const ORIGIN='https://example.test',NIGHTS=['2026-09-24','2026-09-25'];
async function fixture(){
 const c=openState(emptyState()),service=createPlanningService({store:c.plans,adminToken:'secret'});
 await service.seed({id:'proof',title:'proof',window:{start:'2026-09-01',end:'2026-09-30'},options:[{id:'a',title:'a'}]});
 const store={data:c.export(),etag:1,async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}},async setJSON(k,v,{onlyIfMatch}){if(onlyIfMatch!==String(this.etag))return {modified:false};this.data=structuredClone(v);this.etag++;return {modified:true}}};c.close();
 let code,enabled=true;const organizerIds=[];
 const api=createApi({store,blobs:{},adminToken:'secret',organizerIds,origin:ORIGIN,now:()=> '2026-09-23T10:00:00.000Z',mailActive:()=>enabled,queueMail:async(_,m)=>{code=m.code}});
 async function request(path,method='GET',body,headers={}){const r=await api(new Request(ORIGIN+'/filmmaand/api/'+path,{method,headers:{Origin:ORIGIN,...headers},...(body?{body:JSON.stringify(body)}:{})}),{ip:'fixture'});return {status:r.status,body:await r.json(),headers:r.headers}}
 async function account(name,index){const email=name.toLowerCase()+'@digest-mail.nl',challenge=await request('auth/code','POST',{email});const verified=await request('auth/verify','POST',{challengeId:challenge.body.challengeId,code});assert.equal(verified.status,200);const cookie=verified.headers.get('set-cookie').split(';')[0],id=verified.body.participant.id;
  const profile=await request('auth/profile','PUT',{expectedRevision:0,name,animal:'otter',avatarId:[4,7,9,11,12][index]},{Cookie:cookie,'Idempotency-Key':'profile-key-'+index+'-000000'});assert.equal(profile.status,200,JSON.stringify(profile.body));return {id,email,cookie,name};}
 const people=[];for(const [i,name] of ['Chris','Lucas','Koen','Alec','Ruben'].entries())people.push(await account(name,i));organizerIds.push(people[0].id);
 const opened=await request('plans/proof/date-poll','POST',{action:'open',mode:'availability',window:{start:NIGHTS[0],end:NIGHTS[1]},choices:[],pick:'manual'},{Authorization:'Bearer secret','Idempotency-Key':'open-digest-poll-0001'});assert.equal(opened.status,200,JSON.stringify(opened.body));const pollId=opened.body.datePoll.id;
 const issued=await request('plans/proof/date-poll','POST',{action:'issue-passes',pollId,emails:people.map(p=>p.email)},{Authorization:'Bearer secret','Idempotency-Key':'issue-digest-pass-0001'});assert.equal(issued.status,200,JSON.stringify(issued.body));
 const tokens=new Map(issued.body.passes.map(p=>[p.email,p.token]));
 async function vote(who,key,revision=0,yes=[NIGHTS[0]],viaSession=false){return request('plans/proof/date-poll','PUT',{pollId,revision,availability:Object.fromEntries(NIGHTS.map(d=>[d,yes.includes(d)])),favourite:null},viaSession?{Cookie:who.cookie,'Idempotency-Key':key}:{'X-Filmmaand-Poll-Pass':tokens.get(who.email),'Idempotency-Key':key});}
 const poll=()=>store.data.plans.proof.data.datePoll;
 const digests=()=>Object.values(store.data.eventNotifications?.outbox||{}).filter(m=>m.notice.type==='poll-digest');
 return {store,people,poll,vote,digests,setMailActive:value=>{enabled=value}};
}

test('three non-organisers and all active pass holders queue each digest once',async()=>{
 const f=await fixture(),[chris,lucas,koen,alec,ruben]=f.people;
 assert.equal((await f.vote(chris,'chris-vote-key-0001')).status,200);assert.equal(f.digests().length,0);
 assert.equal((await f.vote(lucas,'lucas-vote-key-0001',0,[NIGHTS[0]],true)).status,200);
 assert.equal((await f.vote(koen,'koen-vote-key-0001')).status,200);assert.equal(f.digests().length,0);
 assert.equal((await f.vote(alec,'alec-vote-key-00001')).status,200);
 assert.deepEqual(Object.keys(f.poll().digests),['three']);assert.equal(f.digests().length,1);assert.equal(f.digests()[0].to,chris.email);
 assert.equal((await f.vote(alec,'alec-vote-key-00001')).status,200);
 assert.equal((await f.vote(alec,'alec-vote-key-00002',1,[NIGHTS[1]])).status,200);assert.equal(f.digests().length,1);
 assert.equal((await f.vote(ruben,'ruben-vote-key-0001',0,[])).status,200);
 assert.deepEqual(Object.keys(f.poll().digests),['three','all']);assert.equal(f.digests().length,2);
 assert.equal((await f.vote(ruben,'ruben-vote-key-0002',1,[NIGHTS[0]])).status,200);assert.equal(f.digests().length,2);
 const three=renderPollDigest(f.digests().find(m=>m.notice.kind==='three').notice);
 assert.equal(three.subject,'Filmmaand: 3 mensen hebben gestemd');assert.match(three.text,/do 24 sep · 4 ja \(Alec, Chris, Koen, Lucas\)/);
 assert.match(three.text,/Nog niet: Ruben/);assert.match(three.text,/Voorop: do 24 sep/);assert.match(three.text,/https:\/\/ely0030.xyz\/filmmaand\/beheer\//);
 const all=renderPollDigest(f.digests().find(m=>m.notice.kind==='all').notice);assert.match(all.text,/Kan geen enkele avond: Ruben/);assert.match(all.text,/Nog niet: niemand/);
});

test('mail off leaves vote intact without a queued digest',async()=>{
 const f=await fixture();f.setMailActive(false);
 for(const [i,who] of f.people.entries())assert.equal((await f.vote(who,'off-vote-key-'+i+'-000001')).status,200);
 assert.equal(f.digests().length,0);assert.equal(f.poll().digests,undefined);assert.equal(Object.keys(f.poll().votes).length,5);
});

test('queued digest uses the existing delivery fence and mails only the organiser',async()=>{
 const f=await fixture(),sent=[];
 for(const [i,who] of f.people.slice(1,4).entries())assert.equal((await f.vote(who,'deliver-vote-key-'+i+'-001')).status,200);
 const events=createEventNotifications({store:f.store,enabled:true,activatedAt:'2026-09-22T00:00:00.000Z',now:()=> '2026-09-23T10:00:00.000Z',allowAnyRecipient:true,send:async message=>{sent.push(message);return {providerId:'fake'}}});
 assert.deepEqual((await events.drain()).map(r=>r.status),['accepted']);assert.equal(sent.length,1);
 assert.equal(sent[0].to,f.people[0].email);assert.equal(sent[0].subject,'Filmmaand: 3 mensen hebben gestemd');
 assert.deepEqual(await events.drain(),[]);
});
