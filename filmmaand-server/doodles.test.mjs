// Shared doodles on the date poll: PUT /plans/<id>/date-poll-doodle (pass or session), visible in the date-poll GET,
// organiser kill switch, hard 4KB cap, own-only scope, never mail, private + no-store.
import test from 'node:test';import assert from 'node:assert/strict';
import {createApi} from './api.mjs';import {openState,emptyState} from './state.mjs';import {createPlanningService} from './runtime/planning/service.mjs';
import {normaliseStrokes} from './runtime/planning/doodles.mjs';

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
const f_doodles=store=>store.data.plans['home-picker-lab'].data.datePoll.doodles||{};
const STAR=[['k',[[10.04,10.06],[50,90],[90,10]]],['r',[[50,50]]]];

test('a pass holder adds and replaces their own doodle; everyone in the poll sees it with name and time',async()=>{
 const f=await fixture();
 const saved=await f.draw('Lotte',STAR);
 assert.equal(saved.status,200,JSON.stringify(saved.body));assert.equal(saved.headers.get('cache-control'),'private, no-store');assert.equal(saved.headers.get('set-cookie'),null);
 const own=saved.body.doodle;assert.deepEqual(own.s,[['k',[[10,10.1],[50,90],[90,10]]],['r',[[50,50]]]]);// rounded to 0.1
 assert.equal(own.at,'2026-09-23T10:00:00.000Z');assert.equal(own.t,'12:00');assert.match(own.id,/^doodle-[0-9a-f]{16}$/);
 // The response carries everyone's visible doodles, so the page needs no extra GET after a send.
 assert.deepEqual(saved.body.doodles.map(d=>[d.name,d.self]),[['Lotte',true]]);
 // The receipt in state keeps only the caller's own doodle, never the list (no state bloat per save).
 const receipts=Object.values(f.store.data.plans['home-picker-lab'].data.receipts).filter(r=>r.result?.doodle);
 assert.ok(receipts.length>=1);for(const r of receipts)assert.deepEqual(Object.keys(r.result),['doodle']);
 // The client's t is ignored; the server stamps time and author.
 assert.equal((await f.draw('Lotte',STAR,{t:'03:33'})).body.doodle.t,'12:00');
 const daan=(await f.view('Daan')).body.doodles;
 assert.deepEqual(daan,[{id:own.id,name:'Lotte',avatarId:12,at:own.at,t:'12:00',s:own.s}]);
 assert.equal((await f.view('Lotte')).body.doodles[0].self,true);
 // Replace: still one doodle for Lotte, same id, new strokes and time.
 f.clock.now='2026-09-23T10:05:00.000Z';
 const again=await f.draw('Lotte',[['r',[[1,2]]]]);assert.equal(again.body.doodle.id,own.id);
 assert.equal(Object.keys(f.doodles()).length,1);assert.deepEqual((await f.view('Daan')).body.doodles.map(d=>[d.name,d.at,d.s]),[['Lotte','2026-09-23T10:05:00.000Z',[['r',[[1,2]]]]]]);
 // Two people, ordered by time.
 f.clock.now='2026-09-23T10:06:00.000Z';await f.draw('Daan',STAR);
 assert.deepEqual((await f.view('Lotte')).body.doodles.map(d=>[d.name,!!d.self]),[['Lotte',true],['Daan',false]]);
});

test('scope: a pass writes only its holder\'s own doodle and nothing else; no field selects whose doodle',async()=>{
 const f=await fixture();await f.draw('Daan',STAR);
 const before=structuredClone(f.store.data);
 assert.equal((await f.draw('Lotte',STAR,{participantId:'someone'})).body.error.code,'doodle');// strict body
 assert.equal((await f.draw('Lotte',STAR,{doodleId:'x'})).status,400);
 const ok=await f.draw('Lotte',STAR);assert.equal(ok.status,200);const okId=ok.body.doodle.id;
 const after=f.store.data,strip=s=>{s=structuredClone(s);const d=s.plans['home-picker-lab'].data;
  for(const [a,v] of Object.entries(d.datePoll.doodles))if(v.id===okId){delete d.datePoll.doodles[a];delete d.datePoll.doodleSaves?.[a]}// own slot + own save log (rate limit)
  d.receipts=Object.fromEntries(Object.entries(d.receipts).filter(([,v])=>v.result?.doodle?.id!==okId));delete d.version;delete s.plans['home-picker-lab'].version;return s};
 assert.deepEqual(strip(after),strip(before));// Daan's doodle, votes, auth, notices: untouched
 // A pass cannot reach the organiser kill switch.
 const hide=await f.request(PLAN+'date-poll','POST',{action:'hide-doodle',pollId:f.pollId,doodleId:okId,hidden:true},{'X-Filmmaand-Poll-Pass':f.pass.Lotte,'Idempotency-Key':f.key()});
 assert.equal(hide.status,405);
 // A dead pass is the uniform 401 and writes nothing.
 const dead=await f.request(PLAN+'date-poll-doodle','PUT',{pollId:f.pollId,s:STAR},{'X-Filmmaand-Poll-Pass':'A'.repeat(43),'Idempotency-Key':f.key()});
 assert.equal(dead.status,401);assert.equal(dead.body.error.code,'pass_invalid');assert.equal(dead.headers.get('cache-control'),'private, no-store');
 // Only PUT exists on the doodle route.
 for(const m of ['GET','POST','DELETE'])assert.equal((await f.request(PLAN+'date-poll-doodle',m,m==='GET'?null:{},{'X-Filmmaand-Poll-Pass':f.pass.Lotte,'Idempotency-Key':f.key()})).status,405,m);
});

