// Pre-merge review fixes (Cameo, 23 Sept): cost/state growth (1, 2), organiser picks always confirm per person (3), who gets
// the confirmation (4), no mail queued while mail is off (7), issue-passes never silently rotates (8), winter DST lifetime.
import test from 'node:test';import assert from 'node:assert/strict';
import {createApi} from './api.mjs';import {openState,emptyState} from './state.mjs';import {createPlanningService} from './runtime/planning/service.mjs';
import {queueCoordinationEvents} from './event-notifications.mjs';

const ORIGIN='https://example.test',POLL='plans/home-picker-lab/date-poll';
async function fixture({mail=true,window={start:'2026-09-24',end:'2026-09-26'},clock='2026-09-23T10:00:00.000Z',pick='manual',closesAt}={}){
 const c=openState(emptyState()),s=createPlanningService({store:c.plans,adminToken:'secret'});
 await s.seed({id:'home-picker-lab',title:'Filmmaand',window:{start:'2026-09-01',end:'2026-10-31'},options:['a','b','c'].map(x=>({id:x,title:x}))});
 let writes=0;const store={data:c.export(),etag:1,async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}},async setJSON(k,v,{onlyIfMatch}){if(onlyIfMatch!==String(this.etag))return {modified:false};writes++;this.data=structuredClone(v);this.etag++;return {modified:true}}};c.close();
 let code;const time={now:clock},mailOptions={enabled:true,activatedAt:'2026-01-01T00:00:00.000Z',allowAnyRecipient:true};
 const api=createApi({store,blobs:{},adminToken:'secret',organizerIds:[],origin:ORIGIN,queueMail:async(c,m)=>{code=m.code},...(mail?{mailActive:()=>true}:{}),
  queueEvents:async c=>queueCoordinationEvents(c,{...mailOptions,now:time.now}),now:()=>time.now});
 async function request(path,method,body,headers={}){const r=await api(new Request(ORIGIN+'/filmmaand/api/'+path,{method,headers:{Origin:ORIGIN,...headers},...(body?{body:JSON.stringify(body)}:{})}),{ip:'fixture'});return {status:r.status,body:await r.json()}}
 let n=0;const key=()=>'review-fix-key-'+String(++n).padStart(8,'0'),admin=(k=key())=>({Authorization:'Bearer secret','Idempotency-Key':k});
 const opened=await request(POLL,'POST',{action:'open',mode:'availability',...(pick==='manual'?{pick:'manual'}:{}),window,choices:[],...(closesAt?{closesAt}:{})},admin());
 assert.equal(opened.status,200,JSON.stringify(opened.body));const pollId=opened.body.datePoll.id;
 const minted=await request(POLL,'POST',{action:'issue-passes',pollId,people:['Lotte','Daan','Mo','Ies','Kees'].map((name,i)=>({email:name.toLowerCase()+'@filmvrienden.nl',name,avatarId:10+i}))},{Authorization:'Bearer secret'});
 assert.equal(minted.status,200,JSON.stringify(minted.body));
 const pass=Object.fromEntries(minted.body.passes.map(p=>[p.name,p.token]));
 const nights=[];for(let t=Date.parse(window.start);t<=Date.parse(window.end);t+=864e5)nights.push(new Date(t).toISOString().slice(0,10));
 const as=(who,k=key())=>({'X-Filmmaand-Poll-Pass':pass[who],'Idempotency-Key':k});
 const vote=(who,yes,revision=0)=>request(POLL,'PUT',{pollId,revision,availability:Object.fromEntries(nights.map(d=>[d,yes.includes(d)])),favourite:null},as(who));
 const outbox=type=>{const hits=[];const walk=o=>{if(!o||typeof o!=='object')return;if(o.notice?.type===type&&o.to)hits.push(o);for(const v of Object.values(o))walk(v)};walk(store.data);return hits};
 const plan=()=>store.data.plans['home-picker-lab'].data;
 return {store,time,request,admin,key,pollId,pass,as,vote,nights,outbox,plan,writes:()=>writes};
}
const tick=(f,ms)=>{f.time.now=new Date(Date.parse(f.time.now)+ms).toISOString()};

