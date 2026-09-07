// Anonymous → account claim inside ONE plan-document CAS. The document is the authority: plan.claims[to]={from,key,at,moved}
// and plan.claimedBy[from]=to are written in the same swap as the state move, so a crash can never leave state moved
// without provenance or provenance without state. Idempotent: the same (from,to) again returns {already:true}.
const fail=(status,code,message,details)=>{throw Object.assign(new Error(message),{status,code,details})};
export const PER_ACTOR_FIELDS=['responses','votes','nightProposals'];
export const hasActorState=(p,a)=>PER_ACTOR_FIELDS.some(f=>p[f]&&Object.hasOwn(p[f],a))||Boolean(p.displayProfiles&&Object.hasOwn(p.displayProfiles,a));
export function applyTransfer(p,from,to,key,at){
 p.claims||={};p.claimedBy||={};
 const existing=p.claims[to];
 if(existing){if(existing.from===from)return {already:true,moved:existing.moved};fail(409,'claim_conflict','Dit account heeft al eerdere keuzes overgezet.',{claim:{from:'previous',at:existing.at}})}
 if(p.claimedBy[from])fail(409,'already_claimed','Deze browsersleutel is al aan een ander account gekoppeld.');
 if(hasActorState(p,to))fail(409,'claim_conflict','Dit account heeft al eigen keuzes; overzetten zou ze overschrijven.',{own:Object.fromEntries(PER_ACTOR_FIELDS.filter(f=>p[f]?.[to]).map(f=>[f,p[f][to]]))});
 const moved=[];
 for(const f of PER_ACTOR_FIELDS)if(p[f]&&Object.hasOwn(p[f],from)){p[f][to]=p[f][from];delete p[f][from];moved.push(f)}
 if(p.displayProfiles&&Object.hasOwn(p.displayProfiles,from)){delete p.displayProfiles[from];moved.push('displayProfile-dropped')}
 let receipts=0;const prefix=from+':';for(const [k,r] of Object.entries(p.receipts||{}))if(k.startsWith(prefix)){const target=to+':'+k.slice(prefix.length);if(!Object.hasOwn(p.receipts,target)){p.receipts[target]=r;receipts++}}
 if(receipts)moved.push('receipts:'+receipts);
 p.claims[to]={from,key,at,moved};p.claimedBy[from]=to;return {already:false,moved};
}
export function createActorTransfer({store,now=()=>new Date().toISOString()}){
 async function claimedBy(planId,from){const row=await store.read(planId);return row?.data?.claimedBy?.[from]??null}
 transferActor.claimedBy=claimedBy;return transferActor;
 async function transferActor(planId,from,to,key){
  if(typeof from!=='string'||typeof to!=='string'||from===to)fail(400,'claim','Ongeldige overdracht.');
  for(let n=0;n<40;n++){const row=await store.read(planId);if(!row)fail(404,'not_found','Deze planning bestaat niet.');const p=row.data,result=applyTransfer(p,from,to,key,now());if(result.already)return result;p.version++;if(await store.compareAndSwap(planId,row.etag,p))return result;}
  fail(503,'busy','De planning wordt bijgewerkt. Probeer opnieuw.');
 }
}
