// The confirmation step: the organiser's pick of a manual poll queues ONE confirmation per poll participant (live pass
// holders + everyone who answered), rendered through the pluggable plain template with a personal ja/nee link; the
// generic site-wide "De datum staat vast" fan-out is skipped for it. RSVP: PUT own answer only, until the end of the
// picked night; a GET (the mail link's ?antwoord=) never saves.
import test from 'node:test';import assert from 'node:assert/strict';
import {createApi} from './api.mjs';import {openState,emptyState} from './state.mjs';import {createPlanningService} from './runtime/planning/service.mjs';
import {createEventNotifications,queueCoordinationEvents} from './event-notifications.mjs';

const ORIGIN='https://example.test',NIGHTS=['2026-09-24','2026-09-25','2026-09-26'],POLL='plans/home-picker-lab/date-poll';
async function fixture(){
 const c=openState(emptyState()),s=createPlanningService({store:c.plans,adminToken:'secret'});
 await s.seed({id:'home-picker-lab',title:'Filmmaand',window:{start:'2026-09-01',end:'2026-09-30'},options:['a','b','c'].map(x=>({id:x,title:x}))});
 let writes=0;const store={data:c.export(),etag:1,async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}},async setJSON(k,v,{onlyIfMatch}){if(onlyIfMatch!==String(this.etag))return {modified:false};writes++;this.data=structuredClone(v);this.etag++;return {modified:true}}};c.close();
 let code;const clock={now:'2026-09-23T10:00:00.000Z'};
 const mailOptions={enabled:true,activatedAt:'2026-01-01T00:00:00.000Z',allowAnyRecipient:true};
 // queueEvents runs the real site-wide fan-out after every request, as production does.
 const api=createApi({store,blobs:{},adminToken:'secret',organizerIds:[],origin:ORIGIN,queueMail:async(c,m)=>{code=m.code},queueEvents:async c=>queueCoordinationEvents(c,{...mailOptions,now:clock.now}),now:()=>clock.now});
 async function request(path,method,body,headers={}){const r=await api(new Request(ORIGIN+'/filmmaand/api/'+path,{method,headers:{Origin:ORIGIN,...headers},...(body?{body:JSON.stringify(body)}:{})}),{ip:'fixture'});return {status:r.status,body:await r.json()}}
 const admin=key=>({Authorization:'Bearer secret',...(key?{'Idempotency-Key':key}:{})});
 const pollId=(await request(POLL,'POST',{action:'open',mode:'availability',pick:'manual',window:{start:NIGHTS[0],end:NIGHTS[2]},choices:[]},admin('open-confirm-poll-01'))).body.datePoll.id;
 const minted=await request(POLL,'POST',{action:'issue-passes',pollId,people:[{email:'lotte@filmvrienden.nl',name:'Lotte'},{email:'daan@filmvrienden.nl',name:'Daan'},{email:'mo@filmvrienden.nl',name:'Mo'}]},admin());
 const pass=Object.fromEntries(minted.body.passes.map(p=>[p.name,p.token]));
 // An account outside the poll (onboarded, no pass, never answered): must get NO confirmation.
 const ch=await request('auth/code','POST',{email:'buiten@filmvrienden.nl'}),vr=await request('auth/verify','POST',{challengeId:ch.body.challengeId,code});
 let n=0;const key=()=>'confirm-test-key-'+String(++n).padStart(6,'0');
 const vote=(who,yes)=>request(POLL,'PUT',{pollId,revision:0,availability:Object.fromEntries(NIGHTS.map(d=>[d,yes.includes(d)])),favourite:null},{'X-Filmmaand-Poll-Pass':pass[who],'Idempotency-Key':key()});
 const rsvp=(who,answer,extra={})=>request(POLL+'-rsvp','PUT',{pollId,answer,...extra},{'X-Filmmaand-Poll-Pass':pass[who],'Idempotency-Key':key()});
 const sent=[];const events=createEventNotifications({store,...mailOptions,origin:ORIGIN,now:()=>clock.now,send:async(m,{id})=>{sent.push(m);return {providerId:'stub-'+id}}});
 const outbox=type=>{const hits=[];const walk=o=>{if(!o||typeof o!=='object')return;if(o.notice?.type===type&&o.to)hits.push(o);for(const v of Object.values(o))walk(v)};walk(store.data);return hits};
 return {store,clock,request,admin,pollId,pass,vote,rsvp,events,sent,outbox,key,writes:()=>writes};
}

