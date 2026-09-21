import {commitActivity} from './account-notifications.mjs';
import {transact} from './state.mjs';
import {tickCoordination} from './runtime/planning/date-coordination.mjs';
// A single outer provider CAS includes all plan changes and queued messages. No provider I/O here.
export async function runCoordinationTick({store,queueEvents,now=()=>new Date().toISOString()}){
 const result=await transact(store,async c=>{const accounts=new Set(c.authStore.db.prepare('SELECT id FROM participants WHERE onboarded=1').all().map(p=>'p_'+p.id));let changed=0;for(const row of Object.values(c.state.plans||{})){if(tickCoordination(row.data,now(),a=>accounts.has(a))){row.data.version++;row.version++;changed++;}}commitActivity(c,{},now(),{scheduled:true});if(queueEvents)await queueEvents(c);
  // Reported from inside the transaction that is already open. Each drain otherwise opens with its
  // own full strongly-consistent read of this same blob, so an idle tick downloaded the entire state
  // four times over to find out there was nothing to send — once a minute, forever, with no visitors.
  const pending=rows=>Object.values(rows||{}).some(m=>m?.status==='pending');
  const work={events:pending(c.state.eventNotifications?.outbox),
   mail:Object.keys(c.state.outbox||{}).length>0||(c.state.mailReceipts||[]).some(r=>Date.parse(r.retainUntil)<=Date.parse(now())),
   tonight:Object.values(c.state.tonight||{}).some(e=>pending(e?.messages))};
  return {changed,work};});
 if(result.error)throw Object.assign(Error(result.error.message),result.error);return result.value;
}
