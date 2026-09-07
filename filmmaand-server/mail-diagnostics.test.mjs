import test from 'node:test';
import assert from 'node:assert/strict';
import {createMail} from './mail.mjs';
import {createApi} from './api.mjs';
import {emptyState,openState} from './state.mjs';
import {RECEIPT_LIMIT,RECEIPT_TTL_MS,templateFingerprint} from './mail-diagnostics.mjs';
const providerId='11111111-2222-4333-8444-555555555555'; // Synthetic provider fixture; no live call.
class Memory {
 constructor(){const c=openState(emptyState());this.data=c.export();c.close();this.etag=1;this.conflictOnce=false;this.loseAck=false;}
 async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)};}
 async setJSON(k,data,{onlyIfMatch}){
  if(this.conflictOnce&&data.mailReceipts?.length){this.conflictOnce=false;this.etag++;return {modified:false};}
  if(this.loseAck&&data.mailReceipts?.length){this.loseAck=false;throw Error('synthetic storage failure');}
  if(String(this.etag)!==onlyIfMatch)return {modified:false};
  this.data=structuredClone(data);this.etag++;return {modified:true};
 }
}
function fixture(responder=()=>Response.json({id:providerId})){
 const store=new Memory(),calls=[];let time=new Date().toISOString();
 const mail=createMail({store,enabled:true,apiKey:'synthetic-key',from:'sender@example.test',allowedRecipients:['person@example.test'],now:()=>time,
  fetcher:async(url,options)=>{calls.push(options);return responder(calls.length,store);}});
 const api=createApi({store,blobs:{},queueMail:mail.queue,deliverMail:mail.deliver});
 return {store,calls,mail,api,setTime(value){time=value;},async request(){return api(new Request('https://ely0030.xyz/filmmaand/api/auth/code',{method:'POST',body:JSON.stringify({email:'person@example.test'})}),{ip:'synthetic-ip'});}};
}
test('successful provider receipt survives CAS conflict, is private and contains only approved metadata',async()=>{
 const f=fixture();f.store.conflictOnce=true;
 const response=await f.request();assert.equal(response.status,200);
 const publicBody=await response.text();assert.equal(publicBody.includes(providerId),false);assert.equal(publicBody.includes(templateFingerprint),false);
 assert.equal(f.calls.length,1);assert.equal(Object.keys(f.store.data.outbox).length,0);
 assert.equal(f.store.data.mailReceipts.length,1);
 const receipt=f.store.data.mailReceipts[0];assert.deepEqual(Object.keys(receipt).sort(),['acceptedAt','provider','providerId','providerIdStatus','queuedAt','retainUntil','status','templateFingerprint'].sort());
 assert.equal(receipt.providerId,providerId);assert.equal(receipt.status,'accepted');assert.equal(receipt.templateFingerprint,templateFingerprint);
 assert.equal(Date.parse(receipt.retainUntil)-Date.parse(receipt.acceptedAt),RECEIPT_TTL_MS);
 const wire=JSON.stringify(receipt),payload=JSON.parse(f.calls[0].body),code=payload.text.match(/\b\d{6}\b/)[0];
 for(const forbidden of ['person@example.test','synthetic-key',payload.text,code])assert.equal(wire.includes(forbidden),false);
 assert.equal('templateFingerprint' in payload,false);
});
test('missing, malformed and rejected response JSON retain HTTP-success semantics',async()=>{
 for(const responder of [()=>new Response('{}'),()=>new Response('invalid JSON'),()=>Response.json({id:'secret-body-not-a-uuid'}),()=>({ok:true,json:async()=>{throw Error('private payload')}})]){
  const f=fixture(responder);assert.equal((await f.request()).status,200);assert.equal(f.calls.length,1);
  assert.equal(Object.keys(f.store.data.outbox).length,0);assert.equal(f.store.data.mailReceipts[0].providerId,null);assert.equal(f.store.data.mailReceipts[0].providerIdStatus,'unavailable');
 }
});
test('provider network failure preserves identical body/key and adds no success receipt before retry',async()=>{
 const f=fixture(n=>{if(n===1)throw Error('lost provider acknowledgement');return Response.json({id:providerId});});
 assert.equal((await f.request()).status,503);assert.equal(f.store.data.mailReceipts,undefined);
 const id=Object.keys(f.store.data.outbox)[0];assert.ok(id);await f.mail.deliver(id);
 assert.equal(f.calls.length,2);assert.equal(f.calls[0].body,f.calls[1].body);assert.equal(f.calls[0].headers['Idempotency-Key'],f.calls[1].headers['Idempotency-Key']);assert.equal(f.store.data.mailReceipts.length,1);
});
test('failed acceptance-state write preserves outbox and reuses provider idempotency key',async()=>{
 const f=fixture();f.store.loseAck=true;assert.equal((await f.request()).status,503);
 const id=Object.keys(f.store.data.outbox)[0];assert.ok(id);assert.equal(f.store.data.mailReceipts,undefined);
 await f.mail.deliver(id);assert.equal(f.calls[0].body,f.calls[1].body);assert.equal(f.calls[0].headers['Idempotency-Key'],f.calls[1].headers['Idempotency-Key']);assert.equal(f.store.data.mailReceipts.length,1);
});
test('legacy pending mail keeps unknown template; provider rejection stores no success receipt',async()=>{
 const f=fixture(n=>n===1?new Response('{}',{status:429}):Response.json({id:providerId}));
 assert.equal((await f.request()).status,503);assert.equal(f.store.data.mailReceipts,undefined);
 const id=Object.keys(f.store.data.outbox)[0];delete f.store.data.outbox[id].templateFingerprint;
 await f.mail.deliver(id);assert.equal(f.store.data.mailReceipts[0].templateFingerprint,null);
});
test('receipts are capped and expire on drain even with no pending mail',async()=>{
 const f=fixture();const timestamp=new Date().toISOString();
 f.store.data.mailReceipts=Array.from({length:RECEIPT_LIMIT},(_,i)=>({providerId:String(i),retainUntil:new Date(Date.parse(timestamp)+RECEIPT_TTL_MS).toISOString()}));
 assert.equal((await f.request()).status,200);assert.equal(f.store.data.mailReceipts.length,RECEIPT_LIMIT);assert.equal(f.store.data.mailReceipts[0].providerId,'1');
 f.setTime(new Date(Date.parse(timestamp)+RECEIPT_TTL_MS+60000).toISOString());await f.mail.drain();assert.deepEqual(f.store.data.mailReceipts,[]);assert.equal(f.calls.length,1);
});
test('concurrent provider acknowledgements commit exactly one receipt',async()=>{
 let release;const barrier=new Promise(resolve=>{release=resolve;});
 const f=fixture(async n=>{if(n===1)throw Error('initial lost acknowledgement');if(n===3)release();await barrier;return Response.json({id:providerId});});
 assert.equal((await f.request()).status,503);const id=Object.keys(f.store.data.outbox)[0];
 await Promise.all([f.mail.deliver(id),f.mail.deliver(id)]);
 assert.equal(f.calls.length,3);assert.equal(f.store.data.mailReceipts.length,1);assert.equal(Object.keys(f.store.data.outbox).length,0);
 assert.equal(f.calls[1].body,f.calls[2].body);assert.equal(f.calls[1].headers['Idempotency-Key'],f.calls[2].headers['Idempotency-Key']);
});
