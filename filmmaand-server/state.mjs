import {AuthStore} from './runtime/planning/auth/store.mjs';
const TABLES=['participants','login_codes','sessions','rate_limits','claims','receipts','password_credentials','email_ownership','session_security','auth_invites'];
export const emptyState=()=>({format:1,auth:{},plans:{},images:{owners:{}},outbox:{}});
export function openState(input){
 const state=structuredClone(input);if(![1,2].includes(state.format))throw Error('Unsupported Filmmaand state');
 const authStore=new AuthStore(':memory:');
 for(const table of TABLES){const columns=authStore.db.prepare(`PRAGMA table_info(${table})`).all().map(c=>c.name);const rows=state.auth[table]||[];for(const row of rows){if(Object.keys(row).some(k=>!columns.includes(k)))throw Error('Invalid auth state column');const keys=Object.keys(row);authStore.db.prepare(`INSERT INTO ${table}(${keys.join(',')}) VALUES(${keys.map(()=>'?').join(',')})`).run(...keys.map(k=>row[k]))}}
 const plans={async read(id){const p=state.plans[id];return p?{etag:String(p.version),data:structuredClone(p.data)}:null},async compareAndSwap(id,etag,data){const old=state.plans[id];if(etag===null?Boolean(old):!old||String(old.version)!==etag)return false;state.plans[id]={version:(old?.version||0)+1,data:structuredClone(data)};return true}};
 return {state,authStore,plans,export(){for(const table of TABLES)state.auth[table]=authStore.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();return state},close(){authStore.close()}};
}
export async function transact(store,run,{key='state-v1',attempts=20}={}){
 for(let i=0;i<attempts;i++){
  const current=await store.getWithMetadata(key,{type:'json',consistency:'strong'});if(!current)throw Object.assign(Error('Filmmaand is nog niet geïnitialiseerd.'),{status:503,code:'not_initialized'});
  const context=openState(current.data);let outcome,next;
  try{try{outcome={value:await run(context)}}catch(e){if(!Number.isInteger(e.status)||e.status<400||e.status>=600)throw e;outcome={error:{status:e.status,code:e.code,message:e.message,details:e.details}}}next=context.export()}finally{context.close()}
  if(JSON.stringify(next)===JSON.stringify(current.data))return outcome;
  const result=await store.setJSON(key,next,{onlyIfMatch:current.etag});
  if(result.modified)return outcome;
  await new Promise(r=>setTimeout(r,Math.min(80,2**Math.min(i,6))+Math.floor(Math.random()*7)));
 }
 throw Object.assign(Error('De planning wordt bijgewerkt. Probeer opnieuw.'),{status:503,code:'busy'});
}
