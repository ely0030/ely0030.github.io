/* Account actions stay on their current page; Programma remains public. */
(()=>{'use strict';window.filmmaandRequireAccount=true;
const prefix=location.pathname.startsWith('/filmmaand/')?'/filmmaand':'',kind=document.documentElement.dataset.accountLocked;
let pendingUnlock=false;
window.addEventListener('filmmaand-session',e=>{if(!kind&&/^\/(?:filmmaand\/)?(?:films|stemmen)\/(?:index.html)?$/.test(location.pathname)&&!e.detail?.participant?.id)location.reload()});
const account=()=>{const p=window.filmmaandSession?.participant;return !!p?.id&&p.onboarded&&!p.cached};
window.requestFilmmaandParticipation=intent=>{if(account())return true;window.filmmaandAttendanceIntent=intent||null;window.dispatchEvent(new CustomEvent('filmmaand-login-required',{detail:{source:'participation'}}));return false};
window.addEventListener('filmmaand-login-complete',()=>{if(kind)pendingUnlock=true});
window.addEventListener('filmmaand-availability-intro-closed',e=>{if(pendingUnlock&&['saved','continue','later'].includes(e.detail?.reason)){pendingUnlock=false;location.reload()}});

let prompt=null;window.addEventListener('filmmaand-login-complete',()=>{if(!kind||!prompt)return;prompt.close();prompt.remove();prompt=null;for(const n of document.querySelectorAll('.account-background')){n.inert=false;n.classList.remove('account-background');}});
const el=(tag,cls,value)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(value)n.textContent=value;return n};
function cover(o){const img=el('img');img.src=o.image?.url||window.catalogArtwork?.[o.id]||o.movie?.poster||'';img.alt='';img.decoding='async';return img;}
function renderPreview(main,plan){
 const options=Array.isArray(plan?.options)?plan.options:[];
 const ids=kind==='stemmen'?plan?.round?.shortlist:options.map(o=>o.id);
 const films=(ids||[]).map(id=>options.find(o=>o.id===id)).filter(Boolean);
 const preview=el('section','account-preview');
 if(kind==='films'){
  const collection=el('div','account-preview-collection'),feature=films[0];
  if(feature){const hero=el('div','account-preview-feature');hero.append(cover(feature),el('h2','',feature.title));collection.append(hero);}
  const rail=el('div','account-preview-posters');for(const o of films.slice(0,8)){const figure=el('figure');figure.append(cover(o),el('figcaption','',o.title));rail.append(figure);}collection.append(rail);
  const side=el('aside','account-preview-side');side.append(el('h2','','Leaderboard'));
  const ordered=[...films].sort((a,b)=>(plan.optionCounts?.[b.id]||0)-(plan.optionCounts?.[a.id]||0));
  for(const o of ordered.slice(0,3)){const row=el('div','account-preview-ranking');row.append(cover(o),el('strong','',o.title));side.append(row);}
  preview.append(collection,side);
 }else{preview.append(el('h1','','Welke wil je zien?'));const row=el('div','account-preview-ballot');for(const o of films){const card=el('figure');card.append(cover(o),el('figcaption','',o.title));row.append(card);}preview.append(row);}
 main.replaceChildren(preview);main.removeAttribute('aria-busy');
}
async function ready(){
 const q=new URLSearchParams(location.search);
 if(!kind&&q.get('login')==='complete'){q.delete('login');history.replaceState(null,'',location.pathname+(q.size?'?'+q:'')+location.hash);const p=await window.filmmaandSession?.ready?.();if(p?.id&&p.onboarded&&!p.cached)window.dispatchEvent(new CustomEvent('filmmaand-login-complete',{detail:{participant:p}}));}
 if(!kind)return;
 const main=document.querySelector(kind==='films'?'#home-picker':'#stemmen');if(!main)return;
 main.classList.add('account-locked-page');
 // Native modal provides keyboard trapping; all existing regions also stay inert
 // while the real identity dialog temporarily sits above this prompt.
 for(const child of document.body.children)if(!['SCRIPT','LINK','STYLE'].includes(child.tagName)){child.inert=true;child.classList.add('account-background');}
 prompt=el('dialog','account-unlock');const heading=el('h2','',kind==='films'?'Ontdek jouw volgende film':'Welke film kies jij?');heading.id='account-unlock-title';prompt.setAttribute('aria-labelledby',heading.id);
 const login=el('button','','Inloggen');login.type='button';login.onclick=()=>window.dispatchEvent(new CustomEvent('filmmaand-login-required',{detail:{source:kind}}));const back=el('a','','Bekijk het programma');back.href=prefix+'/agenda/';prompt.append(heading,login,back);prompt.addEventListener('keydown',e=>{if(e.key!=='Tab')return;e.preventDefault();const nodes=[login,back],i=nodes.indexOf(document.activeElement);nodes[(i+(e.shiftKey?-1:1)+nodes.length)%nodes.length].focus({preventScroll:true});});prompt.addEventListener('cancel',e=>{e.preventDefault();location.assign(back.href)});document.body.append(prompt);prompt.showModal();
 try{const response=await fetch(prefix+'/api/plans/home-picker-lab',{cache:'no-store'});if(!response.ok)throw Error('public plan');renderPreview(main,await response.json());}catch{main.replaceChildren(el('p','account-preview-error','De films konden niet worden geladen.'));main.removeAttribute('aria-busy');}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void ready(),{once:true});else void ready();
})();
