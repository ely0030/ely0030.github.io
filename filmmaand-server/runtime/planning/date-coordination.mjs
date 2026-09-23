import {randomInt} from 'node:crypto';
import {resolvedEventTiming} from './event-timing.mjs';
// Pure state transitions. All callers commit through the canonical plan/state CAS.
const fail=(status,code,message)=>{throw Object.assign(Error(message),{status,code})};
export const validDate=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d;
export const localDate=t=>new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(t));
export const eventDate=n=>n.startsAt?localDate(n.startsAt):n.scheduledDate;
const strict=(b,keys)=>b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).every(k=>keys.includes(k));
const days=(a,b)=>{const result=[];for(let t=Date.parse(a);t<=Date.parse(b);t+=86400000)result.push(new Date(t).toISOString().slice(0,10));return result};
const event=(p,id)=>id==='confirmation'?p.confirmation:(p.programme||[]).find(n=>n.id===id);
const revision=n=>n.coordinationRevision||0;
const upcoming=(p,d,now)=>validDate(d)&&d>=localDate(now)&&d>=p.window.start&&d<=p.window.end;
export function notice(p,n,type,now,extra={}){const id=extra.id||[type,n.id||'confirmation',revision(n),extra.proposalId||''].join(':');const log=p.coordinationEvents||=[];if(log.some(e=>e.id===id))return;log.push({id,type,planId:p.id,eventId:n.id||'confirmation',eventVersion:revision(n),occurredAt:now,scheduledDate:eventDate(n),choices:[...(n.choices||[])],timing:resolvedEventTiming(n,p.options),...extra});}
// pick:'auto' (default, the original behaviour): the deadline tick picks the best night at closesAt, which must fall before the
// first candidate night. pick:'manual': nothing is ever scheduled automatically; the organiser picks (action 'pick'). closesAt is
// then optional and may fall on any day up to and including the last candidate night (people can still answer on the day).
const ISO_TIME=/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/;
export function openAvailabilityPoll(p,b,{id,now}){
 if(!strict(b,['action','mode','window','choices','closesAt','programmeId','pick'])||b.action!=='open'||b.mode!=='availability'||(b.pick!==undefined&&b.pick!=='auto'&&b.pick!=='manual'))fail(400,'date_poll','Ongeldige datumpoll.');
 const manual=b.pick==='manual';
 if(p.datePoll?.status==='open')fail(409,'date_poll_open','Sluit eerst de huidige datumpoll.');
 if(!strict(b.window,['start','end'])||!upcoming(p,b.window.start,now)||!upcoming(p,b.window.end,now)||b.window.start>b.window.end||days(b.window.start,b.window.end).length>7)fail(400,'date_poll_window','Kies maximaal zeven komende dagen.');
 const noDeadline=manual&&(b.closesAt===undefined||b.closesAt===null);
 if(!noDeadline&&(typeof b.closesAt!=='string'||!ISO_TIME.test(b.closesAt)||!Number.isFinite(Date.parse(b.closesAt))||Date.parse(b.closesAt)<=Date.parse(now)))fail(400,'date_poll_deadline',manual?'Kies een sluitmoment in de toekomst, uiterlijk op de laatste kandidaatdag.':'Laat de poll vóór de eerste kandidaatdag sluiten.');
 if(!noDeadline&&(manual?localDate(b.closesAt)>b.window.end:localDate(b.closesAt)>=b.window.start))fail(400,'date_poll_deadline',manual?'Laat de poll uiterlijk op de laatste kandidaatdag sluiten.':'Laat de poll vóór de eerste kandidaatdag sluiten.');
 if(!Array.isArray(b.choices)||b.choices.length)fail(400,'date_poll_choices','De filmkeuze blijft onafhankelijk van deze datumkeuze.');
 let linked=null;if(b.programmeId!==undefined){linked=event(p,b.programmeId);if(!linked||linked.selection!=='pending'||linked.choices?.length)fail(409,'date_poll_event','Kies een bestaande avond met open filmkeuze.');}
 if(p.datePoll)(p.datePollHistory||=[]).push(archivePoll(p.datePoll));
 p.datePoll={id,mode:'availability',status:'open',window:{...b.window},choices:[],votes:{},openedAt:now,closesAt:noDeadline?null:b.closesAt,...(manual?{pick:'manual'}:{}),...(linked?{programmeId:b.programmeId,eventVersion:revision(linked),originalDate:eventDate(linked)}:{})};
 // Alec's sticker (Chris, 23 Sept): a real first chat message, the same for everyone. The style (0..3) is drawn once, here.
 p.datePoll.chat={seq:1,messages:[{id:'msg-'+id.slice(-8)+'-1',seq:1,a:ALEC_AUTHOR,at:now,kind:'sticker',sticker:randomInt(STICKER_STYLES)}]};
}
// The chat's system author: the group's host, shown as "Alec". Not an account; it never votes, never gets mail.
export const ALEC_AUTHOR='alec',STICKER_STYLES=4;
// Responded = at least one night explicitly answered (true or false). An all-false answer is a real "I can't make any
// of these nights": it counts as responded (never nudged) and is listed as declined. {} (or nothing) is "not answered yet".
const answered=(q,v)=>days(q.window.start,q.window.end).filter(d=>typeof v?.availability?.[d]==='boolean');
export const responded=(q,v)=>answered(q,v).length>0;
export const declined=(q,v)=>{const nights=days(q.window.start,q.window.end);return nights.every(d=>v?.availability?.[d]===false);};
// Organiser reminder flag: a manual poll still open from the day before its last night.
export const needsPick=(q,now)=>q?.mode==='availability'&&q.pick==='manual'&&q.status==='open'&&localDate(Date.parse(now)+86400000)>=q.window.end;
// Answers are accepted while the poll is open and, when it has a deadline, before it.
// The end of a night in Amsterdam: the instant local midnight after `date` (DST-safe). Chat stays open until then
// after the organiser picks that night (Cameo/Chris, 23 Sept: that's when "ik neem chips mee" happens).
export function nightEnd(date){const next=new Date(Date.parse(date+'T00:00:00Z')+864e5).toISOString().slice(0,10),base=Date.parse(next+'T00:00:00Z');
 for(const h of [1,2,0,3]){const t=base-h*3600e3,p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(t)).map(x=>[x.type,x.value]));
  if(`${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`===next+'T00:00')return t}
 return base}
