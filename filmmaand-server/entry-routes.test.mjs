import test from 'node:test';
import assert from 'node:assert/strict';
import handler from './handler.mjs';
test('public entry redirects before opening private storage and preserves legacy vote intents',async()=>{
 for(const [path,target] of [
 ['/filmmaand','/filmmaand/program/'],
 ['/filmmaand/?intro=1','/filmmaand/program/?intro=1'],
 ['/filmmaand/?edit=1','/filmmaand/stemmen/?edit=1'],
 ['/filmmaand/?screen=thanks','/filmmaand/stemmen/?screen=thanks']
 ]){const r=await handler(new Request('https://ely0030.xyz'+path),{});assert.equal(r.status,302);assert.equal(r.headers.get('location'),'https://ely0030.xyz'+target);}
});
