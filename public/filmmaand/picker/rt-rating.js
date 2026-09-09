// Dated fallback while automatic IMDb-matched ratings load or the provider is unavailable.
// Exact IMDb identities; RT media-scorecard-json audienceScore.scoreType=ALL for all three.
const scores = {
  tt0074486: {title:'Eraserhead',year:1977,percent:87,audience:82,path:'eraserhead'},
  tt0082971: {title:'Raiders of the Lost Ark',year:1981,percent:94,audience:96,path:'raiders_of_the_lost_ark'},
  tt0083658: {title:'Blade Runner',year:1982,percent:89,audience:91,path:'blade_runner'}
};
const valid=p=>Number.isInteger(p)&&p>=0&&p<=100;
const requests=new Map();
function lookup(id){
 const cached=requests.get(id);if(cached&&cached.until>Date.now())return cached.job;
 const job=(async()=>{try{
  const response=await fetch('/filmmaand/api/movies/'+encodeURIComponent(id),{signal:AbortSignal.timeout(10000)});
  if(!response.ok)return null;
  const {movie}=await response.json(),rt=movie?.rtRatings;
  if(movie?.id!==id||rt?.imdbId!==id||rt.source!=='MDBList'||!Number.isFinite(Date.parse(rt.checkedAt)))return null;
  if(!valid(rt.critics)&&!valid(rt.audience))return null;
  return {title:movie.title,year:movie.year,percent:rt.critics,audience:rt.audience,audienceKind:'unspecified',checkedAt:rt.checkedAt,source:'MDBList',path:typeof rt.path==='string'&&/^[a-zA-Z0-9_-]+$/.test(rt.path)?rt.path:null};
 }catch{return null;}})();
 requests.set(id,{job,until:Date.now()+5*60000});while(requests.size>256)requests.delete(requests.keys().next().value);return job;
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
 const fallback=Object.hasOwn(scores,id)?{...scores[id],audienceKind:'all',checkedAt:'2026-09-09T00:00:00Z'}:null;
 if(fallback)render(imdb,fallback);
 const score=await lookup(id);if(score&&imdb.isConnected)render(imdb,score);
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
