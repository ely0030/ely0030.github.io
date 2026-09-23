// Shared doodles on the date poll (the /filmmaand/wanneer/ page). One doodle per person per poll: a save adds or replaces
// the saver's OWN doodle, never anyone else's. Stored on the poll itself (p.datePoll.doodles), so a new poll starts empty.
// Never mails, never notifies: nothing here touches the outbox or the notice list. The organiser can hide a person's doodle
// (a sticky per-person kill switch: a replacement stays hidden until the organiser unhides it).
import {createHash} from 'node:crypto';
import {answersOpen} from './date-coordination.mjs';

const fail=(status,code,message,details)=>{throw Object.assign(new Error(message),{status,code,...(details?{details}:{})})};
const strict=(b,keys)=>b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).every(k=>keys.includes(k));
// Payload shape = what Capsule's eggs.js produces (kits/…/jasjes2/eggs/CHAT-CADENCE.md): {s:[[ink,[[x,y],…]],…], t}. The client's t
// (and any name) is never trusted: the server stamps author, `at` and `t` (HH:MM Amsterdam).
// Inks (Chris, 23 Sept): letters only, the colours are client-side: k black, w white/eraser, r red, o orange, y yellow,
// g green, b blue, p purple, n brown, s pink.
export const DOODLE_MAX_BYTES=4096,DOODLE_MAX_STROKES=64,DOODLE_MAX_POINTS=2000,INKS=['k','w','r','o','y','g','b','p','n','s'];
// Per person, like the chat: 6 saves a minute, 30 an hour. Computed from q.doodleSaves at write time (reads never write);
// that log keeps only the last hour, at most 30 entries per person.
export const DOODLE_RATE=[{ms:60e3,max:6},{ms:3600e3,max:30}];
const clamp=n=>Math.min(100,Math.max(0,n));
const hhmm=at=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at));
const round=n=>Math.round(n*10)/10;

// Strokes: [[ink,[[x,y],…]],…], ink 'k'|'r', x/y finite numbers, clamped to 0..100 and rounded to 0.1 before measuring.
export function normaliseStrokes(s){
 const bad=()=>fail(400,'doodle','Deze tekening kan niet worden opgeslagen.');
 if(!Array.isArray(s)||s.length<1||s.length>DOODLE_MAX_STROKES)bad();
 let points=0;
 const out=s.map(stroke=>{
  // [ink, points] or [ink, points, size] with size 1|2|3 (pen width; optional, Chris 23 Sept).
  if(!Array.isArray(stroke)||(stroke.length!==2&&stroke.length!==3)||!INKS.includes(stroke[0])||!Array.isArray(stroke[1])||stroke[1].length<1)bad();
  if(stroke.length===3&&![1,2,3].includes(stroke[2]))bad();
  points+=stroke[1].length;if(points>DOODLE_MAX_POINTS)fail(400,'doodle_too_big','Deze tekening is te groot.');
  return [stroke[0],stroke[1].map(pt=>{if(!Array.isArray(pt)||pt.length!==2||!pt.every(v=>typeof v==='number'&&Number.isFinite(v)))bad();return [round(clamp(pt[0])),round(clamp(pt[1]))]}),...(stroke.length===3?[stroke[2]]:[])];
 });
 if(Buffer.byteLength(JSON.stringify(out))>DOODLE_MAX_BYTES)fail(400,'doodle_too_big','Deze tekening is te groot.');
 return out;
}
// One doodle rate for every way of drawing (the chat's doodle messages and the older one-per-person slot): check, then log.
export function takeDoodleSlot(q,a,now){const t=Date.parse(now),log=((q.doodleSaves||={})[a]||=[]).filter(x=>t-Date.parse(x)<3600e3);
 for(const {ms,max} of DOODLE_RATE){const recent=log.filter(x=>t-Date.parse(x)<ms);
  if(recent.length>=max)fail(429,'doodle_rate','Even rustig aan: je kunt zo weer een tekening sturen.',{retryAfter:Math.ceil((Date.parse(recent[0])+ms-t)/1000)})}
 log.push(now);q.doodleSaves[a]=log.slice(-30);}
const doodleId=(pollId,a)=>'doodle-'+createHash('sha256').update(pollId+':'+a).digest('hex').slice(0,16);

// PUT body {pollId, s, t?} (t is accepted for the eggs' shape and ignored). Returns {doodle: own, doodles: everyone's visible},
// so the page needs no extra GET after a send.
export function writeDoodle(p,a,b,now,display){
 const q=p.datePoll;
 if(!strict(b,['pollId','s','t'])||typeof b.pollId!=='string'||!('s' in b))fail(400,'doodle','Deze tekening kan niet worden opgeslagen.');
 if(!q||q.mode!=='availability'||q.id!==b.pollId)fail(409,'date_poll_changed','Deze datumpoll is veranderd.');
 if(!answersOpen(q,now))fail(409,'date_poll_closed','Deze poll is gesloten.');
 const s=normaliseStrokes(b.s);takeDoodleSlot(q,a,now);
 const prior=q.doodles?.[a];
 (q.doodles||={})[a]={id:doodleId(q.id,a),at:now,s,...(prior?.hidden?{hidden:true}:{})};
 return {doodle:ownDoodle(p,a),doodles:publicDoodles(p,a,display)};
}
export function ownDoodle(p,a){const d=p.datePoll?.doodles?.[a];return d?{id:d.id,at:d.at,t:hhmm(d.at),s:d.s,...(d.hidden?{hidden:true}:{})}:null}

// Everyone's visible doodles, for the date-poll GET (pass/session). Only people with a display profile, like the names.
export function publicDoodles(p,me,display){
 const out=[];for(const [a,d] of Object.entries(p.datePoll?.doodles||{})){if(d.hidden)continue;const who=display(p,a);if(!who)continue;
  out.push({id:d.id,name:who.name,avatarId:who.avatarId,at:d.at,t:hhmm(d.at),s:d.s,...(a===me?{self:true}:{})})}
 return out.sort((x,y)=>x.at.localeCompare(y.at)||x.id.localeCompare(y.id));
}
// Organiser view: all doodles, hidden ones flagged, without strokes (the organiser decides by looking at the page or by name).
export function organiserDoodles(p,display){
 return Object.entries(p.datePoll?.doodles||{}).map(([a,d])=>{const who=display(p,a);return {id:d.id,name:who?.name||null,at:d.at,hidden:!!d.hidden,bytes:Buffer.byteLength(JSON.stringify(d.s))}})
  .sort((x,y)=>x.at.localeCompare(y.at)||x.id.localeCompare(y.id));
}
// Organiser action {action:'hide-doodle', pollId, doodleId, hidden:true|false}.
export function hideDoodle(p,b){
 if(!strict(b,['action','pollId','doodleId','hidden'])||typeof b.doodleId!=='string'||typeof b.hidden!=='boolean')fail(400,'doodle','Ongeldige actie.');
 const q=p.datePoll;if(!q||q.mode!=='availability'||q.id!==b.pollId)fail(409,'date_poll_changed','Deze datumpoll is veranderd.');
 const entry=Object.values(q.doodles||{}).find(d=>d.id===b.doodleId);if(!entry)fail(404,'doodle_unknown','Deze tekening bestaat niet.');
 if(b.hidden)entry.hidden=true;else delete entry.hidden;
}
