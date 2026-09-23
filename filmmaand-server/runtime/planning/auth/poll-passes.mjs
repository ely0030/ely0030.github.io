import {randomBytes,createHash} from 'node:crypto';
// Poll pass: a per-recipient, per-poll bearer that identifies ONE participant for ONE date poll.
// It is never a session. Only its SHA-256 is stored (same house pattern as auth_invites).
// Resolving a pass is a pure read: it never records use, never rate-limits, never consumes, so a
// mail scanner's prefetch cannot change state. Tokens are 256-bit random, so guessing is not a threat
// that needs a (state-writing) rate limit on the read path.
const sha=x=>createHash('sha256').update(x).digest('hex');
const fail=(status,code,message,details)=>{throw Object.assign(Error(message),{status,code,details})};
const normalize=e=>typeof e==='string'?e.trim().toLowerCase():'';
export const PASS_GRACE_MS=24*3600e3;
export const PASS_ACTIONS=['issue-passes','revoke-passes','list-passes','list-availability'];
// Expiry. Auto poll (closes before the first night, then the tick decides): the row expires at closesAt + 24h, as before.
// Manual poll (the organiser picks): valid while the poll is open, then 24h read-only grace after the pick/close (checked
// against the loaded poll by passLive). Its row carries only a hard ceiling: 24h after the last candidate night ends.
const DAY=86400e3;
export const passExpiry=poll=>new Date(poll.pick==='manual'?Date.parse(poll.window.end)+2*DAY:Date.parse(poll.closesAt)+PASS_GRACE_MS).toISOString();
export const passLive=(poll,now)=>poll.pick!=='manual'||poll.status==='open'||(!!poll.closedAt&&Date.parse(now)<Date.parse(poll.closedAt)+PASS_GRACE_MS);
export const isPassToken=t=>typeof t==='string'&&/^[A-Za-z0-9_-]{43}$/.test(t);
// One message for malformed, unknown, revoked, expired, wrong plan and wrong poll: the caller learns nothing about existence.
export const passInvalid=()=>fail(401,'pass_invalid','Deze link werkt niet (meer). Vraag de organisator om een nieuwe link.');
export function createPollPasses({store,now=()=>new Date().toISOString()}){
 const q=sql=>store.db.prepare(sql),at=()=>Date.parse(now());
 function recipients(body){
  const list=body?.emails;
  if(!Array.isArray(list)||!list.length||list.length>50)fail(400,'recipients','Geef 1 tot 50 e-mailadressen op.');
  const emails=[...new Set(list.map(normalize))],unknown=[],notOnboarded=[],people=[];
  for(const email of emails){const p=email&&store.q.participantByEmail.get(email);if(!p)unknown.push(email);else if(!p.onboarded)notOnboarded.push(email);else people.push({participantId:p.id,email,name:p.name});}
  // All-or-nothing: the organiser is told exactly which addresses need fixing, nothing is minted.
  if(unknown.length)fail(404,'recipient_unknown','Niet elk e-mailadres hoort bij een account.',{emails:unknown});
  // An account without name/avatar is not counted by the poll, so a pass for it would be a silent non-vote.
  if(notOnboarded.length)fail(409,'recipient_not_onboarded','Niet elk account heeft al een naam en avatar.',{emails:notOnboarded});
  return people;
 }
 function openPoll(poll,body){
  if(!poll||poll.mode!=='availability'||poll.status!=='open')fail(409,'date_poll_not_open','Er staat geen open beschikbaarheidspoll.');
  if(body?.pollId!==poll.id)fail(409,'date_poll_changed','Deze datumpoll is veranderd.');
  return poll;
 }
 return {
  // Minting for someone who already holds a pass for this poll rotates it: the old link stops working.
  issue(planId,poll,body,createdBy,origin){
   openPoll(poll,body);const people=recipients(body);
   q('DELETE FROM poll_passes WHERE expires_at<?').run(new Date(at()-30*86400000).toISOString());
   if(q('SELECT count(*) n FROM poll_passes').get().n+people.length>2000)fail(503,'pass_limit','Er zijn te veel links opgeslagen.');
   const expiresAt=passExpiry(poll);
   return store.transaction(()=>({pollId:poll.id,expiresAt,passes:people.map(p=>{
    q('UPDATE poll_passes SET revoked_at=? WHERE plan_id=? AND poll_id=? AND participant_id=? AND revoked_at IS NULL').run(now(),planId,poll.id,p.participantId);
    const token=randomBytes(32).toString('base64url');
    q('INSERT INTO poll_passes(token_hash,plan_id,poll_id,participant_id,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?,?)').run(sha(token),planId,poll.id,p.participantId,createdBy,now(),expiresAt);
    return {...p,token,url:origin+'/filmmaand/?pas='+token};
   })}));
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
  // Pure read. The current-poll check happens in the planning service against the loaded plan.
  resolve(token,planId){
   if(!isPassToken(token))passInvalid();
   const row=q('SELECT x.*,p.onboarded FROM poll_passes x JOIN participants p ON p.id=x.participant_id WHERE x.token_hash=?').get(sha(token));
   if(!row||row.plan_id!==planId||row.revoked_at||Date.parse(row.expires_at)<=at()||!row.onboarded)passInvalid();
   return {participantId:row.participant_id,pollId:row.poll_id};
  },
 };
}