test('(1) doodle rate: 6 a minute, 30 an hour; reads never write; receipts keep {doodle:{id,at}} only',async()=>{
 const f=await fixture(),S=[['k',[[1,1],[50,50]]]];
 const put=()=>f.request(POLL+'-doodle','PUT',{pollId:f.pollId,s:S},f.as('Lotte'));
 for(let i=0;i<6;i++){assert.equal((await put()).status,200);tick(f,1000)}
 const r=await put();assert.equal(r.status,429);assert.ok(r.body.error.details.retryAfter>0);
 assert.equal((await f.request(POLL+'-doodle','PUT',{pollId:f.pollId,s:S},f.as('Daan'))).status,200);// others unaffected
 // One save a minute after that: 24 more fit in the hour (6 + 24 = 30), then the hour cap refuses until the first
 // saves are an hour old (not reached in these 40 minutes).
 let lotte=6,refused=0;for(let i=0;i<40;i++){tick(f,61e3);const x=await put();if(x.status===200)lotte++;else{assert.equal(x.body.error.code,'doodle_rate');refused++}}
 assert.equal(lotte,30);assert.equal(refused,16);
 const receipts=Object.values(f.plan().receipts).filter(x=>x.result?.doodle);
 for(const x of receipts){assert.deepEqual(Object.keys(x.result.doodle).sort(),['at','id']);assert.ok(x.at)}
 const w=f.writes(),before=JSON.stringify(f.store.data);for(let i=0;i<5;i++)await f.request(POLL,'GET',null,f.as('Lotte'));
 assert.equal(f.writes(),w);assert.equal(JSON.stringify(f.store.data),before);
});

test('(1) receipts are pruned 7 days after they were written; older receipts without a time are left alone',async()=>{
 const f=await fixture();
 f.plan().receipts['legacy:key']={fingerprint:'x',result:{ok:true}};// what production already has
 await f.vote('Lotte',[f.nights[0]]);const k=Object.keys(f.plan().receipts).find(x=>x!=='legacy:key'&&f.plan().receipts[x].at);assert.ok(k);
 tick(f,6*864e5);await f.vote('Daan',[f.nights[1]]);assert.ok(f.plan().receipts[k],'kept within 7 days');
 // 7 days later the passes are past their hard cap (28 Sept), so the next write is the organiser's.
 tick(f,864e5+1000);assert.equal((await f.request(POLL,'POST',{action:'close',pollId:f.pollId},f.admin())).status,200);
 assert.equal(f.plan().receipts[k],undefined,'pruned after 7 days');assert.ok(f.plan().receipts['legacy:key'],'legacy receipt untouched');
});

test('(1) burst: 300 doodle PUTs from one pass keep the state small (was ~920KB), and the plan never 503s',async()=>{
 const f=await fixture(),S=[['k',Array.from({length:120},(_,i)=>[i%100+0.5,(i*7)%100+0.5])]];
 const size0=JSON.stringify(f.store.data).length;
 for(let i=0;i<300;i++){await f.request(POLL+'-doodle','PUT',{pollId:f.pollId,s:S},f.as('Lotte'));tick(f,20e3)}// 100 minutes
 const grown=JSON.stringify(f.store.data).length-size0;
 assert.ok(grown<25000,'state grew '+grown+' bytes');// was ~920KB before the fix
 // ~60 saves were accepted over 100 minutes (30 an hour), but a person keeps at most 50 receipts: bounded whatever the pace.
 const lotte=Object.keys(f.plan().receipts).filter(k=>k.startsWith(Object.keys(f.plan().datePoll.doodles)[0]+':'));
 assert.equal(lotte.length,50,'receipts for Lotte: '+lotte.length);assert.ok(Object.keys(f.plan().receipts).length<=52);
 assert.equal((await f.vote('Daan',[f.nights[0]])).status,200);// no 503: the plan still takes writes
});

