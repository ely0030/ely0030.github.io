// Manually checked critic-score snapshot, 2026-09-09. Not a live API.
// Exact IMDb movie identities; source pages include title/year/director.
const scores = {
  tt0074486: {title:'Eraserhead',year:1977,percent:87,path:'eraserhead'},
  tt0082971: {title:'Raiders of the Lost Ark',year:1981,percent:94,path:'raiders_of_the_lost_ark'},
  tt0083658: {title:'Blade Runner',year:1982,percent:89,path:'blade_runner'}
};
export function mountRating(imdb,id){
  const score=Object.hasOwn(scores,id)?scores[id]:null;
  if(!imdb?.isConnected||!score||!Number.isInteger(score.percent)||score.percent<0||score.percent>100||imdb.previousElementSibling?.classList.contains('hp-rt-rating'))return;
  if(!document.getElementById('filmmaand-rt-style')){const css=document.createElement('link');css.id='filmmaand-rt-style';css.rel='stylesheet';css.href='/filmmaand/picker/rt-rating.css';document.head.append(css)}
  const ratings=document.createElement('span');ratings.className='hp-film-ratings';imdb.replaceWith(ratings);ratings.append(imdb);
  const link=document.createElement('a');link.className='hp-rt-rating';link.href='https://www.rottentomatoes.com/m/'+score.path;link.target='_blank';link.rel='noopener noreferrer';link.title=score.title+' ('+score.year+') · Rotten Tomatoes® Tomatometer · critici · gecontroleerd 9 september 2026';link.setAttribute('aria-label',link.title+' · '+score.percent+' procent');
  const line=document.createElement('span');line.className='hp-rt-score';const logo=document.createElement('img');logo.src='/filmmaand/site/ratings/tomatometer-'+(score.percent>=60?'fresh':'rotten')+'.svg';logo.alt='Rotten Tomatoes®';logo.width=18;logo.height=18;logo.addEventListener('error',()=>{logo.replaceWith(document.createTextNode('Rotten Tomatoes® '))},{once:true});line.append(logo,document.createTextNode(score.percent+'%'));
  const date=document.createElement('small');date.textContent='Critici · 9 sep 2026';link.append(line,date);ratings.prepend(link);
}
