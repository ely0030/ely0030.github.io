/** Durable private outbox. Provider delivery is outside retried state transactions. */
import {createHash} from 'node:crypto';
import {transact} from './state.mjs';
import {renderLoginCodeEmail} from './email-template.mjs';
import {templateFingerprint,providerAcceptanceId,pruneMailReceipts,recordMailAcceptance} from './mail-diagnostics.mjs';
const failure=()=>Object.assign(Error('De e-mail kon niet worden verzonden. Probeer het later opnieuw.'),{status:503,code:'mail_unavailable'});
export function createMail({store,apiKey,from,allowedRecipients,allowAnyRecipient=false,fetcher=fetch,now=()=>new Date().toISOString(),enabled=false,provider='resend',domain,apiBaseUrl='https://api.eu.mailgun.net'}){
 const configured=provider==='resend'||(provider==='mailgun'&&['https://api.eu.mailgun.net','https://api.mailgun.net'].includes(apiBaseUrl)&&/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/i.test(domain||''));
 const allowed=new Set((allowedRecipients||[]).map(x=>x.trim().toLowerCase()));
 function queue(c,message){
  if(!configured||!enabled||!apiKey||!from||(!allowAnyRecipient&&!allowed.has(message.to)))throw failure();
  const rows=c.authStore.db.prepare('SELECT * FROM login_codes WHERE email=? AND consumed_at IS NULL').all(message.to);
  const row=rows.find(r=>r.code_hash===createHash('sha256').update(r.id+':'+message.code).digest('hex'));
  if(!row)throw failure();
  const day=now().slice(0,10),month=day.slice(0,7);c.state.mailUsage||={};
  if((c.state.mailUsage[day]||0)>=80||(c.state.mailUsage[month]||0)>=2000)throw failure();
  c.state.mailUsage[day]=(c.state.mailUsage[day]||0)+1;c.state.mailUsage[month]=(c.state.mailUsage[month]||0)+1;
  pruneMailReceipts(c.state,now());
  c.state.outbox[row.id]={provider,from,to:message.to,...renderLoginCodeEmail({code:message.code,expiresAt:row.expires_at}),expiresAt:row.expires_at,createdAt:now(),templateFingerprint};
 }
 async function deliver(id){
  const selected=await transact(store,c=>{
   pruneMailReceipts(c.state,now());
   const m=c.state.outbox[id];if(!m)return null;
   const row=c.authStore.db.prepare('SELECT * FROM login_codes WHERE id=?').get(id);
   if(!row||row.consumed_at||Date.parse(m.expiresAt)<=Date.parse(now())){delete c.state.outbox[id];return null}
   if((m.provider||'resend')!==provider)return null;
   if(provider==='mailgun'){
    if(m.attemptedAt)throw failure();
    if(!configured||!enabled||!apiKey||!from||(!allowAnyRecipient&&!allowed.has(m.to)))throw failure();
    m.attemptedAt=now(); // Commit before I/O: Mailgun has no assumed send deduplication.
   }
   return m;
  });
  if(selected.error)throw failure();const m=selected.value;if(!m)return;
  if(!configured||!enabled||!apiKey||!from||(!allowAnyRecipient&&!allowed.has(m.to)))throw failure();
  let response;
  try{
   if(provider==='mailgun'){
    const body=new FormData();
    for(const [key,value] of Object.entries({from:m.from||from,to:m.to,subject:m.subject,text:m.text,...(m.html?{html:m.html}:{}),'o:tracking':'no','o:tracking-opens':'no','o:tracking-clicks':'no','o:require-tls':'yes'}))body.set(key,value);
    response=await fetcher(`${apiBaseUrl}/v3/${encodeURIComponent(domain)}/messages`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from('api:'+apiKey).toString('base64')},body,signal:AbortSignal.timeout(15000)});
   }else{
    response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'filmmaand-code-'+id},body:JSON.stringify({from:m.from||from,to:[m.to],subject:m.subject,text:m.text,...(m.html?{html:m.html}:{})})});
   }
  }catch{throw failure()}
  // Even a rejection stays guarded; only an explicit new login request creates another attempt.
  if(!response.ok)throw failure();
  const providerId=await providerAcceptanceId(response,provider),acceptedAt=now();
  // Resend can retry with its key; Mailgun keeps its durable attempt guard on lost acknowledgement.
  const result=await transact(store,c=>{if(c.state.outbox[id]){recordMailAcceptance(c.state,m,providerId,acceptedAt);delete c.state.outbox[id]}return true});if(result.error)throw failure();
 }
 async function drain(){const row=await store.getWithMetadata('state-v1',{type:'json',consistency:'strong'});if(!row)return;if(row.data.mailReceipts?.some(r=>Date.parse(r.retainUntil)<=Date.parse(now())))await transact(store,c=>pruneMailReceipts(c.state,now()));for(const id of Object.keys(row.data.outbox||{}).filter(id=>{const m=row.data.outbox[id];return (m.provider||'resend')===provider&&(!m.attemptedAt||Date.parse(m.expiresAt)<=Date.parse(now()))}).slice(0,2))await deliver(id)}
 return {queue,deliver,drain};
}
