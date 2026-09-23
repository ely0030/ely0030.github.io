import {randomBytes,createHash} from 'node:crypto';
import {nightEnd} from '../date-coordination.mjs';
// Poll pass: a per-recipient, per-poll bearer that identifies ONE participant for ONE date poll.
// It is never a session. Only its SHA-256 is stored (same house pattern as auth_invites).
// Resolving a pass is a pure read: it never records use, never rate-limits, never consumes, so a
// mail scanner's prefetch cannot change state. Tokens are 256-bit random, so guessing is not a threat
// that needs a (state-writing) rate limit on the read path.
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=(status,code,message,details)=>{throw Object.assign(Error(message),{status,code,details})};
const normalize=e=>typeof e==='string'?e.trim().toLowerCase():'';
export const PASS_GRACE_MS=24*3600e3;
export const PASS_ACTIONS=['issue-passes','revoke-passes','list-passes','list-availability','nudge-list','nudge','invite-list','invite'];
// Expiry. Auto poll (closes before the first night, then the tick decides): the row expires at closesAt + 24h, as before.
// Manual poll (the organiser picks): valid while the poll is open, then 24h read-only grace after the pick/close (checked
// against the loaded poll by passLive). Its row carries only a hard ceiling: 24h after the last candidate night ends.
const DAY=86400e3;
// Hard cap stored with a pass. Once a night is picked (also an auto poll the organiser picked late), a pass minted then (the
// confirmation mail's) must reach the end of that night + the grace, so the cap is at least that.
export const passExpiry=poll=>new Date(Math.max(poll.pick==='manual'?Date.parse(poll.window.end)+2*DAY:Date.parse(poll.closesAt)+PASS_GRACE_MS,
 poll.scheduledDate?nightEnd(poll.scheduledDate)+PASS_GRACE_MS:0)).toISOString();
// Manual poll: live while open; after close/pick 24h read-only; after a PICK also until the end of the picked night (chat
// stays open) plus the same 24h. The stored hard cap (window.end + 2 days) always covers that: a pick lies inside the window.
export const passLive=(poll,now)=>poll.pick!=='manual'||poll.status==='open'||(!!poll.closedAt&&Date.parse(now)<Date.parse(poll.closedAt)+PASS_GRACE_MS)
 ||(poll.status==='confirmed'&&!!poll.scheduledDate&&Date.parse(now)<nightEnd(poll.scheduledDate)+PASS_GRACE_MS);