test('(2) organiser receipts keep a small summary; a replaced poll is archived without chat/doodles/rsvp',async()=>{
 const f=await fixture();await f.vote('Lotte',[f.nights[2]]);
 for(let i=0;i<5;i++){await f.request(POLL+'-chat','POST',{pollId:f.pollId,text:'bericht '+i+' '+'x'.repeat(300)},f.as('Lotte'));tick(f,13e3)}
 await f.request(POLL+'-doodle','PUT',{pollId:f.pollId,s:[['k',[[1,1]]]]},f.as('Daan'));
 const pick=await f.request(POLL,'POST',{action:'pick',pollId:f.pollId,date:f.nights[2]},f.admin('pick-summary-key-0001'));assert.equal(pick.status,200);
 await f.request(POLL+'-rsvp','PUT',{pollId:f.pollId,answer:'ja'},f.as('Lotte'));
 const r=Object.entries(f.plan().receipts).find(([k])=>k.endsWith('pick-summary-key-0001'))[1];
 assert.ok(JSON.stringify(r).length<600,JSON.stringify(r).length+' bytes');assert.equal(JSON.stringify(r).includes('bericht'),false);
 assert.deepEqual(Object.keys(r.result.datePoll).sort(),['id','mode','pick','programmeId','scheduledDate','status','window']);
 // Replace the poll: the archive keeps the poll but not its social state.
 tick(f,864e5);assert.equal((await f.request(POLL,'POST',{action:'open',mode:'availability',pick:'manual',window:{start:'2026-10-01',end:'2026-10-03'},choices:[]},f.admin())).status,200);
 const old=f.plan().datePollHistory.at(-1);
 for(const k of ['chat','doodles','rsvp','doodleSaves','nudges','invites'])assert.equal(k in old,false,k);
 assert.equal(old.id,f.pollId);assert.equal(old.scheduledDate,f.nights[2]);assert.deepEqual(old.window,{start:f.nights[0],end:f.nights[2]});assert.ok(old.votes);
 assert.equal(JSON.stringify(old).includes('bericht'),false);
});

test('(3) an organiser pick on an AUTO poll also sends the per-person confirmation, never the site-wide fan-out',async()=>{
 const f=await fixture({pick:'auto',window:{start:'2026-09-25',end:'2026-09-26'},closesAt:'2026-09-24T18:00:00.000Z'});
 await f.vote('Lotte',[f.nights[1]]);
 assert.equal((await f.request(POLL,'POST',{action:'pick',pollId:f.pollId,date:f.nights[1]},f.admin())).status,200);
 assert.ok(f.outbox('poll-confirm').length>=1);assert.deepEqual(f.outbox('date-confirmed'),[]);
 assert.ok(f.plan().coordinationEvents.some(e=>e.type==='date-confirmed'&&e.pollConfirm===f.pollId));
});

test('(4) the confirmation goes to yes-on-the-night + pass holders who never answered; not to decliners or no-to-this-night',async()=>{
 const f=await fixture(),[DO,VR,ZA]=f.nights;
 await f.vote('Lotte',[ZA]);// yes to the picked night → mailed
 await f.vote('Daan',[DO]);// no to the picked night → not mailed
 await f.vote('Mo',[]);// declined every night → not mailed
 // Ies never answers → mailed; Kees's link is revoked and he never answered → not mailed (no live pass)
 await f.request(POLL,'POST',{action:'revoke-passes',pollId:f.pollId,emails:['kees@filmvrienden.nl']},{Authorization:'Bearer secret'});
 assert.equal((await f.request(POLL,'POST',{action:'pick',pollId:f.pollId,date:ZA},f.admin())).status,200);
 assert.deepEqual(f.outbox('poll-confirm').map(m=>m.to).sort(),['ies@filmvrienden.nl','lotte@filmvrienden.nl']);
});

test('(7) with mail off nothing is queued: reminder and invitation refused with a clear message, a pick says mail is off',async()=>{
 const f=await fixture({mail:false});
 for(const action of ['nudge','invite']){const r=await f.request(POLL,'POST',{action,pollId:f.pollId},f.admin());
  assert.equal(r.status,409);assert.equal(r.body.error.code,'mail_disabled');assert.equal(r.body.error.message,'Mail staat uit, er is niets verstuurd.')}
 await f.vote('Lotte',[f.nights[2]]);
 const pick=await f.request(POLL,'POST',{action:'pick',pollId:f.pollId,date:f.nights[2]},f.admin());
 assert.equal(pick.status,200);assert.equal(pick.body.mail,'off');assert.equal(f.plan().datePoll.status,'confirmed');
 for(const type of ['poll-confirm','poll-invite','poll-nudge','date-confirmed'])assert.deepEqual(f.outbox(type),[],type);
 const beheer=await (await import('node:fs/promises')).readFile(new URL('../public/filmmaand/beheer/beheer.js',import.meta.url),'utf8');
 assert.match(beheer,/result\?\.mail==='off'\?\(sent\.action==='pick'\?'Avond gekozen\. ':''\)\+'Mail staat uit, er is niets verstuurd\.'/);
});

