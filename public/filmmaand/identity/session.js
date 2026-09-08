/* Filmmaand session client — the only place the browser talks to /filmmaand/api/auth.
   Cookie transport (fm_session, HttpOnly): fetch() sends it same-origin by default; the proxy must pass Cookie/Set-Cookie.
   localStorage 'filmmaand-identity-design-v1' (+ '-signed-in') is kept as a CACHE of the server profile so the existing
   navbar menu, profile bridge, display-profile sync and Agenda keep reading the same keys. The server is the truth; the
   cache is refreshed on every load and after every change. Nothing here mints identities or writes ballots. */
(()=>{'use strict';if(window.filmmaandSession)return;
const key='filmmaand-identity-design-v1',authKey='filmmaand-auth-v1',pickerIdentityKey='filmmaand-checkin-v1:/filmmaand/api:home-picker-lab:identity',claimKey='filmmaand-identity-claim-v1',planId='home-picker-lab',base='/filmmaand/api/auth/';
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}},write=(k,v)=>{try{v===null?localStorage.removeItem(k):localStorage.setItem(k,typeof v==='string'?v:JSON.stringify(v))}catch{}};
let participant=null,refreshed=null,passwordsEnabled=false;let methods=null;
const toCache=p=>p?.onboarded?{name:p.profile.name,avatar:p.profile.avatarId,animal:p.profile.animal||'',age:p.profile.age??'',food:p.profile.food||'',genre:p.profile.genre||'',favouriteFilm:p.profile.film||'',revision:p.profile.revision}:null;
// Monotonic: a slower, stale response can never revert a newer profile revision.
function remember(p,{announce=false}={}){if(p){write(key+'-expired',null);write(authKey,'account')}else write(authKey,null);const known=Math.max(participant&&p&&p.id===participant.id?(participant.profile?.revision??0):0,read(key)?.revision??0);if(p&&p.onboarded&&(p.profile?.revision??0)<known&&(!participant||p.id===participant.id))return false;participant=p||null;write(key,toCache(participant));write(key+'-signed-in',participant?'true':'false');window.dispatchEvent(new CustomEvent('filmmaand-session',{detail:{participant}}));if(announce){window.dispatchEvent(new Event('filmmaand-profile-changed'));window.dispatchEvent(new Event('filmmaand-display-profile-synced'))}return true}
// Another tab or the header iframe saved: adopt the cache and tell this page's surfaces, without any network round trip.
window.addEventListener('storage',e=>{if(window.filmmaandResetGuard?.blocked)return;if(e.key!==key&&e.key!==key+'-signed-in')return;const cache=read(key),on=localStorage.getItem(key+'-signed-in')==='true';const revision=cache?.revision??0;if(!on){if(participant){participant=null;window.dispatchEvent(new CustomEvent('filmmaand-session',{detail:{participant:null}}));window.dispatchEvent(new Event('filmmaand-profile-changed'))}return}if(cache&&(!participant||revision>(participant.profile?.revision??0))){participant={...(participant||{}),onboarded:true,profile:{revision,name:cache.name,avatarId:cache.avatar,animal:cache.animal,age:cache.age===''?null:cache.age,food:cache.food,genre:cache.genre,film:cache.favouriteFilm}};window.dispatchEvent(new CustomEvent('filmmaand-session',{detail:{participant}}));window.dispatchEvent(new Event('filmmaand-profile-changed'));window.dispatchEvent(new Event('filmmaand-display-profile-synced'))}});
async function api(path,{method='GET',body,key:idempotencyKey,headers:extraHeaders={}}={}){if(path!=='logout')await window.filmmaandResetGuard.ready;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(base+path,{method,cache:'no-store',credentials:'same-origin',signal:controller.signal,headers:{...extraHeaders,...(body!==undefined?{'Content-Type':'application/json'}:{}),...(idempotencyKey?{'Idempotency-Key':idempotencyKey}:{})},body:body===undefined?undefined:JSON.stringify(body)});const text=await r.text();let data=null;try{data=text?JSON.parse(text):null}catch{}
 if(!r.ok){const e=Object.assign(new Error(data?.error?.message||'Er ging iets mis. Probeer het opnieuw.'),{status:r.status,code:data?.error?.code||'http_'+r.status,details:data?.error?.details||{}});if(e.details.clear){if(participant||localStorage.getItem(authKey)==='account')write(key+'-expired','true');remember(null)}throw e}return data}catch(e){if(e.name==='AbortError')throw Object.assign(new Error('De verbinding duurde te lang. Probeer het opnieuw.'),{status:0,code:'timeout',details:{}});throw e}finally{clearTimeout(timer)}}
