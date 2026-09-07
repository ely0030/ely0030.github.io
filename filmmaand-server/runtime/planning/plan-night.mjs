// Organizer: plan a night. node planning/plan-night.mjs PLAN_ID 2026-09-19T18:00:00Z blade [more option ids]
// Reads the shared backend's private token from planning/.data/home-picker-admin-token (or PLANNING_ADMIN_TOKEN).
import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
const [plan,startsAt,...choices]=process.argv.slice(2);if(!plan||!startsAt||!choices.length){console.error('usage: plan-night.mjs PLAN_ID UTC_START OPTION_ID [...]');process.exit(2)}
const token=process.env.PLANNING_ADMIN_TOKEN||(await readFile(new URL('./.data/home-picker-admin-token',import.meta.url),'utf8')).trim();
const base=process.env.PLANNING_API_BASE||'http://127.0.0.1:8792/api';
const r=await fetch(base+'/plans/'+plan+'/programme',{method:'POST',headers:{Authorization:'Bearer '+token,'Idempotency-Key':process.env.PLANNING_REQUEST_KEY||randomUUID(),'Content-Type':'application/json'},body:JSON.stringify({startsAt,choices})});
console.log(r.status,JSON.stringify(await r.json(),null,1));process.exit(r.ok?0:1);
