// Chris's whole launch from Beheer, zero curl: open a manual poll → invitees (issue-passes with people) → "Uitnodiging
// sturen aan N mensen" (action invite). Invitations: organiser-only, one per person per poll ever, replay-safe, minted at
// delivery through the pluggable template, never a plaintext token in state/outbox/logs, dropped when the poll closed.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createApi} from './api.mjs';import {openState,emptyState} from './state.mjs';import {createPlanningService} from './runtime/planning/service.mjs';
import {createEventNotifications} from './event-notifications.mjs';import {renderPollInvite} from './poll-invite-mail.mjs';

const ORIGIN='https://example.test',NIGHTS=['2026-09-24','2026-09-25','2026-09-26'],URL_='plans/home-picker-lab/date-poll';
async function fixture(){
 const c=openState(emptyState()),s=createPlanningService({store:c.plans,adminToken:'secret'});
 await s.seed({id:'home-picker-lab',title:'Filmmaand',window:{start:'2026-09-01',end:'2026-09-30'},options:['a','b','c'].map(x=>({id:x,title:x}))});
 const store={data:c.export(),etag:1,async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}},async setJSON(k,v,{onlyIfMatch}){if(onlyIfMatch!==String(this.etag))return {modified:false};this.data=structuredClone(v);this.etag++;return {modified:true}}};c.close();
 let code;const clock={now:'2026-09-23T10:00:00.000Z'},organizerIds=[];
 const api=createApi({store,blobs:{},adminToken:'secret',organizerIds,origin:ORIGIN,queueMail:async(c,m)=>{code=m.code},now:()=>clock.now});
 async function request(path,method,body,headers={}){const r=await api(new Request(ORIGIN+'/filmmaand/api/'+path,{method,headers:{Origin:ORIGIN,...headers},...(body?{body:JSON.stringify(body)}:{})}),{ip:'fixture'});return {status:r.status,body:await r.json()}}
 async function login(email){const ch=await request('auth/code','POST',{email}),r=await api(new Request(ORIGIN+'/filmmaand/api/auth/verify',{method:'POST',headers:{Origin:ORIGIN},body:JSON.stringify({challengeId:ch.body.challengeId,code})}),{ip:'fixture'});return {cookie:r.headers.get('set-cookie').split(';')[0],id:(await r.json()).participant.id}}
 const alec=await login('alec@filmvrienden.nl');organizerIds.push(alec.id);
 await request('auth/profile','PUT',{expectedRevision:0,name:'Alec',animal:'otter',avatarId:6},{Cookie:alec.cookie,'Idempotency-Key':'profile-alec-000001'});
 const org=(key,extra={})=>({Cookie:alec.cookie,'X-Filmmaand-Organizer-Id':alec.id,'X-Filmmaand-Reset-Generation':'0',...(key?{'Idempotency-Key':key}:{}),...extra});
 const sent=[],logs=[];
 const events=createEventNotifications({store,enabled:true,activatedAt:'2026-01-01T00:00:00.000Z',allowAnyRecipient:true,origin:ORIGIN,now:()=>clock.now,send:async(m,{id})=>{sent.push(m);return {providerId:'stub-'+id}}});
 return {store,clock,request,org,alec,sent,logs,events};
}
const outbox=f=>Object.values(f.store.data.eventNotifications?.outbox||f.store.data.notifications?.outbox||{}).filter(m=>m.notice?.type==='poll-invite');
const findOutbox=f=>{const hits=[];const walk=(o,path)=>{if(!o||typeof o!=='object')return;if(o.notice?.type==='poll-invite')hits.push(o);for(const [k,v] of Object.entries(o))walk(v,path+'.'+k)};walk(f.store.data,'');return hits};

