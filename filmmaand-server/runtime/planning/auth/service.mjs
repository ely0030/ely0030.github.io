import {createHash,randomBytes,randomInt,timingSafeEqual} from 'node:crypto';
import {isUniqueViolation} from './store.mjs';
import {renderCodeMail} from './mailer.mjs';
const fail=(status,code,message,details)=>{throw Object.assign(new Error(message),{status,code,details})};
const hash=x=>createHash('sha256').update(x).digest('hex');
// Credential namespaces are disjoint on purpose (see credentials.mjs): a session token can never be read as an anonymous
// bearer or vice versa, and an invalid session is a 401, never a fallback into a fresh anonymous identity.
import {SESSION_PREFIX,isSessionToken,isAnonymousBearer,participantActor,isParticipantActor} from './credentials.mjs';
export {SESSION_PREFIX,isSessionToken,isAnonymousBearer,participantActor,isParticipantActor};
export const GENRES=['action','animation','comedy','crime','documentary','drama','fantasy','horror','romance','science-fiction','thriller','western','other'];
const plain=(s,max)=>typeof s==='string'&&s.length<=max&&!/[<>\x00-\x1f]/.test(s);
const emailOk=e=>typeof e==='string'&&e.length<=254&&/^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]+$/.test(e);
const normalizeEmail=e=>typeof e==='string'?e.trim().toLowerCase():'';
const b64=n=>randomBytes(n).toString('base64url');
export function createAuthService({store,mailer,avatars,now=()=>new Date().toISOString(),config={}}){
 const cfg={codeLength:6,codeTtlSeconds:600,maxAttempts:5,resendAfterSeconds:60,perEmail:{limit:5,windowSeconds:3600},perIp:{limit:20,windowSeconds:900},verifyPerIp:{limit:30,windowSeconds:300},sessionTtlDays:180,sessionTouchSeconds:3600,allowList:null,...config};
 const known=new Map(avatars.map(a=>[a.id,a])),active=new Set(avatars.filter(a=>a.active).map(a=>a.id));
 const ms=()=>Date.parse(now()),iso=t=>new Date(t).toISOString();
 const profileOf=r=>({revision:r.profile_revision,onboarded:Boolean(r.onboarded),name:r.name??null,avatarId:r.avatar_id??null,animal:r.animal??null,age:r.age??null,food:r.food??null,genre:r.genre??null,film:r.film??null});
 const participantView=r=>({id:r.id,email:r.email,onboarded:Boolean(r.onboarded),profile:profileOf(r)});
 const limit=(key,{limit,windowSeconds})=>{const r=store.rateLimit(key,limit,windowSeconds,ms());if(!r.allowed)fail(429,'rate_limited','Te veel pogingen. Probeer het later opnieuw.',{retryAfterSeconds:r.retryAfterSeconds})};
 const client=c=>({ip:c?.ip||'unknown',agent:(c?.userAgent||'').slice(0,200)});
 function receipt(scope,key,payload,run){if(!/^[A-Za-z0-9_-]{16,100}$/.test(key||''))fail(400,'request_key','Een verzoekcode ontbreekt.');const fingerprint=hash(JSON.stringify(payload));const prior=store.q.receiptGet.get(scope,key);if(prior){if(prior.fingerprint!==fingerprint)fail(409,'key_reused','Deze verzoekcode hoort bij andere gegevens.');return JSON.parse(prior.result)}if(store.q.receiptCount.get(scope).n>=500)fail(503,'receipt_limit','Te veel verzoeken voor dit account.');const result=run();store.q.receiptPut.run(scope,key,fingerprint,JSON.stringify(result),now());return result}
 function participant(id){const r=store.q.participantById.get(id);if(!r)fail(401,'session_invalid','Log opnieuw in.',{clear:true});return r}
 function availability(pid){const owners=new Map(store.q.takenAvatars.all().map(r=>[r.avatar_id,r]));return avatars.map(a=>{const o=owners.get(a.id);return {id:a.id,label:a.label,active:a.active,available:a.active&&!o,mine:o?.id===pid,owner:o?o.name:null}})}
 function validateProfile(b,current){
  if(!b||!plain(b.name,32)||!b.name.trim())fail(400,'name','Vul een naam in van maximaal 32 tekens.');
  if(!plain(b.animal,60)||!b.animal.trim())fail(400,'animal','Vul je favoriete dier in.');
  const age=b.age===undefined||b.age===null||b.age===''?null:b.age;if(age!==null&&(!Number.isInteger(age)||age<0||age>130))fail(400,'age','Vul een geldige leeftijd in.');
  for(const [f,max] of [['food',60],['film',120]])if(b[f]!==undefined&&b[f]!==null&&!plain(b[f],max))fail(400,f,'Gebruik maximaal '+max+' tekens zonder opmaak.');
  const genre=b.genre?String(b.genre):null;if(genre&&!GENRES.includes(genre))fail(400,'genre','Kies een genre uit de lijst.');
  return {name:b.name.trim(),avatarId:validateAvatar(b.avatarId,current),animal:b.animal.trim(),age,food:(b.food||'').trim()||null,genre,film:(b.film||'').trim()||null};
 }
 function validateAvatar(id,current){if(!Number.isInteger(id)||!known.has(id))fail(400,'avatar','Kies een avatar uit de collectie.');if(!active.has(id)&&id!==current)fail(400,'avatar_inactive','Deze avatar is niet meer beschikbaar.');return id}
 function swap(run,pid,previous){try{const r=run();if(r.changes!==1)fail(409,'conflict','Je profiel is elders gewijzigd.',{profile:profileOf(participant(pid))});}catch(e){if(isUniqueViolation(e))fail(409,'avatar_taken','Deze avatar is net door iemand anders gekozen.',{profile:previous,avatars:availability(pid)});throw e}}
 return {
  config:cfg,
  async requestCode({email,client:c}={}){const address=normalizeEmail(email),cl=client(c);if(!emailOk(address))fail(400,'email','Vul een geldig e-mailadres in.');limit('code:ip:'+cl.ip,cfg.perIp);const expiresAt=iso(ms()+cfg.codeTtlSeconds*1000),challengeId=b64(16);
   // Guest list: an address outside it gets the same answer and no e-mail, so nothing leaks about who is invited.
   if(cfg.allowList&&!cfg.allowList.has(address))return {challengeId,expiresAt,resendAfter:cfg.resendAfterSeconds};
   limit('code:email:'+address,cfg.perEmail);limit('code:email:min:'+address,{limit:1,windowSeconds:cfg.resendAfterSeconds});
   const code=String(randomInt(0,10**cfg.codeLength)).padStart(cfg.codeLength,'0');
   store.transaction(()=>{store.q.expireOpenCodes.run(now(),address,challengeId);store.q.insertCode.run(challengeId,address,hash(challengeId+':'+code),now(),expiresAt,cl.ip)});
   try{await mailer.send({to:address,...renderCodeMail({code,expiresMinutes:Math.round(cfg.codeTtlSeconds/60)}),code})}catch(e){store.q.consumeCode.run(now(),challengeId);if(e.status)throw e;fail(503,'mail_unavailable','De e-mail kon niet worden verzonden.')}
   return {challengeId,expiresAt,resendAfter:cfg.resendAfterSeconds}},
  async verifyCode({challengeId,code,client:c,sessionToken}={}){const cl=client(c);limit('verify:ip:'+cl.ip,cfg.verifyPerIp);
   if(typeof challengeId!=='string'||!/^[A-Za-z0-9_-]{22}$/.test(challengeId)||typeof code!=='string'||!new RegExp('^\\d{'+cfg.codeLength+'}$').test(code))fail(400,'invalid_code','Deze code klopt niet.');
   const row=store.q.codeById.get(challengeId);if(!row)fail(400,'invalid_code','Deze code klopt niet.');
   if(row.consumed_at||Date.parse(row.expires_at)<=ms())fail(410,'code_expired','Deze code is verlopen. Vraag een nieuwe aan.');
   const attempts=store.q.bumpAttempts.get(challengeId).attempts;
   if(attempts>cfg.maxAttempts){store.q.consumeCode.run(now(),challengeId);fail(410,'code_expired','Te vaak geprobeerd. Vraag een nieuwe code aan.')}
   if(!timingSafeEqual(Buffer.from(hash(challengeId+':'+code)),Buffer.from(row.code_hash)))fail(400,'invalid_code','Deze code klopt niet.',{attemptsLeft:cfg.maxAttempts-attempts});
   const existing=store.q.participantByEmail.get(row.email);
   const ownership=existing&&store.db.prepare('SELECT verified_at FROM email_ownership WHERE participant_id=?').get(existing.id);
   if(ownership&&!ownership.verified_at){
    let current=null;try{current=this.authenticate(sessionToken)}catch{}
    if(!current||current.participantId!==existing.id)fail(409,'email_binding_required','Log eerst in met je wachtwoord en bevestig daarna je e-mailadres. Bij een verkeerd adres helpt de organisator je verder.');
   }
   const token=SESSION_PREFIX+b64(32);
   const p=store.transaction(()=>{if(store.q.consumeCode.run(now(),challengeId).changes!==1)fail(410,'code_expired','Deze code is al gebruikt.');let p=store.q.participantByEmail.get(row.email);if(!p){store.q.insertParticipant.run('u_'+b64(12),row.email,now());p=store.q.participantByEmail.get(row.email)}store.q.insertSession.run(hash(token),p.id,now(),iso(ms()+cfg.sessionTtlDays*864e5),now(),cl.agent);return p});
   store.db.prepare('UPDATE email_ownership SET verified_at=? WHERE participant_id=?').run(now(),p.id);store.db.prepare('INSERT INTO session_security(token_hash,method,authenticated_at) VALUES(?,?,?)').run(hash(token),'code',now());
   return {token,participant:participantView(p)}},
  issueSession(pid,method){const p=participant(pid),token=SESSION_PREFIX+b64(32);store.q.insertSession.run(hash(token),pid,now(),iso(ms()+cfg.sessionTtlDays*864e5),now(),'');store.db.prepare('INSERT INTO session_security(token_hash,method,authenticated_at) VALUES(?,?,?)').run(hash(token),method,now());return {token,participant:participantView(p)}},
  // Every presented session credential is authoritative: unknown, revoked or expired → 401 with clear:true. Never anonymous.
  authenticate(token){if(!isSessionToken(token))fail(401,'session_invalid','Log opnieuw in.',{clear:true});const s=store.q.sessionByHash.get(hash(token));if(!s||s.revoked_at||Date.parse(s.expires_at)<=ms())fail(401,'session_invalid','Je sessie is verlopen. Log opnieuw in.',{clear:true});if(ms()-Date.parse(s.last_seen_at)>cfg.sessionTouchSeconds*1000)store.q.touchSession.run(now(),iso(ms()+cfg.sessionTtlDays*864e5),s.token_hash);return {participantId:s.participant_id,email:s.email,onboarded:Boolean(s.onboarded),tokenHash:s.token_hash}},
  resolveActor(token){return isSessionToken(token)?participantActor(this.authenticate(token).participantId):null},
  publicProfile(actor){if(!isParticipantActor(actor))return null;const r=store.q.participantById.get(actor.slice(2));return r&&r.onboarded?{name:r.name,avatarId:r.avatar_id}:null},
  session(token){const {participantId}=this.authenticate(token);return {participant:participantView(participant(participantId))}},
  logout(token){if(isSessionToken(token))store.q.revokeSession.run(now(),hash(token));return {ok:true}},
  logoutEverywhere(token){const {participantId}=this.authenticate(token);store.q.revokeAllSessions.run(now(),participantId);return {ok:true}},
  getProfile(token){const {participantId}=this.authenticate(token);return {profile:profileOf(participant(participantId)),avatars:availability(participantId)}},
  avatars(token){let pid=null;if(token){pid=this.authenticate(token).participantId}return {avatars:availability(pid)}},
  // One UPDATE guarded by UNIQUE(avatar_id) and the expected revision: claim-new + release-old is atomic, a taken avatar
  // rolls the whole statement back (old avatar and profile untouched), a stale device gets 409 with the current profile.
  updateProfile(token,key,b){const {participantId:pid}=this.authenticate(token);return receipt('profile:'+pid,key,{operation:'profile',body:b},()=>{const current=participant(pid),previous=profileOf(current);if(!b||b.expectedRevision!==previous.revision)fail(409,'conflict','Je profiel is elders gewijzigd.',{profile:previous});
   const avatarOnly=Object.keys(b).every(k=>k==='expectedRevision'||k==='avatarId');
   if(avatarOnly){if(!current.onboarded)fail(400,'profile','Vul eerst je gegevens in.');const avatarId=validateAvatar(b.avatarId,current.avatar_id);swap(()=>store.q.updateAvatar.run(avatarId,now(),pid,previous.revision),pid,previous)}
   else{const v=validateProfile(b,current.avatar_id);swap(()=>store.q.updateProfile.run(v.name,v.avatarId,v.animal,v.age,v.food,v.genre,v.film,now(),pid,previous.revision),pid,previous)}
   return {profile:profileOf(participant(pid))}})},
  // Claim orchestration. Sidecar claims row = lock/index (pending → done); the plan document CAS is the authority.
  async claimAnonymous({token,planId,anonymousBearer,key,transfer}){const {participantId:pid,onboarded}=this.authenticate(token);if(!onboarded)fail(409,'onboarding_required','Kies eerst je naam en avatar.');if(typeof planId!=='string'||!/^[a-z0-9-]+$/.test(planId))fail(400,'plan','Ongeldige planning.');if(!isAnonymousBearer(anonymousBearer))fail(400,'anonymous_bearer','Geen geldige browsersleutel.');
   const from=hash(anonymousBearer),to=participantActor(pid),scope='claim:'+pid;if(!/^[A-Za-z0-9_-]{16,100}$/.test(key||''))fail(400,'request_key','Een verzoekcode ontbreekt.');
   const fingerprint=hash(JSON.stringify({planId,from}));const prior=store.q.receiptGet.get(scope,key);if(prior){if(prior.fingerprint!==fingerprint)fail(409,'key_reused','Deze verzoekcode hoort bij andere gegevens.');return JSON.parse(prior.result)}
   let existing=store.q.claimGet.get(planId,from);
   if(existing&&existing.participant_id!==pid){
    // The document is the authority. A 'pending' row from another account whose transfer never committed is a stale lock,
    // not a claim: the rightful participant takes it over. A committed claim (row done, or document says so) stays refused.
    const committed=existing.status==='done'||(await transfer.claimedBy?.(planId,from))!==null;
    if(committed)fail(409,'already_claimed','Deze browsersleutel is al aan een ander account gekoppeld.');
    store.q.claimTakeover.run(pid,key,now(),planId,from,'pending');existing=store.q.claimGet.get(planId,from);if(existing.participant_id!==pid)fail(409,'already_claimed','Deze browsersleutel is al aan een ander account gekoppeld.');}
   if(!existing){const mine=store.q.claimByParticipant.get(planId,pid);if(mine&&mine.anonymous_actor!==from)fail(409,'claim_conflict','Dit account heeft al eerdere keuzes overgezet.');try{store.q.claimInsert.run(planId,from,pid,key,'pending',now())}catch(e){if(isUniqueViolation(e))fail(409,'already_claimed','Deze browsersleutel is al aan een ander account gekoppeld.');throw e}}
   let result;try{result=await transfer(planId,from,to,key)}catch(e){if(e.status===409||e.status===404||e.status===400)store.q.claimDelete.run(planId,from,'pending');throw e}
   store.q.claimComplete.run('done',now(),planId,from);const out={claimed:!result.already,already:result.already,moved:result.moved,planId};store.q.receiptPut.run(scope,key,fingerprint,JSON.stringify(out),now());return out},
 }
}
