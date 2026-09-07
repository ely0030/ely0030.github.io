/* Shared display-profile synchronization; never creates an identity or submits a ballot. */
(()=>{'use strict';if(window.syncPickerDisplayProfile)return;
const prefix='filmmaand-checkin-v1:/filmmaand/api:home-picker-lab:';let running=false,again=false;
const read=k=>JSON.parse(localStorage.getItem(prefix+k)||'null');
const write=(k,v)=>v===null?localStorage.removeItem(prefix+k):localStorage.setItem(prefix+k,JSON.stringify(v));
async function sync(){if(running){again=true;return;}if(!navigator.locks||!window.loadPickerDisplayProfile)return;running=true;
try{await navigator.locks.request('filmmaand-display-profile-sync-v1',async()=>{
 if(location.port==='4173'&&(localStorage.getItem(prefix+'transfer-v1')!=='complete'||localStorage.getItem(prefix+'transfer-journal')))return;
 const token=read('identity');if(!/^[A-Za-z0-9_-]{43}$/.test(token||''))return;
 async function request(opts={}){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);try{const r=await fetch('/filmmaand/api/plans/home-picker-lab/profile',{...opts,signal:controller.signal,cache:'no-store',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json',...opts.headers}});const b=await r.json();if(!r.ok)throw Object.assign(Error('profile'),{status:r.status});return b}finally{clearTimeout(timer)}}
 let updated=false;
 async function commit(receipt){try{await request({method:'PUT',headers:{'Idempotency-Key':receipt.key},body:JSON.stringify(receipt.body)});write('profileReceipt',null);updated=true;}catch(e){if(e.status>=400&&e.status<500&&e.status!==401&&e.status!==410)write('profileReceipt',null);throw e}}
 const pending=read('profileReceipt');if(pending)await commit(pending);
 // A server-validated account session projects the account profile itself; the per-plan display profile is not written then.
 if(localStorage.getItem('filmmaand-auth-v1')==='account')return;
 const latest=await window.loadPickerDisplayProfile();
 if(latest){const {profile}=await request();if(JSON.stringify(profile.recommender)!==JSON.stringify(latest)){
 const current=await window.loadPickerDisplayProfile();if(JSON.stringify(current)!==JSON.stringify(latest)||read('identity')!==token)return;
 const receipt={key:crypto.randomUUID(),body:{expectedRevision:profile.revision,recommender:latest}};write('profileReceipt',receipt);await commit(receipt);
 }}
 if(updated)window.dispatchEvent(new Event('filmmaand-display-profile-synced'));
 });}catch{}finally{running=false;if(again){again=false;void sync()}}}
window.syncPickerDisplayProfile=sync;
window.addEventListener('filmmaand-profile-changed',sync);window.addEventListener('focus',sync);
window.addEventListener('storage',e=>{if(e.key?.startsWith('filmmaand-identity-design-v1')||e.key===prefix+'identity'||e.key===prefix+'transfer-v1')sync()});
void sync();
})();
