import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../public/filmmaand/identity/reset-guard.js',import.meta.url),'utf8');
const marker='filmmaand-reset-generation-v1',prefix='filmmaand-checkin-v1:/filmmaand/api:home-picker-lab:';
function fixture({saved='one',server='one',failStorage=false,hold=false}={}){
 const data=new Map([[prefix+'receipt','{"key":"immutable","body":{"expectedRevision":0,"choices":["matrix"]}}'],[prefix+'draft','{"choices":["matrix"]}'],['unrelated','keep']]);if(saved!==null)data.set(marker,saved);
 let reloads=0,release;const calls=[],listeners={},ss=new Map();
 const storage={getItem:k=>data.get(k)??null,setItem(k,v){if(failStorage)throw Error('storage unavailable');data.set(k,v)},removeItem(k){if(failStorage)throw Error('storage unavailable');data.delete(k)}};
 const element=()=>({style:{},setAttribute(){},append(){}}),document={body:element(),createElement:element,getElementById(){return null},addEventListener(){}};
 const context={console,AbortController,setTimeout,clearTimeout,URL,Request,Response,Headers,Error,localStorage:storage,sessionStorage:{removeItem:k=>ss.delete(k)},document,location:{origin:'https://example.test',href:'https://example.test/filmmaand/films/',reload(){reloads++}},addEventListener(k,fn){listeners[k]=fn}};
 context.window=context;
 context.fetch=async(input,init)=>{const url=String(input);calls.push({url,init});if(url.endsWith('reset-generation')){if(hold)await new Promise(r=>release=r);return Response.json({resetGeneration:server})}return Response.json({ok:true},{headers:{'X-Filmmaand-Reset-Generation':server}})};
 vm.runInNewContext(source,context);
 return {context,data,calls,listeners,release:()=>release?.(),reloads:()=>reloads,setServer:g=>server=g};
}
test('same generation keeps exact draft/receipt and tags body without rewriting it',async()=>{
 const f=fixture();await f.context.filmmaandResetGuard.ready;const before=[...f.data];const body=f.data.get(prefix+'receipt');await f.context.fetch('/filmmaand/api/plans/home-picker-lab/response',{method:'PUT',body,headers:{'Idempotency-Key':'exact-key'}});assert.deepEqual([...f.data],before);const call=f.calls.at(-1);assert.equal(call.init.body,body);assert.equal(call.init.headers.get('Idempotency-Key'),'exact-key');assert.equal(call.init.headers.get('X-Filmmaand-Reset-Generation'),'one');assert.equal(f.reloads(),0);
});
test('legacy cache and old cache are cleared before any waiting personal request can be released',async()=>{
 for(const saved of [null,'old']){const f=fixture({saved,hold:true});const pending=f.context.fetch('/filmmaand/api/plans/home-picker-lab/response',{method:'PUT',body:'old payload'});f.release();await assert.rejects(pending);assert.equal(f.data.has(prefix+'receipt'),false);assert.equal(f.data.has(prefix+'draft'),false);assert.equal(f.data.get('unrelated'),'keep');assert.equal(f.data.get(marker),'one');assert.equal(f.calls.length,1);assert.equal(f.reloads(),1)}
});
test('storage failure never marks generation current or sends a pending write; logout is still usable',async()=>{
 const f=fixture({saved:'old',failStorage:true});await assert.rejects(f.context.filmmaandResetGuard.ready);await assert.rejects(f.context.fetch('/filmmaand/api/plans/home-picker-lab/vote',{method:'PUT',body:'old'}));assert.equal(f.data.get(marker),'old');assert.equal(f.calls.length,1);await f.context.fetch('/filmmaand/api/auth/logout',{method:'POST'});assert.equal(f.calls.length,2);
});
test('cross-tab generation switch stops the old controller without erasing the other tab new draft',async()=>{
 const f=fixture();await f.context.filmmaandResetGuard.ready;f.data.set(marker,'two');f.data.set(prefix+'draft','new generation work');f.listeners.storage({key:marker,newValue:'two'});assert.equal(f.reloads(),1);await assert.rejects(f.context.fetch('/filmmaand/api/plans/home-picker-lab/response',{method:'PUT',body:'old'}));assert.equal(f.data.get(prefix+'draft'),'new generation work');
});
test('new response generation cannot be stamped onto old payload even if another tab already acknowledged it',async()=>{
 const f=fixture();await f.context.filmmaandResetGuard.ready;f.setServer('two');const pending=f.context.fetch('/filmmaand/api/plans/home-picker-lab/response',{method:'PUT',body:'old'});await Promise.resolve();f.data.set(marker,'two');f.data.set(prefix+'draft','other tab new work');await assert.rejects(pending);assert.equal(f.data.get(prefix+'draft'),'other tab new work');assert.equal(f.context.filmmaandResetGuard.generation,'one');assert.equal(f.reloads(),1);
});
test('every page and runtime protected document loads guard before session and controllers',async()=>{
 for(const path of ['public/filmmaand/identity/index.html','public/filmmaand/agenda/index.html','public/filmmaand/films/index.html','public/filmmaand/stemmen/index.html','filmmaand-server/runtime/public/films/index.html','filmmaand-server/runtime/public/stemmen/index.html']){const html=await readFile(new URL('../'+path,import.meta.url),'utf8');assert.match(html,/<head><script src="\/filmmaand\/identity\/reset-guard.js"><\/script>/,path);assert.ok(html.indexOf('reset-guard.js')<html.indexOf('identity/session.js'),path)}
});

test('concurrent startup cannot release old in-memory draft after another tab acknowledges reset',async()=>{
 const f=fixture({saved:'old',hold:true});const pending=f.context.fetch('/filmmaand/api/plans/home-picker-lab/response',{method:'PUT',body:'old loaded draft'});f.data.set(marker,'one');f.data.set(prefix+'draft','new tab work');f.release();await assert.rejects(pending);assert.equal(f.reloads(),1);assert.equal(f.calls.length,1);assert.equal(f.data.get(prefix+'draft'),'new tab work');
});
