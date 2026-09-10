// Isolated, in-memory review server. No external mail, stores, or catalogue calls.
import http from 'node:http';
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {createApi} from '../../filmmaand-server/api.mjs';
import entryHandler from '../../filmmaand-server/handler.mjs';
import {emptyState,openState} from '../../filmmaand-server/state.mjs';
import {createMail} from '../../filmmaand-server/mail.mjs';
import {createEventNotifications} from '../../filmmaand-server/event-notifications.mjs';
import {createPlanningService} from '../../filmmaand-server/runtime/planning/service.mjs';
const root=resolve('public'),port=Number(process.env.ENTRY_PORT||4381),origin=`http://localhost:${port}`;
const c=openState(emptyState());const seed=JSON.parse(await readFile('filmmaand-server/runtime/planning/seed.json','utf8'));seed.id='home-picker-lab';seed.round={shortlist:['blade','matrix','lotr'],derived:false};await createPlanningService({store:c.plans,adminToken:'entry-fixture-admin'}).seed(seed);
const store={data:c.export(),etag:1,async getWithMetadata(){return {data:structuredClone(this.data),etag:String(this.etag)}},async setJSON(k,data,{onlyIfMatch}){if(String(this.etag)!==onlyIfMatch)return {modified:false};this.data=structuredClone(data);this.etag++;return {modified:true}}};c.close();
let mailCode=null;const requests=[],codes={},captured=[];
const mail=createMail({store,enabled:true,apiKey:'isolated',from:'fixture@example.test',allowedRecipients:['captured.grid.qa@gmail.com','captured.friend.qa@gmail.com'],fetcher:async(u,o)=>{const p=JSON.parse(o.body);mailCode=p.text.match(/\b\d{6}\b/)[0];codes[p.to]=mailCode;return new Response('{}')}});
const events=createEventNotifications({store,enabled:true,activatedAt:'2026-09-10T00:00:00Z',origin,allowedRecipients:['captured.grid.qa@gmail.com','captured.friend.qa@gmail.com'],send:async message=>{captured.push(message);return {providerId:'captured-'+captured.length}}});
const api=createApi({store,blobs:{},origin,adminToken:'entry-fixture-admin',queueMail:mail.queue,deliverMail:mail.deliver,queueEvents:events.queue});
const mime={'.js':'text/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.woff2':'font/woff2'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,origin);let bytes=[];for await(const b of req)bytes.push(b);const body=Buffer.concat(bytes);requests.push({method:req.method,path:url.pathname,...(req.method==='PUT'?{body:body.toString(),key:req.headers['idempotency-key']}: {})});
 if(url.pathname==='/__fixture'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({mailCode,codes,captured,requests}));return;}
 if(url.pathname==='/__fixture/expire'&&req.method==='POST'){store.data.auth.sessions.forEach(s=>s.expires_at='2000-01-01T00:00:00Z');store.data.auth.rate_limits=[];res.end('{}');return;}
 const request=new Request(url,{method:req.method,headers:req.headers,...(body.length?{body}:{} )});
 if(url.pathname.startsWith('/filmmaand/api/')){const response=await api(request,{ip:'isolated-entry'});await events.drain();res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;}
 if(['/filmmaand','/filmmaand/'].includes(url.pathname)){const r=await entryHandler(request,{});res.writeHead(r.status,Object.fromEntries(r.headers));res.end();return;}
 if(['/filmmaand/agenda','/filmmaand/agenda/','/filmmaand/agenda/index.html'].includes(url.pathname)){res.writeHead(301,{Location:'/filmmaand/program/'+url.search});res.end();return;}
 let path=url.pathname.replace('/filmmaand/programma/','/filmmaand/agenda/').replace('/filmmaand/program/','/filmmaand/agenda/');if(path.endsWith('/'))path+='index.html';const file=resolve(root,'.'+path);if(!file.startsWith(root+'/'))throw Error('path');if(process.env.ENTRY_DELAY_ART==='1'&&/\/(artwork|catalogue-base)\.js$/.test(path))await new Promise(r=>setTimeout(r,1500));let data=await readFile(file);if(process.env.ENTRY_LOCK_ONLY==='1'&&/\/site\/access\.(?:js|css)$/.test(path))data=execFileSync('git',['show','47b453e:public'+path]);if(process.env.ENTRY_LOCK_ONLY==='1'&&/\/(?:site\/(?:shell|first-visit|availability-intro)|identity\/profile-menu|films\/next-round)\.(?:js|css)$/.test(path))data=execFileSync('git',['show','29f10dff89353e5fd67bd4181387e162b6a6fd06:public'+path]);
 if(process.env.ENTRY_DELAY_ART==='1'&&extname(file)==='.html')data=Buffer.from(data.toString().replace('<head>','<head><script>window.__entryTimings={};const proofObserver=new MutationObserver(()=>{if(document.querySelector(".account-unlock[open]")){window.__entryTimings.prompt=performance.now();proofObserver.disconnect()}});proofObserver.observe(document,{subtree:true,childList:true,attributes:true});</script>'));
 const kind=/^\/filmmaand\/(films|stemmen)\/(?:index.html)?$/.exec(url.pathname)?.[1];if(kind){const r=await api(new Request(origin+'/filmmaand/api/auth/session',{headers:req.headers}),{ip:'isolated-entry'});if(!(await r.json()).participant?.onboarded)data=Buffer.from(data.toString().replace('<html','<html data-account-locked="'+kind+'"').replace(/<script\b[^>]*src=["'][^"']*\/(?:picker\/picker|stemmen\/stemmen|site\/first-visit|site\/vote-event)\.js["'][^>]*><\/script>/g,''));}
 res.writeHead(200,{'Content-Type':mime[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
 }catch(e){res.writeHead(404);res.end('Fixture unavailable: '+e.message)}}).listen(port,'127.0.0.1',()=>console.log('Isolated entry fixture '+origin));