test('(8) issue-passes skips anyone with a live link (their mailed links keep working); only rotate:true rotates',async()=>{
 const f=await fixture(),old=f.pass.Lotte;
 const again=await f.request(POLL,'POST',{action:'issue-passes',pollId:f.pollId,emails:['lotte@filmvrienden.nl'],people:[{email:'daan@filmvrienden.nl',name:'Daan'},{email:'nieuw@filmvrienden.nl',name:'Nieuw'}]},{Authorization:'Bearer secret'});
 assert.equal(again.status,200,JSON.stringify(again.body));
 assert.deepEqual(again.body.passes.map(p=>p.name),['Nieuw']);assert.deepEqual(again.body.skipped.map(p=>p.name),['Lotte','Daan']);
 assert.equal((await f.request(POLL,'GET',null,{'X-Filmmaand-Poll-Pass':old})).status,200,'the old link still works');
 assert.equal((await f.request(POLL,'POST',{action:'issue-passes',pollId:f.pollId,emails:['lotte@filmvrienden.nl'],rotate:'yes'},{Authorization:'Bearer secret'})).status,400);
 const rotated=await f.request(POLL,'POST',{action:'issue-passes',pollId:f.pollId,emails:['lotte@filmvrienden.nl'],rotate:true},{Authorization:'Bearer secret'});
 assert.deepEqual(rotated.body.passes.map(p=>p.name),['Lotte']);
 assert.equal((await f.request(POLL,'GET',null,{'X-Filmmaand-Poll-Pass':old})).body.error.code,'pass_invalid');
 const js=await (await import('node:fs/promises')).readFile(new URL('../public/filmmaand/beheer/beheer.js',import.meta.url),'utf8');
 assert.equal(/rotate/.test(js),false,'Beheer never sends rotate');
});

test('winter time: a pick on za 25 October (DST ends that night) keeps chat/RSVP to 23:59 CET and the link 24h more',async()=>{
 const f=await fixture({window:{start:'2026-10-23',end:'2026-10-25'},clock:'2026-10-22T10:00:00.000Z'});
 await f.vote('Lotte',['2026-10-25']);
 assert.equal((await f.request(POLL,'POST',{action:'pick',pollId:f.pollId,date:'2026-10-25'},f.admin())).status,200);
 const say=t=>f.request(POLL+'-chat','POST',{pollId:f.pollId,text:t},f.as('Lotte')),rsvp=a=>f.request(POLL+'-rsvp','PUT',{pollId:f.pollId,answer:a},f.as('Lotte'));
 f.time.now='2026-10-25T22:59:00.000Z';// 23:59 CET (UTC+1 after the switch at 03:00)
 assert.equal((await say('laatste')).status,200);assert.equal((await rsvp('ja')).status,200);
 f.time.now='2026-10-25T23:00:00.000Z';// 00:00 CET
 assert.equal((await say('te laat')).body.error.code,'date_poll_closed');assert.equal((await rsvp('nee')).body.error.code,'rsvp_closed');
 f.time.now='2026-10-26T22:59:00.000Z';assert.equal((await f.request(POLL,'GET',null,{'X-Filmmaand-Poll-Pass':f.pass.Lotte})).status,200);
 f.time.now='2026-10-26T23:00:00.000Z';assert.equal((await f.request(POLL,'GET',null,{'X-Filmmaand-Poll-Pass':f.pass.Lotte})).body.error.code,'pass_invalid');
 // The stored hard cap covers it: window end + 2 days = 27 Oct 00:00Z.
 const list=await f.request(POLL,'POST',{action:'list-passes',pollId:f.pollId},{Authorization:'Bearer secret'});
 assert.ok(list.body.passes.every(p=>Date.parse(p.expiresAt)>=Date.parse('2026-10-26T23:00:00.000Z')));
});
