// Text group chat on the date poll (phase 3): POST /plans/<id>/date-poll-chat (pass or session), read via the date-poll
// GET with ?since=<cursor>. Own-person only, text cap, per-person rate limit without read-side writes, organiser hide,
// never mail, private + no-store, receipts without the chat view.
import test from 'node:test';import assert from 'node:assert/strict';
import {createApi} from './api.mjs';import {openState,emptyState} from './state.mjs';import {createPlanningService} from './runtime/planning/service.mjs';
import {normaliseText} from './runtime/planning/chat.mjs';

const ORIGIN='https://example.test',NIGHTS=['2026-09-24','2026-09-25','2026-09-26'],POLL='plans/home-picker-lab/date-poll';
async function fixture(){
 const c=openState(emptyState()),s=createPlanningService({store:c.plans,adminToken:'secret'});
 await s.seed({id:'home-picker-lab',title:'Filmmaand',window:{start:'2026-09-01',end:'2026-09-30'},options:['a','b','c'].map(x=>({id:x,title:x}))});
 let writes=0;const store={data:c.export(),etag:1,async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}},async setJSON(k,v,{onlyIfMatch}){if(onlyIfMatch!==String(this.etag))return {modified:false};writes++;this.data=structuredClone(v);this.etag++;return {modified:true}}};c.close();
 let code;const clock={now:'2026-09-23T10:00:00.000Z'};
 const api=createApi({store,blobs:{},adminToken:'secret',organizerIds:[],origin:ORIGIN,queueMail:async(c,m)=>{code=m.code},now:()=>clock.now});
 async function request(path,method,body,headers={}){const r=await api(new Request(ORIGIN+'/filmmaand/api/'+path,{method,headers:{Origin:ORIGIN,...headers},...(body?{body:JSON.stringify(body)}:{})}),{ip:'fixture'});return {status:r.status,body:await r.json(),headers:r.headers}}
 const admin=key=>({Authorization:'Bearer secret',...(key?{'Idempotency-Key':key}:{})});
 const pollId=(await request(POLL,'POST',{action:'open',mode:'availability',pick:'manual',window:{start:NIGHTS[0],end:NIGHTS[2]},choices:[]},admin('open-chat-poll-00001'))).body.datePoll.id;
 const minted=await request(POLL,'POST',{action:'issue-passes',pollId,people:[{email:'lotte@example.test',name:'Lotte',avatarId:12},{email:'daan@example.test',name:'Daan',avatarId:9}]},admin());
 const pass=Object.fromEntries(minted.body.passes.map(p=>[p.name,p.token]));
 let n=0;const key=()=>'chat-test-key-'+String(++n).padStart(8,'0');
 const say=(who,text,since=0,extra={},k=key())=>request('plans/home-picker-lab/date-poll-chat'+(since?'?since='+since:''),'POST',{pollId,text,...extra},{'X-Filmmaand-Poll-Pass':pass[who],'Idempotency-Key':k});
 const read=(who,since)=>request(POLL+(since!==undefined?'?since='+since:''),'GET',null,{'X-Filmmaand-Poll-Pass':pass[who]});
 async function session(email){const ch=await request('auth/code','POST',{email}),r=await request('auth/verify','POST',{challengeId:ch.body.challengeId,code});return r.headers.get('set-cookie').split(';')[0]}
 return {store,clock,request,admin,pollId,pass,say,read,key,session,writes:()=>writes};
}
const tick=(f,s)=>{f.clock.now=new Date(Date.parse(f.clock.now)+s*1000).toISOString()};

