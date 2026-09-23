import {tonightView,tonightWrite,tonightMessages} from './tonight.mjs';
import {captureActivity,commitActivity,notificationRequest} from './account-notifications.mjs';
import {createPasswords,admitPasswordAttempt,passwordWork} from './runtime/planning/auth/passwords.mjs';
import {createHash} from 'node:crypto';
import {createPollPasses,PASS_ACTIONS} from './runtime/planning/auth/poll-passes.mjs';
import {queuePollNudges,queuePollInvites,invitedParticipants,queuePollConfirms} from './event-notifications.mjs';
import {participantActor} from './runtime/planning/auth/credentials.mjs';
import {parseSince} from './runtime/planning/chat.mjs';
import {responded} from './runtime/planning/date-coordination.mjs';
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
const mutations={'POST:images':'uploadImage','POST:suggestions':'suggest','PUT:profile':'updateProfile','PUT:response':'submit','PUT:proposals':'proposeNight','PUT:coordination':'coordinate','POST:coordination':'manageCoordination','PUT:date-poll':'voteDatePoll','PUT:date-poll-doodle':'doodleDatePoll','POST:date-poll':'manageDatePoll','PUT:vote':'vote','POST:round':'setRound','POST:round-date':'scheduleRound','POST:programme':'planNight','POST:confirmation':'confirm'};
export function createApi({store,blobs,movieCatalogue=null,programmeMovies={},adminToken,organizerIds=[],origin='https://ely0030.xyz',authConfig={},queueMail,deliverMail,queueEvents,deliverTonight,now,avatars=loadAvatarOptions(),mailActive=()=>false}){
 // mailActive(): are event mails switched on (FILMMAAND_EVENT_EMAILS + activation)? Poll mails (reminder, invitation,
 // confirmation) are never queued while it is off, so switching mail on later cannot deliver stale mail. Default: off.
 return async function handle(request,context={}){
  const url=new URL(request.url),path=url.pathname.replace(/^\/filmmaand\/api(?=\/|$)/,'/api'),method=request.method;
  if(!url.pathname.startsWith('/filmmaand/api/'))return json(404,{error:{code:'not_found'}});
  if(request.headers.get('origin')&&request.headers.get('origin')!==origin)return json(403,{error:{code:'origin',message:'Origin niet toegestaan.'}});
  if(method==='OPTIONS')return json(204,null,{'Access-Control-Allow-Methods':'GET, PUT, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, Idempotency-Key, X-Filmmaand-Reset-Generation, X-Filmmaand-Organizer-Id, X-Filmmaand-Poll-Pass'});
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
   if(image&&method==='GET'){const bytes=await blobs.get(image[1],{type:'arrayBuffer'});return bytes?new Response(bytes,{headers:{'Content-Type':'image/webp','X-Content-Type-Options':'nosniff','Cache-Control':'public, max-age=31536000, immutable','Netlify-CDN-Cache-Control':'public, max-age=31536000, immutable, durable'}}):json(404,{error:{code:'not_found'}})}
   if(path==='/api/movies'&&method==='GET'){if(!movieCatalogue)throw error(503,'catalogue','De filmcatalogus is tijdelijk niet beschikbaar.');return json(200,{movies:await movieCatalogue.search(url.searchParams.get('q')||'',8,{waitForArtwork:url.searchParams.get('quick')!=='1'})})}
   const movie=path.match(/^\/api\/movies\/(tt\d{7,12})$/);
   if(movie&&method==='GET'){if(!movieCatalogue)throw error(503,'catalogue','De filmcatalogus is tijdelijk niet beschikbaar.');const value=movieCatalogue.details?await movieCatalogue.details(movie[1],{includeMetadata:url.searchParams.get('poster')!=='1',waitUntil:typeof context.waitUntil==='function'?context.waitUntil.bind(context):undefined}):movieCatalogue.get(movie[1]);return value?json(200,{movie:value}):json(404,{error:{code:'not_found'}})}
   const passwordMutation=method==='POST'&&['/api/auth/password/login','/api/auth/password/set','/api/auth/invite/redeem'].includes(path);
   const inviteMutation=method==='POST'&&['/api/organizer/invites','/api/organizer/invites/revoke'].includes(path);
   if((passwordMutation||inviteMutation)&&request.headers.get('origin')!==origin)throw error(403,'csrf','Dit verzoek kwam niet van de site zelf.');
   if(path==='/api/organizer/account'||(path==='/api/organizer/invites'&&method==='POST'&&body?.kind==='recovery'))return json(403,{error:{code:'recovery_disabled',message:'Herstel door de organisator is niet beschikbaar.'}});
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
    // Everything on the date-poll route names a person (own answers, a pass, a minted link), errors included: never cacheable.
    if(/^\/api\/plans\/[^/]+\/date-poll(?:-doodle|-chat|-rsvp|-film|-login)?$/.test(path))headers['Cache-Control']='private, no-store';
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
     const organizer=method==='POST'&&/^\/api\/plans\/[a-z0-9-]+\/(round|round-date|programme|confirmation|date-poll|coordination)$/.test(path);
     const organizerCookie=organizer&&router.credential(req)?.transport==='cookie';
     if(!readOnly&&!logout&&(!organizer||organizerCookie)&&(organizerCookie||generation!=='0')&&req.headers['x-filmmaand-reset-generation']!==generation){
      return send(409,{error:{code:'reset_generation',message:'De site is opnieuw voorbereid. Vernieuw om verder te gaan.',details:{resetGeneration:generation}}});
     }
     const organizerAccount=()=>{const cred=router.credential(req);if(cred?.transport!=='cookie')throw error(401,'session_required','Log in met je account.');const account=auth.authenticate(cred.token);if(!account.onboarded||!Array.isArray(organizerIds)||!organizerIds.includes(account.participantId))throw error(403,'organizer_required','Dit account heeft geen beheerderstoegang.');return account;};
     if(path==='/api/organizer'&&method==='GET'){const account=organizerAccount();return send(200,{canManageRounds:true,participantId:account.participantId,resetGeneration:generation})}
     const passwords=createPasswords({store:c.authStore,auth,now,work});
     if(inviteMutation){const account=organizerAccount();router.csrf(req);if(req.headers['x-filmmaand-organizer-id']!==account.participantId)throw error(409,'organizer_changed','Heropen het beheer voor dit account.');const value=path.endsWith('/revoke')?passwords.revoke(body):passwords.issue(body,account.participantId);c.state.format=2;return send(200,value);}
     if(path==='/api/auth/password/status'&&method==='GET')return send(200,passwords.status(router.credential(req)?.token));
     if(passwordMutation){
      let result;if(path.endsWith('/login'))result=await passwords.login(body);else if(path.endsWith('/redeem'))result=await passwords.redeem(body);else result=await passwords.set(router.credential(req)?.token,body);
      c.state.format=2;headers['Set-Cookie']=router.setCookie(result.token);return send(200,{participant:result.participant});
     }
     if(path.startsWith('/api/auth/'))return await router.handle(req,{path,method,body,headers,send});
     if(path==='/api/tonight'||path.startsWith('/api/tonight/')){
      const credential=router.credential(req),account=credential?.token?auth.authenticate(credential.token):null;
      if(path==='/api/tonight'&&method==='GET')return send(200,tonightView(c,account,avatars));
      if(!account)throw error(401,'session_required','Log in om te reageren.');
      if(!account.onboarded)throw error(409,'onboarding_required','Kies eerst je naam en avatar.');
      if(method==='GET'&&path==='/api/tonight/messages'){organizerAccount();return send(200,tonightMessages(c));}
      router.csrf(req);
      const part=path==='/api/tonight/response'&&method==='PUT'?'response':path==='/api/tonight/messages'&&method==='POST'?'messages':null;
      if(!part)return send(405,{error:{code:'method'}});
      const result=tonightWrite(c,account,req.headers['idempotency-key'],part,body,now?now():new Date().toISOString());
      return send(200,part==='response'?tonightView(c,account,avatars):result);
     }

     const notifications=path.match(/^\/api\/notifications(?:\/(read|preferences))?$/);
     if(notifications){const account=auth.authenticate(router.credential(req)?.token);if(!account.onboarded)throw error(409,'onboarding_required','Kies eerst je naam en avatar.');if(method!=='GET')router.csrf(req);return send(200,notificationRequest(c,account.participantId,{method,part:notifications[1],body,url,at:now?now():new Date().toISOString()}));}
     const match=path.match(/^\/api\/plans\/([a-z0-9-]+)(?:\/(response|confirmation|suggestions|profile|images|vote|round|round-date|programme|proposals|date-poll|date-poll-doodle|date-poll-chat|date-poll-rsvp|date-poll-film|date-poll-login|coordination))?$/);
     if(!match)return send(404,{error:{code:'not_found'}});
     const [,id,part]=match,cred=router.credential(req);
     if(cred?.transport==='cookie'&&method!=='GET')router.csrf(req);
     const token=cred?.token??(req.headers.authorization||'').replace(/^Bearer /,'');
     const service=createPlanningService({store:c.plans,adminToken,movieCatalogue,programmeMovies,imageStore:createImages(blobs,c.state),identity:auth,now});
     // Invitees (Cameo/Chris, 23 Sept): everyone holding a live pass for this poll, as display names only, so the group
     // header can list members who have not answered yet. Date-poll GET only (pass or session), never the public plan GET.
     // A read: the holders query writes nothing.
     const withInvitees=r=>{if(r?.pollId){const names=createPollPasses({store:c.authStore,accounts:auth,now}).holders(id,r.pollId).map(h=>auth.publicProfile(participantActor(h.participantId))?.name).filter(Boolean);
      r.invitees=[...new Set(names)].sort((x,y)=>x.localeCompare(y,'nl'))}else if(r)r.invitees=[];return r};
     // The anonymous read (?public=1): the public projection only. Checked before ANY identity handling, so a pass header is
     // never resolved or honoured here (and a session changes nothing): same bytes for everyone, never names, no writes.
     if(part==='date-poll'&&method==='GET'&&url.searchParams.get('public')==='1')return send(200,await service.datePollPublic(id));
     if(part==='date-poll-login'){
      // Chris, 23 Sept: "our auto log in should handle this". Opening YOUR invite link logs you in on this device: a normal
      // session for the pass holder's own account (method 'poll-pass'), so coming back later (history, the menu) just works.
      // Rules: POST only, with the pass header. An account already logged in here is never switched (a friend's link opened
      // on your phone does nothing). A poll-pass session is not a fresh e-mail code, so it can't set a password.
      if(method!=='POST')return send(405,{error:{code:'method'}});
      const pass=req.headers['x-filmmaand-poll-pass'];if(pass===undefined)throw error(401,'pass_invalid','Deze link werkt niet (meer).');
      const holder=createPollPasses({store:c.authStore,accounts:auth,now}).resolve(pass,id);
      if(cred){let current=null;try{current=auth.authenticate(cred.token)}catch{}
       if(current)return send(200,{loggedIn:current.participantId===holder.participantId,switched:false});}
      const session=auth.issueSession(holder.participantId,'poll-pass');c.state.format=2;
      headers['Set-Cookie']=router.setCookie(session.token);return send(200,{loggedIn:true,switched:false});
     }
     if(part==='date-poll-film'){
      // The intro film was watched to the END: remember it for this account (own flag only). PUT only, pass or session.
      if(method!=='PUT')return send(405,{error:{code:'method'}});
      const pass=req.headers['x-filmmaand-poll-pass'],key=req.headers['idempotency-key'];let value;
      if(pass!==undefined){const holder=createPollPasses({store:c.authStore,accounts:auth,now}).resolve(pass,id);value=await service.filmSeenDatePollAs(id,participantActor(holder.participantId),holder.pollId,key,body)}
      else value=await service.filmSeenDatePoll(id,token,key,body);
      return send(200,value);
     }
     if(part==='date-poll-rsvp'){
      // After a pick: your own "Ja, ik kom!" / "Toch niet". PUT only, pass or session; a GET (e.g. the mail link's
      // ?antwoord=) never saves anything.
      if(method!=='PUT')return send(405,{error:{code:'method'}});
      const pass=req.headers['x-filmmaand-poll-pass'],key=req.headers['idempotency-key'];
      const activityAt=now?now():new Date().toISOString(),activityBefore=captureActivity(c,activityAt);let value;
      if(pass!==undefined){const holder=createPollPasses({store:c.authStore,accounts:auth,now}).resolve(pass,id);value=await service.rsvpDatePollAs(id,participantActor(holder.participantId),holder.pollId,key,body)}
      else value=await service.rsvpDatePoll(id,token,key,body);
      commitActivity(c,activityBefore,activityAt);return send(200,value);
     }
     if(part==='date-poll-chat'){
      // Text chat: POST only, as yourself (pass or session). ?since=<cursor> → the response carries the chat since then.
      if(method!=='POST')return send(405,{error:{code:'method'}});
      const since=parseSince(url.searchParams.get('since')),pass=req.headers['x-filmmaand-poll-pass'],key=req.headers['idempotency-key'];
      const activityAt=now?now():new Date().toISOString(),activityBefore=captureActivity(c,activityAt);let value;
      if(pass!==undefined){const holder=createPollPasses({store:c.authStore,accounts:auth,now}).resolve(pass,id);value=await service.chatDatePollAs(id,participantActor(holder.participantId),holder.pollId,key,body,since)}
      else value=await service.chatDatePoll(id,token,key,body,since);
      commitActivity(c,activityBefore,activityAt);return send(200,value);
     }
     if(part==='date-poll-doodle'){
      // Shared doodles: PUT only. With a pass the holder may add/replace only their OWN doodle for the pass's poll.
      if(method!=='PUT')return send(405,{error:{code:'method'}});
      const pass=req.headers['x-filmmaand-poll-pass'];
      if(pass!==undefined){
       const holder=createPollPasses({store:c.authStore,accounts:auth,now}).resolve(pass,id),a=participantActor(holder.participantId);
       const activityAt=now?now():new Date().toISOString(),activityBefore=captureActivity(c,activityAt);
       const value=await service.doodleDatePollAs(id,a,holder.pollId,req.headers['idempotency-key'],body);commitActivity(c,activityBefore,activityAt);return send(200,value);
      }
     }
     if(part==='date-poll'){
      const passes=createPollPasses({store:c.authStore,accounts:auth,now});
      if(method==='POST'&&PASS_ACTIONS.includes(body?.action)){
       let createdBy='admin';
       if(organizerCookie){const account=organizerAccount();if(req.headers['x-filmmaand-organizer-id']!==account.participantId)throw error(409,'organizer_changed','Je account is veranderd. Heropen het beheer voor dit account.');createdBy=account.participantId;}
       else service.assertAdmin(token);
       if(body.action==='nudge-list')return send(200,await service.datePollNudgeList(id,body.pollId,passes.holders(id,body.pollId)));
       // Chris, 23 Sept: "friends list will be everyone who has an account". Organiser/admin only (the check above): every
       // account with its e-mail, so the organiser can review the list (and leave out test accounts) before issuing links.
       if(body.action==='list-accounts'){const rows=c.authStore.db.prepare('SELECT id,name,email,onboarded,created_at FROM participants ORDER BY created_at').all();
        return send(200,{accounts:rows.map(r=>({participantId:r.id,name:r.name||null,email:r.email,onboarded:!!r.onboarded,createdAt:r.created_at}))});}
       const mailOff=()=>error(409,'mail_disabled','Mail staat uit, er is niets verstuurd.');
       if(body.action==='nudge'){
        if(!mailActive())throw mailOff();
        // Organiser-triggered only. Same receipt pattern as the other organiser writes: an exact retry replays the receipt
        // and the seen ledger queues nothing twice.
        const key=req.headers['idempotency-key'];if(!/^[A-Za-z0-9_-]{16,100}$/.test(key||''))throw error(400,'request_key','Een verzoekcode ontbreekt.');
        const scoped=createdBy==='admin'?key:'organizer-'+createHash('sha256').update(JSON.stringify([createdBy,key])).digest('hex');
        const at=now?now():new Date().toISOString(),result=await service.nudgeDatePoll(id,adminToken,scoped,body,passes.holders(id,body.pollId));
        const poll=c.state.plans[id].data.datePoll;queuePollNudges(c,{planId:id,poll,scope:scoped,recipients:result.recipients,now:at});
        return send(200,result);
       }
       // Invitations: one per person per poll, ever (the seen ledger has no request scope). invite-list is a read.
       const notInvited=()=>{const invited=invitedParticipants(c,id,body.pollId);return passes.holders(id,body.pollId).filter(h=>!invited(h))};
       if(body.action==='invite-list')return send(200,await service.datePollNudgeList(id,body.pollId,notInvited()));
       if(body.action==='invite'){
        if(!mailActive())throw mailOff();
        const key=req.headers['idempotency-key'];if(!/^[A-Za-z0-9_-]{16,100}$/.test(key||''))throw error(400,'request_key','Een verzoekcode ontbreekt.');
        const scoped=createdBy==='admin'?key:'organizer-'+createHash('sha256').update(JSON.stringify([createdBy,key])).digest('hex');
        const at=now?now():new Date().toISOString(),result=await service.inviteDatePoll(id,adminToken,scoped,body,notInvited());
        const poll=c.state.plans[id].data.datePoll;queuePollInvites(c,{planId:id,poll,recipients:result.recipients,now:at});
        return send(200,result);
       }
       if(body.action==='list-passes')return send(200,passes.list(id,body));
       if(body.action==='revoke-passes')return send(200,passes.revoke(id,body));
       if(body.action==='list-availability')return send(200,await service.datePollOrganizerView(id,body.pollId));
       return send(200,passes.issue(id,await service.datePollInfo(id),body,createdBy,origin));
      }
      // A poll pass is an alternative identity for this route only. When sent it wins over any session, and an
      // invalid pass is an error, never a silent fallback. Resolving it reads; GET stays read-only.
      const pass=req.headers['x-filmmaand-poll-pass'];
      if(pass!==undefined){
       const holder=passes.resolve(pass,id),a=participantActor(holder.participantId);
       if(method==='GET'){const since=parseSince(url.searchParams.get('since'));
        if(url.searchParams.get('lite')==='1')return send(200,await service.getDatePollLiteAs(id,a,holder.pollId,since));
        return send(200,withInvitees(await service.getDatePollAs(id,a,holder.pollId,since)));}
       if(method!=='PUT')return send(405,{error:{code:'method'}});
       const activityAt=now?now():new Date().toISOString(),activityBefore=captureActivity(c,activityAt);
       const value=await service.voteDatePollAs(id,a,holder.pollId,req.headers['idempotency-key'],body);commitActivity(c,activityBefore,activityAt);return send(200,value);
      }
     }
     if(method==='GET'&&part==='date-poll'){const since=parseSince(url.searchParams.get('since'));
      if(url.searchParams.get('lite')==='1')return send(200,await service.getDatePollLite(id,token||null,since));
      return send(200,withInvitees(await service.getDatePoll(id,token||null,since)));}
     if(method==='GET'){const fn={response:'own',profile:'getProfile',vote:'voteView',proposals:'proposals','date-poll':'getDatePoll',coordination:'coordination'}[part]||'get';const result=await service[fn](id,token||null);if(fn==='get'){const fixture=c.state.plans[id]?.data.fixtureGroups?.['social-friends-v1'];if(fixture)result.demo={active:true,label:'Voorbeeldgegevens · fictieve deelnemers',participants:fixture.actors.length}}return send(200,result)}
     const fn=mutations[method+':'+part];if(!fn)return send(405,{error:{code:'method'}});
     // Public launch requires an onboarded account for participant writes. Organizer actions retain their separate secret validator.
     if(!['setRound','scheduleRound','planNight','confirm','manageDatePoll','manageCoordination'].includes(fn)){const account=auth.authenticate(token);if(!account.onboarded)throw error(409,'onboarding_required','Kies eerst je naam en avatar.');}
     const activityAt=now?now():new Date().toISOString(),activityBefore=captureActivity(c,activityAt);
     let pickMailOff=false;
     const committed=async operation=>{const value=await operation;commitActivity(c,activityBefore,activityAt);afterPick();return pickMailOff&&value&&typeof value==='object'?{...value,mail:'off'}:value;};
     // A manual date-poll pick queues ONE confirmation per poll participant (live pass holders + everyone who answered),
     // in this same transaction. Replays are no-ops via the seen ledger. Only reachable through the organiser pick.
     const afterPick=()=>{if(fn!=='manageDatePoll'||body?.action!=='pick')return;const q=c.state.plans[id]?.data.datePoll;if(q?.mode!=='availability'||q.status!=='confirmed')return;
      if(!mailActive()){pickMailOff=true;return}
      // Who gets the confirmation (Chris, 23 Sept): everyone who said YES to the picked night, plus live pass holders who
      // never answered. NOT people who declined every night or said no to this night.
      const who=new Set(createPollPasses({store:c.authStore,accounts:auth,now}).holders(id,q.id).filter(h=>!responded(q,q.votes?.['p_'+h.participantId])).map(h=>h.participantId));
      for(const [a,v] of Object.entries(q.votes||{}))if(a.startsWith('p_')&&v?.availability?.[q.scheduledDate]===true)who.add(a.slice(2));
      queuePollConfirms(c,{planId:id,poll:q,recipients:[...who].sort(),now:activityAt});};
     if(organizerCookie){
      const account=organizerAccount();
      if(req.headers['x-filmmaand-organizer-id']!==account.participantId)throw error(409,'organizer_changed','Je account is veranderd. Heropen het beheer voor dit account.');
      const key=req.headers['idempotency-key'];if(!/^[A-Za-z0-9_-]{16,100}$/.test(key||''))throw error(400,'request_key','Een verzoekcode ontbreekt.');
      // A receipt belongs to the validated account, never the shared admin actor alone.
      const scoped='organizer-'+createHash('sha256').update(JSON.stringify([account.participantId,key])).digest('hex');
      return send(200,await committed(service[fn](id,adminToken,scoped,body)));
     }
     return send(200,await committed(fn==='uploadImage'?service[fn](id,token,body):service[fn](id,token,req.headers['idempotency-key'],body)));
    }catch(e){if(!e.status)throw e;if(e.details?.clear&&router.credential(req)?.transport==='cookie')headers['Set-Cookie']=router.clearCookie();return send(e.status,{error:{code:e.code,message:e.message,details:e.details}})}finally{if(queueEvents)await queueEvents(c)}
   });
   if(result.error)throw Object.assign(Error(result.error.message),result.error);
   const response=result.value;
   if(path==='/api/tonight/messages'&&method==='POST'&&response.status===200&&deliverTonight){const delivery=await deliverTonight(response.body.id);if(delivery)response.body=delivery;}
   // Deliver only after successful durable commit; callback handles idempotency and durable retry.
   if(path==='/api/auth/code'&&response.status===200&&deliverMail)await deliverMail(response.body.challengeId);
   if(response.headers['Set-Cookie'])response.headers['Set-Cookie']=response.headers['Set-Cookie'].replace('Path=/;','Path=/filmmaand/;');
   return json(response.status,response.body,response.headers);
  }catch(e){return json(e.status||503,{error:{code:e.code||'unavailable',message:e.status?e.message:'De site is tijdelijk niet beschikbaar. Probeer opnieuw.',details:e.details}})}finally{if(passwordLease)try{await transact(store,c=>{c.state.passwordWorkLeases=(c.state.passwordWorkLeases||[]).filter(x=>x.id!==passwordLease);return true})}catch{/* lease expires after a crash or failed cleanup; never retry credentials */}}
 }
}
