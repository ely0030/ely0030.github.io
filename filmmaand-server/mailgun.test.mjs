import test from 'node:test';
import {createHash} from 'node:crypto';
import {renderLoginCodeEmail} from './email-template.mjs';
import assert from 'node:assert/strict';
import {createMail} from './mail.mjs';
import {createApi} from './api.mjs';
import {emptyState,openState} from './state.mjs';
class Memory{
 constructor(){const c=openState(emptyState());this.data=c.export();c.close();this.etag=1;}
 async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}}
 async setJSON(k,data,{onlyIfMatch}){
  if(this.failReceipt&&data.mailReceipts?.length)throw Error('synthetic storage failure');
  if(this.conflictClaim&&Object.values(data.outbox).some(m=>m.attemptedAt)){this.conflictClaim=false;this.etag++;return {modified:false}}
  if(String(this.etag)!==onlyIfMatch)return {modified:false};this.data=structuredClone(data);this.etag++;return {modified:true};
 }
}
function fixture(responder=()=>Response.json({id:'<synthetic.123@mail.example.test>'}),extra={}){
 const store=new Memory(),calls=[];
 const mail=createMail({store,enabled:true,provider:'mailgun',apiKey:'synthetic-key',domain:'mail.example.test',apiBaseUrl:'https://api.eu.mailgun.net',from:'Filmmaand <login@mail.example.test>',allowedRecipients:['person@example.test'],fetcher:async(url,options)=>{calls.push({url,...options});return responder(store)},...extra});
 const api=createApi({store,blobs:{},queueMail:mail.queue,deliverMail:mail.deliver,now:extra.now});
 const req=(path,body,headers={})=>api(new Request('https://ely0030.xyz/filmmaand/api/'+path,{method:'POST',headers,body:JSON.stringify(body)}),{ip:'synthetic-ip'});
 return {store,calls,mail,req,request:()=>req('auth/code',{email:'person@example.test'})};
}
test('Mailgun EU form sends approved email and its actual code completes login',async()=>{
 const f=fixture();f.store.conflictClaim=true;
 const r=await f.request();assert.equal(r.status,200);const challenge=await r.json();
 assert.equal(f.calls.length,1);const sent=f.calls[0];assert.equal(sent.url,'https://api.eu.mailgun.net/v3/mail.example.test/messages');assert.equal(sent.headers.Authorization,'Basic '+Buffer.from('api:synthetic-key').toString('base64'));
 for(const k of ['o:tracking','o:tracking-opens','o:tracking-clicks'])assert.equal(sent.body.get(k),'no');assert.equal(sent.body.get('o:require-tls'),'yes');assert.equal(sent.body.get('from'),'Filmmaand <login@mail.example.test>');
 assert.doesNotMatch(sent.body.get('html'),/afm-moire/);assert.match(sent.body.get('html'),/interval-black-48/);
 const code=sent.body.get('text').match(/\b\d{6}\b/)[0];const login=await f.req('auth/verify',{challengeId:challenge.challengeId,code});assert.equal(login.status,200);assert.match(login.headers.get('set-cookie'),/HttpOnly/);
 assert.equal(f.store.data.mailReceipts[0].provider,'mailgun');assert.equal(f.store.data.mailReceipts[0].providerId,'<synthetic.123@mail.example.test>');assert.equal(JSON.stringify(challenge).includes('synthetic.123'),false);
});
test('unknown or missing provider ID preserves successful send',async()=>{
 for(const response of [()=>new Response('bad JSON'),()=>Response.json({id:'private arbitrary text'}),()=>Response.json({})]){
 const f=fixture(response);assert.equal((await f.request()).status,200);assert.equal(f.store.data.mailReceipts[0].providerId,null);assert.equal(f.calls.length,1);}
});
test('timeouts, rejection and lost acceptance writes never automatically send twice',async()=>{
 for(const responder of [()=>{throw Error('timeout')},()=>new Response('{}',{status:429}),()=>new Response('{}',{status:500}),store=>{store.failReceipt=true;return Response.json({id:'<synthetic@mail.example.test>'})}]){
 const f=fixture(responder);assert.equal((await f.request()).status,503);const id=Object.keys(f.store.data.outbox)[0];assert.ok(f.store.data.outbox[id].attemptedAt);
 await f.mail.drain();await assert.rejects(f.mail.deliver(id));assert.equal(f.calls.length,1);assert.equal(f.store.data.mailReceipts,undefined);
 }
});
test('concurrent delivery commits one send claim before network request',async()=>{
 const f=fixture();const api=createApi({store:f.store,blobs:{},queueMail:f.mail.queue,deliverMail:async()=>{}});
 await api(new Request('https://ely0030.xyz/filmmaand/api/auth/code',{method:'POST',body:JSON.stringify({email:'person@example.test'})}),{ip:'synthetic-ip'});
 const id=Object.keys(f.store.data.outbox)[0];await Promise.allSettled([f.mail.deliver(id),f.mail.deliver(id)]);assert.equal(f.calls.length,1);assert.equal(f.store.data.mailReceipts.length,1);
});
test('invalid endpoint and unauthorized recipient fail before network',async()=>{
 for(const extra of [{apiBaseUrl:'https://untrusted.example.test'},{domain:'bad/path'},{allowedRecipients:[]}]){const f=fixture(undefined,extra);assert.equal((await f.request()).status,503);assert.equal(f.calls.length,0);}
});
test('provider switch does not reroute existing Resend outbox',async()=>{
 const f=fixture();f.store.data.outbox.legacy={to:'person@example.test',expiresAt:new Date(Date.now()+600000).toISOString()};await f.mail.drain();assert.equal(f.calls.length,0);assert.ok(f.store.data.outbox.legacy);
});

