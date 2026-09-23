// The intro film's "seen" flag (Chris, 23 Sept): PUT /plans/<id>/date-poll-film (pass or session) after a FULL viewing;
// the date-poll GET tells the viewer filmSeen:true|false, per ACCOUNT (so a login on another device sees it too).
// Own flag only; never in the public plan projection; no mail; PUT only.
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

test('a full viewing is remembered per account: pass → session, own flag only, public projection clean, no mail',async()=>{
 const f=await fixture();
 const seen=(who,extra={})=>f.request(PLAN+'date-poll-film','PUT',{film:'intro',...extra},{'X-Filmmaand-Poll-Pass':f.pass[who],'Idempotency-Key':f.key()});
 assert.equal((await f.view('Lotte')).body.filmSeen,false);
 const r=await seen('Lotte');assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.headers.get('cache-control'),'private, no-store');
 assert.equal((await f.view('Lotte')).body.filmSeen,true);
 assert.equal((await f.view('Daan')).body.filmSeen,false);// own flag only
 assert.equal((await seen('Lotte')).status,200);// idempotent: marking again is fine, the first time stays
 // Same ACCOUNT on another device (login session instead of the pass) sees it too.
 const cookie=await f.session('lotte@example.test');
 const viaSession=await f.request(PLAN+'date-poll','GET',null,{Cookie:cookie});assert.equal(viaSession.status,200,JSON.stringify(viaSession.body));assert.equal(viaSession.body.filmSeen,true);
 // Nothing leaks into the public plan projection, and nothing was queued for mail.
 const wire=JSON.stringify((await f.request('plans/home-picker-lab','GET')).body);assert.equal(wire.includes('filmSeen'),false);assert.equal(/\bu_[A-Za-z0-9]/.test(wire)&&wire.includes('intro'),false);
 assert.equal(f.queued.every(q=>!/film/.test(q)),true);
});

test('the film flag route: PUT only, a strict body, a request key, and a pass or a session',async()=>{
 const f=await fixture();
 const put=(body,headers)=>f.request(PLAN+'date-poll-film','PUT',body,headers);
 assert.equal((await f.request(PLAN+'date-poll-film','GET',null,{'X-Filmmaand-Poll-Pass':f.pass.Lotte})).status,405);
 assert.equal((await put({film:'intro',extra:1},{'X-Filmmaand-Poll-Pass':f.pass.Lotte,'Idempotency-Key':f.key()})).status,400);
 assert.equal((await put({film:'NOT OK!'},{'X-Filmmaand-Poll-Pass':f.pass.Lotte,'Idempotency-Key':f.key()})).status,400);
 assert.equal((await put({film:'intro'},{'X-Filmmaand-Poll-Pass':f.pass.Lotte})).status,400);// no request key
 assert.equal((await put({film:'intro'},{'Idempotency-Key':f.key()})).status,401);// nobody
 assert.equal((await f.view('Lotte')).body.filmSeen,false);
});
