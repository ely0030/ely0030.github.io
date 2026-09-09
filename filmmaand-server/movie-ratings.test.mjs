import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovieRatings,normalizeRatings} from './runtime/planning/movie-ratings.mjs';
import {createMovieDiscovery} from './runtime/planning/movie-discovery.mjs';
const id='tt0133093',stamp='2026-09-09T00:00:00.000Z';
const body=(extra={})=>({imdb_id:id,type:'movie',ratings:[{source:'tomatoes',value:83},{source:'popcorn',value:85}],...extra});
test('exact IMDb lookup returns distinct RT percentages; never aggregate or TMDB rating',async()=>{
 let calls=0;const r=createMovieRatings({apiKey:'private-fixture',now:()=>Date.parse(stamp),fetcher:async(url,options)=>{calls++;assert.equal(url.origin,'https://api.mdblist.com');assert.equal(url.pathname,'/imdb/movie/'+id+'/');assert.equal(url.searchParams.get('apikey'),'private-fixture');assert.equal(options.redirect,'error');return Response.json(body({score:99}));}});
 const result=await r.details(id);assert.deepEqual(result,{imdbId:id,critics:83,audience:85,audienceKind:'unspecified',source:'MDBList',checkedAt:stamp,path:null});assert.equal(JSON.stringify(result).includes('private-fixture'),false);assert.deepEqual(await r.details(id),result);assert.equal(calls,1);r.close();
});
test('legacy audience alias supported; zero is a real score; unspecified subset stays honest',()=>{
 assert.equal(normalizeRatings(body({ratings:[{source:'tomatoes',value:0},{source:'tomatoesaudience',value:100}]}),id,stamp).critics,0);
 assert.equal(normalizeRatings(body({ratings:[{source:'tomatoesaudience',value:100}]}),id,stamp).audience,100);
 assert.equal(normalizeRatings(body({ratings:[{source:'tmdb',value:80}]}),id,stamp),null);
});
test('rejects wrong identity/type, invalid and ambiguous percentage fields',()=>{
 for(const extra of [{imdb_id:'tt0083658'},{type:'show'},{response:false},{error:'upstream'}])assert.throws(()=>normalizeRatings(body(extra),id,stamp));
 for(const value of [null,'83',NaN,-1,101,8.3])assert.equal(normalizeRatings(body({ratings:[{source:'tomatoes',value}]}),id,stamp),null);
 assert.equal(normalizeRatings(body({ratings:[{source:'tomatoes',value:10},{source:'tomatoes',value:20}]}),id,stamp),null);
});
test('no key and malformed IDs make no provider calls',async()=>{
 const fetcher=()=>{throw Error('must not call');};const disabled=createMovieRatings({fetcher});assert.equal(await disabled.details(id),null);disabled.close();
 const enabled=createMovieRatings({apiKey:'fixture',fetcher});assert.equal(await enabled.details('../user'),null);enabled.close();
});
test('simultaneous same-film reads join a single request',async()=>{
 let resolve,calls=0;const r=createMovieRatings({apiKey:'fixture',fetcher:()=>{calls++;return new Promise(r=>resolve=r);}});
 const a=r.details(id),b=r.details(id);await Promise.resolve();resolve(Response.json(body()));assert.deepEqual(await a,await b);assert.equal(calls,1);r.close();
});
test('cached scores refresh after seven days; failed refresh retains dated data only 30 days',async()=>{
 let time=Date.parse(stamp),calls=0;const r=createMovieRatings({apiKey:'fixture',now:()=>time,fetcher:async()=>{if(++calls>1)throw Error('offline');return Response.json(body());}});
 await r.details(id);time+=6*86400000;await r.details(id);assert.equal(calls,1);time+=2*86400000;assert.equal((await r.details(id)).checkedAt,stamp);assert.equal(calls,2);time+=23*86400000;assert.equal(await r.details(id),null);r.close();
});
test('missing ratings negatively cached, not replaced with IMDb/TMDB',async()=>{
 let calls=0;const r=createMovieRatings({apiKey:'fixture',fetcher:async()=>{calls++;return Response.json(body({ratings:[]}));}});assert.equal(await r.details(id),null);assert.equal(await r.details(id),null);assert.equal(calls,1);r.close();
});
test('429 cools down across movie IDs and exposes no upstream error',async()=>{
 let calls=0;const r=createMovieRatings({apiKey:'fixture',fetcher:async()=>{calls++;return new Response('private upstream text',{status:429,headers:{'retry-after':'600'}});}});assert.equal(await r.details(id),null);assert.equal(await r.details('tt0083658'),null);assert.equal(calls,1);r.close();
});
test('malformed/oversized/error payloads fail open',async()=>{
 for(const response of [()=>Response.json({error:'API Limit Reached!',response:false}),()=>new Response('bad json'),()=>new Response('x'.repeat(256001))]){
 const r=createMovieRatings({apiKey:'fixture',fetcher:async()=>response()});assert.equal(await r.details(id),null);r.close();}
});
test('search and poster hydration never spend rating requests; selected details enrich exact catalogue movie',async()=>{
 const movie={id,title:'The Matrix',year:1999,poster:'https://image.tmdb.org/t/p/w500/fixture.jpg'};let calls=0;
 const discovery=createMovieDiscovery({get:key=>key===id?movie:null,search:()=>[movie],close(){}},{creditsPath:'/nonexistent/fixture.sqlite',ratingsApiKey:'fixture',fetcher:async()=>{calls++;return Response.json(body());}});
 assert.equal((await discovery.search('Matrix'))[0].id,id);await discovery.details(id,{includeMetadata:false});assert.equal(calls,0);
 const details=await discovery.details(id);assert.equal(details.title,'The Matrix');assert.equal(details.poster,movie.poster);assert.equal(details.rtRatings.critics,83);assert.equal(calls,1);assert.equal(await discovery.details('tt0000000'),null);assert.equal(calls,1);discovery.close();
});