const testToken='synthetic-single-use-test-token-0001';
const testPlan={tokenSha256:createHash('sha256').update(testToken).digest('hex'),recipient:'person@example.test',expiresAt:'2099-01-01T00:00:00Z'};
test('designated request sends only exact existing text and still verifies; token cannot be reused',async()=>{
 let time=new Date().toISOString();const f=fixture(undefined,{plainTextTest:testPlan,now:()=>time});
 const response=await f.req('auth/code',{email:'person@example.test'},{'x-filmmaand-plain-text-test':testToken});assert.equal(response.status,200);const challenge=await response.json();
 const sent=f.calls[0];assert.equal(sent.body.has('html'),false);const code=sent.body.get('text').match(/\b\d{6}\b/)[0];
 const expected=renderLoginCodeEmail({code,expiresAt:challenge.expiresAt});assert.equal(sent.body.get('text'),expected.text);assert.equal(sent.body.get('subject'),expected.subject);
 for(const k of ['o:tracking','o:tracking-opens','o:tracking-clicks'])assert.equal(sent.body.get(k),'no');assert.equal(sent.body.get('o:require-tls'),'yes');
 assert.equal((await f.req('auth/verify',{challengeId:challenge.challengeId,code})).status,200);
 assert.equal(JSON.stringify(f.store.data).includes(testToken),false);
 time=new Date(Date.parse(time)+61000).toISOString();assert.equal((await f.req('auth/code',{email:'person@example.test'},{'x-filmmaand-plain-text-test':testToken})).status,400);assert.equal(f.calls.length,1);
});
test('normal requests stay multipart even when experiment configured; invalid designations send nothing',async()=>{
 const normal=fixture(undefined,{plainTextTest:testPlan});assert.equal((await normal.request()).status,200);assert.ok(normal.calls[0].body.get('html'));assert.equal(normal.store.data.mailPlainTextTests,undefined);
 for(const plan of [null,{...testPlan,recipient:'other@example.test'},{...testPlan,expiresAt:'2000-01-01T00:00:00Z'},{...testPlan,tokenSha256:'wrong'}]){
 const f=fixture(undefined,{plainTextTest:plan});assert.equal((await f.req('auth/code',{email:'person@example.test'},{'x-filmmaand-plain-text-test':testToken})).status,400);assert.equal(f.calls.length,0);}
});
test('expiry starts before acceptance and resend invalidates the older challenge',async()=>{
 let time='2026-09-08T02:00:00.000Z';const f=fixture(()=>{time=new Date(Date.parse(time)+120000).toISOString();return Response.json({id:'<delay@mail.example.test>'})},{now:()=>time});
 const first=await (await f.request()).json();assert.equal(first.expiresAt,'2026-09-08T02:10:00.000Z');const oldCode=f.calls[0].body.get('text').match(/\b\d{6}\b/)[0];
 const second=await (await f.request()).json();assert.equal((await f.req('auth/verify',{challengeId:first.challengeId,code:oldCode})).status,410);
 const code=f.calls[1].body.get('text').match(/\b\d{6}\b/)[0];time=second.expiresAt;assert.equal((await f.req('auth/verify',{challengeId:second.challengeId,code})).status,410);
});
test('denied daily or monthly quota leaves the experiment token unused',async()=>{
 for(const usage of [{'2026-09-08':80},{'2026-09':2000}]){
 const f=fixture(undefined,{plainTextTest:testPlan,now:()=> '2026-09-08T00:00:00.000Z'});f.store.data.mailUsage=structuredClone(usage);
 assert.equal((await f.req('auth/code',{email:'person@example.test'},{'x-filmmaand-plain-text-test':testToken})).status,503);
 assert.equal(f.calls.length,0);assert.deepEqual(f.store.data.outbox,{});assert.equal(f.store.data.mailPlainTextTests,undefined);assert.deepEqual(f.store.data.mailUsage,usage);
 }
});
