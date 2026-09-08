/* Read-only event header. Never creates an identity or submits a ballot. */
(() => {
 const box=document.querySelector('.site-vote-event');if(!box)return;
 const covers=box.querySelector('.site-vote-covers'),status=box.querySelector('.site-vote-status'),action=box.querySelector('.site-vote-action');
 const check=document.createElement('span');check.className='site-vote-check';check.textContent='✓';check.setAttribute('aria-hidden','true');check.hidden=true;box.append(check);
 const api='/filmmaand/api/plans/home-picker-lab';
 let plan=null,own=null,resolved=false,generation=0,signature='',open=false,nudged=false;
 function render(){
  const ids=plan?.round?.shortlist||[],options=plan?.options||[];
  const heading=box.querySelector('h2'),day=plan?.round?.scheduledDate;let roundLabel='De huidige stemronde';if(/^\d{4}-\d{2}-\d{2}$/.test(day||'')&&Number.isFinite(Date.parse(day+'T12:00:00Z'))&&new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day)roundLabel='Filmavond '+new Date(day+'T12:00:00Z').toLocaleDateString('nl-NL',{timeZone:'Europe/Amsterdam',day:'numeric',month:'long'});if(heading)heading.textContent=roundLabel;
  const planned=new Set([...(plan?.programme||[]),...(plan?.confirmation?[plan.confirmation]:[])].flatMap(n=>n.choices||[]));
  open=ids.length===3&&new Set(ids).size===3&&ids.every(id=>options.some(o=>o.id===id)&&!planned.has(id));
  box.hidden=!!plan&&!open;box.setAttribute('aria-busy',String(!plan||!resolved));
  const selected=open&&ids.includes(own)?options.find(o=>o.id===own):null;
  box.classList.toggle('is-voted',!!selected);check.hidden=!selected;check.style.setProperty('--picked-slot',Math.max(0,ids.indexOf(selected?.id))); 
  status.textContent=selected?'Je stemde op '+selected.title:resolved&&open?'Je hebt nog niet gestemd.':'';
  action.textContent=selected?'Stem wijzigen ↗':'Kies je film ↗';action.setAttribute('aria-label',selected?'Je stemde op '+selected.title+' — stem wijzigen':resolved?'Je hebt nog niet gestemd — kies je film':'Naar de stemming');action.title=action.getAttribute('aria-label');action.href=selected?'/filmmaand/stemmen/?edit=1':'/filmmaand/stemmen/';
  const items=ids.map(id=>{const o=options.find(o=>o.id===id);return {id,title:o?.title||'',src:o?.image?.url||window.catalogArtwork?.[id]||o?.movie?.poster||''};});
  const key=JSON.stringify(items);if(key!==signature){signature=key;covers.replaceChildren();for(const item of items){const img=document.createElement('img');img.alt='';img.dataset.id=item.id;if(item.src)img.src=item.src;else img.style.visibility='hidden';img.onerror=()=>{img.style.visibility='hidden'};covers.append(img);}}
  for(const img of covers.children)img.classList.toggle('is-chosen',img.dataset.id===selected?.id);
  box.classList.toggle('is-unvoted',resolved&&open&&!selected);
  if(resolved&&open&&!selected&&!nudged&&covers.children.length===3){nudged=true;let seen=false;try{seen=sessionStorage.getItem('filmmaand-vote-header-nudge')==='1';sessionStorage.setItem('filmmaand-vote-header-nudge','1');}catch{}if(!seen){box.classList.add('is-nudging');setTimeout(()=>box.classList.remove('is-nudging'),2400);}}
 }
 async function readVote(){
  const current=++generation;let token=null,account=false;
  try{token=JSON.parse(localStorage.getItem('filmmaand-checkin-v1:/filmmaand/api:home-picker-lab:identity'));account=localStorage.getItem('filmmaand-auth-v1')==='account';}catch{}
  if(!/^[A-Za-z0-9_-]{43}$/.test(token||'')&&!account){own=null;resolved=true;render();return;}
  try{const response=await fetch(api+'/vote',{cache:'no-store',headers:token?{Authorization:'Bearer '+token}:{}});if(!response.ok)throw Error('unavailable');const data=await response.json();if(current!==generation)return;own=data.own?.final||null;resolved=true;render();}
  catch{if(current!==generation)return;own=null;resolved=false;render();}
 }
 let version='';
 window.addEventListener('filmmaand-public-plan',event=>{plan=event.detail;render();const next=JSON.stringify([plan?.version,plan?.round]);if(next!==version){version=next;readVote();}});
 for(const name of ['filmmaand-vote-saved','filmmaand-display-profile-synced','filmmaand-profile-changed','focus','storage'])window.addEventListener(name,()=>readVote());
 plan=window.filmmaandPublicPlan||null;render();readVote();
})();
