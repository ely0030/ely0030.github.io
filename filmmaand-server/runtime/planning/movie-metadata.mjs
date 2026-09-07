import {DatabaseSync} from 'node:sqlite';
const DAY=86400000;
const trustedImage=value=>{try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='image.tmdb.org'&&!u.username&&!u.password&&!u.port?u.href:null}catch{return null}};
// TMDB metadata is optional; local IMDb IDs remain the catalogue identity.
export function createMovieMetadata({cachePath=null,fetcher=fetch,now=Date.now,timeout=2500,token=process.env.TMDB_READ_ACCESS_TOKEN||'',apiKey='',language='nl-NL'}={}){
 const db=cachePath?new DatabaseSync(cachePath):null;
 db?.exec('CREATE TABLE IF NOT EXISTS tmdb_metadata_nl_v2(id TEXT PRIMARY KEY,data TEXT NOT NULL,expires INTEGER NOT NULL)');
 const select=db?.prepare('SELECT data,expires FROM tmdb_metadata_nl_v2 WHERE id=?'),save=db?.prepare('INSERT OR REPLACE INTO tmdb_metadata_nl_v2 VALUES (?,?,?)');
 const memory=new Map(),pending=new Map();let closed=false,cooldownUntil=0;
 function read(id){id=language+':'+id;if(memory.has(id))return memory.get(id);const row=select?.get(id);if(row){const v={data:JSON.parse(row.data),expires:row.expires};memory.set(id,v);return v}return null}
 function get(id){return read(id)?.data||{}}
 function unavailable(r){
  if(r.status===429){const value=r.headers?.get?.('retry-after'),seconds=Number(value);const retry=value?(Number.isFinite(seconds)?now()+seconds*1000:Date.parse(value)):NaN;cooldownUntil=Math.max(cooldownUntil,Number.isFinite(retry)?Math.min(now()+DAY,Math.max(now()+1000,retry)):now()+60000);}
  else if(r.status===401||r.status===403)cooldownUntil=Math.max(cooldownUntil,now()+15*60000);
  else if(r.status>=500)cooldownUntil=Math.max(cooldownUntil,now()+30000);
  throw Error('metadata unavailable');
 }
 async function details(id){if((!token&&!apiKey)||closed||!/^tt\d{7,12}$/.test(id))return {};const old=read(id);if(old?.expires>now())return old.data;if(cooldownUntil>now())return old?.data||{};if(pending.has(id))return pending.get(id);if(pending.size>=4)return old?.data||{};
 const job=(async()=>{let data=old?.data||{},expires=now()+15*60000;try{
 const signal=AbortSignal.timeout(timeout),headers={...(apiKey?{}:{Authorization:'Bearer '+token}),Accept:'application/json'};
 const r=await fetcher('https://api.themoviedb.org/3/find/'+id+'?external_source=imdb_id&language='+encodeURIComponent(language)+(apiKey?'&api_key='+encodeURIComponent(apiKey):''),{signal,headers});if(!r.ok)unavailable(r);
 const text=await r.text();if(text.length>256000)throw Error('metadata too large');const rows=JSON.parse(text).movie_results;if(!Array.isArray(rows)||rows.length>1)throw Error('ambiguous metadata');const m=rows[0];if(!m){data={};expires=now()+DAY;return data}if(!Number.isInteger(m.id)||m.id<=0)throw Error('metadata identity mismatch');
 let overview=typeof m.overview==='string'?m.overview.trim():'',overviewLanguage=language;
 if(!overview&&language!=='en-US'){try{const fallback=await fetcher('https://api.themoviedb.org/3/movie/'+m.id+'?language=en-US'+(apiKey?'&api_key='+encodeURIComponent(apiKey):''),{signal,headers});if(!fallback.ok)unavailable(fallback);if(fallback.ok){const text=await fallback.text();if(text.length<=256000){const en=JSON.parse(text);if(en.id===m.id&&typeof en.overview==='string'){overview=en.overview.trim();overviewLanguage='en-US'}}}}catch{cooldownUntil=Math.max(cooldownUntil,now()+30000)}}
 const image=(path,size)=>typeof path==='string'&&/^\/[a-zA-Z0-9_-]+\.(jpg|png|webp)$/.test(path)?trustedImage('https://image.tmdb.org/t/p/'+size+path):null;
 data={overviewLanguage,backdrop:image(m.backdrop_path,'w1280'),metadataPoster:image(m.poster_path,'w500'),overview:overview.length<=8000&&!/[<>\x00-\x08\x0b\x0c\x0e-\x1f]/.test(overview)?overview:'',metadataSource:'TMDB',metadataUrl:'https://www.themoviedb.org/movie/'+m.id};
 expires=now()+7*DAY;
 }catch{cooldownUntil=Math.max(cooldownUntil,now()+30000)}finally{if(!closed){memory.set(language+':'+id,{data,expires});save?.run(language+':'+id,JSON.stringify(data),expires);if(memory.size>2048)memory.delete(memory.keys().next().value)}pending.delete(id)}return data})();pending.set(id,job);return job;
 }
 return {get,details,close(){closed=true;db?.close()}};
}
