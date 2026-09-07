/* Local title results first; optional artwork hydrates by stable IMDb ID. */
(()=>{'use strict';
window.mountMovieSearch=(host,{api='/filmmaand/api/movies',query='',disabled=false,existing=()=>null,onQuery=()=>{},onSelect=()=>{}}={})=>{
 let dead=false,timer,controller,serial=0,items=[],active=-1,selectionRun=0;
 const pending=new Map(),failedImages=new Set();
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
 const safePoster=url=>typeof url==='string'&&/^https:\/\/(?:m\.media-amazon\.com\/images\/M\/|image\.tmdb\.org\/t\/p\/)/.test(url);
 const label=el('label','hp-search-label','Zoek een film'),input=el('input','hp-movie-query');
 input.type='search';input.placeholder='Titel van een film…';input.value=query;input.autocomplete='off';input.disabled=disabled;input.maxLength=120;input.dataset.focus='movie-query';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-expanded','false');input.setAttribute('aria-controls','movie-search-results');label.append(input);
 const status=el('p','hp-search-status');status.setAttribute('role','status');
 const list=el('div','hp-search-results');list.id='movie-search-results';list.setAttribute('role','listbox');list.setAttribute('aria-label','Gevonden films');host.append(label,status,list);
 const current=run=>!dead&&run===serial;
 function close(){list.hidden=true;input.setAttribute('aria-expanded','false');input.removeAttribute('aria-activedescendant');active=-1}
 function highlight(index){active=index;[...list.children].forEach((node,i)=>node.setAttribute('aria-selected',String(i===index)));if(index>=0){input.setAttribute('aria-activedescendant','movie-result-'+index);list.children[index]?.scrollIntoView({block:'nearest'})}else input.removeAttribute('aria-activedescendant')}
 function mergeDetails(item,movie){
  // Identity/title/ranking remain the local search result, never a different detail response.
  if(movie?.id!==item.id)return;
  for(const key of ['poster','posterFull','metadataPoster','backdrop','cast','overview','overviewLanguage','metadataSource','metadataUrl'])if(movie[key]!=null)item[key]=movie[key];
 }
 function details(item,run,full=false){
  const key=run+'|'+item.id+'|'+full;if(pending.has(key))return pending.get(key);
  const job=(async()=>{try{
   const response=await fetch(api+'/'+encodeURIComponent(item.id)+(full?'':'?poster=1'),{signal:controller?.signal});if(!response.ok)return item;
   const data=await response.json();if(!current(run))return item;mergeDetails(item,data.movie);
   const index=items.indexOf(item);if(index>=0)paintArt(list.children[index]?.querySelector('.hp-result-art'),item,run,false);
  }catch{}return item;})();pending.set(key,job);return job;
 }
 function paintArt(art,item,run,mayRepair=true){
  if(!art||!current(run))return;
  const sources=[...new Set([item.poster,item.metadataPoster].filter(url=>safePoster(url)&&!failedImages.has(url)))];
  const old=art.querySelector('img');if(old&&old.getAttribute('src')===sources[0])return;old?.remove();
  if(!sources.length)return;
  const img=el('img');img.alt='';img.loading='lazy';img.width=46;img.height=68;
  img.onerror=()=>{if(!current(run))return;failedImages.add(img.getAttribute('src'));img.remove();
   if(sources.some(url=>!failedImages.has(url)))paintArt(art,item,run,false);
   else if(mayRepair)void details(item,run);
  };
  img.src=sources[0];art.prepend(img);
 }
 async function pick(index){
  if(!items[index]||disabled)return;const item=items[index],run=serial,selection=++selectionRun;
  // Cached artwork is instant; selecting a cold result joins its in-flight detail lookup.
  if(!safePoster(item.poster)&&!safePoster(item.metadataPoster)){status.textContent='Film openen…';await details(item,run);if(current(run)&&!safePoster(item.poster)&&!safePoster(item.metadataPoster))await details(item,run,true);}
  if(!current(run)||selection!==selectionRun)return;
  onSelect({...item,poster:(failedImages.has(item.poster)?item.metadataPoster:null)||item.posterFull||item.poster||item.metadataPoster||null});
 }
 function render(run){
  list.replaceChildren();active=-1;input.removeAttribute('aria-activedescendant');
  items.forEach((item,i)=>{
   const b=el('button','hp-search-result');b.type='button';b.id='movie-result-'+i;b.tabIndex=-1;b.setAttribute('role','option');b.setAttribute('aria-selected','false');
   const art=el('span','hp-result-art'),copy=el('span','hp-result-copy');art.append(el('span','hp-result-year',item.year||'—'));
   copy.append(el('strong','',item.title),el('small','',[item.originalTitle!==item.title?item.originalTitle:null,(item.genres||[]).join(' · '),item.runtime?item.runtime+' min':null].filter(Boolean).join(' / ')));
   const already=existing(item);if(already){b.dataset.existing=already.id;copy.append(el('small','hp-result-existing','Staat al in de selectie · '+already.title));}
   if(item.directors?.length)copy.append(el('small','hp-result-director','Regie: '+item.directors.join(', ')));
   if(item.cast?.length)copy.append(el('small','hp-result-cast',item.cast.join(' · ')));
   b.append(art,copy,el('span','hp-result-arrow','↗'));b.onmousedown=e=>e.preventDefault();b.onclick=()=>void pick(i);list.append(b);paintArt(art,item,run);
  });
  list.hidden=!items.length;input.setAttribute('aria-expanded',String(!!items.length));
 }
 async function hydrate(run){
  const missing=items.filter(item=>!safePoster(item.poster)&&!safePoster(item.metadataPoster));let next=0;
  await Promise.all(Array.from({length:Math.min(2,missing.length)},async()=>{while(current(run)&&next<missing.length)await details(missing[next++],run)}));
 }
 async function search(){
  const q=input.value.trim(),run=++serial;controller?.abort();pending.clear();
  if(q.length<2){items=[];render(run);status.textContent=q?'Typ minstens twee tekens.':'';return}
  status.textContent='Films zoeken…';controller=new AbortController();
  try{
   const response=await fetch(api+'?q='+encodeURIComponent(q)+'&quick=1',{signal:controller.signal});if(!response.ok)throw Error('search');
   const data=await response.json();if(!current(run))return;items=data.movies||[];render(run);
   status.textContent=items.length?'Kies de film die je bedoelt.':'Geen films gevonden. Probeer een andere titel of voeg een eigen thema toe.';
   void hydrate(run);
  }catch(error){if(!current(run)||error.name==='AbortError')return;items=[];render(run);status.textContent='Zoeken lukt even niet. Probeer opnieuw of voeg een eigen thema toe.'}
 }
 input.oninput=()=>{onQuery(input.value);clearTimeout(timer);++serial;controller?.abort();pending.clear();items=[];render(serial);status.textContent=input.value.trim().length>=2?'Films zoeken…':input.value?'Typ minstens twee tekens.':'';timer=setTimeout(search,220)};
 input.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close()}else if(['ArrowDown','ArrowUp'].includes(e.key)&&items.length){e.preventDefault();list.hidden=false;input.setAttribute('aria-expanded','true');highlight((active+(e.key==='ArrowDown'?1:-1)+items.length)%items.length)}else if(e.key==='Enter'){e.preventDefault();if(active>=0&&!list.hidden)void pick(active);else if(items.length===1)void pick(0)}};
 host.onfocusout=e=>{if(!host.contains(e.relatedTarget))close()};input.onfocus=()=>{if(items.length){list.hidden=false;input.setAttribute('aria-expanded','true')}};
 if(query.trim().length>=2&&!disabled)void search();
 return{destroy(){dead=true;++serial;clearTimeout(timer);controller?.abort();host.replaceChildren()}};
};})();
