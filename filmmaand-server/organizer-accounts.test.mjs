// Organiser/admin-only account list (Chris, 23 Sept: "friends list will be everyone who has an account"): the organiser
// reviews every account (name, e-mail, onboarded) before issuing links. Pass holders and ordinary sessions get nothing.
import test from 'node:test';import assert from 'node:assert/strict';
import {createApi} from './api.mjs';import {openState,emptyState} from './state.mjs';import {createPlanningService} from './runtime/planning/service.mjs';

const ORIGIN='https://example.test',NIGHTS=['2026-09-24','2026-09-25','2026-09-26'],PLAN='plans/home-picker-lab/';
async function fixture(){
 const c=openState(emptyState()),s=createPlanningService({store:c.plans,adminToken:'secret'});
 await s.seed({id:'home-picker-lab',title:'Filmmaand',window:{start:'2026-09-01',end:'2026-09-30'},options:['a','b','c'].map(x=>({id:x,title:x}))});
 const store={data:c.export(),etag:1,async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}},async setJSON(k,v,{onlyIfMatch}){if(onlyIfMatch!==String(this.etag))return {modified:false};this.data=structuredClone(v);this.etag++;return {modified:true}}};c.close();
 let code;const clock={now:'2026-09-23T10:00:00.000Z'},queued=[];
 const api=createApi({store,blobs:{},adminToken:'secret',organizerIds:[],origin:ORIGIN,queueMail:async(c,m)=>{code=m.code},queueEvents:async c=>{queued.push(JSON.stringify(c.state.plans?.['home-picker-lab']?.data?.notices||null))},now:()=>clock.now});
 async function request(path,method,body,headers={}){const r=await api(new Request(ORIGIN+'/filmmaand/api/'+path,{method,headers:{Origin:ORIGIN,...headers},...(body?{body:JSON.stringify(body)}:{})}),{ip:'fixture'});return {status:r.status,body:await r.json(),headers:r.headers}}
 const admin=key=>({Authorization:'Bearer secret',...(key?{'Idempotency-Key':key}:{})});
 const opened=await request(PLAN+'date-poll','POST',{action:'open',mode:'availability',pick:'manual',window:{start:NIGHTS[0],end:NIGHTS[2]},choices:[]},admin('open-doodle-poll-001'));
 assert.equal(opened.status,200,JSON.stringify(opened.body));const pollId=opened.body.datePoll.id;
 const minted=await request(PLAN+'date-poll','POST',{action:'issue-passes',pollId,people:[{email:'lotte@example.test',name:'Lotte',avatarId:12},{email:'daan@example.test',name:'Daan',avatarId:9}]},admin());
 const pass=Object.fromEntries(minted.body.passes.map(p=>[p.name,p.token]));
 let n=0;const key=()=>'doodle-test-key-'+String(++n).padStart(6,'0');
 const draw=(who,strokes,extra={})=>request(PLAN+'date-poll-doodle','PUT',{pollId,s:strokes,...extra},{'X-Filmmaand-Poll-Pass':pass[who],'Idempotency-Key':key()});
 const view=who=>request(PLAN+'date-poll','GET',null,{'X-Filmmaand-Poll-Pass':pass[who]});
 async function session(email){const ch=await request('auth/code','POST',{email}),r=await request('auth/verify','POST',{challengeId:ch.body.challengeId,code});return r.headers.get('set-cookie').split(';')[0]}
 return {store,clock,request,admin,pollId,pass,draw,view,key,session,queued,doodles:()=>f_doodles(store)};
}

test('list-accounts: admin sees every account with e-mail; a pass or an ordinary session sees nothing',async()=>{
 const f=await fixture();
 const list=headers=>f.request(PLAN+'date-poll','POST',{action:'list-accounts'},headers);
 const r=await list(f.admin());assert.equal(r.status,200,JSON.stringify(r.body));
 const emails=r.body.accounts.map(a=>a.email).sort();assert.deepEqual(emails,['daan@example.test','lotte@example.test']);
 for(const a of r.body.accounts){assert.deepEqual(Object.keys(a).sort(),['createdAt','email','name','onboarded','participantId']);}
 assert.equal(r.headers.get('cache-control'),'private, no-store');
 const viaPass=await list({'X-Filmmaand-Poll-Pass':f.pass.Lotte});assert.notEqual(viaPass.status,200);assert.equal(JSON.stringify(viaPass.body).includes('@example.test'),false);
 const cookie=await f.session('lotte@example.test');
 const viaSession=await list({Cookie:cookie,'Sec-Fetch-Site':'same-origin'});assert.notEqual(viaSession.status,200);assert.equal(JSON.stringify(viaSession.body).includes('daan@example.test'),false);
 assert.notEqual((await list({})).status,200);
});
