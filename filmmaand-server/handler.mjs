import {createEventNotifications} from './event-notifications.mjs';
import {runCoordinationTick} from './date-coordination-tick.mjs';
import {readFile} from 'node:fs/promises';
import {stateStore,imageStore,checkedFetch} from './blob-store.mjs';
import {createApi} from './api.mjs';
import {createMail} from './mail.mjs';
import {registrationPolicy} from './registration.mjs';
import {openMovieCatalogue} from './runtime/planning/movie-catalogue.mjs';
import {createMovieDiscovery} from './runtime/planning/movie-discovery.mjs';
import {ratingsCacheName} from './runtime/planning/movie-ratings.mjs';
const env=process.env;
let instance;
async function initialize(context={}){
 const store=stateStore({name:env.FILMMAAND_STATE_STORE||'filmmaand-state-v1'}),blobs=imageStore({name:env.FILMMAAND_IMAGE_STORE||'filmmaand-images-v1'});
 const catalogue=openMovieCatalogue(new URL('./data/movie-catalogue.sqlite',import.meta.url).pathname);
 const ratingsStore=stateStore({name:ratingsCacheName(context.deploy),fetch:(input,init={})=>checkedFetch(input,{...init,signal:AbortSignal.any([init.signal,AbortSignal.timeout(1500)].filter(Boolean))})});
 const movieCatalogue=createMovieDiscovery(catalogue,{creditsPath:new URL('./data/movie-credits.sqlite',import.meta.url).pathname,artwork:JSON.parse(await readFile(new URL('./runtime/planning/movie-artwork.json',import.meta.url))),metadataToken:env.TMDB_READ_ACCESS_TOKEN||'',metadataApiKey:env.TMDB_API_KEY||'',ratingsApiKey:env.MDBLIST_API_KEY||'',ratingsStore});
 const registration=registrationPolicy(env);
 const mail=createMail({store,plainTextTest:{tokenSha256:env.AUTH_PLAIN_TEXT_TEST_SHA256,recipient:env.AUTH_PLAIN_TEXT_TEST_RECIPIENT,expiresAt:env.AUTH_PLAIN_TEXT_TEST_EXPIRES_AT},apiKey:env.AUTH_MAILER==='mailgun'?env.MAILGUN_API_KEY:env.RESEND_API_KEY,provider:env.AUTH_MAILER,domain:env.MAILGUN_DOMAIN,apiBaseUrl:env.MAILGUN_API_BASE_URL,from:env.AUTH_FROM,allowedRecipients:registration.allowedRecipients,allowAnyRecipient:registration.allowAnyRecipient,enabled:['resend','mailgun'].includes(env.AUTH_MAILER)});
 const events=createEventNotifications({store,enabled:env.FILMMAAND_EVENT_EMAILS==='1',activatedAt:env.FILMMAAND_EVENT_EMAILS_ACTIVATED_AT,origin:env.FILMMAAND_ORIGIN||'https://ely0030.xyz',allowedRecipients:registration.allowedRecipients,allowAnyRecipient:registration.allowAnyRecipient,provider:env.AUTH_MAILER,apiKey:env.AUTH_MAILER==='mailgun'?env.MAILGUN_API_KEY:env.RESEND_API_KEY,domain:env.MAILGUN_DOMAIN,apiBaseUrl:env.MAILGUN_API_BASE_URL,from:env.AUTH_FROM});
 const api=createApi({store,blobs,movieCatalogue,programmeMovies:JSON.parse(await readFile(new URL('./runtime/planning/programme-movies.json',import.meta.url))),adminToken:env.PLANNING_ADMIN_TOKEN,organizerIds:(env.FILMMAAND_ORGANIZER_IDS||'').split(',').map(id=>id.trim()).filter(Boolean),origin:env.FILMMAAND_ORIGIN||'https://ely0030.xyz',authConfig:{allowList:registration.allowList,passwordsEnabled:env.AUTH_PASSWORDS_ENABLED==='1'},queueMail:mail.queue,deliverMail:mail.deliver,queueEvents:events.queue});
 return {api,mail,events,store};
}
export default async function handler(request,context){
 try{
  const url=new URL(request.url);
  if(url.pathname==='/filmmaand'||url.pathname==='/filmmaand/')return Response.redirect(url.origin+'/filmmaand/'+(url.searchParams.has('edit')||url.searchParams.get('screen')==='thanks'?'stemmen/':'programma/')+url.search,302);
  const {api,mail,events}=await(instance||=(initialize(context).catch(e=>{instance=null;throw e})));
  // Every real invocation can rescue a committed but unacknowledged send; no background timer reliance.
  try{await mail.drain()}catch{/* Current request reports its own delivery failures. */}
  const kind=/^\/filmmaand\/(films|stemmen)\/(?:index.html)?$/.exec(url.pathname)?.[1];
  if(kind){
   const session=await api(new Request(url.origin+'/filmmaand/api/auth/session',{headers:request.headers}),context);const state=await session.json();let html=await readFile(new URL('./runtime/public/'+kind+'/index.html',import.meta.url),'utf8');
   if(!state.participant?.onboarded){html=html.replace('<html','<html data-account-locked="'+kind+'"');html=html.replace(/<script\b[^>]*src=["'][^"']*\/(?:picker\/picker|stemmen\/stemmen|site\/first-visit|site\/vote-event)\.js["'][^>]*><\/script>/g,'')}
   return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Vary':'Cookie'}});
  }
  const response=await api(request,context);try{await events.drain({limit:2})}catch{}return response;
 }catch{return Response.json({error:{code:'unavailable',message:'De site is tijdelijk niet beschikbaar. Probeer opnieuw.'}},{status:503,headers:{'Cache-Control':'no-store'}})}
}
export const config={path:['/filmmaand','/filmmaand/','/filmmaand/api/*','/filmmaand/films/','/filmmaand/films/index.html','/filmmaand/stemmen/','/filmmaand/stemmen/index.html'],preferStatic:false};

export async function coordinationScheduled(context={}){const {store,events}=await(instance||=(initialize(context).catch(e=>{instance=null;throw e})));const result=await runCoordinationTick({store,queueEvents:events.queue});await events.drain({limit:1});return Response.json(result);}
