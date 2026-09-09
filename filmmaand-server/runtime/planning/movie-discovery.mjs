import {createMovieRatings} from './movie-ratings.mjs';
import {createMovieMetadata} from './movie-metadata.mjs';
import {DatabaseSync} from 'node:sqlite';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
// Optional visual enrichment. The local catalogue remains the authority for movie identity.
// IMDb's public suggestion feed is not a supported API: fail back to local results.
export function createMovieDiscovery(catalogue,{fetcher=fetch,timeout=1800,cachePath=null,metadataToken='',metadataApiKey='',ratingsApiKey='',ratingsStore=null,artwork={},creditsPath=fileURLToPath(new URL('./.data/movie-credits.sqlite',import.meta.url))}={}){
 const ratings=createMovieRatings({cachePath,fetcher,apiKey:ratingsApiKey,sharedStore:ratingsStore});
 const metadata=createMovieMetadata({cachePath,fetcher,token:metadataToken,apiKey:metadataApiKey});
 const artDB=cachePath?new DatabaseSync(cachePath):null;if(artDB)artDB.exec('CREATE TABLE IF NOT EXISTS artwork(id TEXT PRIMARY KEY,data TEXT NOT NULL)');const artRead=artDB?.prepare('SELECT data FROM artwork WHERE id=?'),artWrite=artDB?.prepare('INSERT OR REPLACE INTO artwork VALUES (?,?)');
 const cache=new Map(),pending=new Map(),extras=new Map();let credits=null,creditQuery=null;
 if(existsSync(creditsPath)){credits=new DatabaseSync(creditsPath,{readOnly:true});creditQuery=credits.prepare('SELECT directors FROM movie_credits WHERE id=?');}
 const attach=movie=>{if(!movie)return null;const out={...movie,rtRatings:ratings.get(movie.id),rtRatingsCache:ratings.cacheInfo(movie.id),...metadata.get(movie.id),...(extras.get(movie.id)||JSON.parse(artRead?.get(movie.id)?.data||'{}')),...(artwork[movie.id]||{}),directors:creditQuery?JSON.parse(creditQuery.get(movie.id)?.directors||'[]'):[]};if(!out.poster&&out.metadataPoster){out.poster=out.metadataPoster;out.posterFull=out.metadataPoster;}return out;};
 async function enrich(query){const key=query.toLowerCase().trim();if(key.length<2||key.length>120)return;
  if(cache.get(key)>Date.now())return;if(pending.has(key))return pending.get(key);if(pending.size>=24)return;
  const job=(async()=>{try{
   const response=await fetcher('https://v3.sg.media-imdb.com/suggestion/x/'+encodeURIComponent(key)+'.json',{signal:AbortSignal.timeout(timeout)});
   if(!response.ok)throw Error('upstream');
   const text=await response.text();if(text.length>128000)throw Error('size');const body=JSON.parse(text);
   for(const row of Array.isArray(body.d)?body.d.slice(0,20):[]){if(row.qid!=='movie'||!/^tt\d{7,12}$/.test(row.id)||!catalogue.get(row.id))continue;
    let poster=null;try{const url=new URL(row.i?.imageUrl);if(url.protocol==='https:'&&url.hostname==='m.media-amazon.com'&&url.pathname.startsWith('/images/M/')&&!url.search&&!url.hash)poster=url.href.replace(/\._V1_\.[a-z]+$/i,'._V1_QL75_UX120_.jpg')}catch{}
    const cast=typeof row.s==='string'?row.s.split(',').map(x=>x.trim()).filter(x=>x.length&&x.length<=100&&!/[<>\x00-\x1f]/.test(x)).slice(0,4):[];
    const data={poster,posterFull:poster?.replace('UX120_','UX600_')||null,cast};extras.set(row.id,data);if(poster)artWrite?.run(row.id,JSON.stringify(data));
   }cache.set(key,Date.now()+3600000);
  }catch{cache.set(key,Date.now()+30000)}finally{pending.delete(key);if(cache.size>256)cache.delete(cache.keys().next().value);while(extras.size>2048)extras.delete(extras.keys().next().value);}})();pending.set(key,job);return job;
 }
 return{async search(query,limit=8,{waitForArtwork=true}={}){const movies=catalogue.search(query,limit);if(!waitForArtwork)return movies.map(attach);let next=0;await Promise.all(Array.from({length:Math.min(4,movies.length)},async()=>{while(next<movies.length){const m=movies[next++];if(!attach(m).poster)await enrich(m.id)}}));return movies.map(attach)},async details(id,{includeMetadata=true,waitUntil}={}){const movie=catalogue.get(id);if(!movie)return null;await Promise.all([!attach(movie).poster?enrich(id):null,includeMetadata?metadata.details(id):null,includeMetadata?ratings.details(id,{waitUntil}):null]);const out=attach(movie);if(!out.poster&&out.metadataPoster)out.poster=out.posterFull=out.metadataPoster;return out},get(id){return attach(catalogue.get(id))},close(){ratings.close();metadata.close();artDB?.close();credits?.close();catalogue.close()}};
}