// What a replaced poll keeps in datePollHistory: the poll itself (window, votes, ranking, pick, times; the votes stay, as
// before, for legacy preservation) but none of the per-poll social state added for the wanneer page: chat, doodles,
// RSVPs, the doodle-save log and the nudge/invite logs. Those can be large and have no use once the poll is replaced.
export const ARCHIVE_DROP=['chat','doodles','rsvp','doodleSaves','nudges','invites'];
export function archivePoll(q){const out=structuredClone(q);for(const k of ARCHIVE_DROP)delete out[k];return out}
// RSVP after a pick ("Ja, ik kom!" / "Toch niet"): own answer, changeable until the end of the picked night.
export const rsvpOpen=(q,now)=>q?.status==='confirmed'&&!!q.scheduledDate&&Date.parse(now)<nightEnd(q.scheduledDate);
// The intro film (Chris, 23 Sept): "if they've seen the full movie once, that login account shouldn't get it again".
// Own flag only, per account, on the plan; the page records it only after a FULL viewing (never on a skip).
export function writeFilmSeen(p,a,b,now){
 if(!strict(b,['film'])||typeof b.film!=='string'||!/^[a-z0-9-]{1,40}$/.test(b.film))fail(400,'film','Onbekende film.');
 const map=(p.filmSeen||={});if(!map[a])map[a]={film:b.film,at:now};return {filmSeen:true,at:map[a].at};}
