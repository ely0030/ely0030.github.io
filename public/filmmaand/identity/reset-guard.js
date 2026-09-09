/* Loaded before every Filmmaand controller. A document never adopts a new generation. */
(()=>{'use strict';
 if(window.filmmaandResetGuard)return;
 const nativeFetch=window.fetch.bind(window),marker='filmmaand-reset-generation-v1';
 const prefix='filmmaand-checkin-v1:/filmmaand/api:home-picker-lab:';
 const keys=['identity','draft','receipt','availabilityDraft','availabilityReceipt','datePollDraft','datePollReceipt','nightProposalReceipt','suggestionDraft','suggestionReceipt','lastSuggestion','profileReceipt','voteReceipt','stemmenSuggestionReceipt','ballotHelpDismissed'].map(k=>prefix+k).concat(['filmmaand-identity-claim-v1','filmmaand-auth-v1','filmmaand-identity-design-v1','filmmaand-identity-design-v1-signed-in','filmmaand-identity-design-v1-expired']);
 let pinned=null,stopped=false,initialGeneration=null,storageError=null;
 try{initialGeneration=localStorage.getItem(marker)}catch(e){storageError=e}
 const valid=g=>typeof g==='string'&&g.length>0&&g.length<=128;
 const failure=()=>Object.assign(new Error('Vernieuw de pagina om veilig verder te gaan.'),{code:'reset_generation',status:409});
 function notice(){const show=()=>{if(document.getElementById('filmmaand-reset-error'))return;const n=document.createElement('div');n.id='filmmaand-reset-error';n.setAttribute('role','alert');n.style.cssText='position:fixed;z-index:2147483647;bottom:16px;left:16px;right:16px;padding:16px;background:white;color:#222;border:1px solid #ddd';n.append('De verbinding kon niet veilig worden hersteld. ');const b=document.createElement('button');b.type='button';b.textContent='Pagina vernieuwen';b.onclick=()=>location.reload();n.append(b);document.body.append(n)};document.body?show():document.addEventListener('DOMContentLoaded',show,{once:true})}
 function reload(){stopped=true;location.reload();throw failure()}
 function reconcile(g){
  if(!valid(g))throw failure();
  const previous=localStorage.getItem(marker);
  if(previous===g&&((pinned!==null&&g!==pinned)||(pinned===null&&initialGeneration!==g&&(initialGeneration!==null||g!=='0'))))return reload();
  if(previous!==g&&(previous!==null||g!=='0')){
   stopped=true;
   for(const key of keys)localStorage.removeItem(key);
   sessionStorage.removeItem('filmmaand-onboarding-just-completed');
   // Only acknowledge after every removal succeeds. Existing controllers must be discarded.
   localStorage.setItem(marker,g);
   return reload();
  }
  localStorage.setItem(marker,g);
  pinned=g;
  return g;
 }
 async function readGeneration(){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await nativeFetch('/filmmaand/api/reset-generation',{cache:'no-store',credentials:'same-origin',signal:controller.signal});if(!r.ok)throw failure();return (await r.json()).resetGeneration}finally{clearTimeout(timer)}}
 const ready=(storageError?Promise.reject(storageError):readGeneration()).then(reconcile).catch(e=>{stopped=true;notice();throw e});
 // Attach a handler immediately: boot failure stays fail-closed without an unhandled rejection.
 ready.catch(()=>{});
 window.filmmaandResetGuard={ready,get generation(){return pinned},get blocked(){return stopped||pinned===null}};
 window.fetch=async(input,init)=>{
  const url=new URL(input instanceof Request?input.url:String(input),location.href);
  if(url.origin!==location.origin||!url.pathname.startsWith('/filmmaand/api/'))return nativeFetch(input,init);
  const method=(init?.method||(input instanceof Request?input.method:'GET')).toUpperCase();
  if((method==='POST'&&url.pathname==='/filmmaand/api/auth/logout')||(method==='DELETE'&&url.pathname==='/filmmaand/api/auth/session'))return nativeFetch(input,init);
  await ready;
  if(stopped)throw failure();
  if(localStorage.getItem(marker)!==pinned)return reload();
  const headers=new Headers(init?.headers??(input instanceof Request?input.headers:undefined));
  // The value is pinned before controller requests can proceed, never refreshed for a queued payload.
  headers.set('X-Filmmaand-Reset-Generation',pinned);
  const response=await nativeFetch(input,{...init,headers});
  const generation=response.headers.get('X-Filmmaand-Reset-Generation');
  if(generation&&generation!==pinned){try{reconcile(generation)}catch(e){stopped=true;throw e}}
  return response;
 };
 window.addEventListener('storage',e=>{if(e.key===marker&&e.newValue!==pinned){stopped=true;location.reload()}});
 // An idle old tab discovers a reset without waiting for its next save. Never adopt into its in-memory draft.
 window.addEventListener('focus',()=>{if(stopped||pinned===null)return;void readGeneration().then(g=>{if(g!==pinned)reconcile(g)}).catch(()=>{})});
})();
