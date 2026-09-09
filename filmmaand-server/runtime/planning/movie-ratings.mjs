import {DatabaseSync} from 'node:sqlite';
const DAY=86400000;
export const ratingsCacheName=(deploy={})=>'filmmaand-rt-v2-'+(deploy?.context==='production'?'production':'preview-'+(/^[a-zA-Z0-9_-]{1,48}$/.test(deploy?.id||'')?deploy.id:'local'));
const valid=value=>Number.isInteger(value)&&value>=0&&value<=100;
// MDBList resolves exact IMDb identities. Never substitute its aggregate score for RT.
export function normalizeRatings(body,id,checkedAt){
 if(!body||body.error||body.response===false||(body.ids?.imdb??body.imdb_id??body.imdbid)!==id||(body.type??body.mediatype)!=='movie')throw Error('identity');
 const rows=Array.isArray(body.ratings)?body.ratings:[];
 const percent=names=>{for(const source of names){const matches=rows.filter(r=>r?.source===source);if(matches.length===1&&valid(matches[0].value))return matches[0].value;}return null;};
 const critics=percent(['tomatoes']),audience=percent(['popcorn','tomatoesaudience']);
 if(critics===null&&audience===null)return null;
 const paths=rows.filter(r=>['tomatoes','popcorn','tomatoesaudience'].includes(r?.source)&&typeof r.url==='string'&&/^\/m\/[a-zA-Z0-9_-]+$/.test(r.url)).map(r=>r.url.slice(3));
 const path=paths.length&&new Set(paths).size===1?paths[0]:null;
 return {imdbId:id,critics,audience,audienceKind:'unspecified',source:'MDBList',checkedAt,path};
}
const FRESH=7*DAY, MISSING=DAY, ERROR=60000, STALE=30*DAY, LEASE=10000;
// Dedicated ratings store only. Refresh leases prevent cold instances spending the same API request.
export function createMovieRatings({apiKey='',fetcher=fetch,now=Date.now,timeout=2500,cachePath=null,sharedStore=null,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const db=cachePath?new DatabaseSync(cachePath):null;
 db?.exec('CREATE TABLE IF NOT EXISTS movie_rt_cache_v2(id TEXT PRIMARY KEY,entry TEXT NOT NULL)');
 const read=db?.prepare('SELECT entry FROM movie_rt_cache_v2 WHERE id=?'),write=db?.prepare('INSERT OR REPLACE INTO movie_rt_cache_v2 VALUES(?,?)');
 const cache=new Map(),pending=new Map();let cooldown=0,closed=false;
 const visible=entry=>entry?.data&&now()-Date.parse(entry.data.checkedAt)<=STALE?entry.data:null;
 function validEntry(entry,id){
  if(!entry||entry.version!==2||!Number.isFinite(entry.expires)||!['ready','missing','error'].includes(entry.status))return null;
  const d=entry.data;
  if(d!==null&&(!d||d.imdbId!==id||d.source!=='MDBList'||!Number.isFinite(Date.parse(d.checkedAt))||Date.parse(d.checkedAt)>now()+60000||(!valid(d.critics)&&!valid(d.audience))||(d.critics!==null&&!valid(d.critics))||(d.audience!==null&&!valid(d.audience))||(d.path!==null&&!(typeof d.path==='string'&&/^[a-zA-Z0-9_-]+$/.test(d.path)))))return null;
  return entry;
 }
 function remember(id,entry){if(closed)return;cache.set(id,entry);while(cache.size>2048)cache.delete(cache.keys().next().value);try{write?.run(id,JSON.stringify(entry));}catch{}}
 function cached(id){if(cache.has(id))return cache.get(id);try{const raw=read?.get(id)?.entry,entry=raw&&validEntry(JSON.parse(raw),id);if(entry){remember(id,entry);return entry;}}catch{}return null;}
 function info(id){const entry=cached(id),data=visible(entry);return {status:data?(entry.expires>now()&&entry.status==='ready'?'fresh':'stale'):entry?.status==='missing'&&entry.expires>now()?'missing':'unavailable',retryAt:Math.max(now()+15000,entry?.expires||0,cooldown)};}
 async function shared(id){const row=await sharedStore.getWithMetadata('movies/'+id,{type:'json'});return {entry:validEntry(row?.data,id),etag:row?.etag};}
 async function busyResult(id,entry){
  if(visible(entry)){remember(id,entry);return visible(entry);}
  // A concurrent cold reader may already be about to commit. Join briefly, never resend.
  for(let n=0;n<3;n++){await pause(1000);const next=await shared(id);if(next.entry?.expires>now()){remember(id,next.entry);return visible(next.entry);}}
  remember(id,{version:2,data:null,status:'error',expires:now()+15000});return null;
 }
 async function refresh(id,old,onStale){
  let entry=old,etag=null;
  try{
   if(sharedStore){
    const row=await shared(id);if(row.entry){entry=row.entry;remember(id,entry);if(visible(entry))onStale(visible(entry));}etag=row.etag;
    if(entry?.expires>now())return visible(entry);
    if(entry?.leaseUntil>now())return await busyResult(id,entry);
    const gate=await sharedStore.getWithMetadata('provider-cooldown',{type:'json'});
    if(Number.isFinite(gate?.data?.until))cooldown=Math.max(cooldown,Math.min(gate.data.until,now()+DAY));
    if(cooldown>now())return visible(entry);
    const claim={version:2,status:entry?.status||'error',data:visible(entry),expires:entry?.expires||0,leaseUntil:now()+LEASE};
    const acquired=await sharedStore.setJSON('movies/'+id,claim,etag?{onlyIfMatch:etag}:{onlyIfNew:true});
    if(!acquired?.modified||!acquired.etag)return await busyResult(id,entry);
    etag=acquired.etag;
   }
  }catch{
   // Unknown lock ownership after a storage failure: do not fan out duplicate provider traffic.
   remember(id,{version:2,data:visible(entry),status:'error',expires:now()+ERROR});return visible(entry);
  }
  let data=visible(entry),status='error',ttl=ERROR;
  try{
   const url=new URL('https://api.mdblist.com/imdb/movie/'+id+'/');url.searchParams.set('apikey',apiKey);
   const response=await fetcher(url,{signal:AbortSignal.timeout(timeout),redirect:'error',headers:{Accept:'application/json'}});
   if(!response.ok){
    if(response.status===429){const retry=Number(response.headers.get('retry-after'));cooldown=now()+(Number.isFinite(retry)&&retry>0?Math.min(DAY,retry*1000):DAY);}
    else if(response.status===401||response.status===403)cooldown=now()+15*60000;
    throw Error('upstream');
   }
   const text=await response.text();if(text.length>256000)throw Error('size');const body=JSON.parse(text);
   if(body.response===false&&/limit/i.test(String(body.error)))cooldown=now()+DAY;
   const fresh=normalizeRatings(body,id,new Date(now()).toISOString());data=fresh||visible(entry);status=fresh?'ready':'missing';ttl=fresh?FRESH:MISSING;
  }catch{/* Transient errors expire per film; only explicit provider limits pause other films. */}
  const next={version:2,data,status,expires:now()+ttl};
  if(!closed){
   let chosen=next;
   if(sharedStore&&etag){
    try{const committed=await sharedStore.setJSON('movies/'+id,next,{onlyIfMatch:etag});if(!committed?.modified){const latest=await shared(id);chosen=latest.entry||entry;data=visible(chosen);}}catch{}
    if(cooldown>now())try{const gate=await sharedStore.getWithMetadata('provider-cooldown',{type:'json'});if((gate?.data?.until||0)<cooldown)await sharedStore.setJSON('provider-cooldown',{until:cooldown},gate?.etag?{onlyIfMatch:gate.etag}:{onlyIfNew:true});}catch{}
   }
   if(chosen)remember(id,chosen);
  }
  return data;
 }
 return {
  get(id){return visible(cached(id));},
  cacheInfo:info,
  async details(id,{waitUntil}={}){
   if(closed||!/^tt\d{7,12}$/.test(id))return null;
   const old=cached(id);if(!apiKey||old?.expires>now()||cooldown>now())return visible(old);
   let work=pending.get(id);
   if(!work){
    if(pending.size>=4)return visible(old);
    let reveal;const stale=new Promise(resolve=>{reveal=resolve;});
    if(visible(old))reveal(visible(old));
    const job=Promise.resolve().then(()=>refresh(id,old,reveal)).finally(()=>pending.delete(id));
    work={job,stale};pending.set(id,work);
   }
   if(typeof waitUntil==='function'){try{waitUntil(work.job);return await Promise.race([work.job,work.stale]);}catch{}}
   return work.job;
  },
  close(){closed=true;db?.close();}
 };
}
