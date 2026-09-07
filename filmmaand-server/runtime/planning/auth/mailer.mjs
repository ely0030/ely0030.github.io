import {appendFileSync} from 'node:fs';
const fail=(status,code,message,details)=>{throw Object.assign(new Error(message),{status,code,details})};
export const renderCodeMail=({code,expiresMinutes})=>({subject:'Je inlogcode voor Alec Filmmaand',text:`Je inlogcode is ${code}\n\nVul deze code in op de site. De code is ${expiresMinutes} minuten geldig en werkt één keer.\nHeb je dit niet aangevraagd? Dan kun je deze mail negeren.`});
// Development mailer: never delivers. Keeps messages in memory (tests) and appends to an outbox file (manual QA).
export function createDevMailer({outbox=null}={}){const messages=[];return {kind:'dev',messages,async send(m){const entry={...m,at:new Date().toISOString(),id:'dev-'+(messages.length+1)};messages.push(entry);if(outbox)appendFileSync(outbox,JSON.stringify(entry)+'\n');return {id:entry.id}},last(to){for(let i=messages.length-1;i>=0;i--)if(messages[i].to===to)return messages[i];return null}}}
// Resend adapter (POST https://api.resend.com/emails, Bearer key, {from,to,subject,text} → {id}; verified 2026-09-07 against
// resend.com/docs/api-reference/emails/send-email). Requires an explicit recipient allow-list: the first live tests go to
// Chris only. Refuses to construct without every setting so a stray key alone can never send.
export function createResendMailer({apiKey,from,allow,fetch=globalThis.fetch,endpoint='https://api.resend.com/emails'}){
 if(!apiKey||!from||!(allow instanceof Set)||!allow.size)throw new Error('Resend mailer needs apiKey, from and a non-empty recipient allow-list.');
 return {kind:'resend',async send({to,subject,text}){if(!allow.has(to.toLowerCase()))fail(503,'mail_not_allowed','E-mail naar dit adres is nog niet vrijgegeven.');const r=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json'},body:JSON.stringify({from,to:[to],subject,text})});if(!r.ok)fail(503,'mail_unavailable','De e-mail kon niet worden verzonden.',{status:r.status});return {id:(await r.json()).id}}}}
// AUTH_MAILER=resend is the only path to a real delivery, and it still needs AUTH_FROM, RESEND_API_KEY and AUTH_MAIL_ALLOW.
export function mailerFromEnv(env=process.env,{outbox=null}={}){
 if(env.AUTH_MAILER==='resend'){const allow=new Set((env.AUTH_MAIL_ALLOW||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));return createResendMailer({apiKey:env.RESEND_API_KEY,from:env.AUTH_FROM,allow})}
 if(env.AUTH_MAILER&&env.AUTH_MAILER!=='dev')throw new Error('Unknown AUTH_MAILER: '+env.AUTH_MAILER);
 return createDevMailer({outbox});
}
