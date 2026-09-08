import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createApi} from './api.mjs';
import {emptyState,openState} from './state.mjs';
import {createPlanningService} from './runtime/planning/service.mjs';
class Memory {
 constructor(){const c=openState(emptyState());this.data=c.export();c.close();this.etag=1}
 async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}}
 async setJSON(k,data,{onlyIfMatch}){if(this.beforeCAS){const hook=this.beforeCAS;this.beforeCAS=null;hook(this)}if(String(this.etag)!==onlyIfMatch)return {modified:false};this.data=structuredClone(data);this.etag++;return {modified:true}}
}
async function fixture(){
 const store=new Memory(),c=openState(store.data),seed=JSON.parse(await readFile(new URL('./runtime/planning/seed.json',import.meta.url)));
 await createPlanningService({store:c.plans,adminToken:'admin'}).seed(seed);store.data=c.export();c.close();store.data.resetGeneration='reset-one';let messages=[];
 const api=createApi({store,blobs:{},adminToken:'admin',queueMail:async(c,m)=>messages.push(m)});
 const req=async(path,method='GET',body,headers={})=>{const r=await api(new Request('https://ely0030.xyz/filmmaand/api/'+path,{method,headers:{'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})}));return {status:r.status,headers:r.headers,body:await r.json()}};
 const generation={'X-Filmmaand-Reset-Generation':'reset-one'};
 async function login(email='reset@example.test'){
  const challenge=await req('auth/code','POST',{email},generation);assert.equal(challenge.status,200);
  const digits=messages.at(-1).code;const verified=await req('auth/verify','POST',{challengeId:challenge.body.challengeId,code:digits},generation);assert.equal(verified.status,200);
  return {...generation,Cookie:verified.headers.get('set-cookie').split(';')[0],Origin:'https://ely0030.xyz','Idempotency-Key':'reset-profile-test-001'};
 }
 return {store,req,generation,login,seed};
}
test('public generation; all stale writes including login fail before side effects, logout remains possible',async()=>{
 const f=await fixture();const g=await f.req('reset-generation','GET',null,{Cookie:'fm_session=expired'});assert.equal(g.body.resetGeneration,'reset-one');assert.equal(g.headers.get('x-filmmaand-reset-generation'),'reset-one');const before=structuredClone(f.store.data);
 for(const headers of [{},{'X-Filmmaand-Reset-Generation':'0'}])for(const [path,method] of [['auth/code','POST'],['auth/verify','POST'],['auth/claim','POST'],['auth/profile','PUT'],['auth/logout-everywhere','POST'],['plans/'+f.seed.id+'/response','PUT'],['plans/'+f.seed.id+'/vote','PUT'],['plans/'+f.seed.id+'/suggestions','POST']]){const r=await f.req(path,method,{},headers);assert.equal(r.status,409,path);assert.equal(r.body.error.code,'reset_generation')}
 assert.deepEqual(f.store.data,before);assert.equal((await f.req('auth/logout','POST',{})).status,200);assert.equal((await f.req('auth/session','DELETE')).status,200);
});
test('same-generation exact receipts replay; stale generation checked before an existing receipt',async()=>{
 const f=await fixture(),h=await f.login();assert.equal((await f.req('auth/profile','PUT',{expectedRevision:0,name:'Reset test',animal:'otter',avatarId:4},h)).status,200);
 const body={expectedRevision:0,dates:['2026-09-12'],choices:['matrix']},headers={...h,'Idempotency-Key':'reset-response-test-01'},path='plans/'+f.seed.id+'/response';
 const saved=await f.req(path,'PUT',body,headers);assert.equal(saved.status,200);const replay=await f.req(path,'PUT',body,headers);assert.deepEqual(replay.body,saved.body);
 f.store.data.auth.sessions.forEach(s=>s.expires_at='2000-01-01T00:00:00Z');
 assert.equal((await f.req(path,'PUT',body,headers)).status,401);
 // Isolated fixture only: clear throttling to exercise immediate real reauthentication.
 f.store.data.auth.rate_limits=[];const renewed=await f.login();
 const recovered=await f.req(path,'PUT',body,{...headers,Cookie:renewed.Cookie});assert.equal(recovered.status,200);assert.deepEqual(recovered.body,saved.body);
 f.store.data.resetGeneration='reset-two';f.store.etag++;const before=structuredClone(f.store.data);
 const stale=await f.req(path,'PUT',body,headers);assert.equal(stale.status,409);assert.equal(stale.body.error.code,'reset_generation');assert.deepEqual(f.store.data,before);
});
test('reset racing a CAS forces fresh guard check and prevents old mutation',async()=>{
 const f=await fixture();f.store.beforeCAS=s=>{s.data.resetGeneration='reset-two';s.etag++};
 const r=await f.req('auth/code','POST',{email:'race@example.test'},f.generation);assert.equal(r.status,409);assert.equal(r.body.error.code,'reset_generation');assert.equal(f.store.data.auth.login_codes.length,0);
});
test('legacy state stays compatible before activation and organizer validator remains authoritative',async()=>{
 const f=await fixture();delete f.store.data.resetGeneration;assert.equal((await f.req('reset-generation')).body.resetGeneration,'0');assert.equal((await f.req('auth/code','POST',{email:'legacy@example.test'})).status,200);
 f.store.data.resetGeneration='reset-one';const r=await f.req('plans/'+f.seed.id+'/round-date','POST',{date:'2026-09-12'},{Authorization:'Bearer admin','Idempotency-Key':'reset-admin-date-001'});assert.equal(r.status,200);
});
