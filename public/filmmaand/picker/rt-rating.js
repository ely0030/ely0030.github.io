// Dated fallback while automatic IMDb-matched ratings load or the provider is unavailable.
// Exact IMDb identities, observed 2026-09-09; snapshots expire after 30 days.
// Manual RT scorecards use ALL audience; MDBList snapshots leave audience subset unspecified.
// The dated programme audit preserves last-known scores when upstream later returns null.
const scores = {
  tt0074486: {title:'Eraserhead',year:1977,percent:87,audience:82,path:'eraserhead'},
  tt0082971: {title:'Raiders of the Lost Ark',year:1981,percent:94,audience:96,path:'raiders_of_the_lost_ark'},
  tt0083658: {title:'Blade Runner',year:1982,percent:89,audience:91,path:'blade_runner'},
  tt0087469: {title:'Indiana Jones and the Temple of Doom',year:1984,percent:77,audience:82,path:'indiana_jones_and_the_temple_of_doom'},
  tt0120737: {title:'The Lord of the Rings: The Fellowship of the Ring',year:2001,percent:91,audience:95,path:'the_lord_of_the_rings_the_fellowship_of_the_ring'},
  tt0120669: {title:'Fear and Loathing in Las Vegas',year:1998,percent:50,audience:89,path:'fear_and_loathing_in_las_vegas'},
  tt0242653: {title:'The Matrix Revolutions',year:2003,percent:33,audience:60,path:'matrix_revolutions'},
  tt0372784: {title:'Batman Begins',year:2005,percent:85,audience:94,path:'batman_begins'},
  tt0079944: {title:'Stalker',year:1979,percent:100,audience:92,path:'1043378-stalker'},
  tt2631186: {title:'Baahubali: The Beginning',year:2015,percent:93,audience:85,path:'baahubali_the_beginning'},
  tt4849438: {title:'Baahubali 2: The Conclusion',year:2017,percent:90,audience:86,path:'baahubali_2_the_conclusion'},
  tt0086541: {"title":"Videodrome","year":1983,"percent":83,"audience":80,"path":"videodrome","source":"MDBList","audienceKind":"unspecified"},
  tt0090756: {"title":"Blue Velvet","year":1986,"percent":91,"audience":88,"path":"blue_velvet","source":"MDBList","audienceKind":"unspecified"},
  tt0091064: {"title":"The Fly","year":1986,"percent":83,"audience":83,"path":"1007602-fly","source":"MDBList","audienceKind":"unspecified"},
  tt0094625: {"title":"Akira","year":1988,"percent":88,"audience":90,"path":"akira","source":"MDBList","audienceKind":"unspecified"},
  tt0097576: {"title":"Indiana Jones and the Last Crusade","year":1989,"percent":84,"audience":94,"path":"indiana_jones_and_the_last_crusade","source":"MDBList","audienceKind":"unspecified"},
  tt0099939: {"title":"King of New York","year":1990,"percent":74,"audience":77,"path":"king_of_new_york","source":"MDBList","audienceKind":"unspecified"},
  tt0105665: {"title":"Twin Peaks: Fire Walk with Me","year":1992,"percent":67,"audience":78,"path":"twin-peaks-fire-walk-with-me","source":"MDBList","audienceKind":"unspecified"},
  tt0113568: {"title":"Ghost in the Shell","year":1995,"percent":95,"audience":89,"path":"ghost_in_the_shell","source":"MDBList","audienceKind":"unspecified"},
  tt0133093: {"title":"The Matrix","year":1999,"percent":83,"audience":85,"path":"matrix","source":"MDBList","audienceKind":"unspecified"},
  tt0167260: {"title":"The Lord of the Rings: The Return of the King","year":2003,"percent":94,"audience":86,"path":"the_lord_of_the_rings_the_return_of_the_king","source":"MDBList","audienceKind":"unspecified"},
  tt0167261: {"title":"The Lord of the Rings: The Two Towers","year":2002,"percent":95,"audience":95,"path":"the_lord_of_the_rings_the_two_towers","source":"MDBList","audienceKind":"unspecified"},
  tt0172493: {"title":"Girl, Interrupted","year":1999,"percent":53,"audience":84,"path":"girl_interrupted","source":"MDBList","audienceKind":"unspecified"},
  tt0234215: {"title":"The Matrix Reloaded","year":2003,"percent":74,"audience":72,"path":"matrix_reloaded","source":"MDBList","audienceKind":"unspecified"},
  tt0383028: {"title":"Synecdoche, New York","year":2008,"percent":69,"audience":71,"path":"synecdoche_new_york","source":"MDBList","audienceKind":"unspecified"},
  tt0811080: {"title":"Speed Racer","year":2008,"percent":43,"audience":60,"path":"speed_racer","source":"MDBList","audienceKind":"unspecified"},
  tt10128846: {"title":"Megalopolis","year":2024,"percent":46,"audience":34,"path":"megalopolis","source":"MDBList","audienceKind":"unspecified"},
  tt1131734: {"title":"Jennifer’s Body","year":2009,"percent":47,"audience":36,"path":"jennifers_body","source":"MDBList","audienceKind":"unspecified"},
  tt1483797: {"title":"Redline","year":2009,"percent":70,"audience":91,"path":"redline_2011","source":"MDBList","audienceKind":"unspecified"},
  tt1856101: {"title":"Blade Runner 2049","year":2017,"percent":88,"audience":88,"path":"blade_runner_2049","source":"MDBList","audienceKind":"unspecified"},
  tt0468569: {"title":"The Dark Knight","year":2008,"percent":94,"audience":94,"path":"the_dark_knight","source":"MDBList","audienceKind":"unspecified"},
  tt1345836: {"title":"The Dark Knight Rises","year":2012,"percent":87,"audience":90,"path":"the_dark_knight_rises","source":"MDBList","audienceKind":"unspecified"},
  tt0441773: {"title":"Kung Fu Panda","year":2008,"percent":87,"audience":83,"path":"kung_fu_panda","source":"MDBList","audienceKind":"unspecified"},
  tt1302011: {"title":"Kung Fu Panda 2","year":2011,"percent":82,"audience":74,"path":"kung_fu_panda_the_kaboom_of_doom","source":"MDBList","audienceKind":"unspecified"},
  tt2883512: {"title":"Chef","year":2014,"percent":87,"audience":85,"path":"chef_2014","source":"MDBList","audienceKind":"unspecified"},
  tt0382932: {"title":"Ratatouille","year":2007,"percent":96,"audience":87,"path":"ratatouille","source":"MDBList","audienceKind":"unspecified"},
  tt0069293: {"title":"Solaris","year":1972,"percent":92,"audience":89,"path":"solaris_1976","source":"MDBList","audienceKind":"unspecified"}
};
const valid=p=>Number.isInteger(p)&&p>=0&&p<=100;
const requests=new Map(),saved=new Map(),CACHE_KEY='filmmaand-rt-ratings-v2',HOUR=3600000,MAX_AGE=30*86400000;
let loaded=false;
function validSaved(id,score){return score&&score.imdbId===id&&score.source==='MDBList'&&typeof score.title==='string'&&score.title.length<=300&&(valid(score.percent)||valid(score.audience))&&Number.isFinite(Date.parse(score.checkedAt))&&Date.parse(score.checkedAt)<=Date.now()+60000&&Date.now()-Date.parse(score.checkedAt)<=MAX_AGE&&(!score.path||typeof score.path==='string'&&/^[a-zA-Z0-9_-]+$/.test(score.path));}
function readSaved(id){
 if(!loaded){loaded=true;try{const raw=localStorage.getItem(CACHE_KEY);if(raw&&raw.length<=200000){const rows=JSON.parse(raw);if(Array.isArray(rows))for(const [key,entry] of rows.slice(-128)){if(/^tt\d{7,12}$/.test(key)&&Number.isFinite(entry?.until)&&entry.until<=Date.now()+HOUR&&(entry.score===null||validSaved(key,entry.score)))saved.set(key,entry);}}}catch{}}
 const entry=saved.get(id);if(entry?.score&&!validSaved(id,entry.score)){saved.delete(id);return null;}return entry;
}
function save(id,score,until){
 saved.delete(id);saved.set(id,{score,until});while(saved.size>128)saved.delete(saved.keys().next().value);
 try{localStorage.setItem(CACHE_KEY,JSON.stringify([...saved]));}catch{}
}
function lookup(id){
 const old=readSaved(id);if(old&&old.until>Date.now())return Promise.resolve(old.score);
 if(requests.has(id))return requests.get(id);
 const job=Promise.resolve().then(async()=>{try{
  const response=await fetch('/filmmaand/api/movies/'+encodeURIComponent(id),{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('unavailable');
  const {movie}=await response.json(),rt=movie?.rtRatings,meta=movie?.rtRatingsCache;
  if(movie?.id!==id)throw Error('identity');
  let score=null;
  if(rt){
   score={imdbId:id,title:movie.title,year:movie.year,percent:rt.critics,audience:rt.audience,audienceKind:'unspecified',checkedAt:rt.checkedAt,source:rt.source,path:typeof rt.path==='string'&&/^[a-zA-Z0-9_-]+$/.test(rt.path)?rt.path:null};
   if(rt.imdbId!==id||!validSaved(id,score))throw Error('rating');
  }
  const status=meta?.status||(score&&Date.now()-Date.parse(score.checkedAt)<7*86400000?'fresh':'unavailable');
  // Absolute server freshness is never reset merely because a cached value was read again.
  const budget=status==='fresh'||status==='missing'?HOUR:15000;
  const serverUntil=Number.isFinite(meta?.retryAt)?meta.retryAt:score?Date.parse(score.checkedAt)+7*86400000:Date.now()+15000;
  const until=Math.max(Date.now()+15000,Math.min(Date.now()+budget,serverUntil));
  score=score||old?.score||null;save(id,score,until);return score;
 }catch{const score=old?.score||null;save(id,score,Date.now()+15000);return score;}
 finally{requests.delete(id);}});requests.set(id,job);return job;
}
function alignWithTitle(imdb){
 const record=imdb.closest('.hp-film-record'),chosen=imdb.closest('.hp-chosen-movie');
 const heading=record?.querySelector('.hp-record-title')||chosen?.querySelector('h3')||imdb.closest('.hp-layout')?.querySelector('.hp-caption h2');
 if(!heading)return;
 let row=heading.parentElement;
 if(!row.classList.contains('hp-rating-heading')){row=document.createElement('div');row.className='hp-rating-heading';heading.replaceWith(row);row.append(heading);}
 const group=imdb.parentElement?.classList.contains('hp-film-ratings')?imdb.parentElement:imdb;
 if(group.parentElement!==row)row.append(group);
}
export async function mountRating(imdb,id){
 if(!imdb?.isConnected||!/^tt\d{7,12}$/.test(id||''))return;
 if(!document.getElementById('filmmaand-rt-style')){const css=document.createElement('link');css.id='filmmaand-rt-style';css.rel='stylesheet';css.href='/filmmaand/picker/rt-rating.css';document.head.append(css)}
 alignWithTitle(imdb);
 const fallback=Object.hasOwn(scores,id)&&Date.now()-Date.parse('2026-09-09T00:00:00Z')<=MAX_AGE?{audienceKind:'all',checkedAt:'2026-09-09T00:00:00Z',...scores[id]}:null;
 if(fallback)render(imdb,fallback);
 const cached=readSaved(id)?.score;
 if(cached&&(!fallback||!cached.path||cached.path===fallback.path))render(imdb,cached);
 const score=await lookup(id);
 // A checked RT identity wins over a provider mapping to a different entry/version.
 if(score&&imdb.isConnected&&(!fallback||!score.path||score.path===fallback.path))render(imdb,score);
}
function render(imdb,score){
 if(!valid(score.percent)&&!valid(score.audience))return;
 let ratings=imdb.parentElement;
 if(!ratings?.classList.contains('hp-film-ratings')){ratings=document.createElement('span');ratings.className='hp-film-ratings';imdb.replaceWith(ratings);ratings.append(imdb);}
 ratings.querySelectorAll('.hp-rt-rating').forEach(n=>n.remove());
 const checked=new Intl.DateTimeFormat('nl-NL',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(score.checkedAt));
 for(const audience of [false,true]){
  const percent=audience?score.audience:score.percent;if(!valid(percent))continue;
  const all=score.audienceKind==='all',label=audience?(all?'Publiek (alle)':'Publiek'):'Critici';
  const metric=audience?'Popcornmeter'+(all?' · alle publieksbeoordelingen':''):'Tomatometer · critici';
  const link=document.createElement('a');link.className='hp-rt-rating';link.dataset.metric=audience?(all?'audience-all':'audience'):'critics';
  link.href=score.path?'https://www.rottentomatoes.com/m/'+score.path:'https://www.rottentomatoes.com/search?search='+encodeURIComponent(score.title);
  link.target='_blank';link.rel='noopener noreferrer';link.title=score.title+' ('+score.year+') · Rotten Tomatoes® '+metric+' · '+(score.source?'opgehaald via '+score.source:'gecontroleerd')+' '+checked+(score.path?'':' · Zoek op Rotten Tomatoes');link.setAttribute('aria-label',link.title+' · '+percent+' procent');
  const line=document.createElement('span');line.className='hp-rt-score';const logo=document.createElement('img');logo.src='/filmmaand/site/ratings/'+(audience?'popcorn':'tomatometer')+'-'+(percent>=60?'fresh':'rotten')+'.svg';logo.alt=audience?'Rotten Tomatoes® Popcornmeter':'Rotten Tomatoes® Tomatometer';logo.width=18;logo.height=18;logo.addEventListener('error',()=>{logo.replaceWith(document.createTextNode(audience?'Publiek ':'RT '))},{once:true});
  const number=document.createElement('span');number.className='hp-rt-number';number.textContent=percent+'%';line.append(logo,number);
  const date=document.createElement('small');date.textContent=label+' · '+checked;link.append(line,date);ratings.insertBefore(link,imdb);
 }
}
