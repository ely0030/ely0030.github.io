/* Available-theme strip with film credits and native collection links.
 * Load after /filmmaand/picker/artwork.js and the existing festival strip initializer.
 * Layout, 24px/s loop, accessibility and reduced motion remain with fitBanner. */
(()=>{
  const items=[
  {
    "id": "blade",
    "title": "Blade Runner 1 + 2",
    "meta": "Ridley Scott (1982) · Denis Villeneuve (2017)"
  },
  {
    "id": "matrix",
    "title": "The Matrix Trilogy",
    "meta": "Lana Wachowski & Lilly Wachowski (1999, 2003)"
  },
  {
    "id": "lotr",
    "title": "The Lord of the Rings",
    "meta": "Peter Jackson (2001, 2002, 2003)"
  },
  {
    "id": "indiana",
    "title": "Indiana Jones Marathon",
    "meta": "Steven Spielberg (1981, 1984, 1989)"
  },
  {
    "id": "synecdoche",
    "title": "Synecdoche + Megalopolis",
    "meta": "Charlie Kaufman (2008) · Francis Ford Coppola (2024)"
  },
  {
    "id": "bahubali",
    "title": "Bahubali 1 + 2",
    "meta": "S.S. Rajamouli (2015, 2017)"
  },
  {
    "id": "dress",
    "title": "Dress to Impress",
    "meta": ""
  },
  {
    "id": "redball",
    "title": "Redball 5",
    "meta": ""
  },
  {
    "id": "cronenberg",
    "title": "The Fly + Videodrome",
    "meta": "David Cronenberg (1986, 1983)"
  },
  {
    "id": "girlboss",
    "title": "Girlboss night",
    "meta": "Karyn Kusama (2009) · James Mangold (1999)"
  },
  {
    "id": "king",
    "title": "King of New York",
    "meta": "Abel Ferrara (1990)"
  },
  {
    "id": "twinpeaks",
    "title": "Twin Peaks: Fire Walk with Me",
    "meta": "David Lynch (1992)"
  },
  {
    "id": "anime",
    "title": "Ghost in the Shell + Akira",
    "meta": "Mamoru Oshii (1995) · Katsuhiro Otomo (1988)"
  },
  {
    "id": "lynch",
    "title": "David Lynch night",
    "meta": "David Lynch (1986, 1977)"
  },
  {
    "id": "fear",
    "title": "Fear and Loathing + …",
    "meta": "Terry Gilliam (1998)"
  },
  {
    "id": "horror",
    "title": "Horror night",
    "meta": ""
  },
  {
    "id": "racing",
    "title": "Redline + Speed Racer",
    "meta": "Takeshi Koike (2009) · Lana Wachowski & Lilly Wachowski (2008)"
  },
  {
    "id": "batman",
    "title": "Batman Trilogy",
    "meta": "Christopher Nolan (2005, 2008, 2012)"
  },
  {
    "id": "kungfupanda",
    "title": "Kungfu Panda 1 + 2",
    "meta": "Mark Osborne & John Stevenson (2008) · Jennifer Yuh Nelson (2011)"
  },
  {
    "id": "cooking",
    "title": "Cooking Night",
    "meta": "Jon Favreau (2014) · Brad Bird & Jan Pinkava (2007)"
  },
  {
    "id": "tarkovsky",
    "title": "Tarkovsky Classics",
    "meta": "Andrei Tarkovsky (1972, 1979)"
  }
];
  const strip=document.querySelector('.running-line');
  let state={},votes=null,publicOptions=null,lastRender='',fetching=false;
  function render(){
    if(!strip)return;
    const scheduled=new Set(state.phase==='confirmed'&&Array.isArray(state.programme)?state.programme.map(x=>x.id):[]);
    const catalogue=publicOptions?publicOptions.map(o=>({...o,meta:items.find(x=>x.id===o.id)?.meta||''})):items;
    const included=votes?.ids?new Set(votes.ids):null;
    const available=catalogue.filter(x=>!scheduled.has(x.id)&&(!included||included.has(x.id)));
    strip.dataset.programmePhase=scheduled.size?'next-round':'catalogue';strip.hidden=!available.length;
    const rendered=available.map(item=>{const count=votes?.counts?.[item.id],known=Number.isInteger(count)&&count>=0;
      const noun=votes?.source==='preferences'?(count===1?'voorkeur':'voorkeuren'):votes?.source==='demo'?(count===1?'voorbeeldstem':'voorbeeldstemmen'):(count===1?'stem':'stemmen');
      const uploaded=/^\/filmmaand\/api\/images\/[a-f0-9]{64}\.webp$/.test(item.image?.url||'')?item.image.url:'';
      return {...item,meta:item.movie?[(item.movie.directors||[]).join(' & '),item.movie.year].filter(Boolean).join(' · '):item.meta,img:uploaded||window.catalogArtwork?.[item.id]||item.movie?.poster||window.dvdBackdrops?.[item.id]||item.movie?.backdrop};});
    const signature=JSON.stringify(rendered);if(signature!==lastRender){lastRender=signature;window.setFestivalStrip?.(rendered)}
    const label=strip.querySelector('.screening-strip-label');if(label)label.textContent=scheduled.size?'De volgende ronde':'Uit de selectie';
    const content=strip.querySelector('.running-window'),oldLink=content?.closest('.programme-strip-link');
    if(oldLink)oldLink.replaceWith(content);
    // Each cover is a native deep link; the duplicate scrolling half stays out of tab order.
    for(const group of strip.querySelectorAll('.screening-strip-group')){
      [...group.querySelectorAll('.screening-strip-item')].forEach((card,index)=>{
        const item=rendered[index];if(!item)return;
        let link=card;
        if(card.tagName!=='A'){link=document.createElement('a');for(const attr of card.attributes)link.setAttribute(attr.name,attr.value);link.append(...card.childNodes);card.replaceWith(link)}
        link.href='/filmmaand/films/?film='+encodeURIComponent(item.id);
        link.setAttribute('aria-label','Bekijk '+item.title);
        if(group.getAttribute('aria-hidden')==='true')link.tabIndex=-1;
      });
    }
  }
  window.setProgrammeStripState=(next={})=>{state=next;render()};
  window.setProgrammeStripVotes=next=>{if(!next||!['demo','preferences','final'].includes(next.source)||!next.counts)return;votes={source:next.source,counts:{...next.counts},ids:Array.isArray(next.ids)?next.ids:null};render()};
  window.addEventListener('festival-programme-state',event=>window.setProgrammeStripState(event.detail));
  window.addEventListener('festival-strip-votes',event=>window.setProgrammeStripVotes(event.detail));
  async function refreshVotes(){if(votes?.source==='demo'&&document.querySelector('[data-source=live][aria-pressed=true]')){votes=null;window.festivalStripVotes=null;render()}if(fetching||document.hidden||votes?.source==='demo'||votes?.source==='final')return;fetching=true;try{const r=await fetch('/filmmaand/api/plans/home-picker-lab',{cache:'no-store'});if(!r.ok)throw Error('plan unavailable');const p=await r.json();window.filmmaandPublicPlan=p;window.dispatchEvent(new CustomEvent('filmmaand-public-plan',{detail:p}));if(votes?.source==='demo'||votes?.source==='final'||!Array.isArray(p.options)||!p.optionCounts)return;publicOptions=p.options;votes={source:'preferences',counts:p.optionCounts};render()}catch{window.filmmaandPublicPlan=null;window.dispatchEvent(new CustomEvent('filmmaand-public-plan',{detail:null}))}finally{fetching=false}}
  if(window.festivalStripVotes)window.setProgrammeStripVotes(window.festivalStripVotes);else render();
  document.addEventListener('click',event=>{if(event.target.closest('[data-source=live]')){votes=null;window.festivalStripVotes=null;render();refreshVotes()}});
  refreshVotes();setInterval(refreshVotes,10000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)refreshVotes()});
})();