// Claim the browser-held anonymous picker key into the account, exactly once, with a persisted idempotency key so a retry
// after a lost response replays instead of re-running. Only the key already in this browser is ever offered.
async function claimPicker(){if(!participant?.onboarded)return null;const anonymousBearer=read(pickerIdentityKey);if(!/^[A-Za-z0-9_-]{43}$/.test(anonymousBearer||''))return null;let receipt=read(claimKey);if(!receipt||receipt.anonymousBearer!==anonymousBearer)receipt={key:crypto.randomUUID(),anonymousBearer,planId};write(claimKey,receipt);
 try{const result=await api('claim',{method:'POST',key:receipt.key,body:{planId:receipt.planId,anonymousBearer:receipt.anonymousBearer}});write(claimKey,null);window.dispatchEvent(new Event('filmmaand-profile-changed'));window.dispatchEvent(new Event('filmmaand-display-profile-synced'));return result}catch(e){if(e.status>=400&&e.status<500&&e.code!=='rate_limited')write(claimKey,null);if(e.code==='claim_conflict'||e.code==='already_claimed')return {claimed:false,already:false,refused:e.code,message:e.message};throw e}}
const session={
 get participant(){return participant},
 get passwordsEnabled(){return passwordsEnabled},
 // 200 {participant:null} while this browser holds the server-written 'account' marker means a validated session was lost
 // (cookie expired, or cleared by an earlier 401 on another request): that is an expiry, never a return to anonymous.
 refresh(){refreshed=api('session').then(d=>{if(!d.participant&&localStorage.getItem(authKey)==='account')write(key+'-expired','true');remember(d.participant);return participant}).catch(e=>{if(e.status===401||e.details?.clear)remember(null);else if(e.status===404)participant=null;else if(e.status===0||e.status>=500)participant=localStorage.getItem(authKey)==='account'&&read(key)?{cached:true,onboarded:true,profile:{...read(key),avatarId:read(key).avatar,film:read(key).favouriteFilm}}:null;return participant});return refreshed},
 ready(){methods||=api('methods').then(d=>{passwordsEnabled=d.passwordsEnabled===true}).catch(()=>{passwordsEnabled=false});return Promise.all([refreshed||session.refresh(),methods]).then(([p])=>{let pending=null;try{pending=JSON.parse(sessionStorage.getItem('filmmaand-onboarding-just-completed')||'null');sessionStorage.removeItem('filmmaand-onboarding-just-completed')}catch{}if(pending?.completed&&p?.onboarded)setTimeout(()=>window.dispatchEvent(new CustomEvent('filmmaand-onboarding-complete',{detail:{claim:pending.claim||{status:'none'},participant:{onboarded:true,name:p.profile.name,avatarId:p.profile.avatarId}}})),0);return p})},
 passwordStatus:()=>api('password/status'),
 async loginPassword(email,password){const d=await api('password/login',{method:'POST',body:{email,password}});remember(d.participant);return participant},
 async redeemInvite(email,inviteToken,password){const d=await api('invite/redeem',{method:'POST',body:{email,inviteToken,password}});remember(d.participant);return participant},
 async setPassword(body){const d=await api('password/set',{method:'POST',body});remember(d.participant);return participant},
 organizer:()=>api('../organizer'),
 recoveryAccount:email=>api('../organizer/account?email='+encodeURIComponent(email)),
 issueInvite:body=>api('../organizer/invites',{method:'POST',body,headers:{'X-Filmmaand-Organizer-Id':participant?.id||''}}),
 revokeInvite:inviteToken=>api('../organizer/invites/revoke',{method:'POST',body:{inviteToken},headers:{'X-Filmmaand-Organizer-Id':participant?.id||''}}),
 requestCode:email=>api('code',{method:'POST',body:{email}}),
 async verify(challengeId,code){const d=await api('verify',{method:'POST',body:{challengeId,code}});remember(d.participant);return participant},
 avatars:()=>api('avatars'),
 profile:()=>api('profile'),
 async saveProfile(body){const d=await api('profile',{method:'PUT',key:crypto.randomUUID(),body});remember({...participant,onboarded:d.profile.onboarded,profile:d.profile},{announce:true});return d.profile},
 async logout(){try{await api('logout',{method:'POST'})}catch{}remember(null,{announce:true})},
 claimPicker,
 signedIn:()=>Boolean(participant),
 expired:()=>localStorage.getItem(key+'-expired')==='true',
 // 'account' = server-validated session in this browser; 'expired' = a real 401 ended one; 'anonymous' = never authenticated here.
 authMode:()=>participant?'account':localStorage.getItem(key+'-expired')==='true'?'expired':localStorage.getItem(authKey)==='account'?'account':'anonymous',
 onboarded:()=>Boolean(participant?.onboarded)
};
window.filmmaandSession=session;
})();
