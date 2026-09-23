// Isolated preview of /filmmaand/wanneer/ against the real API code, in memory. Never reads production, sends no mail.
//   node qa/wanneer/serve.mjs            → http://localhost:4419/  (index with fresh pass links)
// A manual poll for do 24 – za 26 Sept on plan home-picker-lab, four fictional friends minted via `people`,
// two of them already answered. No cookie is injected: pass links use the pass path; /__session/<name> logs that
// friend in by email code (captured) and sets the real session cookie, to exercise the session fallback.
import http from 'node:http';import {readFile} from 'node:fs/promises';import {fileURLToPath} from 'node:url';
import {createApi} from '../../filmmaand-server/api.mjs';import {openState,emptyState} from '../../filmmaand-server/state.mjs';
import {createPlanningService} from '../../filmmaand-server/runtime/planning/service.mjs';

const PORT=Number(process.env.WANNEER_QA_PORT||4419),ORIGIN='http://localhost:'+PORT,root=fileURLToPath(new URL('../../public',import.meta.url));
const c=openState(emptyState());
await createPlanningService({store:c.plans,adminToken:'isolated-admin'}).seed({id:'home-picker-lab',title:'Isolated wanneer preview',window:{start:'2026-09-01',end:'2026-09-30'},options:['a','b','c'].map(id=>({id,title:'Fictional '+id}))});
const store={data:c.export(),etag:1,async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}},async setJSON(k,v,{onlyIfMatch}){if(onlyIfMatch!==String(this.etag))return {modified:false};this.data=structuredClone(v);this.etag++;return {modified:true}}};c.close();
// Live QA clock: starts at QA_NOW (default 23 Sept 10:00Z) and runs in real time from there, so chat times, hot mode and
// its 2-minute cool-down behave as in production. The server's Date header carries this clock (see below).
let code,offset=0;const start=Date.parse(process.env.QA_NOW||'2026-09-23T10:00:00.000Z'),t0=Date.now();
const qaNow=()=>new Date(start+(Date.now()-t0)+offset).toISOString(),tick=()=>{offset+=60e3};
const organizerIds=[];const api=createApi({store,blobs:{},adminToken:'isolated-admin',organizerIds,mailActive:()=>true,// queues only: this server has no mail transport, nothing is ever sent
 origin:ORIGIN,queueMail:async(c,m)=>{code=m.code},now:qaNow});
async function request(path,method='GET',body,headers={}){const r=await api(new Request(ORIGIN+'/filmmaand/api/'+path,{method,headers:{Origin:ORIGIN,...headers},...(body?{body:JSON.stringify(body)}:{})}),{ip:'qa-wanneer'});return {status:r.status,body:await r.json(),headers:r.headers}}
const admin=key=>({Authorization:'Bearer isolated-admin',...(key?{'Idempotency-Key':key}:{})});
const NIGHTS=['2026-09-24','2026-09-25','2026-09-26'];
const opened=await request('plans/home-picker-lab/date-poll','POST',{action:'open',mode:'availability',pick:'manual',window:{start:NIGHTS[0],end:NIGHTS[2]},choices:[]},admin('qa-wanneer-open-0001'));
if(opened.status!==200)throw Error(JSON.stringify(opened.body));
const pollId=opened.body.datePoll.id;
const FRIENDS=[{email:'lotte@example.test',name:'Lotte (voorbeeld)',avatarId:12},{email:'daan@example.test',name:'Daan (voorbeeld)',avatarId:9},{email:'mo@example.test',name:'Mo (voorbeeld)',avatarId:7},{email:'ies@example.test',name:'Ies (voorbeeld)',avatarId:10}];
let links={};
async function mint(){const m=await request('plans/home-picker-lab/date-poll','POST',{action:'issue-passes',pollId,people:FRIENDS},admin());if(m.status!==200)throw Error(JSON.stringify(m.body));links=Object.fromEntries(m.body.passes.map(p=>[p.name,p.url]))}
await mint();
const pass=n=>new URL(links[n]).searchParams.get('pas');
const vote=async(n,yes,key)=>{const r=await request('plans/home-picker-lab/date-poll','PUT',{pollId,revision:0,availability:Object.fromEntries(NIGHTS.map(d=>[d,yes.includes(d)])),favourite:null},{'X-Filmmaand-Poll-Pass':pass(n),'Idempotency-Key':key});if(r.status!==200)throw Error(JSON.stringify(r.body))};
await vote('Daan (voorbeeld)',[NIGHTS[0],NIGHTS[2]],'qa-wanneer-daan-0001');await vote('Mo (voorbeeld)',[NIGHTS[2]],'qa-wanneer-mo-00001');
const index=()=>`<!doctype html><meta charset="utf-8"><title>wanneer · QA</title><body style="font:15px system-ui;margin:40px">
<h1>/filmmaand/wanneer/ · isolated QA (in-memory, fictional people, no mail)</h1><p>Poll ${pollId}, clock ${qaNow()} (live; +1 min per organiser pick). Daan and Mo have answered.</p><ul>
${Object.entries(links).map(([n,u])=>`<li>${n}: <a href="${u}">pass link</a> · <a href="/__session/${encodeURIComponent(n)}">log in as (session)</a></li>`).join('')}
<li><a href="/filmmaand/wanneer/?pas=${'A'.repeat(43)}">dead pass, no session</a></li><li><a href="/filmmaand/wanneer/">no pass</a></li></ul>
<p><a href="/__organiser">Beheer as the organiser (Alec, session cookie)</a> · reminder mails queued (never sent here): ${(JSON.stringify(store.data).match(/"notice":\{"id":"nudge:/g)||[]).length}</p>
<form method="post" action="/__rotate"><button>rotate all passes (old links die)</button></form><form method="post" action="/__pick"><button>organiser picks za 26</button></form>`;

