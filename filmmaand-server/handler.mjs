import {createTonightForwarder} from './tonight.mjs';
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
let instance,messaging;
// The scheduled tick needs durable state and the three outbound mail paths, nothing else.
// Keeping that init separate keeps the movie catalogue (~175 MB of SQLite) and the image
// store out of every cron cold start; the request instance builds on top of it.
async function initializeMessaging(){
 const store=stateStore({name:env.FILMMAAND_STATE_STORE||'filmmaand-state-v1'});
 const registration=registrationPolicy(env);
 const mail=createMail({store,plainTextTest:{tokenSha256:env.AUTH_PLAIN_TEXT_TEST_SHA256,recipient:env.AUTH_PLAIN_TEXT_TEST_RECIPIENT,expiresAt:env.AUTH_PLAIN_TEXT_TEST_EXPIRES_AT},apiKey:env.AUTH_MAILER==='mailgun'?env.MAILGUN_API_KEY:env.RESEND_API_KEY,provider:env.AUTH_MAILER,domain:env.MAILGUN_DOMAIN,apiBaseUrl:env.MAILGUN_API_BASE_URL,from:env.AUTH_FROM,allowedRecipients:registration.allowedRecipients,allowAnyRecipient:registration.allowAnyRecipient,enabled:['resend','mailgun'].includes(env.AUTH_MAILER)});
 const events=createEventNotifications({store,enabled:env.FILMMAAND_EVENT_EMAILS==='1',activatedAt:env.FILMMAAND_EVENT_EMAILS_ACTIVATED_AT,origin:env.FILMMAAND_ORIGIN||'https://ely0030.xyz',allowedRecipients:registration.allowedRecipients,allowAnyRecipient:registration.allowAnyRecipient,provider:env.AUTH_MAILER,apiKey:env.AUTH_MAILER==='mailgun'?env.MAILGUN_API_KEY:env.RESEND_API_KEY,domain:env.MAILGUN_DOMAIN,apiBaseUrl:env.MAILGUN_API_BASE_URL,from:env.AUTH_FROM});
 const tonight=createTonightForwarder({store,provider:env.AUTH_MAILER,apiKey:env.AUTH_MAILER==='mailgun'?env.MAILGUN_API_KEY:env.RESEND_API_KEY,domain:env.MAILGUN_DOMAIN,apiBaseUrl:env.MAILGUN_API_BASE_URL,from:env.AUTH_FROM});
 return {store,registration,mail,events,tonight};
}
async function initialize(context={}){
 const {store,registration,mail,events,tonight}=await(messaging||=(initializeMessaging().catch(e=>{messaging=null;throw e})));
 const blobs=imageStore({name:env.FILMMAAND_IMAGE_STORE||'filmmaand-images-v1'});
 const catalogue=openMovieCatalogue(new URL('./data/movie-catalogue.sqlite',import.meta.url).pathname);
 const ratingsStore=stateStore({name:ratingsCacheName(context.deploy),fetch:(input,init={})=>checkedFetch(input,{...init,signal:AbortSignal.any([init.signal,AbortSignal.timeout(1500)].filter(Boolean))})});
 const movieCatalogue=createMovieDiscovery(catalogue,{creditsPath:new URL('./data/movie-credits.sqlite',import.meta.url).pathname,artwork:JSON.parse(await readFile(new URL('./runtime/planning/movie-artwork.json',import.meta.url))),metadataToken:env.TMDB_READ_ACCESS_TOKEN||'',metadataApiKey:env.TMDB_API_KEY||'',ratingsApiKey:env.MDBLIST_API_KEY||'',ratingsStore});
 const api=createApi({store,blobs,movieCatalogue,programmeMovies:JSON.parse(await readFile(new URL('./runtime/planning/programme-movies.json',import.meta.url))),adminToken:env.PLANNING_ADMIN_TOKEN,organizerIds:(env.FILMMAAND_ORGANIZER_IDS||'').split(',').map(id=>id.trim()).filter(Boolean),origin:env.FILMMAAND_ORIGIN||'https://ely0030.xyz',authConfig:{allowList:registration.allowList,passwordsEnabled:env.AUTH_PASSWORDS_ENABLED==='1'},queueMail:mail.queue,deliverMail:mail.deliver,queueEvents:events.queue,deliverTonight:tonight.deliver});
 return {api,mail,events,store,tonight};
}
export default async function handler(request,context){
 try{
  const url=new URL(request.url);
  if(url.pathname==='/filmmaand'||url.pathname==='/filmmaand/')return Response.redirect(url.origin+'/filmmaand/'+(url.searchParams.has('edit')||url.searchParams.get('screen')==='thanks'?'stemmen/':'programma/')+url.search,302);
  const {api,mail,events}=await(instance||=(initialize(context).catch(e=>{instance=null;throw e})));
  // A mutation can rescue a committed but unacknowledged send; the scheduled tick is the
  // standing drain worker. Read-only polling used to pay for both drains, which cost two
  // extra full strongly-consistent state reads per request and dominated function compute.
  const readOnly=['GET','HEAD','OPTIONS'].includes(request.method); // a CORS preflight is answered before any transaction and must not drain
  if(!readOnly)try{await mail.drain()}catch{/* Current request reports its own delivery failures. */}
  const kind=/^\/filmmaand\/(films|stemmen)\/(?:index.html)?$/.exec(url.pathname)?.[1];
  if(kind){
   const session=await api(new Request(url.origin+'/filmmaand/api/auth/session',{headers:request.headers}),context);const state=await session.json();let html=await readFile(new URL('./runtime/public/'+kind+'/index.html',import.meta.url),'utf8');
   if(!state.participant?.onboarded){html=html.replace('<html','<html data-account-locked="'+kind+'"');html=html.replace(/<script\b[^>]*src=["'][^"']*\/(?:picker\/picker|stemmen\/stemmen|site\/first-visit|site\/vote-event)\.js["'][^>]*><\/script>/g,'')}
   return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Vary':'Cookie'}});
  }
  const response=await api(request,context);if(!readOnly)try{await events.drain({limit:2})}catch{}return response;
 }catch{return Response.json({error:{code:'unavailable',message:'De site is tijdelijk niet beschikbaar. Probeer opnieuw.'}},{status:503,headers:{'Cache-Control':'no-store'}})}
}
export const config={path:['/filmmaand','/filmmaand/','/filmmaand/api/*','/filmmaand/films/','/filmmaand/films/index.html','/filmmaand/stemmen/','/filmmaand/stemmen/index.html'],preferStatic:false};

// Only an EXPLICIT false skips a drain. An absent hint, an unrecognised one, or an object that is
// simply missing a key all drain — so adding a fourth outbox later, or a tick that returns a partial
// hint, costs one wasted read rather than silently stranding a queued send. A wrong hint must only
// ever be able to cost work, never to lose mail. Exported so this invariant is testable without Blobs.
export function drainSelection(hint){
 const h=hint&&typeof hint==='object'?hint:{};
 return {events:h.events!==false,mail:h.mail!==false,tonight:h.tonight!==false};
}
// The scheduled tick is the standing drain worker for all three outbound mail paths, so a
// slower cadence delays delivery by at most one interval instead of stranding a queued send.
export async function coordinationScheduled(context={}){
 const {store,mail,events,tonight}=await(messaging||=(initializeMessaging().catch(e=>{messaging=null;throw e})));
 const result=await runCoordinationTick({store,queueEvents:events.queue});
 const work=drainSelection(result?.work);
 if(work.events)await events.drain({limit:3});
 if(work.mail)try{await mail.drain()}catch{/* A queued login code is also retried by the next request that asks for one. */}
 if(work.tonight)await tonight.drain();
 return Response.json({changed:result?.changed});
}