test('post as yourself, read with a cursor: the POST returns the chat since your cursor, the GET ?since= only what is new',async()=>{
 const f=await fixture();
 const first=await f.say('Lotte','  movie?  ');
 assert.equal(first.status,200,JSON.stringify(first.body));assert.equal(first.headers.get('cache-control'),'private, no-store');assert.equal(first.headers.get('set-cookie'),null);
 assert.deepEqual(first.body.message,{id:first.body.message.id,seq:1,name:'Lotte',avatarId:12,at:'2026-09-23T10:00:00.000Z',t:'12:00',text:'movie?',self:true});
 assert.deepEqual(first.body.chat.messages.map(m=>m.text),['movie?']);assert.equal(first.body.chat.cursor,1);
 tick(f,30);const reply=await f.say('Daan','ja!\nzaterdag',1);// Daan's cursor is 1: the response carries only his own new message
 assert.deepEqual(reply.body.chat.messages.map(m=>[m.name,m.text,!!m.self]),[['Daan','ja!\nzaterdag',true]]);assert.equal(reply.body.chat.cursor,2);
 const all=(await f.read('Lotte')).body.chat;assert.deepEqual(all.messages.map(m=>[m.seq,m.name,!!m.self]),[[1,'Lotte',true],[2,'Daan',false]]);assert.equal(all.cursor,2);
 assert.deepEqual((await f.read('Lotte',1)).body.chat.messages.map(m=>m.seq),[2]);
 assert.deepEqual((await f.read('Lotte',2)).body.chat,{messages:[],cursor:2,hidden:[]});
 // A bad cursor reads as 0 (everything), never an error.
 assert.equal((await f.read('Lotte','abc')).body.chat.messages.length,2);
 // The public plan GET has no chat.
 const pub=await f.request('plans/home-picker-lab','GET');assert.equal(JSON.stringify(pub.body).includes('movie?'),false);
 // The receipt keeps only the message, never the chat view.
 for(const r of Object.values(f.store.data.plans['home-picker-lab'].data.receipts).filter(r=>r.result?.message))assert.deepEqual(Object.keys(r.result),['message']);
 // An exact retry replays (same key, same body): one message, not two.
 const k='chat-retry-key-000001';tick(f,30);await f.say('Lotte','zelfde',0,{},k);await f.say('Lotte','zelfde',0,{},k);
 assert.equal(f.store.data.plans['home-picker-lab'].data.datePoll.chat.messages.filter(m=>m.text==='zelfde').length,1);
});

test('scope: a pass posts only as its own person; strict body; dead pass 401; POST only',async()=>{
 const f=await fixture();
 for(const extra of [{name:'Daan'},{participantId:'x'},{a:'p_x'},{at:'2020-01-01T00:00:00Z'},{seq:9}])assert.equal((await f.say('Lotte','hoi',0,extra)).status,400,JSON.stringify(extra));
 const m=(await f.say('Lotte','hoi')).body.message;assert.equal(m.name,'Lotte');
 const dead=await f.request('plans/home-picker-lab/date-poll-chat','POST',{pollId:f.pollId,text:'x'},{'X-Filmmaand-Poll-Pass':'A'.repeat(43),'Idempotency-Key':f.key()});
 assert.equal(dead.status,401);assert.equal(dead.body.error.code,'pass_invalid');
 for(const method of ['GET','PUT','DELETE'])assert.equal((await f.request('plans/home-picker-lab/date-poll-chat',method,method==='GET'?null:{},{'X-Filmmaand-Poll-Pass':f.pass.Lotte,'Idempotency-Key':f.key()})).status,405,method);
 assert.equal((await f.request('plans/home-picker-lab/date-poll-chat','POST',{pollId:f.pollId,text:'x'},{'Idempotency-Key':f.key()})).status,401);// no identity
 // A session works too, as that account.
 const cookie=await f.session('daan@example.test');
 const viaSession=await f.request('plans/home-picker-lab/date-poll-chat','POST',{pollId:f.pollId,text:'via sessie'},{Cookie:cookie,'Idempotency-Key':f.key()});
 assert.equal(viaSession.status,200,JSON.stringify(viaSession.body));assert.equal(viaSession.body.message.name,'Daan');
});

