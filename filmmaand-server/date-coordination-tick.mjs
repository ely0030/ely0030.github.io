import {transact} from './state.mjs';
import {tickCoordination} from './runtime/planning/date-coordination.mjs';
// A single outer provider CAS includes all plan changes and queued messages. No provider I/O here.
export async function runCoordinationTick({store,queueEvents,now=()=>new Date().toISOString()}){
 const result=await transact(store,async c=>{const accounts=new Set(c.authStore.db.prepare('SELECT id FROM participants WHERE onboarded=1').all().map(p=>'p_'+p.id));let changed=0;for(const row of Object.values(c.state.plans||{})){if(tickCoordination(row.data,now(),a=>accounts.has(a))){row.data.version++;row.version++;changed++;}}if(queueEvents)await queueEvents(c);return {changed};});
 if(result.error)throw Object.assign(Error(result.error.message),result.error);return result.value;
}
