/** Operator-only tool; never import from a Function/public endpoint. */
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {parseArgs} from 'node:util';
import {randomUUID,createHash} from 'node:crypto';
import {removeFixture,fixtureId} from './operator-fixture.mjs';
const sha=state=>createHash('sha256').update(JSON.stringify(state)).digest('hex');
export const checkedOperatorFetch=(fetcher=fetch)=>async(...args)=>{const r=await fetcher(...args),method=String(args[1]?.method||args[0]?.method||'GET').toUpperCase();const missingRead=r.status===404&&['GET','HEAD','DELETE'].includes(method);if(!r.ok&&!missingRead&&r.status!==412)throw Error('Storage transport failed with status '+r.status);return r};
const expectedNames=['Bas','Koen','Fre','Ruben','Lucas','Joeri','Sjoerd'].map(n=>n+' (voorbeeld)');
export function freshState(plan){
 const fixture=plan.fixtureGroups?.[fixtureId];
 if(!fixture||fixture.actors?.length!==7||Object.keys(plan.fixtureGroups).length!==1)throw Error('Expected one seven-friend fixture');
 if(!/^[a-z0-9-]+$/.test(plan.id||''))throw Error('Invalid plan ID');
 if(JSON.stringify(fixture.actors.map(a=>a.name).sort())!==JSON.stringify([...expectedNames].sort()))throw Error('Expected the seven explicitly labelled friend names');
 const actors=new Set(fixture.actors.map(a=>a.actor));if(actors.size!==7||[...actors].some(a=>! /^[a-f0-9]{64}$/.test(a)))throw Error('Invalid fixture actor registry');
 if(Object.keys(plan.responses||{}).length!==7)throw Error('Expected exactly seven fixture responses');
 for(const field of ['responses','displayProfiles','nightProposals'])if(Object.keys(plan[field]||{}).some(a=>!actors.has(a)))throw Error('Non-fixture participant state: '+field);
 for(const field of ['votes','claims','claimedBy'])if(Object.keys(plan[field]||{}).length)throw Error('Refusing votes or claimed data');
 if(plan.confirmation||(plan.programme||[]).length||Object.keys(plan.receipts||{}).some(k=>!actors.has(k.split(':')[0])))throw Error('Refusing organizer or real-user data');
 const optionIds=new Set(fixture.optionIds||[]);
 if(plan.options.some(o=>o.kind==='suggestion'&&!optionIds.has(o.id)))throw Error('Unregistered suggestion');
 return {format:1,auth:Object.fromEntries(['participants','login_codes','sessions','rate_limits','claims','receipts'].map(k=>[k,[]])),plans:{[plan.id]:{version:1,data:structuredClone(plan)}},images:{owners:{}},outbox:{}};
}
async function backup({directory,storeName,operation,before,after}){
 // Unique mode0700 directory, mode0600 file: backups contain private auth/session material.
 await mkdir(directory,{recursive:true,mode:0o700});
 const folder=resolve(directory,new Date().toISOString().replace(/[:.]/g,'-')+'-'+randomUUID());await mkdir(folder,{mode:0o700});
 const path=resolve(folder,'state.json');
 await writeFile(path,JSON.stringify({format:1,store:storeName,key:'state-v1',operation,at:new Date().toISOString(),before,proposed:after},null,2)+'\n',{flag:'wx',mode:0o600});
 return path;
}
export async function operate({store,storeName,operation,plan,planId,backupDirectory}){
 if(!storeName||!backupDirectory)throw Error('Explicit store and private backup directory required');
 if(!['initialize','remove-demo'].includes(operation))throw Error('Unknown operation');
 const current=await store.getWithMetadata('state-v1',{type:'json',consistency:'strong'});
 let next;
 if(operation==='initialize'){if(current)throw Error('Existing state: refusing initialization');next=freshState(plan);planId=plan.id}
 else{
  if(!current||current.data?.format!==1)throw Error('Missing or unsupported state');
  if(!planId||!current.data.plans?.[planId])throw Error('Explicit existing plan ID required');
  if(!current.etag)throw Error('Storage did not provide an ETag');
  next=structuredClone(current.data);
  const row=next.plans[planId];row.data=removeFixture(row.data);row.version=Number(row.version)+1;
  if(!Number.isSafeInteger(row.version))throw Error('Invalid plan storage revision');
 }
 const path=await backup({directory:resolve(backupDirectory),storeName,operation,before:current,after:next});
 const result=await store.setJSON('state-v1',next,current?{onlyIfMatch:current.etag}:{onlyIfNew:true});
 if(result?.modified!==true)throw Error('Concurrent update: nothing acknowledged; rerun from fresh state. Private backup: '+path);
 return {operation,store:storeName,planId,backup:path,beforeSha256:current?sha(current.data):null,afterSha256:sha(next),applied:true};
}
async function main(){
 const {values:v,positionals}=parseArgs({allowPositionals:true,options:{store:{type:'string'},plan:{type:'string'},'plan-id':{type:'string'},'backup-dir':{type:'string'}}});
 const operation=positionals[0];if(positionals.length!==1||!['initialize','remove-demo'].includes(operation)||!v.store||!v['backup-dir'])throw Error('Usage: operator-state.mjs initialize|remove-demo --store NAME --backup-dir PRIVATE_DIR [--plan FRESH_PLAN_JSON | --plan-id EXISTING_ID]');
 if(!/^[A-Za-z0-9_-]{1,128}$/.test(v.store))throw Error('Invalid store name');
 const token=process.env.NETLIFY_AUTH_TOKEN,siteID=process.env.NETLIFY_SITE_ID;if(!token||!siteID)throw Error('Set NETLIFY_AUTH_TOKEN and NETLIFY_SITE_ID in the operator environment');
 if(operation==='initialize'&&(!v.plan||v['plan-id']))throw Error('Initialization requires --plan, not --plan-id');
 if(operation==='remove-demo'&&(!v['plan-id']||v.plan))throw Error('Removal requires --plan-id, not --plan');
 const {getStore}=await import('@netlify/blobs');
 // Explicit credentials override ambient deployed-function context. Never print either credential.
 const checkedFetch=checkedOperatorFetch();
 const store=getStore({name:v.store,siteID,token,consistency:'strong',fetch:checkedFetch});
 const result=await operate({store,storeName:v.store,operation,plan:v.plan?JSON.parse(await readFile(resolve(v.plan),'utf8')):undefined,planId:v['plan-id'],backupDirectory:v['backup-dir']});
 console.log(JSON.stringify(result));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(e.message);process.exitCode=1});
