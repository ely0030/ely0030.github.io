// Beheer "Wie kan wanneer" (the organiser panel for the manual date poll). Two halves:
//  1. the API: every panel action is organiser-only (pass, anonymous, non-organiser session and a mismatched organiser id
//     are all refused, and nothing is written or queued); the organiser reads write nothing;
//  2. the page: pick / reminder / doodle-hide can only be sent through the #confirm dialog (focus on "Terug").
import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {createApi} from './api.mjs';import {openState,emptyState} from './state.mjs';import {createPlanningService} from './runtime/planning/service.mjs';

const ORIGIN='https://example.test',NIGHTS=['2026-09-24','2026-09-25','2026-09-26'],URL_='plans/home-picker-lab/date-poll';
async function fixture(){
 const c=openState(emptyState()),s=createPlanningService({store:c.plans,adminToken:'secret'});
 await s.seed({id:'home-picker-lab',title:'Filmmaand',window:{start:'2026-09-01',end:'2026-09-30'},options:['a','b','c'].map(x=>({id:x,title:x}))});
 let writes=0;const store={data:c.export(),etag:1,async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}},async setJSON(k,v,{onlyIfMatch}){if(onlyIfMatch!==String(this.etag))return {modified:false};writes++;this.data=structuredClone(v);this.etag++;return {modified:true}}};c.close();
 let code;const organizerIds=[];
 const api=createApi({store,blobs:{},adminToken:'secret',organizerIds,origin:ORIGIN,queueMail:async(c,m)=>{code=m.code},now:()=>'2026-09-23T10:00:00.000Z'});
 async function request(path,method,body,headers={}){const r=await api(new Request(ORIGIN+'/filmmaand/api/'+path,{method,headers:{Origin:ORIGIN,...headers},...(body?{body:JSON.stringify(body)}:{})}),{ip:'fixture'});return {status:r.status,body:await r.json()}}
 async function account(email,name,avatarId){const ch=await request('auth/code','POST',{email}),r=await api(new Request(ORIGIN+'/filmmaand/api/auth/verify',{method:'POST',headers:{Origin:ORIGIN},body:JSON.stringify({challengeId:ch.body.challengeId,code})}),{ip:'fixture'});const b=await r.json(),cookie=r.headers.get('set-cookie').split(';')[0];
  await request('auth/profile','PUT',{expectedRevision:0,name,animal:'otter',avatarId},{Cookie:cookie,'Idempotency-Key':'profile-key-'+avatarId+'-0000000'});return {cookie,id:b.participant.id}}
 const alec=await account('alec@example.test','Alec',6),friend=await account('friend@example.test','Fien',8);organizerIds.push(alec.id);
 const admin=key=>({Authorization:'Bearer secret',...(key?{'Idempotency-Key':key}:{})});
 const opened=await request(URL_,'POST',{action:'open',mode:'availability',pick:'manual',window:{start:NIGHTS[0],end:NIGHTS[2]},choices:[]},admin('open-panel-poll-0001'));
 const pollId=opened.body.datePoll.id;
 const minted=await request(URL_,'POST',{action:'issue-passes',pollId,people:[{email:'lotte@example.test',name:'Lotte',avatarId:12}]},admin());
 const pass=minted.body.passes[0].token;
 await request('plans/home-picker-lab/date-poll-doodle','PUT',{pollId,s:[['k',[[1,1]]]]},{'X-Filmmaand-Poll-Pass':pass,'Idempotency-Key':'panel-doodle-000001'});
 const doodleId=(await request(URL_,'POST',{action:'list-availability',pollId},admin())).body.datePoll.doodles[0].id;
 const organizer=(key,extra={})=>({Cookie:alec.cookie,'X-Filmmaand-Organizer-Id':alec.id,'X-Filmmaand-Reset-Generation':'0',...(key?{'Idempotency-Key':key}:{}),...extra});
 return {store,request,alec,friend,pass,pollId,doodleId,organizer,writes:()=>writes};
}
const snap=f=>JSON.stringify(f.store.data)+'#'+f.store.etag;