test('the launch, as the organiser from Beheer: manual poll, invitees, one invitation each, replay-safe, no plaintext token anywhere',async()=>{
 const f=await fixture(),origLog=console.log,origErr=console.error;console.log=(...a)=>f.logs.push(a.join(' '));console.error=(...a)=>f.logs.push(a.join(' '));
 try{
  // 1. Open (what the Beheer form now sends by default).
  const opened=await f.request(URL_,'POST',{action:'open',mode:'availability',pick:'manual',window:{start:NIGHTS[0],end:NIGHTS[2]},choices:[]},f.org('launch-open-key-0001'));
  assert.equal(opened.status,200,JSON.stringify(opened.body));assert.equal(opened.body.datePoll.pick,'manual');const pollId=opened.body.datePoll.id;
  // 2. Invitees → personal links; accounts created for newcomers. Nothing is queued by issuing.
  const issued=await f.request(URL_,'POST',{action:'issue-passes',pollId,people:[{email:'lotte@filmvrienden.nl',name:'Lotte'},{email:'bram@filmvrienden.nl',name:'Bram'},{email:'ies@example.test',name:'Ies'}]},f.org('launch-issue-key-001'));
  assert.equal(issued.status,200,JSON.stringify(issued.body));assert.deepEqual(issued.body.passes.map(p=>[p.name,p.created]),[['Lotte',true],['Bram',true],['Ies',true]]);
  const tokens=issued.body.passes.map(p=>p.token);assert.deepEqual(findOutbox(f),[]);
  // 3. invite-list (a read) shows exactly those three; then the send, only with a key.
  const list=await f.request(URL_,'POST',{action:'invite-list',pollId},f.org());assert.deepEqual(list.body.recipients.map(r=>r.name),['Lotte','Bram','Ies']);
  assert.equal((await f.request(URL_,'POST',{action:'invite',pollId},f.org())).body.error.code,'request_key');assert.deepEqual(findOutbox(f),[]);
  const sent1=await f.request(URL_,'POST',{action:'invite',pollId},f.org('launch-invite-key-01'));
  assert.equal(sent1.status,200,JSON.stringify(sent1.body));assert.deepEqual(sent1.body.recipients.map(r=>r.name),['Lotte','Bram','Ies']);
  assert.equal(findOutbox(f).length,3);
  // Replay (same key) → same body, nothing new. A second click (new key) → nobody (already invited).
  assert.deepEqual((await f.request(URL_,'POST',{action:'invite',pollId},f.org('launch-invite-key-01'))).body,sent1.body);
  assert.deepEqual((await f.request(URL_,'POST',{action:'invite',pollId},f.org('launch-invite-key-02'))).body.recipients,[]);assert.equal(findOutbox(f).length,3);
  assert.deepEqual((await f.request(URL_,'POST',{action:'invite-list',pollId},f.org())).body.recipients,[]);
  // Someone added later is invited by the next send, alone.
  await f.request(URL_,'POST',{action:'issue-passes',pollId,people:[{email:'mo@filmvrienden.nl',name:'Mo'}]},f.org('launch-issue-key-002'));
  assert.deepEqual((await f.request(URL_,'POST',{action:'invite',pollId},f.org('launch-invite-key-03'))).body.recipients.map(r=>r.name),['Mo']);assert.equal(findOutbox(f).length,4);
  // Bram answers before delivery: his invitation is dropped. ies@example.test is never mailed (test address policy).
  await f.request(URL_.replace('date-poll','date-poll'),'PUT',{pollId,revision:0,availability:Object.fromEntries(NIGHTS.map(d=>[d,false])),favourite:null},{'X-Filmmaand-Poll-Pass':tokens[1],'Idempotency-Key':'bram-answer-key-0001'});
  await f.events.drain({limit:20});
  assert.deepEqual(f.sent.map(m=>m.to).sort(),['lotte@filmvrienden.nl','mo@filmvrienden.nl']);
  const lotte=f.sent.find(m=>m.to==='lotte@filmvrienden.nl');
  assert.equal(lotte.subject,'movie deze week?');assert.match(lotte.text,/^Hoi Lotte,\n\nmovie deze week\? do 24, vr 25 of za 26 september\n\nhttps:\/\/example\.test\/filmmaand\/wanneer\/\?pas=[A-Za-z0-9_-]{43}\n\nAlec$/);
  const link=/pas=([A-Za-z0-9_-]{43})/.exec(lotte.text)[1];assert.ok(lotte.html.includes(link));
  assert.equal((await f.request(URL_,'GET',null,{'X-Filmmaand-Poll-Pass':link})).body.viewer.name,'Lotte');// the mailed link works
  // No plaintext token in state (incl. outbox) or logs: neither the mailed one nor the ones issue-passes returned.
  const state=JSON.stringify(f.store.data);for(const t of [link,...tokens])assert.equal(state.includes(t),false);
  for(const t of [link,...tokens])assert.equal(f.logs.some(l=>l.includes(t)),false);
  // Draining again sends nothing more.
  await f.events.drain({limit:20});assert.equal(f.sent.length,2);
 }finally{console.log=origLog;console.error=origErr}
});

