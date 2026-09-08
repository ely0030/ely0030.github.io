import {createPasswords,admitPasswordAttempt,passwordWork} from './runtime/planning/auth/passwords.mjs';
import {createHash} from 'node:crypto';
/** Fetch adapter: canonical r17 domain/auth methods run inside a single durable-state CAS. */
import {transact,openState} from './state.mjs';
import {createPlanningService} from './runtime/planning/service.mjs';
import {createAuthService} from './runtime/planning/auth/service.mjs';
import {createAuthRouter} from './runtime/planning/auth/http.mjs';
import {createActorTransfer} from './runtime/planning/auth/transfer.mjs';
import {loadAvatarOptions} from './runtime/planning/auth/avatars.mjs';
import {createImages} from './images.mjs';
const error=(status,code,message)=>Object.assign(Error(message),{status,code});
const rewrite=(value,key='')=>typeof value==='string'&&['url','poster','backdrop','image','posterFull','metadataPoster'].includes(key)&&value.startsWith('/planning-api/images/')?'/filmmaand/api/images/'+value.slice('/planning-api/images/'.length):Array.isArray(value)?value.map(v=>rewrite(v,key)):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).map(([k,v])=>[k,rewrite(v,k)])):value;
const json=(status,body,headers={})=>new Response(status===204?null:JSON.stringify(rewrite(body)),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers}});
const mutations={'POST:images':'uploadImage','POST:suggestions':'suggest','PUT:profile':'updateProfile','PUT:response':'submit','PUT:proposals':'proposeNight','PUT:vote':'vote','POST:round':'setRound','POST:round-date':'scheduleRound','POST:programme':'planNight','POST:confirmation':'confirm'};
export function createApi({store,blobs,movieCatalogue=null,programmeMovies={},adminToken,organizerIds=[],origin='https://ely0030.xyz',authConfig={},queueMail,deliverMail,now,avatars=loadAvatarOptions()}){
 return async function handle(request,context={}){
  const url=new URL(request.url),path=url.pathname.replace(/^\/filmmaand\/api(?=\/|$)/,'/api'),method=request.method;
  if(!url.pathname.startsWith('/filmmaand/api/'))return json(404,{error:{code:'not_found'}});
  if(request.headers.get('origin')&&request.headers.get('origin')!==origin)return json(403,{error:{code:'origin',message:'Origin niet toegestaan.'}});
  if(method==='OPTIONS')return json(204,null,{'Access-Control-Allow-Methods':'GET, PUT, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, Idempotency-Key, X-Filmmaand-Reset-Generation, X-Filmmaand-Organizer-Id'});
  const req={url:request.url,headers:Object.fromEntries(request.headers),socket:{remoteAddress:context.ip||'unknown'}};
  let body=null,passwordLease=null;
  try{
   if(!['GET','HEAD'].includes(method)){
    const limit=path.endsWith('/images')?750000:16384;
    // Stream bounds avoid buffering an arbitrary-sized upload before rejecting it.
    const reader=request.body?.getReader();let size=0,chunks=[];
    if(reader)while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit){await reader.cancel();throw error(413,'too_large','Verzoek te groot.')}chunks.push(Buffer.from(value))}
    try{const text=Buffer.concat(chunks).toString('utf8');body=text?JSON.parse(text):{}}catch{throw error(400,'json','Ongeldige invoer.')}
   }
   const image=path.match(/^\/api\/images\/([a-f0-9]{64})\.webp$/);
   if(image&&method==='GET'){const bytes=await blobs.get(image[1],{type:'arrayBuffer'});return bytes?new Response(bytes,{headers:{'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable'}}):json(404,{error:{code:'not_found'}})}
   if(path==='/api/movies'&&method==='GET'){if(!movieCatalogue)throw error(503,'catalogue','De filmcatalogus is tijdelijk niet beschikbaar.');return json(200,{movies:await movieCatalogue.search(url.searchParams.get('q')||'',8,{waitForArtwork:url.searchParams.get('quick')!=='1'})})}
   const movie=path.match(/^\/api\/movies\/(tt\d{7,12})$/);
   if(movie&&method==='GET'){if(!movieCatalogue)throw error(503,'catalogue','De filmcatalogus is tijdelijk niet beschikbaar.');const value=movieCatalogue.details?await movieCatalogue.details(movie[1],{includeMetadata:url.searchParams.get('poster')!=='1'}):movieCatalogue.get(movie[1]);return value?json(200,{movie:value}):json(404,{error:{code:'not_found'}})}
   const passwordMutation=method==='POST'&&['/api/auth/password/login','/api/auth/password/set','/api/auth/invite/redeem'].includes(path);
   const inviteMutation=method==='POST'&&['/api/organizer/invites','/api/organizer/invites/revoke'].includes(path);
   if((passwordMutation||inviteMutation)&&request.headers.get('origin')!==origin)throw error(403,'csrf','Dit verzoek kwam niet van de site zelf.');
   const passwordsEnabled=authConfig.passwordsEnabled===true;
   if(!passwordsEnabled&&(passwordMutation||inviteMutation||path.startsWith('/api/auth/password/')||path==='/api/organizer/account'))return json(503,{error:{code:'passwords_disabled',message:'Inloggen met wachtwoord is tijdelijk niet beschikbaar.'}});
   const work=passwordWork();
   if(passwordMutation){
    const admission=await transact(store,c=>{
     const generation=c.state.resetGeneration??'0';
     if(generation!=='0'&&req.headers['x-filmmaand-reset-generation']!==generation)throw error(409,'reset_generation','Vernieuw de site om verder te gaan.');
     return admitPasswordAttempt(c,{email:body?.email,ip:context.ip||'unknown',now:now?now():new Date().toISOString()});
    });
    if(admission.error)throw Object.assign(Error(admission.error.message),admission.error);passwordLease=admission.value;
    // Read a snapshot and perform every KDF outside all retried transactions.
    // The final transaction revalidates authority and rejects changed credential hashes.
    const snapshot=await store.getWithMetadata('state-v1',{type:'json',consistency:'strong'});
    if(!snapshot)throw error(503,'not_initialized','De site is niet beschikbaar.');
    const pre=openState(snapshot.data);
    try{
     let row;
     if(path.endsWith('/login')){const p=pre.authStore.q.participantByEmail.get(typeof body?.email==='string'?body.email.trim().toLowerCase():'');row=p&&pre.authStore.db.prepare('SELECT password_hash FROM password_credentials WHERE participant_id=?').get(p.id);await work.verify(body?.password,row?.password_hash);}
     else{
      if(path.endsWith('/set')){const auth=createAuthService({store:pre.authStore,avatars,now,config:authConfig});const router=createAuthRouter({auth,origins:[origin],cookie:{secure:true}});const a=auth.authenticate(router.credential(req)?.token);row=pre.authStore.db.prepare('SELECT password_hash FROM password_credentials WHERE participant_id=?').get(a.participantId);await work.verify(body?.currentPassword,row?.password_hash);}
      await work.hash(body?.password);
     }
    }finally{pre.close()}
    work.seal();

   }
   const result=await transact(store,async c=>{
    const generation=c.state.resetGeneration??'0';
    if(typeof generation!=='string'||!generation||generation.length>128)throw error(503,'reset_generation','De site wordt opnieuw voorbereid.');
    const headers={'X-Filmmaand-Reset-Generation':generation};
    const auth=createAuthService({store:c.authStore,avatars,now,config:authConfig,mailer:{async send(message){if(!queueMail)throw error(503,'mail_unavailable','E-mail is nog niet ingesteld.');await queueMail(c,message,{plainTextTestToken:request.headers.get('x-filmmaand-plain-text-test')})}}});
    const router=createAuthRouter({auth,transfer:createActorTransfer({store:c.plans}),origins:[origin],cookie:{secure:true}});
    const send=(status,value)=>({status,body:value,headers});
    try{
     if(path==='/api/auth/methods'&&method==='GET')return send(200,{passwordsEnabled});
     if(path==='/api/reset-generation'&&method==='GET')return send(200,{resetGeneration:generation});
     // This check is inside the durable CAS and precedes auth receipts and all domain side effects.
     // Logout remains available to old documents. Organizer mutations keep their separate secret contract.
     const readOnly=['GET','HEAD'].includes(method);
     const logout=(method==='POST'&&path==='/api/auth/logout')||(method==='DELETE'&&path==='/api/auth/session');
     const organizer=method==='POST'&&/^\/api\/plans\/[a-z0-9-]+\/(round|round-date|programme|confirmation)$/.test(path);
     const organizerCookie=organizer&&router.credential(req)?.transport==='cookie';
     if(!readOnly&&!logout&&(!organizer||organizerCookie)&&(organizerCookie||generation!=='0')&&req.headers['x-filmmaand-reset-generation']!==generation){
      return send(409,{error:{code:'reset_generation',message:'De site is opnieuw voorbereid. Vernieuw om verder te gaan.',details:{resetGeneration:generation}}});
     }
     const organizerAccount=()=>{const cred=router.credential(req);if(cred?.transport!=='cookie')throw error(401,'session_required','Log in met je account.');const account=auth.authenticate(cred.token);if(!account.onboarded||!Array.isArray(organizerIds)||!organizerIds.includes(account.participantId))throw error(403,'organizer_required','Dit account heeft geen beheerderstoegang.');return account;};
     if(path==='/api/organizer'&&method==='GET'){const account=organizerAccount();return send(200,{canManageRounds:true,participantId:account.participantId,resetGeneration:generation})}
     const passwords=createPasswords({store:c.authStore,auth,now,work});
     if(inviteMutation){const account=organizerAccount();router.csrf(req);if(req.headers['x-filmmaand-organizer-id']!==account.participantId)throw error(409,'organizer_changed','Heropen het beheer voor dit account.');const value=path.endsWith('/revoke')?passwords.revoke(body):passwords.issue(body,account.participantId);c.state.format=2;return send(200,value);}
     if(path==='/api/organizer/account'&&method==='GET'){organizerAccount();const email=String(url.searchParams.get('email')||'').trim().toLowerCase();const p=c.authStore.q.participantByEmail.get(email);if(!p)return send(404,{error:{code:'not_found',message:'Geen account gevonden.'}});const row=c.authStore.db.prepare('SELECT revision FROM password_credentials WHERE participant_id=?').get(p.id);return send(200,{participantId:p.id,name:p.name||null,email:p.email,credentialRevision:row?.revision||0});}
     if(path==='/api/auth/password/status'&&method==='GET')return send(200,passwords.status(router.credential(req)?.token));
     if(passwordMutation){
      let result;if(path.endsWith('/login'))result=await passwords.login(body);else if(path.endsWith('/redeem'))result=await passwords.redeem(body);else result=await passwords.set(router.credential(req)?.token,body);
      c.state.format=2;headers['Set-Cookie']=router.setCookie(result.token);return send(200,{participant:result.participant});
     }
     if(path.startsWith('/api/auth/'))return await router.handle(req,{path,method,body,headers,send});
     const match=path.match(/^\/api\/plans\/([a-z0-9-]+)(?:\/(response|confirmation|suggestions|profile|images|vote|round|round-date|programme|proposals))?$/);
     if(!match)return send(404,{error:{code:'not_found'}});
     const [,id,part]=match,cred=router.credential(req);
     if(cred?.transport==='cookie'&&method!=='GET')router.csrf(req);
     const token=cred?.token??(req.headers.authorization||'').replace(/^Bearer /,'');
     const service=createPlanningService({store:c.plans,adminToken,movieCatalogue,programmeMovies,imageStore:createImages(blobs,c.state),identity:auth,now});
     if(method==='GET'){const fn={response:'own',profile:'getProfile',vote:'voteView',proposals:'proposals'}[part]||'get';const result=await service[fn](id,token||null);if(fn==='get'){const fixture=c.state.plans[id]?.data.fixtureGroups?.['social-friends-v1'];if(fixture)result.demo={active:true,label:'Voorbeeldgegevens · fictieve deelnemers',participants:fixture.actors.length}}return send(200,result)}
     const fn=mutations[method+':'+part];if(!fn)return send(405,{error:{code:'method'}});
     // Public launch requires an onboarded account for participant writes. Organizer actions retain their separate secret validator.
     if(!['setRound','scheduleRound','planNight','confirm'].includes(fn)){const account=auth.authenticate(token);if(!account.onboarded)throw error(409,'onboarding_required','Kies eerst je naam en avatar.');}
     if(organizerCookie){
      const account=organizerAccount();
      if(req.headers['x-filmmaand-organizer-id']!==account.participantId)throw error(409,'organizer_changed','Je account is veranderd. Heropen het beheer voor dit account.');
      const key=req.headers['idempotency-key'];if(!/^[A-Za-z0-9_-]{16,100}$/.test(key||''))throw error(400,'request_key','Een verzoekcode ontbreekt.');
      // A receipt belongs to the validated account, never the shared admin actor alone.
      const scoped='organizer-'+createHash('sha256').update(JSON.stringify([account.participantId,key])).digest('hex');
      return send(200,await service[fn](id,adminToken,scoped,body));
     }
     return send(200,fn==='uploadImage'?await service[fn](id,token,body):await service[fn](id,token,req.headers['idempotency-key'],body));
    }catch(e){if(!e.status)throw e;if(e.details?.clear&&router.credential(req)?.transport==='cookie')headers['Set-Cookie']=router.clearCookie();return send(e.status,{error:{code:e.code,message:e.message,details:e.details}})}
   });
   if(result.error)throw Object.assign(Error(result.error.message),result.error);
   const response=result.value;
   // Deliver only after successful durable commit; callback handles idempotency and durable retry.
   if(path==='/api/auth/code'&&response.status===200&&deliverMail)await deliverMail(response.body.challengeId);
   if(response.headers['Set-Cookie'])response.headers['Set-Cookie']=response.headers['Set-Cookie'].replace('Path=/;','Path=/filmmaand/;');
   return json(response.status,response.body,response.headers);
  }catch(e){return json(e.status||503,{error:{code:e.code||'unavailable',message:e.status?e.message:'De site is tijdelijk niet beschikbaar. Probeer opnieuw.',details:e.details}})}finally{if(passwordLease)try{await transact(store,c=>{c.state.passwordWorkLeases=(c.state.passwordWorkLeases||[]).filter(x=>x.id!==passwordLease);return true})}catch{/* lease expires after a crash or failed cleanup; never retry credentials */}}
 }
}