export function writeRsvp(p,a,b,now){const q=p.datePoll;
 if(!strict(b,['pollId','answer'])||!['ja','nee'].includes(b.answer))fail(400,'rsvp','Kies ja of nee.');
 if(q?.mode!=='availability'||b.pollId!==q.id)fail(409,'date_poll_changed','Deze datumpoll is veranderd.');
 if(!rsvpOpen(q,now))fail(409,'rsvp_closed','Aanmelden kan niet (meer).');
 (q.rsvp||={})[a]={answer:b.answer,at:now};return {rsvp:{answer:b.answer,at:now}};}
export const ownRsvp=(q,a,now)=>({answer:q?.rsvp?.[a]?.answer||null,at:q?.rsvp?.[a]?.at||null,open:rsvpOpen(q,now)});
// Chat: open while answers are, and after a pick until the end of the picked night. Votes and doodles close at the pick.
export const chatOpen=(q,now)=>answersOpen(q,now)||(q?.status==='confirmed'&&!!q.scheduledDate&&Date.parse(now)<nightEnd(q.scheduledDate));
export const answersOpen=(q,now)=>q?.status==='open'&&(q.closesAt==null||Date.parse(now)<Date.parse(q.closesAt));
export function ownAvailability(p,a){const q=p.datePoll,v=q.votes?.[a];return {pollId:q.id,revision:v?.revision||0,availability:{...v?.availability},favourite:v?.favourite||null};}
export function rankAvailability(q,eligible=()=>true){return days(q.window.start,q.window.end).map(date=>{let available=0,unavailable=0,favourites=0;for(const [a,v]of Object.entries(q.votes||{})){if(!eligible(a))continue;if(v.availability?.[date]===true){available++;if(v.favourite===date)favourites++;}if(v.availability?.[date]===false)unavailable++;}return {date,available,unavailable,favourites};}).sort((a,b)=>b.available-a.available||b.favourites-a.favourites||a.date.localeCompare(b.date));}
// Organiser: remove one person's answer from the poll entirely (a test account, a mistaken vote). Their own page re-reads
// and sees no answer (a stale save of theirs fails on the revision check first). Hidden from nobody; it just no longer counts.
export function clearVote(p,b){if(!strict(b,['action','pollId','voter'])||typeof b.voter!=='string')fail(400,'date_poll','Ongeldige actie.');
 const q=p.datePoll;if(!q||q.mode!=='availability'||q.id!==b.pollId)fail(409,'date_poll_changed','Deze datumpoll is veranderd.');
 if(!q.votes||!Object.hasOwn(q.votes,b.voter))fail(404,'vote_unknown','Deze stem bestaat niet (meer).');delete q.votes[b.voter];}
export function writeAvailability(p,a,b,now){const q=p.datePoll;if(!strict(b,['pollId','revision','availability','favourite']))fail(400,'date_poll','Ongeldig antwoord.');if(!answersOpen(q,now))fail(409,'date_poll_closed','Deze poll is gesloten.');const own=ownAvailability(p,a);if(b.revision!==own.revision)fail(409,'revision_conflict','Je antwoord is elders veranderd.');const allowed=days(q.window.start,q.window.end);if(!b.availability||typeof b.availability!=='object'||Array.isArray(b.availability)||Object.entries(b.availability).some(([d,v])=>!allowed.includes(d)||typeof v!=='boolean')||(b.favourite!==null&&b.availability[b.favourite]!==true))fail(400,'availability','Markeer dagen als ja of nee; je voorkeur moet een beschikbare dag zijn.');q.votes[a]={revision:own.revision+1,availability:{...b.availability},favourite:b.favourite,updatedAt:now};return ownAvailability(p,a);}
// A linked night that changed since the poll opened cannot silently be rescheduled.
const linkedChanged=(p,q)=>{const n=q.programmeId?event(p,q.programmeId):null;return !!q.programmeId&&(!n||revision(n)!==q.eventVersion||eventDate(n)!==q.originalDate||n.selection!=='pending'||n.choices?.length)};
// Put the chosen night on the programme (the linked night, or a new pending night) and confirm the poll. Shared by the
// deadline tick (auto) and the organiser's pick (manual).
function schedule(p,q,date,now,extra={}){let n=q.programmeId?event(p,q.programmeId):null;if(!n){n={id:'night-'+q.id,selection:'pending',choices:[],coordinationRevision:0};(p.programme||=[]).push(n);}delete n.startsAt;n.scheduledDate=date;n.coordinationRevision=revision(n)+1;n.dateConfirmedAt=now;q.status='confirmed';q.scheduledDate=n.scheduledDate;q.programmeId=n.id;notice(p,n,'date-confirmed',now,extra);}
// Auto polls only. A manual poll is never finalised by time, however far past closesAt.
export function finalizePoll(p,now,eligible=()=>true){const q=p.datePoll;if(q?.mode!=='availability'||q.pick==='manual'||q.status!=='open'||Date.parse(now)<Date.parse(q.closesAt))return false;const ranks=rankAvailability(q,eligible);q.ranking=ranks;q.closedAt=now;if(!ranks[0]?.available){q.status='needs-organizer';return true;}if(linkedChanged(p,q)){q.status='needs-organizer';q.reason='event_changed';return true;}
 schedule(p,q,ranks[0].date,now);return true;}