test('the pick queues exactly one plain confirmation per poll participant, with a personal ja/nee link; no site-wide fan-out',async()=>{
 const f=await fixture();
 await f.vote('Lotte',[NIGHTS[2]]);await f.vote('Daan',[NIGHTS[0],NIGHTS[2]]);// Mo never answers but holds a link
 assert.deepEqual(f.outbox('poll-confirm'),[]);
 const pick=await f.request(POLL,'POST',{action:'pick',pollId:f.pollId,date:NIGHTS[2],tijd:'20:30',waar:'bij Alec thuis'},f.admin('pick-confirm-key-001'));
 assert.equal(pick.status,200,JSON.stringify(pick.body));
 assert.deepEqual(f.outbox('poll-confirm').map(m=>m.to).sort(),['daan@filmvrienden.nl','lotte@filmvrienden.nl','mo@filmvrienden.nl']);
 assert.deepEqual(f.outbox('date-confirmed'),[],'the generic fan-out is skipped for a manual pick (buiten@ gets nothing)');
 // Replaying the pick queues nothing more.
 await f.request(POLL,'POST',{action:'pick',pollId:f.pollId,date:NIGHTS[2],tijd:'20:30',waar:'bij Alec thuis'},f.admin('pick-confirm-key-001'));
 assert.equal(f.outbox('poll-confirm').length,3);
 await f.events.drain({limit:20});
 assert.equal(f.sent.length,3);const lotte=f.sent.find(m=>m.to==='lotte@filmvrienden.nl');
 assert.equal(lotte.subject,'het wordt zaterdag 26 september!');
 assert.match(lotte.text,/^Hoi Lotte,\n\nDe avond staat vast: zaterdag 26 september, 20:30, bij Alec thuis\.\n\nBen je erbij\?\n\nJa, ik kom: https:\/\/example\.test\/filmmaand\/wanneer\/\?pas=[A-Za-z0-9_-]{43}&antwoord=ja\nToch niet: https:\/\/example\.test\/filmmaand\/wanneer\/\?pas=[A-Za-z0-9_-]{43}&antwoord=nee\n\nJe kunt het nog aanpassen tot de avond zelf\.\n\nAlec$/);
 const token=/pas=([A-Za-z0-9_-]{43})&antwoord=ja/.exec(lotte.text)[1];assert.ok(lotte.html.includes('pas='+token+'&amp;antwoord=nee'));
 assert.equal(JSON.stringify(f.store.data).includes(token),false,'no plaintext token stored');
 // The mailed link works for GET + RSVP after the pick.
 const view=await f.request(POLL+'?antwoord=ja','GET',null,{'X-Filmmaand-Poll-Pass':token});
 assert.equal(view.status,200);assert.deepEqual(view.body.rsvp,{answer:null,at:null,open:true});// ?antwoord= never saves
 await f.events.drain({limit:20});assert.equal(f.sent.length,3);
});

test('RSVP: own answer only, changeable until the end of the picked night; a GET never writes; organiser sees who',async()=>{
 const f=await fixture();await f.vote('Lotte',[NIGHTS[1]]);
 assert.equal((await f.rsvp('Lotte','ja')).body.error.code,'rsvp_closed');// nothing picked yet
 await f.request(POLL,'POST',{action:'pick',pollId:f.pollId,date:NIGHTS[1]},f.admin('pick-confirm-key-002'));
 // GETs, with or without ?antwoord=, write nothing.
 const before=JSON.stringify(f.store.data),w=f.writes();
 for(const q of ['','?antwoord=ja','?antwoord=nee'])assert.equal((await f.request(POLL+q,'GET',null,{'X-Filmmaand-Poll-Pass':f.pass.Lotte})).status,200);
 assert.equal(JSON.stringify(f.store.data),before);assert.equal(f.writes(),w);
 // Strict body: nobody else's answer can be set.
 for(const extra of [{name:'Daan'},{participantId:'x'},{for:'Daan'}])assert.equal((await f.rsvp('Lotte','ja',extra)).status,400);
 assert.equal((await f.rsvp('Lotte','misschien')).status,400);
 assert.deepEqual((await f.rsvp('Lotte','ja')).body.rsvp.answer,'ja');assert.deepEqual((await f.rsvp('Daan','nee')).body.rsvp.answer,'nee');
 f.clock.now='2026-09-25T21:59:00.000Z';assert.equal((await f.rsvp('Lotte','nee')).body.rsvp.answer,'nee');// vr 25, 23:59 Amsterdam
 assert.deepEqual((await f.request(POLL,'GET',null,{'X-Filmmaand-Poll-Pass':f.pass.Lotte})).body.rsvp.answer,'nee');
 const org=(await f.request(POLL,'POST',{action:'list-availability',pollId:f.pollId},f.admin())).body.datePoll.rsvp;
 assert.deepEqual(org.map(r=>[r.name,r.answer]),[['Daan','nee'],['Lotte','nee']]);
 f.clock.now='2026-09-25T22:00:00.000Z';assert.equal((await f.rsvp('Lotte','ja')).body.error.code,'rsvp_closed');// after the night
 assert.equal((await f.request(POLL,'GET',null,{'X-Filmmaand-Poll-Pass':f.pass.Lotte})).body.rsvp.open,false);
 // Only PUT; a dead pass is the uniform 401.
 assert.equal((await f.request(POLL+'-rsvp','POST',{},{'X-Filmmaand-Poll-Pass':f.pass.Lotte,'Idempotency-Key':f.key()})).status,405);
 assert.equal((await f.request(POLL+'-rsvp','PUT',{pollId:f.pollId,answer:'ja'},{'X-Filmmaand-Poll-Pass':'A'.repeat(43),'Idempotency-Key':f.key()})).body.error.code,'pass_invalid');
});

test('the pick (and so the confirmations) stays organiser-only, and invalid tijd/waar are refused before anything is queued',async()=>{
 const f=await fixture();
 for(const headers of [{'Idempotency-Key':'anon-pick-key-00001'},{'X-Filmmaand-Poll-Pass':f.pass.Lotte,'Idempotency-Key':'pass-pick-key-00001'},{Authorization:'Bearer nope','Idempotency-Key':'bear-pick-key-00001'}])
  assert.ok([401,405].includes((await f.request(POLL,'POST',{action:'pick',pollId:f.pollId,date:NIGHTS[2]},headers)).status));
 for(const bad of [{tijd:''},{tijd:'x'.repeat(41)},{waar:'<b>'},{waar:5},{tijd:'20:00\n'}])
  assert.equal((await f.request(POLL,'POST',{action:'pick',pollId:f.pollId,date:NIGHTS[2],...bad},f.admin('bad-pick-'+JSON.stringify(bad).replace(/[^a-z0-9]/gi,'').padEnd(12,'0').slice(0,40)))).status,400,JSON.stringify(bad));
 assert.deepEqual(f.outbox('poll-confirm'),[]);assert.equal(f.store.data.plans['home-picker-lab'].data.datePoll.status,'open');
});
