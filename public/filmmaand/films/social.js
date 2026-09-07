/* Four social sections. Canonical picker retains all persistence and credentials. */
(()=>{'use strict';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
let nearIndex=0;const railPositions={mine:0,new:0};
window.renderFilmsSocial=(host,ctx,{open,add,planNight,browse})=>{
 const focus=document.activeElement?.dataset.focus,y=scrollY;for(const row of host.querySelectorAll('[data-social-rail]'))railPositions[row.dataset.socialRail]=row.scrollLeft;host.replaceChildren();
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const m=FilmsSocialModel.project(ctx,today),count=m.count,fans=m.fans;
 const rerender=()=>window.renderFilmsSocial(host,ctx,{open,add,planNight,browse});
 function button(label,cls,fn,key){const b=el('button',cls,label);b.type='button';b.onclick=fn;if(key)b.dataset.focus=key;return b;}
 function avatars(people,total=people.length){const stack=el('span','films-social-avatars');let visible=0;const remaining=[];
  for(const p of people){const a=window.filmmaandAvatarOptions?.find(a=>a.id===p.avatarId);if(!a){remaining.push(p.name||'Zonder profiel');continue;}visible++;const face=el('span','films-social-avatar'+(p.self?' is-self':'')),label=p.self?'Jij':p.name||'Zonder naam';face.tabIndex=0;face.title=label;face.setAttribute('aria-label',label);const img=el('img');img.src=a.src;img.alt='';if(a.filter)img.style.filter=a.filter;face.append(img,el('span','films-social-name',label));face.onclick=e=>{e.stopPropagation();face.focus({preventScroll:true});};face.onkeydown=e=>e.stopPropagation();stack.append(face);}
  if(total>visible){const more=el('span','films-social-avatar films-social-avatar-more','+'+(total-visible));more.tabIndex=0;const unknown=Math.max(0,total-people.length);if(unknown)remaining.push(unknown+' zonder profiel');more.title=remaining.join(', ');more.setAttribute('aria-label',more.title);more.append(el('span','films-social-name',more.title));stack.append(more);}return stack;}
 function section(key,title){const section=el('section','fs-compact fs-'+key);section.dataset.socialSection=key;const head=el('div','fs-compact-head');head.append(el('h3','',title));section.append(head);return section;}
 function coverButton(o,key){const b=button('','fs-mini-open',()=>open(o),'social-open-'+key+'-'+o.id);b.setAttribute('aria-label','Bekijk '+o.title);b.append(ctx.cover(o,'social-'+key));return b;}
 function heart(o,key){return ctx.heartButton(o,'films-social-heart','social-heart-'+key+'-'+o.id);}
 function rail(kind,label,options){const section=sectionForRail(kind,label),head=section.firstChild,row=el('div','fs-mini-rail');row.dataset.socialRail=kind;
  for(const o of options){const card=el('article','fs-mini-card');card.append(coverButton(o,kind));const supporters=fans(o);
   if(supporters.length){const stickers=el('span','fs-mini-stickers');stickers.append(avatars(supporters));card.append(stickers);}
   const title=button(o.title,'fs-mini-title',()=>open(o),'social-title-'+kind+'-'+o.id);card.append(title);
   if(kind==='new')card.append(el('span','fs-mini-author',o.recommender?.self?'Door jou':o.recommender?.name||'Toegevoegd aan de collectie'));
   if(kind==='mine'||kind==='new'){const remove=heart(o,kind);remove.classList.add('fs-mini-remove');card.append(remove);}row.append(card);
  }
  if(!options.length){const empty=button(kind==='mine'?'Bewaar films met een hartje →':'Voeg een film toe →','fs-compact-empty',kind==='mine'?browse:add);row.append(empty);}
  section.append(row);const controls=el('span','fs-rail-controls');for(const [label,direction] of [['Vorige films',-1],['Volgende films',1]]){const b=button(direction<0?'←':'→','',()=>row.scrollBy({left:direction*180,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'}));b.setAttribute('aria-label',label);controls.append(b);}head.append(controls);row.addEventListener('scroll',()=>railPositions[kind]=row.scrollLeft,{passive:true});return section;
 }
 function sectionForRail(kind,label){const s=section(kind,label);s.classList.add('fs-rail-section');return s;}
 host.classList.add('fs-compact-social');
 const popular=section('popular','Populair bij jullie'),rank=el('div','fs-compact-ranking');
 const maximum=Math.max(1,...m.ranked.map(count));
 for(const [index,o] of m.ranked.slice(0,6).entries()){const line=el('div','fs-compact-rank');line.append(el('span','fs-rank-number',String(index+1).padStart(2,'0')));const image=el('div','fs-rank-image');image.append(coverButton(o,'popular'));const stickers=el('span','fs-mini-stickers');stickers.append(avatars(fans(o)));image.append(stickers);line.append(image);const copy=el('div');copy.append(button(o.title,'fs-compact-rank-title',()=>open(o),'social-title-popular-'+o.id));const bar=el('div','fs-rank-track'),fill=el('i');fill.style.width=count(o)/maximum*100+'%';bar.append(fill);copy.append(bar);line.append(copy,el('span','fs-rank-count',String(count(o))));rank.append(line);}popular.append(rank);if(!m.ranked.length)popular.append(el('p','fs-compact-empty','Nog geen hartjes.'));host.append(popular);
 const recent=ctx.plan.options.filter(o=>o.kind==='suggestion').slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||''));host.append(rail('new','Nieuw van vrienden',recent));
 for(const row of host.querySelectorAll('[data-social-rail]'))row.scrollLeft=railPositions[row.dataset.socialRail]||0;
 if(focus)[...host.querySelectorAll('[data-focus]')].find(n=>n.dataset.focus===focus)?.focus({preventScroll:true});scrollTo({top:y,behavior:'instant'});
};
window.renderFilmsNext=(host,ctx,{open,browse})=>{
 host.replaceChildren();const excluded=new Set([...(ctx.plan.round?.shortlist||[]),...(ctx.plan.programme||[]).flatMap(n=>n.choices||[])]);
 const m=FilmsSocialModel.project(ctx,new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()));
 const candidates=m.ranked.filter(o=>!excluded.has(o.id)).slice(0,3);
 host.append(el('h3','fs-next-title','Voor de volgende ronde'),el('p','fs-next-caption','Op basis van jullie hartjes'));
 const row=el('div','fs-next-candidates');
 candidates.forEach((o,i)=>{const card=el('article','fs-next-candidate'),b=el('button','fs-next-open');b.type='button';b.setAttribute('aria-label','Bekijk '+o.title);b.onclick=()=>open(o);b.append(ctx.cover(o,'next'));card.append(el('span','fs-next-position',String(i+1).padStart(2,'0')),b,el('span','fs-next-name',o.title));const foot=el('div','fs-next-foot');foot.append(el('span','',String(m.count(o))+' ♥'),ctx.heartButton(o,'films-social-heart','next-heart-'+o.id));card.append(foot);row.append(card);});host.append(row);
 if(!candidates.length){const b=el('button','fs-compact-empty','Ontdek films →');b.type='button';b.onclick=browse;host.append(b);}
};
})();
