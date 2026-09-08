/* Composition presentation. The picker owns the draft and canonical save receipt. */
(()=>{'use strict';
const art=url=>typeof url==='string'&&/^https:\/\/(?:m\.media-amazon\.com\/images\/M\/|image\.tmdb\.org\/t\/p\/)/.test(url);
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
function poster(movie){const box=el('span','tc-poster',String(movie.year||'Film'));const src=[movie.posterFull,movie.poster,movie.metadataPoster].find(art);if(src){const img=el('img');img.src=src;img.alt='';img.onerror=()=>img.remove();box.append(img)}return box}
window.mountThemeComposer=(host,{draft,disabled=false,persist,rerender})=>{
 if(!Array.isArray(draft.movies))draft.movies=[];host.classList.add('tc-composer',draft.themeStep==='details'?'is-details':'is-picking');
 const button=(text,cls,action)=>{const b=el('button',cls,text);b.type='button';b.disabled=disabled;b.onclick=action;return b};
 const go=step=>{if(disabled)return;draft.themeStep=step;persist();rerender();const dialog=document.querySelector('.films-add-panel');if(dialog)dialog.scrollTop=0;document.querySelector('[data-focus="'+(step==='details'?'suggest-title':'movie-query')+'"]')?.focus({preventScroll:true})};
 const steps=el('div','tc-steps');steps.setAttribute('aria-label','Stap '+(draft.themeStep==='details'?'2':'1')+' van 2');steps.append(el('span',draft.themeStep!=='details'?'is-current':'','1  Kies films'),el('span','','→'),el('span',draft.themeStep==='details'?'is-current':'','2  Maak je thema af'));if(draft.themeStep!=='details')host.append(steps);
 if(draft.themeStep==='details'){
  const back=button('← Films wijzigen','tc-back',()=>go('films'));back.dataset.focus='theme-back';host.append(back);
  const preview=el('div','tc-preview'),posters=el('div','tc-preview-posters');
  if(draft.image?.url){const frame=el('span','tc-poster'),img=el('img');img.src=draft.image.url;img.alt='Je gekozen cover';img.onerror=()=>img.remove();frame.append(img);posters.append(frame)}else if(draft.movies.length)posters.append(poster(draft.movies[0]));else posters.append(el('span','tc-poster','Cover'));
  const copy=el('div','tc-preview-copy');copy.append(el('strong','',draft.movies.length?draft.movies.length+' '+(draft.movies.length===1?'film':'films'):'Eigen thema'));if(draft.movies.length)copy.append(el('p','',draft.movies.map(m=>m.title).join(' · ')));preview.append(posters,copy);host.append(preview);
  const label=el('label','tc-title-label','Naam van je thema'),title=el('input','tc-title');title.type='text';title.maxLength=120;title.required=true;title.placeholder='Bijv. Ruimtereis';title.value=draft.title||'';title.disabled=disabled;title.dataset.focus='suggest-title';title.oninput=()=>{draft.title=title.value;persist()};label.append(title);host.insertBefore(label,preview);
  return {destroy(){}};
 }
 const search=el('div','hp-movie-search tc-search');host.append(search);
 const selected=el('section','tc-selected'),heading=el('div','tc-heading'),count=el('h3'),list=el('ol','tc-lineup'),empty=el('p','tc-empty','Je gekozen films komen hier te staan.');list.setAttribute('aria-label','Films in je thema, in volgorde');heading.append(count);selected.append(heading,list,empty);host.append(selected);
 const footer=el('div','tc-next-row'),skip=button('Verder zonder films','tc-skip',()=>go('details')),next=button('Verder →','tc-next',()=>go('details'));next.dataset.focus='theme-next';footer.append(skip,next);host.append(footer);
 let searchMount;
 function paint(){
  count.textContent='Jouw films'+(draft.movies.length?' · '+draft.movies.length:'');empty.hidden=!!draft.movies.length;skip.hidden=!!draft.movies.length;next.disabled=disabled||!draft.movies.length;
  list.replaceChildren();draft.movies.forEach((movie,index)=>{
   const item=el('li','tc-film'),copy=el('div','tc-film-copy');copy.append(el('strong','',movie.title),el('span','',[movie.year,index===0?'Cover':null].filter(Boolean).join(' · ')));item.append(el('span','tc-number',String(index+1).padStart(2,'0')),poster(movie),copy);
   const controls=el('div','tc-controls');for(const [symbol,name,delta]of[['↑','Eerder',-1],['↓','Later',1],['×','Verwijder',0]]){const b=button(symbol,'tc-control',()=>{if(disabled)return;if(delta){const to=index+delta;[draft.movies[index],draft.movies[to]]=[draft.movies[to],draft.movies[index]]}else draft.movies.splice(index,1);persist();paint();searchMount?.refreshSelection();const target=host.querySelector('[data-focus="theme-'+movie.id+'-'+(delta||'remove')+'"]');(target&&!target.disabled?target:host.querySelector('[data-focus="theme-'+movie.id+'-remove"]')||host.querySelector('[data-focus=movie-query]'))?.focus({preventScroll:true})});b.setAttribute('aria-label',name+' · '+movie.title);b.title=name;b.dataset.focus='theme-'+movie.id+'-'+(delta||'remove');b.disabled=disabled||(delta!==0&&(index+delta<0||index+delta>=draft.movies.length));controls.append(b)}item.append(controls);list.append(item);
  });
 }
 searchMount=mountMovieSearch(search,{query:draft.themeQuery||'',disabled,multiple:true,existing:movie=>draft.movies.find(m=>m.id===movie.id)||null,onQuery:q=>{draft.themeQuery=q;persist()},onSelect:movie=>{if(disabled)return;if(draft.movies.length>=12){search.querySelector('.hp-search-status').textContent='Maximaal 12 films. Verwijder er één om een andere toe te voegen.';return}if(draft.movies.some(m=>m.id===movie.id))return;draft.movies.push(movie);persist();paint();searchMount?.refreshSelection()}});
 search.querySelector('input').placeholder='Zoek een film om toe te voegen…';search.querySelector('label').firstChild.textContent='Zoek films';paint();return{destroy(){searchMount.destroy()}};
};
window.renderThemeLineup=(host,option)=>{if(!Array.isArray(option.movies)||!option.movies.length){if(option.lineup?.length)host.append(el('p','hp-lineup',option.lineup.join(' · ')));return}const list=el('ol','tc-saved-lineup');list.setAttribute('aria-label','Films in dit thema');for(const movie of option.movies){const row=el('li');row.append(poster(movie));const link=el('a','',movie.title+(movie.year?' ('+movie.year+')':''));link.href='https://www.imdb.com/title/'+movie.id+'/';link.target='_blank';link.rel='noopener noreferrer';row.append(link);list.append(row)}host.append(list)};
})();