export const isPassToken=t=>typeof t==='string'&&/^[A-Za-z0-9_-]{43}$/.test(t);
// One message for malformed, unknown, revoked, expired, wrong plan and wrong poll: the caller learns nothing about existence.
export const passInvalid=()=>fail(401,'pass_invalid','Deze link werkt niet (meer). Vraag de organisator om een nieuwe link.');
export function createPollPasses({store,accounts=null,now=()=>new Date().toISOString()}){
 const q=sql=>store.db.prepare(sql),at=()=>Date.parse(now());
 // emails: existing accounts. people (issue only): {email,name,avatarId?}; an account is created (or a profile-less one
 // completed) with that name/avatar, so every minted friend's answer counts. Validation happens before any write.
 function recipients(body,{allowNew=false}={}){
  const list=body?.emails===undefined&&allowNew?[]:body?.emails,extra=allowNew&&body?.people!==undefined?body.people:[];
  if(!Array.isArray(list)||!Array.isArray(extra)||!(list.length+extra.length)||list.length+extra.length>50)fail(400,'recipients','Geef 1 tot 50 ontvangers op.');
  const planned=new Map();
  for(const e of extra){if(!e||typeof e!=='object'||Array.isArray(e)||!Object.keys(e).every(k=>['email','name','avatarId'].includes(k)))fail(400,'recipients','Geef per nieuwe ontvanger email, name en eventueel avatarId op.');
   if(!accounts)fail(503,'recipients','Accounts aanmaken is hier niet beschikbaar.');const v=accounts.validateProvision(e);if(planned.has(v.email))fail(400,'recipients','Elk e-mailadres maar één keer.',{emails:[v.email]});planned.set(v.email,v);}
  const emails=[...new Set(list.map(normalize))].filter(e=>!planned.has(e)),unknown=[],notOnboarded=[],people=[];
  for(const email of emails){const p=email&&store.q.participantByEmail.get(email);if(!p)unknown.push(email);else if(!p.onboarded)notOnboarded.push(email);else people.push({participantId:p.id,email,name:p.name});}
  // All-or-nothing: the organiser is told exactly which addresses need fixing, nothing is minted.
  if(unknown.length)fail(404,'recipient_unknown','Niet elk e-mailadres hoort bij een account. Geef voor een nieuwe vriend naam (en avatar) op via people.',{emails:unknown});
  // An account without name/avatar is not counted by the poll, so a pass for it would be a silent non-vote.
  if(notOnboarded.length)fail(409,'recipient_not_onboarded','Niet elk account heeft al een naam en avatar. Geef ze op via people.',{emails:notOnboarded});
  return allowNew?{people,planned:[...planned.values()]}:people;
 }
 function openPoll(poll,body){
  if(!poll||poll.mode!=='availability'||poll.status!=='open')fail(409,'date_poll_not_open','Er staat geen open beschikbaarheidspoll.');
  if(body?.pollId!==poll.id)fail(409,'date_poll_changed','Deze datumpoll is veranderd.');
  return poll;
 }
 return {
  // Someone who already holds a LIVE pass for this poll is SKIPPED (listed in `skipped`), because rotating would kill a
  // link that may already be in their mailbox (invite, reminder or confirmation). Only an explicit rotate:true rotates
  // (revokes all their passes for this poll and mints one new one). Beheer never sends rotate.
  issue(planId,poll,body,createdBy,origin){
   openPoll(poll,body);if(body?.rotate!==undefined&&body.rotate!==true&&body.rotate!==false)fail(400,'recipients','rotate is true of false.');
   const rotate=body?.rotate===true,live=pid=>!!q('SELECT 1 FROM poll_passes WHERE plan_id=? AND poll_id=? AND participant_id=? AND revoked_at IS NULL AND expires_at>? LIMIT 1').get(planId,poll.id,pid,now());
   const {people:all,planned:allPlanned}=recipients(body,{allowNew:true}),existing=v=>store.q.participantByEmail.get(v.email);
   const skipped=rotate?[]:[...all.filter(p=>live(p.participantId)).map(({participantId,email,name})=>({participantId,email,name})),
    ...allPlanned.filter(v=>{const e=existing(v);return e&&live(e.id)}).map(v=>{const e=existing(v);return {participantId:e.id,email:v.email,name:e.name}})];
   const people=all.filter(p=>!skipped.some(s=>s.participantId===p.participantId)),planned=allPlanned.filter(v=>!skipped.some(s=>s.email===v.email));
   q('DELETE FROM poll_passes WHERE expires_at<?').run(new Date(at()-30*86400000).toISOString());
   if(q('SELECT count(*) n FROM poll_passes').get().n+people.length+planned.length>2000)fail(503,'pass_limit','Er zijn te veel links opgeslagen.');
   const expiresAt=passExpiry(poll);
   return store.transaction(()=>{
    // Accounts are created inside the same transaction as the passes: any failure (e.g. an avatar taken) rolls back all.
    const everyone=[...people.map(p=>({...p,created:false})),...planned.map(v=>{const r=accounts.provisionAccount(v);return {participantId:r.participant.id,email:v.email,name:r.participant.name,created:r.created}})];
    return {pollId:poll.id,expiresAt,skipped,passes:everyone.map(p=>{
    q('UPDATE poll_passes SET revoked_at=? WHERE plan_id=? AND poll_id=? AND participant_id=? AND revoked_at IS NULL').run(now(),planId,poll.id,p.participantId);
    const token=randomBytes(32).toString('base64url');
    q('INSERT INTO poll_passes(token_hash,plan_id,poll_id,participant_id,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').run(sha(token),planId,poll.id,p.participantId,createdBy,now(),expiresAt);
    return {...p,token,url:origin+'/filmmaand/wanneer/?pas='+token};
   })};});
  },
  revoke(planId,body){
   if(typeof body?.pollId!=='string')fail(400,'date_poll','Ongeldige datumpoll.');
   const people=recipients(body);let revoked=0;
   for(const p of people)revoked+=Number(q('UPDATE poll_passes SET revoked_at=? WHERE plan_id=? AND poll_id=? AND participant_id=? AND revoked_at IS NULL').run(now(),planId,body.pollId,p.participantId).changes);
   return {pollId:body.pollId,revoked};
  },
  // Never returns tokens or hashes: a lost link is replaced by issuing a new one.
  list(planId,body){
   if(typeof body?.pollId!=='string')fail(400,'date_poll','Ongeldige datumpoll.');
   const rows=q('SELECT x.participant_id,x.created_at,x.expires_at,x.revoked_at,p.email,p.name FROM poll_passes x JOIN participants p ON p.id=x.participant_id WHERE x.plan_id=? AND x.poll_id=? ORDER BY x.rowid').all(planId,body.pollId);
   return {pollId:body.pollId,passes:rows.map(r=>({participantId:r.participant_id,email:r.email,name:r.name,createdAt:r.created_at,expiresAt:r.expires_at,status:r.revoked_at?'revoked':Date.parse(r.expires_at)<=at()?'expired':'active'}))};
  },
  // Who holds a working pass for this poll (not revoked, not expired, still onboarded), one row per person.
  holders(planId,pollId){return q('SELECT x.participant_id participantId,p.email,p.name FROM poll_passes x JOIN participants p ON p.id=x.participant_id WHERE x.plan_id=? AND x.poll_id=? AND x.revoked_at IS NULL AND x.expires_at>? AND p.onboarded=1 GROUP BY x.participant_id ORDER BY MIN(x.rowid)').all(planId,pollId,now());},
  // An extra pass for a reminder mail, minted at delivery so the plaintext only exists in the mail itself. The
  // person's earlier link keeps working (no rotation); revoke-passes/issue-passes still revoke all of them.
  mintExtra(planId,poll,participantId,createdBy){const token=randomBytes(32).toString('base64url');q('INSERT INTO poll_passes(token_hash,plan_id,poll_id,participant_id,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').run(sha(token),planId,poll.id,participantId,createdBy,now(),passExpiry(poll));return token;},
  // Pure read. The current-poll check happens in the planning service against the loaded plan.
  resolve(token,planId){
   if(!isPassToken(token))passInvalid();
   const row=q('SELECT x.*,p.onboarded FROM poll_passes x JOIN participants p ON p.id=x.participant_id WHERE x.token_hash=?').get(sha(token));
   if(!row||row.plan_id!==planId||row.revoked_at||Date.parse(row.expires_at)<=at()||!row.onboarded)passInvalid();
   return {participantId:row.participant_id,pollId:row.poll_id};
  },
 };
}