test('hard size cap and shape: 4KB after rounding, 64 strokes, 2000 points, the ten ink letters, 0..100',async()=>{
 assert.deepEqual(normaliseStrokes([['k',[[-0.3,100.4],[50.04,7]]]]),[['k',[[0,100],[50,7]]]]);// off-canvas is clamped, not refused
 // Optional pen size 1|2|3 as a third element; kept as sent. Anything else is refused.
 assert.deepEqual(normaliseStrokes([['b',[[1,1]],3],['k',[[2,2]]]]),[['b',[[1,1]],3],['k',[[2,2]]]]);
 for(const bad of [[['k',[[1,1]],0]],[['k',[[1,1]],4]],[['k',[[1,1]],'2']],[['k',[[1,1]],2,'x']]])assert.throws(()=>normaliseStrokes(bad),JSON.stringify(bad));
 const f=await fixture(),code=async s=>(await f.draw('Lotte',s)).body.error?.code;
 const line=k=>[['k',Array.from({length:k},(_,i)=>[i%100+0.12,(i*7)%100+0.34])]];
 assert.equal(await code(line(900)),'doodle_too_big');
 assert.equal(Buffer.byteLength(JSON.stringify(normaliseStrokes(line(300))))<=4096,true);assert.equal(await code(line(300)),undefined);
 assert.equal(await code(Array.from({length:65},()=>['k',[[1,1]]])),'doodle');
 for(const bad of [[],'x',[['x',[[1,1]]]],[['k',[]]],[['k',[[1,'2']]]],[['k',[[1,2,3]]]],[['k',[[NaN,1]]]],[['k',[[1,1]],'extra']]])
  assert.match(String(await code(bad)),/^doodle/,JSON.stringify(bad));
});

test('organiser kill switch: hide, sticky across a replacement, unhide; organiser view lists all',async()=>{
 const f=await fixture(),mine=(await f.draw('Lotte',STAR)).body.doodle;f.clock.now='2026-09-23T10:01:00.000Z';await f.draw('Daan',STAR);
 const list=await f.request(PLAN+'date-poll','POST',{action:'list-availability',pollId:f.pollId},f.admin());
 assert.deepEqual(list.body.datePoll.doodles.map(d=>[d.name,d.hidden]),[['Lotte',false],['Daan',false]]);
 const hide=await f.request(PLAN+'date-poll','POST',{action:'hide-doodle',pollId:f.pollId,doodleId:mine.id,hidden:true},f.admin('hide-doodle-key-0001'));
 assert.equal(hide.status,200,JSON.stringify(hide.body));assert.equal(hide.body.datePoll.doodles.find(d=>d.id===mine.id).hidden,true);
 assert.deepEqual((await f.view('Daan')).body.doodles.map(d=>d.name),['Daan']);
 assert.deepEqual((await f.view('Lotte')).body.doodles.map(d=>d.name),['Daan']);// hidden for everyone, the author too
 f.clock.now='2026-09-23T09:59:00.000Z';await f.draw('Lotte',[['k',[[5,5]]]]);// a replacement stays hidden (clock set earlier only to keep the order stable)
 assert.deepEqual((await f.view('Daan')).body.doodles.map(d=>d.name),['Daan']);
 assert.equal((await f.request(PLAN+'date-poll','POST',{action:'hide-doodle',pollId:f.pollId,doodleId:mine.id,hidden:false},f.admin('hide-doodle-key-0002'))).status,200);
 assert.deepEqual((await f.view('Daan')).body.doodles.map(d=>[d.name,d.s]),[['Lotte',[['k',[[5,5]]]]],['Daan',normaliseStrokes(STAR)]]);
 assert.equal((await f.request(PLAN+'date-poll','POST',{action:'hide-doodle',pollId:f.pollId,doodleId:'doodle-0000000000000000',hidden:true},f.admin('hide-doodle-key-0003'))).body.error.code,'doodle_unknown');
});

test('never mail, never public: no notice or outbox entry, public plan GET has no doodles, closed poll refuses',async()=>{
 const f=await fixture(),cookie=await f.session('daan@example.test');
 const notices=()=>JSON.stringify([f.store.data.plans['home-picker-lab'].data.notices,f.store.data.eventNotifications,f.store.data.mailOutbox]);
 const before=notices();
 await f.draw('Lotte',STAR);
 const viaSession=await f.request(PLAN+'date-poll-doodle','PUT',{pollId:f.pollId,s:STAR},{Cookie:cookie,'Idempotency-Key':f.key()});
 assert.equal(viaSession.status,200,JSON.stringify(viaSession.body));
 assert.equal(notices(),before);assert.equal(new Set(f.queued).size,1);
 const pub=await f.request('plans/home-picker-lab','GET');assert.equal(pub.status,200);
 assert.equal(JSON.stringify(pub.body).includes('doodle'),false);assert.equal(JSON.stringify(pub.body).includes('strokes'),false);
 // After the organiser picks, the poll takes no more doodles (GET still shows them during the grace).
 assert.equal((await f.request(PLAN+'date-poll','POST',{action:'pick',pollId:f.pollId,date:NIGHTS[2]},f.admin('pick-doodle-poll-001'))).status,200);
 assert.equal((await f.draw('Lotte',STAR)).body.error.code,'date_poll_closed');
 assert.equal((await f.view('Daan')).body.doodles.length,2);
});
