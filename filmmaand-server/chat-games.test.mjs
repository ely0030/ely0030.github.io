// Chat games (Chris, 23 Sept): a game turn is a chat message kind 'game' {game:'hop'|'pool', gid, payload}. Same channel,
// same cursor, own person only, strict + rounded payloads, a 2 KB cap, its own rate limit, organiser hide, never mail.
import test from 'node:test';import assert from 'node:assert/strict';
import {createApi} from './api.mjs';import {openState,emptyState} from './state.mjs';import {createPlanningService} from './runtime/planning/service.mjs';

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
const play=(f,who,game,gid,payload,k=f.key())=>f.request('plans/home-picker-lab/date-poll-chat','POST',{pollId:f.pollId,kind:'game',game,gid,payload},{'X-Filmmaand-Poll-Pass':f.pass[who],'Idempotency-Key':k});
const games=body=>(body.chat?.messages||[]).filter(m=>m.kind==='game');
const RACK=Array.from({length:16},(_,i)=>[100+i*0.123456,110+i]);
const HOP={seed:123456,frames:[40,8,55,6,70,12],score:212};
const POOL={shots:[{dx:0.123456789,dy:-0.99,p:0.87654}],start:RACK,end:RACK.map((b,i)=>i===3?null:b),turn:1,groups:[null,null],over:null};

test('a Hop run and a pool turn are chat messages: others see them with name and time, rounded, in the same stream',async()=>{
 const f=await fixture();
 const hop=await play(f,'Lotte','hop','hop-abcdef12',HOP);assert.equal(hop.status,200,JSON.stringify(hop.body));
 assert.equal(hop.headers.get('cache-control'),'private, no-store');
 const pool=await play(f,'Lotte','pool','pool-abcdef12-1',POOL);assert.equal(pool.status,200,JSON.stringify(pool.body));
 const seen=games((await f.read('Daan',0)).body);
 assert.deepEqual(seen.map(m=>[m.game,m.gid,m.name,!!m.self]),[['hop','hop-abcdef12','Lotte',false],['pool','pool-abcdef12-1','Lotte',false]]);
 assert.deepEqual(seen[0].payload,HOP);assert.equal(seen[0].t,'12:00');
 assert.deepEqual(seen[1].payload.shots,[{dx:0.1235,dy:-0.99,p:0.877}]);assert.equal(seen[1].payload.end[3],null);assert.equal(seen[1].payload.start[1][0],100.1);
 // Lotte sees her own as self; the organiser list labels them; nothing reaches the public plan.
 assert.equal(games((await f.read('Lotte',0)).body).every(m=>m.self),true);
 const org=(await f.request('plans/home-picker-lab/date-poll','POST',{action:'list-availability',pollId:f.pollId},f.admin())).body;
 const labels=JSON.stringify(org);assert.match(labels,/\[spel Pudding Hop 212\]/);assert.match(labels,/\[spel biljart\]/);
 const pub=JSON.stringify((await f.request('plans/home-picker-lab','GET')).body);assert.equal(/hop-abcdef12|pool-abcdef12/.test(pub),false);
});

test('game payloads are strict: wrong game, gid, keys, ranges, counts and the 2 KB cap are refused',async()=>{
 const f=await fixture();
 const no=async(game,gid,payload,code='game')=>{const r=await play(f,'Lotte',game,gid,payload);assert.equal(r.status,400,JSON.stringify([game,gid,r.body]));assert.equal(r.body.error.code,code)};
 await no('chess','hop-abcdef12',HOP);await no('hop','BAD GID',HOP);await no('hop','hop-abcdef12',{...HOP,extra:1});
 await no('hop','hop-abcdef12',{...HOP,score:-1});await no('hop','hop-abcdef12',{...HOP,frames:[1.5]});await no('hop','hop-abcdef12',{...HOP,frames:Array(2001).fill(1)});
 await no('pool','pool-abcdef12',{...POOL,shots:[]});await no('pool','pool-abcdef12',{...POOL,shots:Array(9).fill(POOL.shots[0])});
 await no('pool','pool-abcdef12',{...POOL,turn:2});await no('pool','pool-abcdef12',{...POOL,groups:['hele','x']});await no('pool','pool-abcdef12',{...POOL,end:RACK.slice(1)});
 await no('pool','pool-abcdef12',{...POOL,shots:[{dx:2,dy:0,p:.5}]});
 await no('hop','hop-abcdef12',{...HOP,frames:Array(1500).fill(19999)},'game_too_big');
 // extra top-level keys on the message itself
 const r=await f.request('plans/home-picker-lab/date-poll-chat','POST',{pollId:f.pollId,kind:'game',game:'hop',gid:'hop-abcdef12',payload:HOP,text:'x'},{'X-Filmmaand-Poll-Pass':f.pass.Lotte,'Idempotency-Key':f.key()});
 assert.equal(r.status,400);
});

test('games have their own rate limit (6 a minute), and the organiser can hide a game turn for everyone',async()=>{
 const f=await fixture();
 for(let i=0;i<6;i++)assert.equal((await play(f,'Lotte','hop','hop-abcdef12',{...HOP,score:i})).status,200);
 const seventh=await play(f,'Lotte','hop','hop-abcdef12',HOP);assert.equal(seventh.status,429);assert.equal(seventh.body.error.code,'game_rate');assert.ok(seventh.body.error.details.retryAfter>0);
 assert.equal((await f.say('Lotte','text still works')).status,200);// the text rate is separate
 tick(f,61);assert.equal((await play(f,'Lotte','hop','hop-abcdef12',HOP)).status,200);
 const m=games((await f.read('Daan',0)).body)[0];
 assert.equal((await f.request('plans/home-picker-lab/date-poll','POST',{action:'hide-message',pollId:f.pollId,messageId:m.id,hidden:true},f.admin('hide-game-key-000001'))).status,200);
 const after=await f.read('Daan',0);assert.equal(games(after.body).some(x=>x.id===m.id),false);assert.ok(after.body.chat.hidden.includes(m.id));
});
