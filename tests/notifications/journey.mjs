import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
const origin='http://localhost:4381',cookies={},proof={origin,at:new Date().toISOString(),steps:[]};
async function req(path,method='GET',body,who='one') { const r=await fetch(origin+'/filmmaand/api/'+path,{method,headers:{Origin:origin,'Content-Type':'application/json','Idempotency-Key':crypto.randomUUID(),...(cookies[who]?{Cookie:cookies[who]}:{}),...(who==='admin'?{Authorization:'Bearer entry-fixture-admin'}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.equal(r.status,200,JSON.stringify(data));return {data,headers:r.headers}; }
for(const [who,email,name,avatarId] of [['one','captured.grid.qa@gmail.com','Grid QA',41],['two','captured.friend.qa@gmail.com','Andere vriend',8]]){const ch=await req('auth/code','POST',{email},who),f=await(await fetch(origin+'/__fixture')).json(),login=await req('auth/verify','POST',{challengeId:ch.data.challengeId,code:f.mailCode},who);cookies[who]=login.headers.get('set-cookie').split(';')[0];await req('auth/profile','PUT',{expectedRevision:0,name,animal:'otter',avatarId},who);assert.equal((await req('notifications','GET',null,who)).data.unreadCount,0);}
proof.steps.push('Two real authenticated accounts; baseline histories empty.');
const suggestion=(await req('plans/home-picker-lab/suggestions','POST',{title:'Nachtelijke ontdekkingen',detail:'Een gezamenlijk filmthema.'},'two')).data.option;
const first=(await req('notifications')).data;assert.equal(first.items.length,1);assert.equal(first.items[0].type,'film-suggested');assert.equal(first.items[0].href,'/filmmaand/films/?film='+suggestion.id);assert.equal((await req('notifications','GET',null,'two')).data.items.length,0);
await req('notifications/read','POST',{items:[{id:first.items[0].id,updatedAt:first.items[0].updatedAt}]});assert.equal((await req('notifications')).data.unreadCount,0);
await req('plans/home-picker-lab/response','PUT',{expectedRevision:0,choices:[suggestion.id,'indiana','horror','anime'],rankingOrder:[suggestion.id,'indiana','horror','anime'],dates:[]});
const likes=(await req('notifications','GET',null,'two')).data;assert.ok(likes.items.some(i=>i.type==='suggestion-liked'&&i.actor.name==='Grid QA'));proof.steps.push('Saved suggestion -> other account history -> durable read; saved like -> canonical suggester, direct film link.');proof.likes=likes;
const round=(await req('plans/home-picker-lab/vote')).data.round;
await req('plans/home-picker-lab/vote','PUT',{roundId:round.id,expectedRevision:0,final:'blade'});
await req('plans/home-picker-lab/vote','PUT',{roundId:round.id,expectedRevision:0,final:'matrix'},'two');
assert.match((await req('notifications')).data.items.find(i=>i.type==='vote-leader').text,/Gelijke stand/);
const change=async(action,extra={})=>{const r=(await req('plans/home-picker-lab/vote')).data.round;return (await req('plans/home-picker-lab/round','POST',{action,expectedRoundId:r.id,expectedRevision:r.revision,...extra},'admin')).data;};
await change('close');let f=await(await fetch(origin+'/__fixture')).json();assert.equal(f.captured.length,2);assert.ok(f.captured.every(m=>/gelijke stand/.test(m.text)));
await change('resolve',{choice:'blade'});const next=(await req('plans/home-picker-lab')).data.nextRound;
await change('open',{selectionSnapshot:next.snapshot,shortlist:next.shortlist,scheduledDate:'2026-09-14',closesAt:'2026-09-11T12:00:00Z'});
const final=(await req('notifications')).data;assert.ok(final.items.some(i=>i.type==='round-concluded'&&/afgerond/.test(i.text)));assert.ok(final.items.some(i=>i.type==='round-opened'));
f=await(await fetch(origin+'/__fixture')).json();assert.equal(f.captured.length,6);assert.ok(f.captured.slice(-2).every(m=>/nieuwe stemronde/i.test(m.text)));proof.steps.push('Actual tied vote -> closed truthful history + two captured emails; resolution then next round -> history and captured mail.');
proof.final=final;proof.mail=f.captured.map(m=>({to:m.to,subject:m.subject,text:m.text}));proof.productionWrites=false;proof.realEmailSends=0;
await writeFile('artifacts/notifications/final-http-journey.json',JSON.stringify(proof,null,2)+'\n');
for(const [who,session]of [['one','grid-notifications'],['two','grid-notifications-other']])execFileSync('agent-browser',['--session',session,'cookies','set','fm_session',cookies[who].split('=').slice(1).join('='),'--url',origin],{stdio:'pipe'});
console.log(JSON.stringify({pass:true,steps:proof.steps,capturedEmails:proof.mail.length}));
