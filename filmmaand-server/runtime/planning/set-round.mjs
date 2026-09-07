// Organizer: set the finale shortlist. node planning/set-round.mjs PLAN_ID blade matrix lotr
import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
const [plan,...shortlist]=process.argv.slice(2);if(!plan||shortlist.length!==3){console.error('usage: set-round.mjs PLAN_ID A B C');process.exit(2)}
const token=process.env.PLANNING_ADMIN_TOKEN||(await readFile(new URL('./.data/home-picker-admin-token',import.meta.url),'utf8')).trim();
const base=process.env.PLANNING_API_BASE||'http://127.0.0.1:8792/api';
const r=await fetch(base+'/plans/'+plan+'/round',{method:'POST',headers:{Authorization:'Bearer '+token,'Idempotency-Key':process.env.PLANNING_REQUEST_KEY||randomUUID(),'Content-Type':'application/json'},body:JSON.stringify({shortlist})});
console.log(r.status,JSON.stringify(await r.json(),null,1));process.exit(r.ok?0:1);