test('text cap and shape: plain text, 1..500 code points, at most 9 lines, no control or bidi characters',async()=>{
 const f=await fixture(),code=async t=>(await f.say('Lotte',t)).body.error?.code;
 assert.equal(normaliseText('  hé\r\nda  '),'hé\nda');assert.equal(normaliseText('😀'.repeat(500)).length,1000);// code points, not UTF-16 units
 assert.equal(await code('😀'.repeat(501)),'chat_too_long');assert.equal(await code('a\n'.repeat(9)+'a'),'chat_too_long');
 for(const bad of ['','   ',null,5,['x'],'tab\there','nul\u0000','bidi\u202eevil','line\u2028sep'])assert.match(String(await code(bad)),/^chat/,JSON.stringify(bad));
 assert.equal(await code('<b>html</b> blijft tekst'),undefined);// stored as text; the page renders it with textContent
});

test('rate limit per person: 5 a minute, 40 an hour; others are unaffected; reads never write',async()=>{
 const f=await fixture();
 for(let i=0;i<5;i++){assert.equal((await f.say('Lotte','m'+i)).status,200);tick(f,1)}
 const limited=await f.say('Lotte','zesde');assert.equal(limited.status,429);assert.equal(limited.body.error.code,'chat_rate');assert.ok(limited.body.error.details.retryAfter>0);
 assert.equal((await f.say('Daan','ik mag wel')).status,200);
 tick(f,60);assert.equal((await f.say('Lotte','weer')).status,200);
 // Hour window: 40 per hour.
 for(let i=0;i<34;i++){tick(f,13);assert.equal((await f.say('Lotte','u'+i)).status,200,'u'+i)}
 tick(f,13);assert.equal((await f.say('Lotte','41ste')).body.error.code,'chat_rate');
 // Reading, any number of times, writes nothing (the limit lives in the messages themselves).
 const w=f.writes(),before=JSON.stringify(f.store.data);for(let i=0;i<5;i++)await f.read('Lotte',i);
 assert.equal(f.writes(),w);assert.equal(JSON.stringify(f.store.data),before);
});

test('organiser hide: gone for everyone (the hidden id is listed so clients remove it); never mail; closed poll refuses',async()=>{
 const f=await fixture();const m=(await f.say('Lotte','oeps')).body.message;tick(f,5);await f.say('Daan','hoi');
 const notices=()=>JSON.stringify([f.store.data.plans['home-picker-lab'].data.notices,f.store.data.eventNotifications]);const before=notices();
 const org=(await f.request(POLL,'POST',{action:'list-availability',pollId:f.pollId},f.admin())).body.datePoll.chat;
 assert.deepEqual(org.map(x=>[x.name,x.text,x.hidden]),[['Lotte','oeps',false],['Daan','hoi',false]]);
 // Only the organiser: a pass cannot hide.
 assert.equal((await f.request(POLL,'POST',{action:'hide-message',pollId:f.pollId,messageId:m.id,hidden:true},{'X-Filmmaand-Poll-Pass':f.pass.Daan,'Idempotency-Key':f.key()})).status,405);
 assert.equal((await f.request(POLL,'POST',{action:'hide-message',pollId:f.pollId,messageId:m.id,hidden:true},f.admin('hide-message-key-0001'))).status,200);
 const view=(await f.read('Daan')).body.chat;assert.deepEqual(view.messages.map(x=>x.text),['hoi']);assert.deepEqual(view.hidden,[m.id]);
 assert.deepEqual((await f.read('Lotte',2)).body.chat.hidden,[m.id]);// a client that already showed it learns to remove it
 assert.equal((await f.request(POLL,'POST',{action:'hide-message',pollId:f.pollId,messageId:m.id,hidden:false},f.admin('hide-message-key-0002'))).status,200);
 assert.deepEqual((await f.read('Daan')).body.chat.messages.map(x=>x.text),['oeps','hoi']);
 assert.equal((await f.request(POLL,'POST',{action:'hide-message',pollId:f.pollId,messageId:'msg-nope',hidden:true},f.admin('hide-message-key-0003'))).body.error.code,'message_unknown');
 assert.equal(notices(),before);
 assert.equal((await f.request(POLL,'POST',{action:'pick',pollId:f.pollId,date:NIGHTS[2]},f.admin('pick-chat-poll-00001'))).status,200);
 tick(f,60);assert.equal((await f.say('Lotte','na de keuze')).body.error.code,'date_poll_closed');
});