test('current live nested IMDb identity and canonical RT paths; reject conflicting or unsafe URLs',()=>{
 const data=body({imdb_id:undefined,ids:{imdb:id},ratings:[{source:'tomatoes',value:83,url:'/m/matrix'},{source:'popcorn',value:85,url:'/m/matrix'}]});
 assert.equal(normalizeRatings(data,id,stamp).path,'matrix');
 assert.throws(()=>normalizeRatings({...data,ids:{imdb:'tt0083658'}},id,stamp));
 data.ratings[1].url='/m/something_else';assert.equal(normalizeRatings(data,id,stamp).path,null);
 data.ratings=[{source:'tomatoes',value:83,url:'https://evil.example/m/matrix'}];assert.equal(normalizeRatings(data,id,stamp).path,null);
});

const DAY=86400000;
const defer=()=>{let resolve;const promise=new Promise(r=>{resolve=r});return {promise,resolve};};
function memoryShared(){
 const records=new Map();let sequence=0;
 return {records,async getWithMetadata(key){return structuredClone(records.get(key)||null);},async setJSON(key,data,options={}){
  const old=records.get(key);if(options.onlyIfNew&&old||options.onlyIfMatch&&old?.etag!==options.onlyIfMatch)return {modified:false};
  const etag=String(++sequence);records.set(key,{data:structuredClone(data),etag});return {modified:true,etag};
 }};
}
const record=(extra={})=>({version:2,data:normalizeRatings(body(),id,stamp),status:'ready',expires:Date.parse(stamp)+7*DAY,...extra});
test('shared fresh ratings survive helper restart and eliminate provider calls',async()=>{
 const store=memoryShared();let calls=0;const options={apiKey:'fixture',sharedStore:store,now:()=>Date.parse(stamp),fetcher:async()=>{calls++;return Response.json(body());}};
 const first=createMovieRatings(options);await first.details(id);first.close();const next=createMovieRatings(options);assert.equal((await next.details(id)).critics,83);assert.equal(calls,1);assert.equal(next.cacheInfo(id).status,'fresh');next.close();
});
test('two cold instances share one refresh lease and one provider call',async()=>{
 const store=memoryShared(),started=defer(),answer=defer();let calls=0;
 const options={apiKey:'fixture',sharedStore:store,fetcher:()=>{calls++;started.resolve();return answer.promise;}};
 const a=createMovieRatings(options),b=createMovieRatings(options),one=a.details(id),two=b.details(id);await started.promise;answer.resolve(Response.json(body()));
 assert.equal((await one).critics,83);assert.equal((await two).critics,83);assert.equal(calls,1);a.close();b.close();
});
test('stale shared score returns before slow refresh; waitUntil retains the refresh and coalesces readers',async()=>{
 const store=memoryShared(),answer=defer(),started=defer();let time=Date.parse(stamp)+8*DAY,calls=0;await store.setJSON('movies/'+id,record());
 const r=createMovieRatings({apiKey:'fixture',sharedStore:store,now:()=>time,fetcher:()=>{calls++;started.resolve();return answer.promise;}}),background=[];
 const result=await r.details(id,{waitUntil:p=>background.push(p)});assert.equal(result.checkedAt,stamp);await started.promise;
 assert.equal((await r.details(id,{waitUntil:p=>background.push(p)})).critics,83);assert.equal(calls,1);
 answer.resolve(Response.json(body({ratings:[{source:'tomatoes',value:84}]})));await Promise.all(background);assert.equal(r.get(id).critics,84);assert.equal(r.cacheInfo(id).status,'fresh');r.close();
});
test('expired worker lease can be recovered; old owner cannot overwrite the successor result',async()=>{
 let time=Date.parse(stamp);const store=memoryShared(),started=defer(),answer=defer();
 const first=createMovieRatings({apiKey:'fixture',sharedStore:store,now:()=>time,fetcher:()=>{started.resolve();return answer.promise;}});
 const slow=first.details(id);await started.promise;time+=11000;
 const second=createMovieRatings({apiKey:'fixture',sharedStore:store,now:()=>time,fetcher:async()=>Response.json(body({ratings:[{source:'tomatoes',value:90}]}))});
 assert.equal((await second.details(id)).critics,90);answer.resolve(Response.json(body()));assert.equal((await slow).critics,90);assert.equal((await store.getWithMetadata('movies/'+id)).data.data.critics,90);first.close();second.close();
});
test('confirmed missing result persists for a day; transient failures retry after a minute',async()=>{
 for(const missing of [true,false]){let time=Date.parse(stamp),calls=0;const store=memoryShared(),options={apiKey:'fixture',sharedStore:store,now:()=>time,fetcher:async()=>{calls++;if(!missing)throw Error('offline');return Response.json(body({ratings:[]}));}};
 const r=createMovieRatings(options);assert.equal(await r.details(id),null);assert.equal(r.cacheInfo(id).status,missing?'missing':'unavailable');r.close();
 time+=61000;const next=createMovieRatings(options);await next.details(id);assert.equal(calls,missing?1:2);next.close();}
});
test('storage read/claim failure does not fail details or spend duplicate provider requests',async()=>{
 for(const failure of ['read','write']){let calls=0;const store=memoryShared();if(failure==='read')store.getWithMetadata=async()=>{throw Error('offline');};else store.setJSON=async()=>{throw Error('offline');};
 const r=createMovieRatings({apiKey:'fixture',sharedStore:store,fetcher:async()=>{calls++;return Response.json(body());}});assert.equal(await r.details(id),null);assert.equal(calls,0);r.close();}
});
test('failed durable commit still returns verified data without claiming durable persistence',async()=>{
 const store=memoryShared(),original=store.setJSON;let writes=0;store.setJSON=async(...args)=>{if(++writes===2)throw Error('write failed');return original(...args);};
 const r=createMovieRatings({apiKey:'fixture',sharedStore:store,fetcher:async()=>Response.json(body())});assert.equal((await r.details(id)).critics,83);assert.equal((await store.getWithMetadata('movies/'+id)).data.data,null);r.close();
});
test('shared stale data beyond 30 days cannot be served, even on provider failure',async()=>{
 const store=memoryShared();await store.setJSON('movies/'+id,record());const r=createMovieRatings({apiKey:'fixture',sharedStore:store,now:()=>Date.parse(stamp)+31*DAY,fetcher:async()=>{throw Error('offline');}});const jobs=[];assert.equal(await r.details(id,{waitUntil:p=>jobs.push(p)}),null);await Promise.all(jobs);assert.equal(r.get(id),null);r.close();
});
test('shared provider cooldown suppresses a different movie lookup after a cold restart',async()=>{
 const store=memoryShared();let calls=0;const options={apiKey:'fixture',sharedStore:store,fetcher:async()=>{calls++;return new Response('',{status:429,headers:{'retry-after':'600'}});}};const a=createMovieRatings(options);await a.details(id);a.close();const b=createMovieRatings(options);assert.equal(await b.details('tt0083658'),null);assert.equal(calls,1);b.close();
});
test('production ratings namespace is stable across deploys; previews are separate',async()=>{
 const {ratingsCacheName}=await import('./runtime/planning/movie-ratings.mjs');assert.equal(ratingsCacheName({context:'production',id:'one'}),ratingsCacheName({context:'production',id:'two'}));assert.notEqual(ratingsCacheName({context:'production',id:'one'}),ratingsCacheName({context:'deploy-preview',id:'one'}));assert.notEqual(ratingsCacheName({context:'deploy-preview',id:'one'}),ratingsCacheName({context:'deploy-preview',id:'two'}));
});
test('movie API forwards waitUntil with its context, serving stale scores while refresh completes',async()=>{
 const {createApi}=await import('./api.mjs');const store=memoryShared(),answer=defer();await store.setJSON('movies/'+id,record());
 // Helper clock is intentionally controlled; the API/discovery forwarding is exercised through a wrapper.
 const ratings=createMovieRatings({apiKey:'fixture',sharedStore:store,now:()=>Date.parse(stamp)+8*DAY,fetcher:()=>answer.promise});
 const api=createApi({store:null,blobs:null,movieCatalogue:{async details(key,options){await ratings.details(key,options);return {id:key,rtRatings:ratings.get(key),rtRatingsCache:ratings.cacheInfo(key)};}}});
 const work=[],context={waitUntil(p){assert.equal(this,context);work.push(p);}};
 const response=await api(new Request('https://ely0030.xyz/filmmaand/api/movies/'+id),context),data=await response.json();assert.equal(data.movie.rtRatings.checkedAt,stamp);assert.equal(data.movie.rtRatingsCache.status,'stale');assert.equal(work.length,1);
 answer.resolve(Response.json(body({ratings:[{source:'tomatoes',value:88}]})));await Promise.all(work);assert.equal(ratings.get(id).critics,88);ratings.close();
});
test('missing refresh keeps the original dated score, without extending its 30-day age',async()=>{
 const store=memoryShared();await store.setJSON('movies/'+id,record());let time=Date.parse(stamp)+8*DAY;
 const r=createMovieRatings({apiKey:'fixture',sharedStore:store,now:()=>time,fetcher:async()=>Response.json(body({ratings:[]}))});assert.equal((await r.details(id)).checkedAt,stamp);assert.equal(r.cacheInfo(id).status,'stale');time=Date.parse(stamp)+31*DAY;assert.equal(await r.details(id),null);r.close();
});

test('a transient failure for one film does not suppress another film lookup',async()=>{
 let calls=0;const r=createMovieRatings({apiKey:'fixture',fetcher:async url=>{calls++;if(url.pathname.includes(id))throw Error('one film timeout');return Response.json(body({imdb_id:'tt0083658'}));}});
 assert.equal(await r.details(id),null);assert.equal((await r.details('tt0083658')).critics,83);assert.equal(calls,2);r.close();
});
