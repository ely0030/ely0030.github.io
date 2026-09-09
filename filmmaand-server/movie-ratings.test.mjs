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
 const a=r.details(id),b=r.details(id);resolve(Response.json(body()));assert.deepEqual(await a,await b);assert.equal(calls,1);r.close();
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
