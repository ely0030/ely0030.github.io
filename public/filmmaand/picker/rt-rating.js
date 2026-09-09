// Manually checked snapshot, 2026-09-09. Not a live API.
// Exact IMDb identities; RT media-scorecard-json audienceScore.scoreType=ALL for all three.
const scores = {
  tt0074486: {title:'Eraserhead',year:1977,percent:87,audience:82,path:'eraserhead'},
  tt0082971: {title:'Raiders of the Lost Ark',year:1981,percent:94,audience:96,path:'raiders_of_the_lost_ark'},
  tt0083658: {title:'Blade Runner',year:1982,percent:89,audience:91,path:'blade_runner'}
};
const valid=p=>Number.isInteger(p)&&p>=0&&p<=100;
function alignWithTitle(imdb){
 const record=imdb.closest('.hp-film-record'),chosen=imdb.closest('.hp-chosen-movie');
 const heading=record?.querySelector('.hp-record-title')||chosen?.querySelector('h3')||imdb.closest('.hp-layout')?.querySelector('.hp-caption h2');
 if(!heading)return;
 let row=heading.parentElement;
 if(!row.classList.contains('hp-rating-heading')){row=document.createElement('div');row.className='hp-rating-heading';heading.replaceWith(row);row.append(heading);}
 const group=imdb.parentElement?.classList.contains('hp-film-ratings')?imdb.parentElement:imdb;
 if(group.parentElement!==row)row.append(group);
}
export function mountRating(imdb,id){
  if(!imdb?.isConnected)return;
  if(!document.getElementById('filmmaand-rt-style')){const css=document.createElement('link');css.id='filmmaand-rt-style';css.rel='stylesheet';css.href='/filmmaand/picker/rt-rating.css';document.head.append(css)}
  alignWithTitle(imdb);
  const score=Object.hasOwn(scores,id)?scores[id]:null;
  if(!score||!valid(score.percent)||imdb.parentElement?.classList.contains('hp-film-ratings'))return;
  const ratings=document.createElement('span');ratings.className='hp-film-ratings';imdb.replaceWith(ratings);
  for(const audience of [false,true]){
    const percent=audience?score.audience:score.percent;if(!valid(percent))continue;
    const label=audience?'Publiek (alle)':'Critici',metric=audience?'Popcornmeter · alle publieksbeoordelingen':'Tomatometer · critici';
    const link=document.createElement('a');link.className='hp-rt-rating';link.dataset.metric=audience?'audience-all':'critics';link.href='https://www.rottentomatoes.com/m/'+score.path;link.target='_blank';link.rel='noopener noreferrer';link.title=score.title+' ('+score.year+') · Rotten Tomatoes® '+metric+' · gecontroleerd 9 september 2026';link.setAttribute('aria-label',link.title+' · '+percent+' procent');
    const line=document.createElement('span');line.className='hp-rt-score';const logo=document.createElement('img');logo.src='/filmmaand/site/ratings/'+(audience?'popcorn':'tomatometer')+'-'+(percent>=60?'fresh':'rotten')+'.svg';logo.alt=audience?'Rotten Tomatoes® Popcornmeter':'Rotten Tomatoes® Tomatometer';logo.width=18;logo.height=18;logo.addEventListener('error',()=>{logo.replaceWith(document.createTextNode(audience?'Publiek ':'RT '))},{once:true});
    const number=document.createElement('span');number.className='hp-rt-number';number.textContent=percent+'%';line.append(logo,number);
    const date=document.createElement('small');date.textContent=label+' · 9 sep 2026';link.append(line,date);ratings.append(link);
  }
  ratings.append(imdb);
}
