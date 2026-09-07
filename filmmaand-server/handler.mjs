import {readFile} from 'node:fs/promises';
import {stateStore,imageStore} from './blob-store.mjs';
import {createApi} from './api.mjs';
import {createMail} from './mail.mjs';
import {openMovieCatalogue} from './runtime/planning/movie-catalogue.mjs';
import {createMovieDiscovery} from './runtime/planning/movie-discovery.mjs';
const env=process.env;
let instance;
async function initialize(){
 const store=stateStore({name:env.FILMMAAND_STATE_STORE||'filmmaand-state-v1'}),blobs=imageStore({name:env.FILMMAAND_IMAGE_STORE||'filmmaand-images-v1'});
 const catalogue=openMovieCatalogue(new URL('./data/movie-catalogue.sqlite',import.meta.url).pathname);
 const movieCatalogue=createMovieDiscovery(catalogue,{creditsPath:new URL('./data/movie-credits.sqlite',import.meta.url).pathname,artwork:JSON.parse(await readFile(new URL('./runtime/planning/movie-artwork.json',import.meta.url))),metadataToken:env.TMDB_READ_ACCESS_TOKEN||'',metadataApiKey:env.TMDB_API_KEY||''});
 const mail=createMail({store,apiKey:env.RESEND_API_KEY,from:env.AUTH_FROM,allowedRecipients:(env.AUTH_MAIL_ALLOW||'').split(',').filter(Boolean),enabled:env.AUTH_MAILER==='resend'});
 const api=createApi({store,blobs,movieCatalogue,programmeMovies:JSON.parse(await readFile(new URL('./runtime/planning/programme-movies.json',import.meta.url))),adminToken:env.PLANNING_ADMIN_TOKEN,origin:env.FILMMAAND_ORIGIN||'https://ely0030.xyz',authConfig:{allowList:env.AUTH_ALLOW_LIST?new Set(env.AUTH_ALLOW_LIST.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)):null},queueMail:mail.queue,deliverMail:mail.deliver});
 return {api,mail};
}
export default async function handler(request,context){
 try{
  const {api,mail}=await(instance||=(initialize().catch(e=>{instance=null;throw e}))),url=new URL(request.url);
  // Every real invocation can rescue a committed but unacknowledged send; no background timer reliance.
  try{await mail.drain()}catch{/* Current request reports its own delivery failures. */}
  if(url.pathname==='/filmmaand'||url.pathname==='/filmmaand/')return Response.redirect(url.origin+'/filmmaand/'+(url.searchParams.has('edit')||url.searchParams.get('screen')==='thanks'?'stemmen/':'films/')+url.search,302);
  const kind=/^\/filmmaand\/(films|stemmen)\/(?:index.html)?$/.exec(url.pathname)?.[1];
  if(kind){
   const session=await api(new Request(url.origin+'/filmmaand/api/auth/session',{headers:request.headers}),context);const state=await session.json();let html=await readFile(new URL('./runtime/public/'+kind+'/index.html',import.meta.url),'utf8');
   if(!state.participant?.onboarded){html=html.replace('<html','<html data-account-locked="'+kind+'"');html=html.replace(/<script\b[^>]*src=["'][^"']*\/(?:picker\/picker|stemmen\/stemmen|site\/first-visit|site\/vote-event)\.js["'][^>]*><\/script>/g,'')}
   return new Response(html,{headers:{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Vary':'Cookie'}});
  }
  return api(request,context);
 }catch{return Response.json({error:{code:'unavailable',message:'De site is tijdelijk niet beschikbaar. Probeer opnieuw.'}},{status:503,headers:{'Cache-Control':'no-store'}})}
}
export const config={path:['/filmmaand','/filmmaand/','/filmmaand/api/*','/filmmaand/films/','/filmmaand/films/index.html','/filmmaand/stemmen/','/filmmaand/stemmen/index.html'],preferStatic:false};
