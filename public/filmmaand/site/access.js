/* Account actions stay on their current page; Programma remains public. */
(()=>{'use strict';window.filmmaandRequireAccount=true;
const prefix=location.pathname.startsWith('/filmmaand/')?'/filmmaand':'',kind=document.documentElement.dataset.accountLocked;
let pendingUnlock=false;
window.addEventListener('filmmaand-session',e=>{if(!kind&&/^\/(?:filmmaand\/)?(?:films|stemmen)\/(?:index.html)?$/.test(location.pathname)&&!e.detail?.participant?.id)location.reload()});
const account=()=>{const p=window.filmmaandSession?.participant;return !!p?.id&&p.onboarded&&!p.cached};
window.requestFilmmaandParticipation=intent=>{if(account())return true;window.filmmaandAttendanceIntent=intent||null;window.dispatchEvent(new CustomEvent('filmmaand-login-required',{detail:{source:'participation'}}));return false};
window.addEventListener('filmmaand-login-complete',()=>{if(kind)pendingUnlock=true});
window.addEventListener('filmmaand-availability-intro-closed',e=>{if(pendingUnlock&&['saved','continue','later'].includes(e.detail?.reason)){pendingUnlock=false;location.reload()}});
async function ready(){
 const q=new URLSearchParams(location.search);
 if(!kind&&q.get('login')==='complete'){q.delete('login');history.replaceState(null,'',location.pathname+(q.size?'?'+q:'')+location.hash);const p=await window.filmmaandSession?.ready?.();if(p?.id&&p.onboarded&&!p.cached)window.dispatchEvent(new CustomEvent('filmmaand-login-complete',{detail:{participant:p}}));}
 if(!kind)return;
 const main=document.querySelector(kind==='films'?'#home-picker':'#stemmen');if(!main)return;
 main.classList.add('account-locked-page');main.removeAttribute('aria-busy');main.replaceChildren();
 const preview=document.createElement('div');preview.className='account-preview';preview.inert=true;preview.setAttribute('aria-hidden','true');
 const title=document.createElement('h1');title.textContent=kind==='films'?'Films':'Welke wil je zien?';const posters=document.createElement('div');posters.className='account-preview-posters';preview.append(title,posters);
 const prompt=document.createElement('section');prompt.className='account-unlock';const heading=document.createElement('h2');heading.textContent=kind==='films'?'Log in om films te ontdekken':'Log in om te stemmen';const login=document.createElement('button');login.type='button';login.textContent='Inloggen';login.onclick=()=>window.dispatchEvent(new CustomEvent('filmmaand-login-required',{detail:{source:kind}}));prompt.append(heading,login);main.append(preview,prompt);
 try{const r=await fetch(prefix+'/api/plans/home-picker-lab',{cache:'no-store'});if(!r.ok)throw Error('plan');const p=await r.json(),ids=kind==='stemmen'?p.round?.shortlist:p.options.slice(0,3).map(o=>o.id);for(const id of ids||[]){const o=p.options.find(o=>o.id===id);if(!o)continue;const figure=document.createElement('figure'),img=document.createElement('img'),caption=document.createElement('figcaption');img.src=window.catalogArtwork?.[o.id]||o.movie?.poster||'';img.alt='';caption.textContent=o.title;figure.append(img,caption);posters.append(figure)}}catch{preview.classList.add('is-unavailable')}
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>void ready(),{once:true});else void ready();
})();
