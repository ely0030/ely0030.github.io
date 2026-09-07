import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../../public/filmmaand/site/access.js',import.meta.url),'utf8');
function fixture({kind,participant={id:'account',onboarded:true},draft,receipt,dialog=false}={}){
 const listeners={},calls=[],storage=new Map(receipt?[['filmmaand-checkin-v1:/filmmaand/api:home-picker-lab:receipt',JSON.stringify(receipt)]]:[]);
 const window={filmmaandSession:{participant,async refresh(){this.participant={id:'verified',onboarded:true}}},checkinState:()=>draft,addEventListener:(e,fn)=>listeners[e]=fn};
 const document={documentElement:{dataset:{accountLocked:kind}},readyState:'loading',addEventListener(){},querySelector:s=>dialog&&s.includes('identity-overlay')?{}:null};
 const location={pathname:'/filmmaand/stemmen/',assign:u=>calls.push(u),reload:()=>calls.push('reload')};
 vm.runInNewContext(source,{window,document,location,localStorage:{getItem:k=>storage.get(k)||null},URLSearchParams,CustomEvent:class{}});return {window,listeners,calls};
}
test('fresh login routes to Films, including profile-cache race without participant id',async()=>{const f=fixture({participant:{onboarded:true}});await f.listeners['filmmaand-login-complete']({detail:{}});assert.deepEqual(f.calls,['/filmmaand/films/']);});
test('explicit recovery never routes away even after a receipt has just settled',async()=>{const f=fixture();await f.listeners['filmmaand-login-complete']({detail:{recovery:true}});assert.deepEqual(f.calls,[]);});
test('exact pending receipt stays intact and prevents fresh routing',async()=>{const receipt={key:'exact-key',body:{expectedRevision:2,choices:['matrix']}};const f=fixture({receipt});assert.equal(f.window.filmmaandHasPendingEntryAction(),true);await f.listeners['filmmaand-login-complete']({detail:{}});assert.deepEqual(f.calls,[]);});
test('dirty choices and order prevent routing before save starts',async()=>{for(const field of ['choices','dates','rankingOrder']){const f=fixture({draft:{draft:{[field]:['changed']},own:{[field]:[]}}});assert.equal(f.window.filmmaandHasPendingEntryAction(),true);await f.listeners['filmmaand-login-complete']({detail:{}});assert.deepEqual(f.calls,[]);}});
test('server-stripped recovery reloads same route so canonical receipt replay can mount',async()=>{const f=fixture({kind:'stemmen',receipt:{key:'same',body:{final:'matrix'}}});await f.listeners['filmmaand-login-complete']({detail:{recovery:true}});assert.deepEqual(f.calls,['reload']);});
test('null cache event during recovery login does not destroy the modal or draft',()=>{for(const opts of [{dialog:true},{receipt:{key:'pending',body:{}}}]){const f=fixture(opts);f.listeners['filmmaand-session']({detail:{participant:null}});assert.deepEqual(f.calls,[]);}});
