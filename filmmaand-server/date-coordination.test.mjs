import test from 'node:test';import assert from 'node:assert/strict';
import {openAvailabilityPoll,writeAvailability,finalizePoll,pickAvailabilityDate,responded,declined,needsPick,rankAvailability,changeDate,resolveChanges,tickCoordination,coordinationView} from './runtime/planning/date-coordination.mjs';
const now='2026-09-10T10:00:00Z',closed='2026-09-11T11:00:00Z',eligible=a=>['p_a','p_b','p_c'].includes(a);
const plan=()=>({id:'qa',version:1,window:{start:'2026-09-01',end:'2026-09-30'},options:[],responses:{},programme:[],receipts:{}});
function poll(p){openAvailabilityPoll(p,{action:'open',mode:'availability',window:{start:'2026-09-12',end:'2026-09-14'},choices:[],closesAt:'2026-09-11T10:00:00Z'},{id:'poll-qa',now});}
test('availability, favourites, chronological tie, unknown and legacy preservation',()=>{const p=plan();p.datePoll={id:'old',status:'closed',votes:{p_a:{date:'2026-09-12'}}};const old=structuredClone(p.datePoll);poll(p);assert.deepEqual(p.datePollHistory,[old]);writeAvailability(p,'p_a',{pollId:'poll-qa',revision:0,availability:{'2026-09-12':true,'2026-09-13':true},favourite:'2026-09-13'},now);writeAvailability(p,'p_b',{pollId:'poll-qa',revision:0,availability:{'2026-09-12':true,'2026-09-13':true},favourite:null},now);assert.equal(rankAvailability(p.datePoll)[0].date,'2026-09-13');assert.equal(rankAvailability(p.datePoll).find(d=>d.date==='2026-09-14').unavailable,0);p.datePoll.votes.p_a.favourite=null;assert.equal(rankAvailability(p.datePoll)[0].date,'2026-09-12');assert.throws(()=>writeAvailability(p,'p_c',{revision:0,availability:{},favourite:'2026-09-12'},now));});
test('deadline commits once, zero positive needs organizer, no legacy auto-finalization',()=>{const p=plan();poll(p);assert.equal(finalizePoll(p,now),false);writeAvailability(p,'p_a',{revision:0,availability:{'2026-09-13':true},favourite:null},now);assert.equal(finalizePoll(p,closed,eligible),true);const exact=structuredClone(p);assert.equal(finalizePoll(p,closed,eligible),false);assert.deepEqual(p,exact);assert.equal(p.programme[0].selection,'pending');assert.equal(p.programme[0].scheduledDate,'2026-09-13');assert.deepEqual(p.responses,{});assert.equal(p.coordinationEvents.length,1);const z=plan();poll(z);finalizePoll(z,closed);assert.equal(z.datePoll.status,'needs-organizer');assert.deepEqual(z.programme,[]);const legacy=plan();legacy.datePoll={status:'open',votes:{p_a:{date:'2026-09-12'}}};assert.equal(finalizePoll(legacy,closed),false);});
function moveFixture(){const p=plan();p.programme=[{id:'night',scheduledDate:'2026-09-12',selection:'pending',choices:[]}];p.responses={p_a:{dates:['2026-09-12']},p_b:{dates:['2026-09-12']}};changeDate(p,'p_a',{action:'propose',eventId:'night',eventVersion:0,proposedDate:'2026-09-14'},{id:'proposal',now,eligible});return p;}
const consent=(p,a,agree,revision=0)=>changeDate(p,a,{action:'consent',eventId:'night',eventVersion:0,proposalId:'proposal',revision,agree},{id:'unused',now,eligible});
test('current attendees must consent, refusal blocks, new joiner required and cancellation no longer blocks',()=>{const p=moveFixture();consent(p,'p_a',true);p.responses.p_c={dates:['2026-09-12']};consent(p,'p_b',true);assert.equal(p.programme[0].scheduledDate,'2026-09-12');consent(p,'p_c',false);assert.equal(p.dateChanges[0].status,'pending');p.responses.p_c.dates=[];const before=structuredClone(p.responses);resolveChanges(p,now,eligible);assert.equal(p.programme[0].scheduledDate,'2026-09-14');assert.deepEqual(p.responses,before);assert.throws(()=>consent(p,'p_c',true,1),e=>e.code==='event_changed');const view=coordinationView(p,'p_a',()=>({name:'QA'}));assert.ok(!JSON.stringify(view).includes('p_b'));});
test('zero attendees cannot auto-move; explicit organizer override, cancellation and version guards',()=>{const p=moveFixture();p.responses={};resolveChanges(p,now,eligible);assert.equal(p.dateChanges[0].status,'pending');assert.throws(()=>changeDate(p,'p_a',{action:'override',eventId:'night',eventVersion:0,proposalId:'proposal'},{now,eligible}));changeDate(p,'admin',{action:'override',eventId:'night',eventVersion:0,proposalId:'proposal'},{now,eligible,admin:true});assert.equal(p.programme[0].scheduledDate,'2026-09-14');assert.equal(p.dateChanges[0].override,true);const c=moveFixture();changeDate(c,'p_a',{action:'cancel',eventId:'night',eventVersion:0,proposalId:'proposal'},{now,eligible});assert.equal(c.dateChanges[0].status,'cancelled');assert.equal(c.programme[0].scheduledDate,'2026-09-12');});
test('manual time labels stay manual; reminder off until explicitly configured and only once',()=>{const p=moveFixture();changeDate(p,'admin',{action:'times',eventId:'night',eventVersion:0,timing:{arrival:'19:00',screening:'19:30',end:''}},{now,eligible,admin:true});assert.equal(p.programme[0].startsAt,undefined);assert.equal(p.programme[0].timing.end,'');assert.equal(p.programme[0].reminderMinutes,undefined);p.programme[0].startsAt='2026-09-12T17:30:00Z';p.programme[0].reminderMinutes=60;tickCoordination(p,'2026-09-12T17:00:00Z',eligible);tickCoordination(p,'2026-09-12T17:01:00Z',eligible);assert.equal(p.coordinationEvents.filter(n=>n.type==='reminder').length,1);});
test('pending move can resolve beyond original date, but never after proposed date',()=>{const p=moveFixture();changeDate(p,'admin',{action:'override',eventId:'night',eventVersion:0,proposalId:'proposal'},{now:'2026-09-13T10:00:00Z',eligible,admin:true});assert.equal(p.programme[0].scheduledDate,'2026-09-14');const stale=moveFixture();resolveChanges(stale,'2026-09-15T10:00:00Z',eligible);assert.equal(stale.dateChanges[0].status,'stale');assert.equal(stale.programme[0].scheduledDate,'2026-09-12');});
// Manual mode (pick:'manual'): the organiser picks; time never decides.
const manualBody=(extra={})=>({action:'open',mode:'availability',pick:'manual',window:{start:'2026-09-12',end:'2026-09-14'},choices:[],...extra});
const deadline=(body,at=now)=>{try{openAvailabilityPoll(plan(),body,{id:'poll-m',now:at});return 'ok'}catch(e){return e.code}};
test('closesAt rule: relaxed only in manual mode (optional, on or before the last night); auto keeps "before the first night"',()=>{
 assert.equal(deadline(manualBody()),'ok');assert.equal(deadline(manualBody({closesAt:null})),'ok');
 assert.equal(deadline(manualBody({closesAt:'2026-09-12T18:00:00Z'})),'ok');// on the first night
 assert.equal(deadline(manualBody({closesAt:'2026-09-14T21:59:00Z'})),'ok');// 23:59 Amsterdam on the last night
 assert.equal(deadline(manualBody({closesAt:'2026-09-14T22:00:00Z'})),'date_poll_deadline');// 00:00 the day after
 assert.equal(deadline(manualBody({closesAt:'2026-09-10T09:00:00Z'})),'date_poll_deadline');// in the past
 assert.equal(deadline(manualBody({closesAt:'soon'})),'date_poll_deadline');
 const auto=extra=>({...manualBody(extra),pick:'auto'});
 assert.equal(deadline(auto({closesAt:'2026-09-11T21:59:00Z'})),'ok');
 assert.equal(deadline(auto({closesAt:'2026-09-12T18:00:00Z'})),'date_poll_deadline');
 assert.equal(deadline(auto({})),'date_poll_deadline');assert.equal(deadline(auto({closesAt:null})),'date_poll_deadline');
 const {pick,...legacy}=auto({});assert.equal(deadline(legacy),'date_poll_deadline');// no pick = auto
 assert.equal(deadline(manualBody({pick:'later'})),'date_poll');
 const p=plan();openAvailabilityPoll(p,manualBody(),{id:'poll-m',now});assert.equal(p.datePoll.pick,'manual');assert.equal(p.datePoll.closesAt,null);
 const a=plan();poll(a);assert.equal('pick' in a.datePoll,false);// auto polls are stored exactly as before
});
test('manual mode never auto-schedules, with or without a deadline, however late the tick runs',()=>{
 for(const closesAt of [undefined,'2026-09-12T18:00:00Z']){
  const p=plan();openAvailabilityPoll(p,manualBody(closesAt?{closesAt}:{}),{id:'poll-m',now});
  writeAvailability(p,'p_a',{pollId:'poll-m',revision:0,availability:{'2026-09-13':true},favourite:'2026-09-13'},now);
  const before=structuredClone(p);
  for(const at of ['2026-09-12T18:00:00Z','2026-09-13T12:00:00Z','2026-09-20T00:00:00Z','2027-01-01T00:00:00Z']){assert.equal(finalizePoll(p,at,eligible),false);assert.equal(tickCoordination(p,at,eligible),false);}
  assert.deepEqual(p,before);assert.equal(p.datePoll.status,'open');assert.deepEqual(p.programme,[]);assert.equal(p.coordinationEvents,undefined);
 }
});
test('manual mode: answers stay open until the organiser picks, or until closesAt when one is given',()=>{
 const vote=(p,at,revision=0)=>writeAvailability(p,'p_a',{pollId:'poll-m',revision,availability:{'2026-09-12':true},favourite:null},at);
 const open=plan();openAvailabilityPoll(open,manualBody(),{id:'poll-m',now});vote(open,'2026-09-14T20:00:00Z');// on the last night itself
 const timed=plan();openAvailabilityPoll(timed,manualBody({closesAt:'2026-09-12T16:00:00Z'}),{id:'poll-m',now});vote(timed,'2026-09-12T15:59:00Z');
 assert.throws(()=>vote(timed,'2026-09-12T16:00:00Z',1),e=>e.code==='date_poll_closed');assert.equal(timed.datePoll.status,'open');// still waiting for the organiser
 pickAvailabilityDate(open,{action:'pick',pollId:'poll-m',date:'2026-09-14'},'2026-09-14T20:30:00Z',eligible);
 assert.throws(()=>vote(open,'2026-09-14T20:31:00Z',1),e=>e.code==='date_poll_closed');
});
test('pick puts the chosen night on the programme exactly like the deadline did, and only once',()=>{
 const p=plan();openAvailabilityPoll(p,manualBody(),{id:'poll-m',now});
 writeAvailability(p,'p_a',{pollId:'poll-m',revision:0,availability:{'2026-09-12':true,'2026-09-13':true},favourite:null},now);
 writeAvailability(p,'p_b',{pollId:'poll-m',revision:0,availability:{'2026-09-13':true},favourite:null},now);
 const pick=(date,at=now,pollId='poll-m',q=p)=>{try{pickAvailabilityDate(q,{action:'pick',pollId,date},at,eligible);return 'ok'}catch(e){return e.code}};
 assert.equal(pick('2026-09-15'),'date_poll_date');assert.equal(pick('2026-09-11'),'date_poll_date');assert.equal(pick('13-09-2026'),'date_poll_date');
 assert.equal(pick('2026-09-12','2026-09-13T10:00:00Z'),'date_poll_date');// already past
 assert.equal(pick('2026-09-12',now,'poll-other'),'date_poll_changed');
 assert.throws(()=>pickAvailabilityDate(p,{action:'pick',pollId:'poll-m',date:'2026-09-12',extra:1},now,eligible),e=>e.code==='date_poll');
 assert.equal(pick('2026-09-12'),'ok');// not the leader (13th): the organiser decides
 const night=p.programme[0];assert.equal(night.id,'night-poll-m');assert.equal(night.scheduledDate,'2026-09-12');assert.equal(night.selection,'pending');assert.equal(night.dateConfirmedAt,now);
 assert.equal(p.datePoll.status,'confirmed');assert.equal(p.datePoll.scheduledDate,'2026-09-12');assert.equal(p.datePoll.programmeId,night.id);assert.equal(p.datePoll.closedAt,now);
 assert.deepEqual(p.coordinationEvents.map(e=>[e.type,e.scheduledDate]),[['date-confirmed','2026-09-12']]);
 assert.equal(pick('2026-09-13'),'date_poll_closed');assert.equal(p.programme.length,1);
 // The same pick resolves an auto poll that the deadline left for the organiser.
 const z=plan();poll(z);finalizePoll(z,closed,eligible);assert.equal(z.datePoll.status,'needs-organizer');
 assert.equal(pick('2026-09-14',closed,'poll-qa',z),'ok');assert.equal(z.programme[0].scheduledDate,'2026-09-14');assert.equal(z.datePoll.status,'confirmed');
 // A linked night that changed elsewhere is not silently rescheduled.
 const l=plan();l.programme=[{id:'night',scheduledDate:'2026-09-20',selection:'pending',choices:[]}];openAvailabilityPoll(l,manualBody({programmeId:'night'}),{id:'poll-m',now});l.programme[0].coordinationRevision=1;
 assert.equal(pick('2026-09-13',now,'poll-m',l),'event_changed');assert.equal(l.datePoll.status,'open');assert.equal(l.programme[0].scheduledDate,'2026-09-20');
});
test('responded / declined / needsPick',()=>{
 const q={mode:'availability',pick:'manual',status:'open',window:{start:'2026-09-12',end:'2026-09-14'}},v=availability=>({availability});
 assert.equal(responded(q,undefined),false);assert.equal(responded(q,v({})),false);assert.equal(responded(q,v({'2026-09-20':false})),false);
 assert.equal(responded(q,v({'2026-09-13':false})),true);assert.equal(responded(q,v({'2026-09-13':true})),true);
 assert.equal(declined(q,v({'2026-09-12':false,'2026-09-13':false,'2026-09-14':false})),true);
 assert.equal(declined(q,v({'2026-09-12':false,'2026-09-13':false})),false);assert.equal(declined(q,v({'2026-09-12':false,'2026-09-13':true,'2026-09-14':false})),false);
 assert.equal(needsPick(q,'2026-09-12T21:59:00Z'),false);assert.equal(needsPick(q,'2026-09-12T22:00:00Z'),true);assert.equal(needsPick(q,'2026-09-20T00:00:00Z'),true);
 assert.equal(needsPick({...q,pick:undefined},'2026-09-13T12:00:00Z'),false);assert.equal(needsPick({...q,status:'confirmed'},'2026-09-13T12:00:00Z'),false);
});
