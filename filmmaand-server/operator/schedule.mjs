import {openState} from '../state.mjs';
import {createPlanningService} from '../runtime/planning/service.mjs';
export async function prepareSchedule(input){
 const plan=input.plans?.['home-picker-lab']?.data;
 if(!plan||plan.confirmation||(plan.programme||[]).length)throw Error('Expected open plan with no programmed nights; inspect fresh state');
 if(JSON.stringify(plan.round?.shortlist)!==JSON.stringify(['blade','matrix','lotr'])||plan.roundSchedule?.date!=='2026-09-09')throw Error('Round changed: inspect before scheduling');
 if(!plan.options.some(o=>o.id==='indiana'&&o.title==='Indiana Jones Marathon'))throw Error('Indiana option mismatch');
 const c=openState(input);try{
  const service=createPlanningService({store:c.plans,adminToken:'private-schedule-operation'});
  await service.planNight(plan.id,'private-schedule-operation','schedule-indiana-20260910-v1',{scheduledDate:'2026-09-10',choices:['indiana']});
  await service.scheduleRound(plan.id,'private-schedule-operation','schedule-ballot-20260912-v1',{date:'2026-09-12'});
  const output=c.export(),next=output.plans[plan.id].data;
  for(const k of Object.keys(input))if(k!=='plans'&&JSON.stringify(input[k])!==JSON.stringify(output[k]))throw Error('Non-plan state changed: '+k);
  for(const [id,row] of Object.entries(input.plans))if(id!==plan.id&&JSON.stringify(row)!==JSON.stringify(output.plans[id]))throw Error('Other plan changed');
  for(const k of Object.keys(plan))if(!['programme','roundSchedule','receipts','version'].includes(k)&&JSON.stringify(plan[k])!==JSON.stringify(next[k]))throw Error('Unexpected change: '+k);
  for(const [k,v] of Object.entries(plan.receipts||{}))if(JSON.stringify(v)!==JSON.stringify(next.receipts[k]))throw Error('Existing receipt changed');
  return output;
 }finally{c.close()}
}
