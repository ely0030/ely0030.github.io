import {isSessionToken} from './credentials.mjs';
const fail=(status,code,message,details)=>{throw Object.assign(new Error(message),{status,code,details})};
const loopback=ip=>ip==='127.0.0.1'||ip==='::1'||ip==='::ffff:127.0.0.1';
// Preserve the first same-name cookie: browsers send a more specific path before its legacy root match.
// Never retry another cookie when that selected session is invalid.
export function parseCookies(header){const out={};for(const part of (header||'').split(';')){const i=part.indexOf('=');if(i<0)continue;const k=part.slice(0,i).trim(),v=part.slice(i+1).trim();if(k&&!Object.hasOwn(out,k))out[k]=decodeURIComponent(v)}return out}
// HTTP edge for the auth service. Two transports, two CSRF policies:
//  cookie  — fm_session HttpOnly SameSite=Lax (+Secure when configured). Every non-GET request authenticated by cookie must
//            prove same-origin: Sec-Fetch-Site ∈ {same-origin, none} or an allow-listed Origin. Missing headers FAIL CLOSED.
//  bearer  — Authorization: Bearer fms_… for explicit API/test clients; cannot be sent cross-site by a browser form, so no CSRF check.
// Client IP is the socket peer unless trustProxy is on AND the peer is loopback, in which case the first X-Forwarded-For hop counts.
// devOutbox (optional): (email)=>lastMessage|null. Only wired when the DEV mailer is active AND AUTH_DEV_INBOX=1 — it exposes
// the last code written to the local outbox so the flow can be exercised without a mail provider. Never available with Resend.
export function createAuthRouter({auth,transfer,origins=[],cookie={},trustProxy=false,devOutbox=null}){
 const jar={name:'fm_session',secure:false,maxAgeSeconds:180*86400,...cookie};
 const setCookie=token=>`${jar.name}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${jar.maxAgeSeconds}${jar.secure?'; Secure':''}`;
 const clearCookie=()=>`${jar.name}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${jar.secure?'; Secure':''}`;
 function client(req){const peer=req.socket?.remoteAddress||'unknown';const xff=req.headers['x-forwarded-for'];const ip=trustProxy&&loopback(peer)&&xff?String(xff).split(',')[0].trim()||peer:peer;return {ip,userAgent:req.headers['user-agent']||''}}
 function credential(req){const bearer=(req.headers.authorization||'').replace(/^Bearer /,'');if(isSessionToken(bearer))return {token:bearer,transport:'bearer'};const c=parseCookies(req.headers.cookie)[jar.name];if(c)return {token:c,transport:'cookie'};return null}
 function csrf(req){const site=req.headers['sec-fetch-site'],origin=req.headers.origin;if(site==='same-origin'||site==='none')return;if(origin&&origins.includes(origin))return;fail(403,'csrf','Dit verzoek kwam niet van de site zelf.')}
 async function handle(req,{path,method,body,headers,send}){
  const sub=path.slice('/api/auth/'.length),cred=credential(req),cl=client(req),key=req.headers['idempotency-key'];
  const needToken=()=>{if(!cred)fail(401,'session_invalid','Log eerst in.',{clear:true});return cred.token};
  const mutation=method!=='GET';if(mutation&&cred?.transport==='cookie')csrf(req);
  try{
   if(sub==='code'&&method==='POST')return send(200,await auth.requestCode({email:body?.email,client:cl}));
   if(sub==='verify'&&method==='POST'){const {token,participant}=await auth.verifyCode({challengeId:body?.challengeId,code:body?.code,client:cl,sessionToken:cred?.token});if(body?.transport==='bearer')return send(200,{participant,sessionToken:token});headers['Set-Cookie']=setCookie(token);return send(200,{participant})}
   if(sub==='session'&&method==='GET'){if(!cred)return send(200,{participant:null});return send(200,auth.session(cred.token))}
   if((sub==='logout'&&method==='POST')||(sub==='session'&&method==='DELETE')){if(cred)auth.logout(cred.token);if(cred?.transport!=='bearer')headers['Set-Cookie']=clearCookie();return send(200,{ok:true})}
   if(sub==='logout-everywhere'&&method==='POST'){auth.logoutEverywhere(needToken());headers['Set-Cookie']=clearCookie();return send(200,{ok:true})}
   if(sub==='profile'&&method==='GET')return send(200,auth.getProfile(needToken()));
   if(sub==='profile'&&method==='PUT')return send(200,auth.updateProfile(needToken(),key,body));
   if(sub==='avatars'&&method==='GET')return send(200,auth.avatars(cred?.token));
   if(sub==='dev/outbox'&&method==='GET'){if(!devOutbox)return send(404,{error:{code:'not_found',message:'Niet gevonden.'}});const email=String(new URL(req.url,'http://localhost').searchParams.get('email')||'').trim().toLowerCase();const m=devOutbox(email||null);return send(200,{devOnly:true,message:m?{to:m.to,code:m.code,subject:m.subject,text:m.text,at:m.at}:null})}
   // Lab only: make the server forget this session but leave the cookie in the browser, so the real UI meets a genuine 401.
   if(sub==='dev/expire'&&method==='POST'){if(!devOutbox)return send(404,{error:{code:'not_found',message:'Niet gevonden.'}});if(cred)auth.logout(cred.token);return send(200,{devOnly:true,expired:Boolean(cred)})}
   if(sub==='claim'&&method==='POST')return send(200,await auth.claimAnonymous({token:needToken(),planId:body?.planId,anonymousBearer:body?.anonymousBearer,key,transfer}));
   return send(404,{error:{code:'not_found',message:'Niet gevonden.'}});
  }catch(e){if(e.details?.clear&&cred?.transport==='cookie')headers['Set-Cookie']=clearCookie();throw e}
 }
 return {handle,credential,csrf,client,setCookie,clearCookie,cookieName:jar.name};
}
