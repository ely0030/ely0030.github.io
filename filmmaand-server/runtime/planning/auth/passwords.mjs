import {randomBytes,createHash,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
const derive=promisify(scrypt),sha=x=>createHash('sha256').update(x).digest('hex');
const fail=(status,code,message)=>{throw Object.assign(Error(message),{status,code})};
const normalize=e=>typeof e==='string'?e.trim().toLowerCase():'';
const emailOk=e=>e.length<=254&&/^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[^\s@<>()[\],;:"]+$/.test(e);
const params={N:131072,r:8,p:1,maxmem:256*1024*1024};
const dummy='scrypt1$'+Buffer.alloc(16,7).toString('hex')+'$'+Buffer.alloc(64,3).toString('hex');
export function validatePassword(value){
 if(typeof value!=='string'||Array.from(value).length<15||Array.from(value).length>128||Buffer.byteLength(value)>512||/\u0000/.test(value))fail(400,'password_policy','Gebruik een wachtwoord van 15 tot 128 tekens.');
 const common=new Set(['passwordpassword','password123456789','123456789012345','1234567890123456','wachtwoord123456','qwertyuiopasdfgh']);
 if(common.has(value.toLowerCase())||/^(.)\1+$/.test(value))fail(400,'password_policy','Kies een minder voorspelbaar wachtwoord.');
 return value;
}
export async function hashPassword(value){validatePassword(value);const salt=randomBytes(16).toString('hex');return 'scrypt1$'+salt+'$'+Buffer.from(await derive(value,salt,64,params)).toString('hex');}
export async function verifyPassword(value,encoded){
 const valid=typeof encoded==='string'&&/^scrypt1\$[a-f0-9]{32}\$[a-f0-9]{128}$/.test(encoded);
 const [,salt,expected]=(valid?encoded:dummy).split('$');
 const input=typeof value==='string'&&Buffer.byteLength(value)<=512?value:'';
 const actual=Buffer.from(await derive(input,salt,64,params));return timingSafeEqual(actual,Buffer.from(expected,'hex'))&&valid;
}
// One cache per admitted HTTP request, never persisted. CAS retries reuse expensive work.
export function passwordWork(){const values=new Map();let sealed=false;const missing=()=>fail(409,'credential_changed','Je inloggegevens zijn gewijzigd. Probeer opnieuw.');return {seal(){sealed=true},hash(value){const key='hash';if(!values.has(key)){if(sealed)missing();values.set(key,hashPassword(value))}return values.get(key)},verify(value,encoded){const key=sha(JSON.stringify([value,encoded]));if(!values.has(key)){if(sealed)missing();values.set(key,verifyPassword(value,encoded))}return values.get(key)}};}
export function admitPasswordAttempt(c,{email,ip,now}){
 const active=(c.state.passwordWorkLeases||[]).filter(x=>Date.parse(x.expiresAt)>Date.parse(now));if(active.length>=2)throw Object.assign(Error('Inloggen is even druk. Probeer over een paar seconden opnieuw.'),{status:429,code:'rate_limited',details:{retryAfterSeconds:5}});
 for(const [key,limit,seconds]of [['pw:global',100,300],['pw:ip:'+ip,30,900],['pw:email:'+sha(normalize(email)),10,900]]){
  const result=c.authStore.rateLimit(key,limit,seconds,Date.parse(now));if(!result.allowed)throw Object.assign(Error('Te veel pogingen. Probeer later opnieuw.'),{status:429,code:'rate_limited',details:{retryAfterSeconds:result.retryAfterSeconds}});
 }
 const id=randomBytes(16).toString('hex');c.state.passwordWorkLeases=[...active,{id,expiresAt:new Date(Date.parse(now)+120000).toISOString()}];return id;
}
export function createPasswords({store,auth,now=()=>new Date().toISOString(),work=passwordWork()}){
 const q=sql=>store.db.prepare(sql),at=()=>Date.parse(now());
 const credential=pid=>q('SELECT * FROM password_credentials WHERE participant_id=?').get(pid);
 const person=email=>store.q.participantByEmail.get(normalize(email));
 const invalid=()=>fail(401,'password_invalid','E-mailadres of wachtwoord klopt niet. Je kunt ook een e-mailcode aanvragen.');
 function replace(pid,passwordHash,expectedRevision){
  const old=credential(pid);if((old?.revision||0)!==expectedRevision)fail(409,'credential_changed','Je inloggegevens zijn gewijzigd. Log opnieuw in.');
  q('INSERT INTO password_credentials(participant_id,password_hash,revision,updated_at) VALUES(?,?,?,?) ON CONFLICT(participant_id) DO UPDATE SET password_hash=excluded.password_hash,revision=excluded.revision,updated_at=excluded.updated_at').run(pid,passwordHash,expectedRevision+1,now());
  store.q.revokeAllSessions.run(now(),pid);
  const p=store.q.participantById.get(pid);store.q.expireOpenCodes.run(now(),p.email,'');
  q('UPDATE auth_invites SET consumed_at=? WHERE participant_id=? AND consumed_at IS NULL').run(now(),pid);
  return auth.issueSession(pid,'password');
 }
 return {
  async login(body){
   const p=person(body?.email),row=p&&credential(p.id);
   const correct=await work.verify(body?.password,row?.password_hash);
   if(!correct||!p)invalid();
   return auth.issueSession(p.id,'password');
  },
  issue(body,organizerId){
   const email=normalize(body?.email);if(!emailOk(email))fail(400,'email','Vul een geldig e-mailadres in.');
   const kind=body?.kind||'signup';if(kind!=='signup')fail(400,'invite_kind','Ongeldige uitnodiging.');
   const existing=person(email);
   if(kind==='signup'&&existing)fail(409,'invite_collision','Dit e-mailadres hoort al bij een account. Log in op je bestaande account.');
   const rate=store.rateLimit('invite:organizer:'+organizerId,20,3600,at());if(!rate.allowed)fail(429,'rate_limited','Te veel uitnodigingen. Probeer later opnieuw.');
   q('DELETE FROM auth_invites WHERE expires_at<?').run(new Date(at()-30*86400000).toISOString());if(q('SELECT count(*) n FROM auth_invites').get().n>=2000)fail(503,'invite_limit','Er zijn te veel uitnodigingen opgeslagen.');
   const token=randomBytes(32).toString('base64url'),expiresAt=new Date(at()+86400000).toISOString();
   q('UPDATE auth_invites SET consumed_at=? WHERE email=? AND consumed_at IS NULL').run(now(),email);
   q('INSERT INTO auth_invites(token_hash,email,kind,participant_id,credential_revision,created_by,created_at,expires_at) VALUES(?,?,?,?,?,?,?,?)').run(sha(token),email,kind,existing?.id||null,existing?credential(existing.id)?.revision||0:0,organizerId,now(),expiresAt);
   return {inviteToken:token,email,kind,expiresAt};
  },
  revoke(body){if(typeof body?.inviteToken!=='string')fail(400,'invite_invalid','Ongeldige uitnodiging.');q('UPDATE auth_invites SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL').run(now(),sha(body.inviteToken));return {ok:true};},
  async redeem(body){
   validatePassword(body?.password);
   const token=body?.inviteToken;if(typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))fail(400,'invite_invalid','Deze uitnodiging is ongeldig of verlopen.');
   const row=q('SELECT * FROM auth_invites WHERE token_hash=?').get(sha(token));
   if(!row||row.consumed_at||Date.parse(row.expires_at)<=at()||normalize(body.email)!==row.email)fail(400,'invite_invalid','Deze uitnodiging is ongeldig of verlopen.');
   if(row.kind!=='signup')fail(403,'recovery_disabled','Herstel door de organisator is niet beschikbaar.');
   let p=person(row.email);
   if(row.kind==='signup'&&p)fail(409,'invite_collision','Dit e-mailadres hoort inmiddels bij een account. Log in of neem contact op met de organisator.');
   const hashed=await work.hash(body.password);
   return store.transaction(()=>{
    if(Date.parse(row.expires_at)<=at())fail(400,'invite_invalid','Deze uitnodiging is ongeldig of verlopen.');
    if(q('UPDATE auth_invites SET consumed_at=? WHERE token_hash=? AND consumed_at IS NULL').run(now(),sha(token)).changes!==1)fail(409,'invite_used','Deze uitnodiging is al gebruikt.');
    if(!p){const id='u_'+randomBytes(12).toString('base64url');store.q.insertParticipant.run(id,row.email,now());q('INSERT INTO email_ownership(participant_id,verified_at) VALUES(?,NULL)').run(id);p=store.q.participantById.get(id);}
    return replace(p.id,hashed,row.credential_revision);
   });
  },
  async set(token,body){
   const a=auth.authenticate(token),old=credential(a.participantId),proof=q('SELECT * FROM session_security WHERE token_hash=?').get(a.tokenHash);
   const freshCode=proof?.method==='code'&&at()-Date.parse(proof.authenticated_at)<=600000;
   if(!freshCode&&!(old&&await work.verify(body?.currentPassword,old.password_hash)))fail(403,'reauth_required','Bevestig eerst je huidige wachtwoord of log opnieuw in met een e-mailcode.');
   validatePassword(body?.password);if(!Number.isInteger(body?.expectedRevision)||(old?.revision||0)!==body.expectedRevision)fail(409,'credential_changed','Je inloggegevens zijn gewijzigd. Vernieuw je account.');
   const hashed=await work.hash(body.password);return store.transaction(()=>{auth.authenticate(token);if(freshCode&&at()-Date.parse(proof.authenticated_at)>600000)fail(403,'reauth_required','Bevestig je identiteit opnieuw.');return replace(a.participantId,hashed,body.expectedRevision)});
  },
  status(token){const a=auth.authenticate(token),row=credential(a.participantId),ownership=q('SELECT verified_at FROM email_ownership WHERE participant_id=?').get(a.participantId);const proof=q('SELECT method,authenticated_at FROM session_security WHERE token_hash=?').get(a.tokenHash);return {hasPassword:Boolean(row),credentialRevision:row?.revision||0,emailVerified:!ownership||Boolean(ownership.verified_at),recentCodeProof:proof?.method==='code'&&at()-Date.parse(proof.authenticated_at)<=600000};},
 };
}
