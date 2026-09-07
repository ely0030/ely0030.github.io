/** Durable private outbox. Provider delivery is outside retried state transactions. */
import {createHash} from 'node:crypto';
import {transact} from './state.mjs';
import {renderLoginCodeEmail} from './email-template.mjs';
const failure=()=>Object.assign(Error('De e-mail kon niet worden verzonden. Probeer het later opnieuw.'),{status:503,code:'mail_unavailable'});
export function createMail({store,apiKey,from,allowedRecipients,fetcher=fetch,now=()=>new Date().toISOString(),enabled=false}){
 const allowed=new Set((allowedRecipients||[]).map(x=>x.trim().toLowerCase()));
 function queue(c,message){
  if(!enabled||!apiKey||!from||!allowed.has(message.to))throw failure();
  const rows=c.authStore.db.prepare('SELECT * FROM login_codes WHERE email=? AND consumed_at IS NULL').all(message.to);
  const row=rows.find(r=>r.code_hash===createHash('sha256').update(r.id+':'+message.code).digest('hex'));
  if(!row)throw failure();
  const day=now().slice(0,10),month=day.slice(0,7);c.state.mailUsage||={};
  if((c.state.mailUsage[day]||0)>=80||(c.state.mailUsage[month]||0)>=2000)throw failure();
  c.state.mailUsage[day]=(c.state.mailUsage[day]||0)+1;c.state.mailUsage[month]=(c.state.mailUsage[month]||0)+1;
  c.state.outbox[row.id]={to:message.to,...renderLoginCodeEmail({code:message.code,expiresAt:row.expires_at}),expiresAt:row.expires_at,createdAt:now()};
 }
 async function deliver(id){
  const selected=await transact(store,c=>{
   const m=c.state.outbox[id];if(!m)return null;
   const row=c.authStore.db.prepare('SELECT * FROM login_codes WHERE id=?').get(id);
   if(!row||row.consumed_at||Date.parse(m.expiresAt)<=Date.parse(now())){delete c.state.outbox[id];return null}
   return m;
  });
  if(selected.error)throw failure();const m=selected.value;if(!m)return;
  if(!enabled||!apiKey||!from||!allowed.has(m.to))throw failure();
  let response;try{response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'filmmaand-code-'+id},body:JSON.stringify({from,to:[m.to],subject:m.subject,text:m.text,...(m.html?{html:m.html}:{})})})}catch{throw failure()}
  if(!response.ok)throw failure();
  // A lost acknowledgement leaves the exact message/key for a provider-deduplicated retry.
  const result=await transact(store,c=>{delete c.state.outbox[id];return true});if(result.error)throw failure();
 }
 async function drain(){const row=await store.getWithMetadata('state-v1',{type:'json',consistency:'strong'});if(!row)return;for(const id of Object.keys(row.data.outbox||{}).slice(0,2))await deliver(id)}
 return {queue,deliver,drain};
}