// The organiser picks the night: any upcoming night in the poll window, whatever the counts. Works for a manual poll that is
// open (answers may still be coming in, or its deadline may have passed) and for an auto poll that is still open or that the
// deadline left as needs-organizer.
export function pickAvailabilityDate(p,b,now,eligible=()=>true){const q=p.datePoll;
 if(!strict(b,['action','pollId','date','tijd','waar'])||b.action!=='pick')fail(400,'date_poll','Ongeldige datumkeuze.');
 // Optional, for the confirmation mail: a time and a place, plain text (defaults "20:00" / "bij Alec").
 for(const k of ['tijd','waar'])if(b[k]!==undefined&&(typeof b[k]!=='string'||!b[k].trim()||b[k].length>40||/[\u0000-\u001f\u007f<>]/.test(b[k])))fail(400,'date_poll','Ongeldige '+k+'.');
 if(q?.mode!=='availability'||b.pollId!==q.id)fail(409,'date_poll_changed','Deze datumpoll is veranderd.');
 if(q.status!=='open'&&q.status!=='needs-organizer')fail(409,'date_poll_closed','Deze poll is al beslist of gesloten.');
 if(!upcoming(p,b.date,now)||b.date<q.window.start||b.date>q.window.end)fail(400,'date_poll_date','Kies een komende dag binnen deze poll.');
 if(linkedChanged(p,q))fail(409,'event_changed','De gekoppelde avond is elders veranderd.');
 q.ranking=rankAvailability(q,eligible);q.closedAt=now;delete q.reason;q.tijd=(b.tijd||'20:00').trim();q.waar=(b.waar||'bij Alec').trim();
 // An ORGANISER pick (manual or auto poll) mails its own per-person confirmation (poll-confirm, with a personal ja/nee
 // link) instead of the generic site-wide "De datum staat vast" fan-out; the event carries pollConfirm so the fan-out
 // skips it. (Only an auto poll decided by its deadline, finalizePoll, still uses the generic notice.)
 schedule(p,q,b.date,now,{pollConfirm:q.id});
}
export function attendees(p,n,eligible){const d=eventDate(n);return Object.entries(p.responses||{}).filter(([a,r])=>eligible(a)&&(Array.isArray(r.dates)?r.dates.includes(d):r.start<=d&&r.end>=d)).map(([a])=>a).sort();}
function current(p,b){const n=event(p,b.eventId);if(!n)fail(404,'event','Deze avond bestaat niet.');if(b.eventVersion!==revision(n))fail(409,'event_changed','Deze avond is elders veranderd.');return n;}
function move(p,n,q,now,override=false){const old=eventDate(n);if(n.startsAt&&!n.timing?.screening)n.timing={...n.timing,screening:new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'}).format(new Date(n.startsAt))};delete n.startsAt;n.scheduledDate=q.proposedDate;n.coordinationRevision=revision(n)+1;q.status='changed';q.resolvedAt=now;q.override=override;for(const other of p.dateChanges||[])if(other!==q&&other.eventId===q.eventId&&other.status==='pending')other.status='stale';notice(p,n,'date-changed',now,{previousDate:old,proposalId:q.id,override});}
export function resolveChanges(p,now,eligible){let changed=false;for(const q of p.dateChanges||[]){if(q.status!=='pending')continue;const n=event(p,q.eventId);if(!n||q.proposedDate<localDate(now)||revision(n)!==q.eventVersion||eventDate(n)!==q.previousDate){q.status='stale';changed=true;continue;}const required=attendees(p,n,eligible);if(JSON.stringify(required)!==JSON.stringify(q.currentRequiredActors)){q.currentRequiredActors=required;changed=true;}if(required.length&&required.every(a=>q.responses[a]?.agree===true)){move(p,n,q,now);changed=true;}}return changed;}
export function changeDate(p,a,b,{id,now,eligible,admin=false}){if(!strict(b,['action','eventId','eventVersion','proposedDate','proposalId','revision','agree','timing','reminderMinutes','startsAt','expectedRoundId']))fail(400,'coordination','Ongeldige handeling.');if(p.roundSchedule?.date&&b.eventId==='round-'+p.roundSchedule.date){
 if(!admin||b.action!=='times')fail(403,'organizer_required','Deze ronde kan hier alleen door de beheerder van tijden worden voorzien.');
 const r=p.roundSchedule;if(b.expectedRoundId!==(p.round?.id||null))fail(409,'event_changed','De stemronde is veranderd.');if(b.eventVersion!==(r.coordinationRevision||0))fail(409,'event_changed','Deze avond is elders veranderd.');
 if(r.date<localDate(now))fail(409,'event_past','Deze avond is voorbij.');
 if(b.startsAt!==undefined||b.reminderMinutes!==undefined)fail(400,'round_timing','Pas hier alleen Inloop, Aanvang en Einde aan.');
 if(!strict(b.timing,['arrival','screening','end'])||Object.values(b.timing).some(t=>typeof t!=='string'||t.length>60||/[<>\x00-\x1f]/.test(t)))fail(400,'timing','Gebruik korte tijdlabels zonder opmaak.');
 r.timing={...b.timing};r.coordinationRevision=(r.coordinationRevision||0)+1;
 return {eventId:b.eventId,eventVersion:r.coordinationRevision};
 }const n=current(p,b);if(['propose','times'].includes(b.action)&&eventDate(n)<localDate(now))fail(409,'event_past','Deze avond is voorbij.');
 if(b.action==='propose'){if(!upcoming(p,b.proposedDate,now)||b.proposedDate===eventDate(n))fail(400,'date','Kies een andere komende datum.');if((p.dateChanges||[]).some(q=>q.eventId===b.eventId&&q.status==='pending'))fail(409,'proposal_pending','Er staat al een voorstel open.');const required=attendees(p,n,eligible);const q={id,eventId:b.eventId,eventVersion:revision(n),previousDate:eventDate(n),proposedDate:b.proposedDate,status:'pending',proposedBy:a,createdAt:now,requiredActors:required,currentRequiredActors:required,responses:{}};(p.dateChanges||=[]).push(q);notice(p,n,'date-change-proposed',now,{proposalId:id,proposedDate:b.proposedDate,requiredActors:required});return {proposalId:id,status:q.status};}
 if(b.action==='times'){if(!admin)fail(403,'organizer_required','Beheerderstoegang vereist.');if(!strict(b.timing,['arrival','screening','end'])||Object.values(b.timing).some(t=>typeof t!=='string'||t.length>60||/[<>\x00-\x1f]/.test(t)))fail(400,'timing','Gebruik korte tijdlabels zonder opmaak.');if(b.reminderMinutes!==undefined&&b.reminderMinutes!==null&&(!Number.isInteger(b.reminderMinutes)||b.reminderMinutes<1||b.reminderMinutes>10080))fail(400,'reminder','Kies een herinnering tussen 1 minuut en 7 dagen.');if(b.startsAt!==undefined&&b.startsAt!==null&&(typeof b.startsAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(b.startsAt)||!Number.isFinite(Date.parse(b.startsAt))||localDate(b.startsAt)!==eventDate(n)))fail(400,'event_time','De exacte starttijd moet op de bestaande programmadatum vallen.');const nextStart=b.startsAt===undefined?n.startsAt:b.startsAt;if(b.reminderMinutes!=null&&!nextStart)fail(400,'reminder_time','Een herinnering vereist een bestaande exacte starttijd.');const existingDate=eventDate(n);n.timing={...(n.timing?.arrival!==undefined?{arrival:n.timing.arrival}:{}),...b.timing};if(b.startsAt!==undefined){if(b.startsAt){n.startsAt=b.startsAt;delete n.scheduledDate;}else{n.scheduledDate=existingDate;delete n.startsAt;}}if(b.reminderMinutes!==undefined)n.reminderMinutes=b.reminderMinutes;n.coordinationRevision=revision(n)+1;notice(p,n,'event-updated',now);return {eventId:b.eventId,eventVersion:revision(n)};}
 const q=(p.dateChanges||[]).find(q=>q.id===b.proposalId&&q.eventId===b.eventId);if(!q||q.status!=='pending'||q.proposedDate<localDate(now)||q.eventVersion!==revision(n))fail(409,'proposal_changed','Dit voorstel is niet meer open.');
 if(b.action==='cancel'){if(!admin&&a!==q.proposedBy)fail(403,'proposal_owner','Alleen de indiener of beheerder kan annuleren.');q.status='cancelled';q.resolvedAt=now;notice(p,n,'event-updated',now,{id:'cancel:'+q.id});}
 else if(b.action==='override'){if(!admin)fail(403,'organizer_required','Beheerderstoegang vereist.');move(p,n,q,now,true);}
 else if(b.action==='consent'){const old=q.responses[a];if(b.revision!==(old?.revision||0))fail(409,'revision_conflict','Je antwoord is elders veranderd.');if(typeof b.agree!=='boolean')fail(400,'consent','Kies expliciet ja of nee.');q.responses[a]={revision:(old?.revision||0)+1,agree:b.agree,updatedAt:now};resolveChanges(p,now,eligible);}
 else fail(400,'coordination','Kies een geldige handeling.');return {proposalId:q.id,status:q.status,own:q.responses[a]||{revision:0,agree:null}};
}
export function coordinationView(p,me,display){return {proposals:(p.dateChanges||[]).map(q=>({id:q.id,eventId:q.eventId,eventVersion:q.eventVersion,previousDate:q.previousDate,proposedDate:q.proposedDate,status:q.status,canCancel:me===q.proposedBy,own:q.responses[me]||{revision:0,agree:null},required:(q.currentRequiredActors||q.requiredActors).map(a=>{const profile=display(a);return profile?{...profile,agree:q.responses[a]?.agree??null,...(a===me?{self:true}:{})}:null}).filter(Boolean)}))};}
export function tickCoordination(p,now,eligible){let changed=finalizePoll(p,now,eligible);changed=resolveChanges(p,now,eligible)||changed;for(const n of [...(p.programme||[]),...(p.confirmation?[{...p.confirmation,id:'confirmation'}]:[])])if(n.startsAt&&Number.isInteger(n.reminderMinutes)&&Date.parse(now)>=Date.parse(n.startsAt)-n.reminderMinutes*60000&&Date.parse(now)<Date.parse(n.startsAt)){const before=p.coordinationEvents?.length||0;notice(p,n,'reminder',now);changed=(p.coordinationEvents?.length||0)!==before||changed;}return changed;}
