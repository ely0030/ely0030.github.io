/** Fetch adapter: canonical r17 domain/auth methods run inside a single durable-state CAS. */
import {transact} from './state.mjs';
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
export function createApi({store,blobs,movieCatalogue=null,programmeMovies={},adminToken,origin='https://ely0030.xyz',authConfig={},queueMail,deliverMail,now,avatars=loadAvatarOptions()}){
 return async function handle(request,context={}){
  const url=new URL(request.url),path=url.pathname.replace(/^\/filmmaand\/api(?=\/|$)/,'/api'),method=request.method;
  if(!url.pathname.startsWith('/filmmaand/api/'))return json(404,{error:{code:'not_found'}});
  if(request.headers.get('origin')&&request.headers.get('origin')!==origin)return json(403,{error:{code:'origin',message:'Origin niet toegestaan.'}});
  if(method==='OPTIONS')return json(204,null,{'Access-Control-Allow-Methods':'GET, PUT, POST, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, Idempotency-Key'});
  const req={url:request.url,headers:Object.fromEntries(request.headers),socket:{remoteAddress:context.ip||'unknown'}};
  let body=null;
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
   const result=await transact(store,async c=>{
    const headers={};
    const auth=createAuthService({store:c.authStore,avatars,now,config:authConfig,mailer:{async send(message){if(!queueMail)throw error(503,'mail_unavailable','E-mail is nog niet ingesteld.');await queueMail(c,message,{plainTextTestToken:request.headers.get('x-filmmaand-plain-text-test')})}}});
    const router=createAuthRouter({auth,transfer:createActorTransfer({store:c.plans}),origins:[origin],cookie:{secure:true}});
    const send=(status,value)=>({status,body:value,headers});
    try{
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
     return send(200,fn==='uploadImage'?await service[fn](id,token,body):await service[fn](id,token,req.headers['idempotency-key'],body));
    }catch(e){if(!e.status)throw e;if(e.details?.clear&&router.credential(req)?.transport==='cookie')headers['Set-Cookie']=router.clearCookie();return send(e.status,{error:{code:e.code,message:e.message,details:e.details}})}
   });
   if(result.error)throw Object.assign(Error(result.error.message),result.error);
   const response=result.value;
   // Deliver only after successful durable commit; callback handles idempotency and durable retry.
   if(path==='/api/auth/code'&&response.status===200&&deliverMail)await deliverMail(response.body.challengeId);
   if(response.headers['Set-Cookie'])response.headers['Set-Cookie']=response.headers['Set-Cookie'].replace('Path=/;','Path=/filmmaand/;');
   return json(response.status,response.body,response.headers);
  }catch(e){return json(e.status||503,{error:{code:e.code||'unavailable',message:e.status?e.message:'De site is tijdelijk niet beschikbaar. Probeer opnieuw.',details:e.details}})}
 }
}