http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,ORIGIN);
 if(url.pathname==='/'){res.setHeader('Content-Type','text/html');return res.end(index())}
 if(req.method==='POST'&&url.pathname==='/__rotate'){await mint();res.writeHead(303,{Location:'/'});return res.end()}
 if(req.method==='POST'&&url.pathname==='/__pick'){tick();await request('plans/home-picker-lab/date-poll','POST',{action:'pick',pollId,date:NIGHTS[2]},admin('qa-wanneer-pick-0001'));res.writeHead(303,{Location:'/'});return res.end()}
 if(url.pathname==='/__organiser'){const ch=await request('auth/code','POST',{email:'alec@example.test'}),r=await request('auth/verify','POST',{challengeId:ch.body.challengeId,code});const cookie=r.headers.get('set-cookie');
  if(!organizerIds.includes(r.body.participant.id)){organizerIds.push(r.body.participant.id);await request('auth/profile','PUT',{expectedRevision:0,name:'Alec (voorbeeld)',animal:'otter',avatarId:6},{Cookie:cookie.split(';')[0],'Idempotency-Key':'qa-wanneer-alec-profile'})}
  res.writeHead(303,{Location:'/filmmaand/beheer/','Set-Cookie':cookie.replace(/;\s*Secure/i,'')});return res.end()}
 if(url.pathname.startsWith('/__session/')){const f=FRIENDS.find(x=>x.name===decodeURIComponent(url.pathname.slice(11)));const ch=await request('auth/code','POST',{email:f.email}),r=await request('auth/verify','POST',{challengeId:ch.body.challengeId,code});
  res.writeHead(303,{Location:'/filmmaand/wanneer/','Set-Cookie':r.headers.get('set-cookie').replace(/;\s*Secure/i,'')});return res.end()}
 if(url.pathname.startsWith('/filmmaand/api/')){const chunks=[];for await(const x of req)chunks.push(x);const body=Buffer.concat(chunks);
  const r=await api(new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}:{})}),{ip:'qa-wanneer'});
  res.writeHead(r.status,{...Object.fromEntries(r.headers),Date:new Date(qaNow()).toUTCString()});return res.end(Buffer.from(await r.arrayBuffer()))}
 if(url.pathname==='/filmmaand/'&&url.searchParams.has('pas')){res.writeHead(302,{Location:'/filmmaand/wanneer/'+url.search});return res.end()}
 const path=fileURLToPath(new URL('.'+url.pathname+(url.pathname.endsWith('/')?'index.html':''),'file://'+root+'/'));if(!path.startsWith(root+'/'))throw Error();
 const data=await readFile(path);const ext=path.split('.').pop();
 res.writeHead(200,{'Content-Type':{html:'text/html',js:'text/javascript',css:'text/css',png:'image/png',jpg:'image/jpeg',webp:'image/webp',svg:'image/svg+xml'}[ext]||'application/octet-stream',...(url.pathname.startsWith('/filmmaand/wanneer/')?{'Referrer-Policy':'no-referrer'}:{})});res.end(data);
}catch(e){res.statusCode=500;res.end('qa error')}}).listen(PORT,'127.0.0.1',()=>console.log('wanneer QA '+ORIGIN+'/'));