test('panel actions (pick, reminder, doodle hide) are organiser-only; refused callers write and queue nothing',async()=>{
 const f=await fixture();
 const actions=[{action:'pick',pollId:f.pollId,date:NIGHTS[2]},{action:'nudge',pollId:f.pollId},{action:'hide-doodle',pollId:f.pollId,doodleId:f.doodleId,hidden:true}];
 const before=snap(f);
 for(const body of actions){
  const tag=body.action;
  const anon=await f.request(URL_,'POST',body,{'Idempotency-Key':'anon-'+tag+'-00000000'});assert.equal(anon.status,401,tag+' anonymous');
  const byPass=await f.request(URL_,'POST',body,{'X-Filmmaand-Poll-Pass':f.pass,'Idempotency-Key':'pass-'+tag+'-00000000'});assert.ok([401,405].includes(byPass.status),tag+' pass '+byPass.status);
  const friend=await f.request(URL_,'POST',body,{Cookie:f.friend.cookie,'X-Filmmaand-Organizer-Id':f.friend.id,'X-Filmmaand-Reset-Generation':'0','Idempotency-Key':'friend-'+tag+'-000000'});
  assert.ok([401,403].includes(friend.status),tag+' non-organiser session '+friend.status);
  const wrongId=await f.request(URL_,'POST',body,f.organizer('wrongid-'+tag+'-00000',{'X-Filmmaand-Organizer-Id':f.friend.id}));assert.equal(wrongId.status,409,tag+' mismatched organiser id');
  const bearer=await f.request(URL_,'POST',body,{Authorization:'Bearer wrong','Idempotency-Key':'bearer-'+tag+'-000000'});assert.equal(bearer.status,401,tag+' wrong admin token');
 }
 // Sending actions need an Idempotency-Key even for the organiser.
 assert.equal((await f.request(URL_,'POST',actions[0],f.organizer())).body.error.code,'request_key');
 assert.equal((await f.request(URL_,'POST',actions[1],f.organizer())).body.error.code,'request_key');
 assert.equal(snap(f),before,'no refused call wrote or queued anything');
 // The organiser's reads (what the panel loads) write nothing either.
 const w=f.writes();
 for(const action of ['list-availability','list-passes','nudge-list'])assert.equal((await f.request(URL_,'POST',{action,pollId:f.pollId},f.organizer())).status,200,action);
 assert.equal(f.writes(),w);assert.equal(snap(f),before);
 // And the organiser can do each of them.
 assert.equal((await f.request(URL_,'POST',actions[2],f.organizer('panel-hide-key-000001'))).status,200);
 const nudge=await f.request(URL_,'POST',actions[1],f.organizer('panel-nudge-key-00001'));assert.equal(nudge.status,200);assert.deepEqual(nudge.body.recipients.map(r=>r.name),['Lotte']);
 const pick=await f.request(URL_,'POST',actions[0],f.organizer('panel-pick-key-000001'));assert.equal(pick.status,200,JSON.stringify(pick.body));assert.equal(pick.body.datePoll.status,'confirmed');
});

test('the Beheer page sends pick / reminder / doodle hide only through the confirm dialog, with focus on "Terug"',async()=>{
 const js=await readFile(new URL('../public/filmmaand/beheer/beheer.js',import.meta.url),'utf8');
 // Each sending body is built only as an argument of coordinate(...), which opens the dialog and never fetches.
 for(const action of ['pick','nudge','hide-doodle']){
  const uses=[...js.matchAll(new RegExp(`action:'${action}'`,'g'))].map(m=>js.slice(Math.max(0,m.index-40),m.index));
  assert.ok(uses.length>=1,action);for(const u of uses)assert.match(u,/coordinate\('date-poll',\{$/,action+' outside coordinate()');
 }
 const coordinate=/function coordinate\([^)]*\)\{[^\n]*\}/.exec(js)[0];
 assert.equal(/fetch|request\(|execute\(|persist\(/.test(coordinate),false);
 assert.match(coordinate,/\$\('#confirm'\)\.showModal\(\);\$\('#cancel-confirm'\)\.focus\(\)/);
 // The only request that carries an Idempotency-Key is execute(), reached from "Bevestigen" (after persist) or the retry
 // of an already-confirmed receipt.
 assert.deepEqual([...js.matchAll(/'Idempotency-Key':/g)].length,1);
 const calls=js.match(/.{0,40}void execute\(\)/g);assert.equal(calls.length,2);
 assert.ok(calls[0].endsWith("$('#confirm').close();void execute()"));assert.ok(calls[1].endsWith("$('#retry').onclick=()=>void execute()"));
 // The panel's own reads are the three read-only organiser actions, nothing else.
 const reads=[...js.matchAll(/organizerRead\(\{action:'([a-z-]+)'/g)].map(m=>m[1]).sort();
 assert.deepEqual(reads,['list-availability','list-passes','nudge-list']);
 // Plain words about mail in the two sending confirms.
 assert.match(js,/Dit MAILT iedereen in de poll meteen "De datum staat vast"/);assert.match(js,/'Dit MAILT precies deze '\+who\.length/);
});