test('invitations are organiser-only; refused callers queue nothing; a closed poll drops queued invitations',async()=>{
 const f=await fixture();
 const pollId=(await f.request(URL_,'POST',{action:'open',mode:'availability',pick:'manual',window:{start:NIGHTS[0],end:NIGHTS[2]},choices:[]},f.org('launch-open-key-0002'))).body.datePoll.id;
 const issued=await f.request(URL_,'POST',{action:'issue-passes',pollId,people:[{email:'lotte@filmvrienden.nl',name:'Lotte'}]},f.org('launch-issue-key-003'));
 const pass=issued.body.passes[0].token,friend=await (async()=>{const r=await f.request('auth/code','POST',{email:'fien@filmvrienden.nl'});return r})();
 for(const [who,headers] of [['anonymous',{'Idempotency-Key':'anon-invite-key-0001'}],['pass',{'X-Filmmaand-Poll-Pass':pass,'Idempotency-Key':'pass-invite-key-0001'}],['wrong bearer',{Authorization:'Bearer nope','Idempotency-Key':'bear-invite-key-0001'}],['wrong organiser id',f.org('wrid-invite-key-0001',{'X-Filmmaand-Organizer-Id':'someone-else'})]]){
  for(const action of ['invite','invite-list']){const r=await f.request(URL_,'POST',{action,pollId},headers);assert.ok([401,403,405,409].includes(r.status),who+' '+action+' '+r.status)}
 }
 assert.deepEqual(findOutbox(f),[]);
 // Queued, then the organiser picks before delivery: the invitation is dropped, not sent.
 await f.request(URL_,'POST',{action:'invite',pollId},f.org('launch-invite-key-04'));assert.equal(findOutbox(f).length,1);
 await f.request(URL_,'POST',{action:'pick',pollId,date:NIGHTS[2]},f.org('launch-pick-key-00001'));
 await f.events.drain({limit:20});assert.deepEqual(f.sent.filter(m=>m.subject==='movie deze week?'),[]);
 assert.equal((await f.request(URL_,'POST',{action:'invite',pollId},f.org('launch-invite-key-05'))).body.error.code,'date_poll_closed');
});

test('the template is pluggable and must carry the link; assets are served from /filmmaand/assets/mail/',async()=>{
 const out=renderPollInvite({name:'<Lotte>',window:{start:NIGHTS[0],end:NIGHTS[2]},url:'https://example.test/filmmaand/wanneer/?pas='+'A'.repeat(43),origin:ORIGIN});
 assert.ok(out.html.includes('&lt;Lotte&gt;'));assert.equal(out.html.includes('<Lotte>'),false);// ctx values are escaped in html
 const tpl=await readFile(new URL('./poll-invite-template.mjs',import.meta.url),'utf8');
 assert.match(tpl,/export const subject=/);assert.match(tpl,/export const text=/);assert.match(tpl,/export const html=/);assert.match(tpl,/assetBase/);
 assert.ok((await readFile(new URL('../public/filmmaand/assets/mail/README.md',import.meta.url),'utf8')).includes('/filmmaand/assets/mail/'));
 // Beheer: the open form sends pick:'manual' unless "automatisch kiezen" is ticked; issue/invite only via coordinate().
 const js=await readFile(new URL('../public/filmmaand/beheer/beheer.js',import.meta.url),'utf8');
 assert.match(js,/\.\.\.\(isAuto\?\{\}:\{pick:'manual'\}\)/);
 for(const action of ['issue-passes','invite'])for(const m of js.matchAll(new RegExp(`action:'${action}'`,'g')))assert.match(js.slice(m.index-40,m.index),/coordinate\('date-poll',\{$/,action);
 assert.match(js,/organizerRead\(\{action:'invite-list'/);
 // Links from issue-passes are never shown: only names and "(nieuw account)".
 assert.equal(/\.token|\.url\b/.test(js),false);
});
