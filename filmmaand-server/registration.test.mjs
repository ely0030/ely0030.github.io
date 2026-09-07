import test from 'node:test';
import assert from 'node:assert/strict';
import {registrationPolicy} from './registration.mjs';
import {createMail} from './mail.mjs';
import {createApi} from './api.mjs';
import {emptyState,openState} from './state.mjs';
class Memory {
 constructor(){const c=openState(emptyState());this.data=c.export();c.close();this.etag=1;}
 async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)};}
 async setJSON(k,data,{onlyIfMatch}){if(String(this.etag)!==onlyIfMatch)return {modified:false};this.data=structuredClone(data);this.etag++;return {modified:true};}
}
function fixture(mode,usage={}){
 const policy=registrationPolicy({AUTH_REGISTRATION:mode,AUTH_ALLOW_LIST:'original@example.test',AUTH_MAIL_ALLOW:'original@example.test'});
 const store=new Memory();store.data.mailUsage=usage;const sent=[];
 const mail=createMail({store,...policy,enabled:true,apiKey:'synthetic',from:'sender@example.test',fetcher:async(u,o)=>{sent.push(JSON.parse(o.body));return new Response('{}');}});
 const api=createApi({store,blobs:{},authConfig:{allowList:policy.allowList},queueMail:mail.queue,deliverMail:mail.deliver});
 return {store,sent,async code(email){return api(new Request('https://ely0030.xyz/filmmaand/api/auth/code',{method:'POST',body:JSON.stringify({email})}),{ip:'synthetic-registration'});}};
}
test('explicit public registration delivers to a new visitor despite both legacy test lists',async()=>{
 const f=fixture('public');const response=await f.code('new-visitor@example.test');assert.equal(response.status,200);assert.equal(f.sent.length,1);assert.deepEqual(f.sent[0].to,['new-visitor@example.test']);assert.match(f.sent[0].text,/\b\d{6}\b/);assert.equal(Object.keys(f.store.data.outbox).length,0);
 // Canonical cooldown still limits repeated requests.
 await f.code('new-visitor@example.test');assert.equal(f.sent.length,1);
});
test('default and unknown registration modes keep non-allowlisted visitors private and undelivered',async()=>{
 for(const mode of [undefined,'typo']){const f=fixture(mode);const response=await f.code('new-visitor@example.test');assert.equal(response.status,200);assert.equal(f.sent.length,0);assert.equal(f.store.data.auth.login_codes.length,0);}
 const f=fixture();assert.equal((await f.code('original@example.test')).status,200);assert.equal(f.sent.length,1);
});
test('public registration retains durable daily and monthly delivery caps',async()=>{
 const day=new Date().toISOString().slice(0,10);
 for(const usage of [{[day]:80},{[day.slice(0,7)]:2000}]){const f=fixture('public',usage);assert.equal((await f.code('new-visitor@example.test')).status,503);assert.equal(f.sent.length,0);assert.equal(Object.keys(f.store.data.outbox).length,0);}
});
