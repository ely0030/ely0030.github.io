import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import vm from 'node:vm';
const source=await readFile(new URL('../public/filmmaand/stemmen/stemmen.js',import.meta.url),'utf8');
test('countdown uses server + monotonic clock; zero checks the server rather than inventing closure',()=>{
 let monotonic=100,refreshes=0;const node={hidden:true,textContent:''},button={dataset:{state:'lock'},disabled:false};const classes=new Set(['can-vote']);
 const ctx={Date,performance:{now:()=>monotonic},setInterval:()=>1,document:{hidden:false,body:{classList:{remove:n=>classes.delete(n)}}},vote:{round:{id:'r',status:'open',closesAt:'2026-09-08T12:00:02Z'}},arena:{section:{querySelector:()=>node},bar:{querySelector:()=>button}},busy:false,authLock:null,refresh:()=>{refreshes++;return Promise.resolve()}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('// The countdown follows'),source.indexOf('const accountState=')),ctx);
 ctx.alignRoundClock('2026-09-08T12:00:00Z');ctx.updateCountdown();assert.equal(node.textContent,'Nog 00:00:02');assert.equal(ctx.roundRemaining(),2000);
 monotonic=2100;ctx.updateCountdown();assert.equal(ctx.roundRemaining(),0);assert.equal(ctx.roundClosed(),false);assert.equal(ctx.roundBlocked(),true);assert.equal(node.textContent,'Sluiting controleren…');assert.equal(button.disabled,true);assert.equal(refreshes,1);
 ctx.vote.round.status='closed';ctx.updateCountdown();assert.equal(node.textContent,'Stemming gesloten');assert.equal(refreshes,1);
});

test('auth failure preserves exact pending receipt; historical replay never becomes a current-round vote',async()=>{
 const original={key:'exact-pending-key-001',body:{roundId:'old',expectedRevision:0,final:'a'}},calls=[],writes=[];let fail=true;
 const ctx={authLock:null,busy:false,pending:structuredClone(original),vote:{round:{id:'new'},own:{final:null,revision:0}},choice:{final:null},editingFinal:false,error:'',revealed:{final:false},lastPayload:'',render(){},requestVoteLogin(){},request:async(path,opts)=>{calls.push(structuredClone(opts));if(fail)throw {auth:true,status:401,message:'Log opnieuw in'};return {round:{id:'old'},own:{final:'a',revision:1}}},settledError:e=>e.status>=400&&e.status<500&&!e.auth,write:(k,v)=>writes.push([k,v]),window:{dispatchEvent(){}},Event,refresh:async()=>{}};
 vm.createContext(ctx);vm.runInContext(source.slice(source.indexOf('async function retry(){'),source.indexOf('\nasync function setupDvdDemo')),ctx);
 await ctx.retry();assert.deepEqual(JSON.parse(JSON.stringify(ctx.pending)),original);assert.deepEqual(writes,[]);
 fail=false;await ctx.retry();assert.equal(ctx.pending,null);assert.equal(ctx.vote.round.id,'new');assert.equal(ctx.vote.own.final,null);assert.equal(ctx.choice.final,null);assert.equal(ctx.revealed.final,false);assert.match(ctx.error,/eerdere stem/);assert.equal(calls.length,2);assert.equal(calls[0].body,calls[1].body);assert.equal(calls[0].headers['Idempotency-Key'],calls[1].headers['Idempotency-Key']);assert.equal(calls[0].body,JSON.stringify(original.body));
});
