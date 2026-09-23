// Auto-login from the invite link (Chris, 23 Sept: "our auto log in should handle this"): POST /plans/<id>/date-poll-login
// with the pass header turns the pass into a normal session cookie for the holder's OWN account. It never switches an
// account already logged in on the device, and a poll-pass session can't set a password (that needs a fresh e-mail code).
import test from 'node:test';import assert from 'node:assert/strict';
import {createApi} from './api.mjs';import {openState,emptyState} from './state.mjs';import {createPlanningService} from './runtime/planning/service.mjs';

const ORIGIN='https://example.test',NIGHTS=['2026-09-24','2026-09-25','2026-09-26'],PLAN='plans/home-picker-lab/';
async function fixture(){
 const c=openState(emptyState()),s=createPlanningService({store:c.plans,adminToken:'secret'});
 await s.seed({id:'home-picker-lab',title:'Filmmaand',window:{start:'2026-09-01',end:'2026-09-30'},options:['a','b','c'].map(x=>({id:x,title:x}))});
 const store={data:c.export(),etag:1,async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}},async setJSON(k,v,{onlyIfMatch}){if(onlyIfMatch!==String(this.etag))return {modified:false};this.data=structuredClone(v);this.etag++;return {modified:true}}};c.close();
 let code;const clock={now:'2026-09-23T10:00:00.000Z'},queued=[];
 const api=createApi({store,blobs:{},adminToken:'secret',authConfig:{passwordsEnabled:true},organizerIds:[],origin:ORIGIN,queueMail:async(c,m)=>{code=m.code},queueEvents:async c=>{queued.push(JSON.stringify(c.state.plans?.['home-picker-lab']?.data?.notices||null))},now:()=>clock.now});
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

const cookieOf=r=>(r.headers.get('set-cookie')||'').split(';')[0];
test('the invite link logs its holder in on this device; later visits need no pass',async()=>{
 const f=await fixture();
 const r=await f.request(PLAN+'date-poll-login','POST',{},{'X-Filmmaand-Poll-Pass':f.pass.Lotte});
 assert.equal(r.status,200,JSON.stringify(r.body));assert.deepEqual(r.body,{loggedIn:true,switched:false});
 assert.equal(r.headers.get('cache-control'),'private, no-store');
 const cookie=cookieOf(r);assert.match(cookie,/^fm_session=fms_/);
 // Later, without the pass: the cookie alone is Lotte, and the date poll reads as hers.
 const me=await f.request('auth/session','GET',null,{Cookie:cookie});assert.equal(me.body.participant.profile.name,'Lotte');
 const poll=await f.request(PLAN+'date-poll','GET',null,{Cookie:cookie});assert.equal(poll.status,200,JSON.stringify(poll.body));
 // Opening the same link again while already logged in as Lotte: fine, no new cookie.
 const again=await f.request(PLAN+'date-poll-login','POST',{},{'X-Filmmaand-Poll-Pass':f.pass.Lotte,Cookie:cookie,'Sec-Fetch-Site':'same-origin'});
 assert.deepEqual(again.body,{loggedIn:true,switched:false});assert.equal(again.headers.get('set-cookie'),null);
});

test('a friend\'s link opened while someone else is logged in never switches the account',async()=>{
 const f=await fixture();
 const daan=cookieOf(await f.request(PLAN+'date-poll-login','POST',{},{'X-Filmmaand-Poll-Pass':f.pass.Daan}));
 const r=await f.request(PLAN+'date-poll-login','POST',{},{'X-Filmmaand-Poll-Pass':f.pass.Lotte,Cookie:daan,'Sec-Fetch-Site':'same-origin'});
 assert.equal(r.status,200);assert.deepEqual(r.body,{loggedIn:false,switched:false});assert.equal(r.headers.get('set-cookie'),null);
 assert.equal((await f.request('auth/session','GET',null,{Cookie:daan})).body.participant.profile.name,'Daan');
});

test('the login route: POST only, a real pass, and a poll-pass session cannot set a password',async()=>{
 const f=await fixture();
 assert.equal((await f.request(PLAN+'date-poll-login','GET',null,{'X-Filmmaand-Poll-Pass':f.pass.Lotte})).status,405);
 assert.equal((await f.request(PLAN+'date-poll-login','POST',{},{})).status,401);
 assert.equal((await f.request(PLAN+'date-poll-login','POST',{},{'X-Filmmaand-Poll-Pass':'A'.repeat(43)})).status,401);
 const cookie=cookieOf(await f.request(PLAN+'date-poll-login','POST',{},{'X-Filmmaand-Poll-Pass':f.pass.Lotte}));
 const set=await f.request('auth/password/set','POST',{password:'een-heel-lang-wachtwoord-123',expectedRevision:0},{Cookie:cookie,'Sec-Fetch-Site':'same-origin'});
 assert.equal(set.status,403,JSON.stringify(set.body));
});
