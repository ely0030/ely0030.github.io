import {DatabaseSync} from 'node:sqlite';
const DAY=86400000;
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
// Optional, private enrichment. No key means no calls; failures never break movie details.
// SQLite is optional for long-running local deployments; warm serverless instances cache in memory.
export function createMovieRatings({apiKey='',fetcher=fetch,now=Date.now,timeout=2500,cachePath=null}={}){
 const db=cachePath?new DatabaseSync(cachePath):null;
 db?.exec('CREATE TABLE IF NOT EXISTS movie_rt_ratings_v1(id TEXT PRIMARY KEY,data TEXT NOT NULL,expires INTEGER NOT NULL)');
 const read=db?.prepare('SELECT data,expires FROM movie_rt_ratings_v1 WHERE id=?'),write=db?.prepare('INSERT OR REPLACE INTO movie_rt_ratings_v1 VALUES(?,?,?)');
 const cache=new Map(),pending=new Map();let cooldown=0,closed=false;
 function remember(id,entry){cache.set(id,entry);while(cache.size>2048)cache.delete(cache.keys().next().value);}
 function cached(id){if(cache.has(id))return cache.get(id);try{const row=read?.get(id);if(row){const entry={data:JSON.parse(row.data),expires:row.expires};remember(id,entry);return entry;}}catch{}return null;}
 const visible=entry=>entry?.data&&now()-Date.parse(entry.data.checkedAt)<=30*DAY?entry.data:null;
 return {
  get(id){return visible(cached(id));},
  async details(id){
   if(closed||!/^tt\d{7,12}$/.test(id))return null;
   const old=cached(id);if(!apiKey||old?.expires>now()||cooldown>now())return visible(old);
   if(pending.has(id))return pending.get(id);if(pending.size>=4)return visible(old);
   const job=(async()=>{let data=visible(old),ttl=15*60000;
    try{
     const url=new URL('https://api.mdblist.com/imdb/movie/'+id+'/');url.searchParams.set('apikey',apiKey);
     const response=await fetcher(url,{signal:AbortSignal.timeout(timeout),redirect:'error',headers:{Accept:'application/json'}});
     if(!response.ok){
      if(response.status===429){const retry=Number(response.headers.get('retry-after'));cooldown=now()+(Number.isFinite(retry)&&retry>0?Math.min(DAY,retry*1000):DAY);}
      else if(response.status===401||response.status===403)cooldown=now()+15*60000;
      throw Error('upstream');
     }
     const text=await response.text();if(text.length>256000)throw Error('size');
     const body=JSON.parse(text);
     if(body.response===false&&/limit/i.test(String(body.error)))cooldown=now()+DAY;
     data=normalizeRatings(body,id,new Date(now()).toISOString());ttl=data?7*DAY:DAY;
    }catch{cooldown=Math.max(cooldown,now()+60000);}
    finally{pending.delete(id);if(!closed){const entry={data,expires:now()+ttl};remember(id,entry);try{write?.run(id,JSON.stringify(data),entry.expires);}catch{}}}
    return data;
   })();pending.set(id,job);return job;
  },
  close(){closed=true;db?.close();}
 };
}
