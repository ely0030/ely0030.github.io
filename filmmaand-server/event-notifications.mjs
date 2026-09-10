/** Committed date-event notifications. Private state only; never called from a browser. */
import {createHash} from 'node:crypto';
import {transact} from './state.mjs';
import {providerAcceptanceId} from './mail-diagnostics.mjs';
const TYPES=new Set(['date-confirmed','date-change-proposed','date-changed','event-updated','reminder']);
const DAY=86400000, hash=value=>createHash('sha256').update(value).digest('hex');
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validTime=value=>typeof value==='string'&&Number.isFinite(Date.parse(value));
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
const clean=(value,max=180)=>typeof value==='string'?value.replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,max):'';
function stamp(now){const value=typeof now==='function'?now():now;return value||new Date().toISOString();}
function namespace(state){return state.eventNotifications||=( {version:1,seen:{},outbox:{},receipts:[]} );}
function validNotice(n){return n&&typeof n.id==='string'&&n.id.length>0&&n.id.length<=200&&TYPES.has(n.type)&&typeof n.planId==='string'&&typeof n.eventId==='string'&&validTime(n.occurredAt)&&date(n.scheduledDate)&&(!['date-changed'].includes(n.type)||date(n.previousDate))&&(n.type!=='date-change-proposed'||date(n.proposedDate));}
function policyAllows(c,p,{allowedRecipients=[],allowAnyRecipient=false}={}){
 const email=String(p.email||'').trim().toLowerCase();
 if(!p.id||!email||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||/(?:@(?:example\.(?:com|org|net)|localhost)$|\.(?:test|invalid|example)$)/i.test(email))return false;
 // Legacy participants were created only after a code proof; explicit null means invite-only, unverified.
 const ownership=c.authStore.db.prepare('SELECT verified_at FROM email_ownership WHERE participant_id=?').get(p.id);
 if(ownership&&!ownership.verified_at)return false;
 const pref=c.state.eventNotificationPreferences?.[p.id];
 if(pref===false||pref?.email===false||pref?.enabled===false)return false;
 const suppressed=c.state.eventNotificationSuppressions?.[email];
 if(suppressed===true||(suppressed&&suppressed.active!==false))return false;
 if(c.state.eventNotificationExcludedParticipantIds?.includes(p.id))return false;
 return allowAnyRecipient||allowedRecipients.some(x=>String(x).trim().toLowerCase()===email);
}
export function eligibleEventRecipients(c,options={}){
 return c.authStore.db.prepare('SELECT id,email FROM participants ORDER BY id').all().filter(p=>policyAllows(c,p,options));
}
function projectNotice(n,p){
 const options=Array.isArray(p.options)?p.options:[];
 return {id:n.id,type:n.type,planId:n.planId,eventId:n.eventId,eventVersion:n.eventVersion??null,occurredAt:n.occurredAt,scheduledDate:n.scheduledDate,previousDate:n.previousDate||null,proposedDate:n.proposedDate||null,proposalId:n.proposalId||null,requiredActors:Array.isArray(n.requiredActors)?[...new Set(n.requiredActors.filter(x=>typeof x==='string'))].sort():[],title:clean(n.title)||'Filmavond',timing:{arrival:clean(n.timing?.arrival,80),screening:clean(n.timing?.screening,80),end:clean(n.timing?.end,80)},films:(Array.isArray(n.choices)?n.choices:[]).map(id=>options.find(o=>o.id===id)).filter(Boolean).map(o=>clean(o.title)).filter(Boolean)};
}
/** Call within the SAME state transaction as date changes. No network or provider effects here. */
export function queueCoordinationEvents(c,options={}){
 const at=stamp(options.now),activatedAt=options.activatedAt;
 if(!options.enabled||!validTime(activatedAt)||Date.parse(activatedAt)>Date.parse(at))return {queued:0,enabled:false};
 const ns=namespace(c.state),recipients=eligibleEventRecipients(c,options);let queued=0;
 // Keep only bounded-age private delivery bodies; the minimal seen ledger still prevents replay.
 for(const [id,m] of Object.entries(ns.outbox))if(Date.parse(m.createdAt)<Date.parse(at)-30*DAY)delete ns.outbox[id];
 for(const {data:p} of Object.values(c.state.plans||{}))for(const n of p.coordinationEvents||[]){
  if(!validNotice(n)||Date.parse(n.occurredAt)<Date.parse(activatedAt)||Date.parse(n.occurredAt)>Date.parse(at))continue;
  const key=hash(n.planId+'\0'+n.id);if(ns.seen[key])continue;
  const notice=projectNotice(n,p);
  // Stable minimal ledger prevents replay even after private message bodies/receipts expire.
  ns.seen[key]={at,eventId:n.eventId,type:n.type};
  for(const recipient of recipients){const id=hash(key+'\0'+recipient.id);ns.outbox[id]={id,notice,participantId:recipient.id,to:recipient.email.toLowerCase(),createdAt:at,status:'pending'};queued++;}
 }
 return {queued,enabled:true};
}
function displayDate(value){return new Intl.DateTimeFormat('nl-NL',{weekday:'long',day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Amsterdam'}).format(new Date(value+'T12:00:00Z'));}
export function renderEventNotification(notice,{participantId,origin='https://ely0030.xyz'}={}){
 if(!validNotice(notice))throw Error('Invalid committed notification');
 const base=new URL(origin);if(base.protocol!=='https:'&&base.hostname!=='localhost')throw Error('Invalid Programme origin');
 const url=new URL('/filmmaand/programma/',base);url.searchParams.set('event',notice.eventId);if(notice.proposalId)url.searchParams.set('proposal',notice.proposalId);
 const day=displayDate(notice.scheduledDate),title=clean(notice.title)||'Filmavond',required=notice.requiredActors?.includes('p_'+participantId);
 let heading,subject,paragraphs,action='Zie programma';
 switch(notice.type){
 case 'date-confirmed':heading='De datum staat vast.';subject='Filmmaand · '+title+' · '+day;paragraphs=[title+' is gepland op '+day+'.'];break;
 case 'date-change-proposed':heading='Een andere datum?';subject='Filmmaand · Voorstel om '+title+' te verplaatsen';paragraphs=['Huidige datum: '+day+'.','Voorgestelde datum: '+displayDate(notice.proposedDate)+'.','De huidige datum blijft staan zolang de wijziging niet is bevestigd.',required?'Je staat als aanwezig op de huidige datum. Jouw expliciete akkoord is nodig voor een automatische verplaatsing.':'Laat weten of je akkoord gaat met de verplaatsing. De huidige aanwezigen moeten daar expliciet mee instemmen.','Je antwoord gaat over het verplaatsen van deze avond, niet over je algemene beschikbaarheid.'];action='Reageer op het voorstel';break;
 case 'date-changed':heading='De datum is gewijzigd.';subject='Filmmaand · Nieuwe datum voor '+title;paragraphs=[title+': '+displayDate(notice.previousDate)+' vervalt.','De nieuwe datum is '+day+'.','Controleer je aanwezigheid bij de avond op de site.'];break;
 case 'event-updated':heading='De avond is bijgewerkt.';subject='Filmmaand · Update voor '+title;paragraphs=[title+' · '+day+'.','Bekijk de actuele gegevens in het programma.'];break;
 case 'reminder':heading='Tot bij de film.';subject='Filmmaand · Herinnering: '+title;paragraphs=[title+' staat gepland op '+day+'.'];break;
 }
 if(notice.type!=='date-change-proposed'){
  for(const [key,label] of [['arrival','Inloop'],['screening',notice.type==='date-confirmed'?'Aanvang':'Film start'],['end','Einde']])if(clean(notice.timing?.[key],80))paragraphs.push(label+': '+clean(notice.timing[key],80)+'.');
  if(notice.films?.length)paragraphs.push('Filmprogramma: '+notice.films.map(x=>clean(x)).join(' · ')+'.');
 }
 const text=['Alec Filmmaand',heading,...paragraphs,action+': '+url.href].join('\n\n');
 if(notice.type==='date-confirmed')return {subject,text,html:renderConfirmedScreening(notice,{base,url,subject,title,heading})};
 const html=`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head><body style="margin:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:auto;background:#fff;"><tr><td style="padding:30px 32px;font:700 13px/20px Arial,Helvetica,sans-serif;"><img src="${base.origin}/filmmaand/site/icons/interval-black-48.png" width="22" height="22" alt="" style="vertical-align:middle;margin-right:9px;border:0;">ALEC FILMMAAND</td></tr><tr><td style="padding:25px 32px 40px;"><h1 style="margin:0;font:400 44px/48px Arial,Helvetica,sans-serif;letter-spacing:-1.8px;">${escape(heading)}</h1>${paragraphs.map(p=>`<p style="margin:22px 0 0;font:15px/25px Arial,Helvetica,sans-serif;">${escape(p)}</p>`).join('')}</td></tr><tr><td bgcolor="#101010" style="padding:25px 32px;background:#101010;"><a href="${escape(url.href)}" style="font:700 13px/22px Arial,Helvetica,sans-serif;color:#fff;text-decoration:underline;">${escape(action)} ↗</a></td></tr></table></body></html>`;
 return {subject,text,html};
}
/** Confirmation-only presentation. The event facts and delivery contract remain unchanged. */
function renderConfirmedScreening(notice,{base,url,subject,title,heading}){
 const when=new Date(notice.scheduledDate+'T12:00:00Z');
 const format=options=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',...options}).format(when);
 const weekday=format({weekday:'long'}),monthDay=format({day:'numeric',month:'long'}),year=format({year:'numeric'});
 const slots=[['arrival','Inloop'],['screening','Aanvang'],['end','Einde']].map(([key,label])=>({label,value:clean(notice.timing?.[key],80)})).filter(slot=>slot.value);
 const films=(notice.films||[]).map(f=>clean(f)).filter(Boolean);
 const timings=slots.length?`<tr><td style="padding:0 32px 34px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="table-layout:fixed;border-top:1px solid #d9d9d9;border-bottom:1px solid #d9d9d9;"><tr>${slots.map((slot,index)=>`<td width="${Math.floor(100/slots.length)}%" valign="top" style="padding:20px ${index===slots.length-1?0:12}px 22px ${index?12:0}px;${index?'border-left:1px solid #e5e5e5;':''}"><p style="margin:0 0 9px;font:11px/16px Arial,Helvetica,sans-serif;color:#6d6d6d;">${slot.label}</p><p style="margin:0;font:400 ${slot.value.length>12?16:23}px/29px Arial,Helvetica,sans-serif;letter-spacing:-.5px;overflow-wrap:anywhere;word-break:break-word;color:#111;">${escape(slot.value)}</p></td>`).join('')}</tr></table></td></tr>`:'';
 return `<!doctype html>
<html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(subject)}</title></head>
<body style="margin:0;background:#fff;color:#111;font-family:Arial,Helvetica,sans-serif;">
<table role="presentation" width="100%" border="0" cellpadding="0" cellspacing="0"><tr><td align="center">
<!--[if mso]><table role="presentation" width="600" border="0" cellpadding="0" cellspacing="0"><tr><td><![endif]-->
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:600px;margin:auto;background:#fff;color:#111;">
<tr><td style="padding:30px 32px 0;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="border-bottom:1px solid #111;"><tr><td style="padding:0 0 23px;font:700 13px/22px Arial,Helvetica,sans-serif;letter-spacing:.2px;"><img src="${base.origin}/filmmaand/site/icons/interval-black-48.png" width="22" height="22" alt="" style="width:22px;height:22px;vertical-align:middle;margin-right:9px;border:0;">ALEC FILMMAAND</td></tr></table></td></tr>
<tr><td style="padding:29px 32px 0;"><p style="margin:0;font:400 14px/22px Arial,Helvetica,sans-serif;color:#555;">${escape(heading)}</p><p style="margin:28px 0 10px;font:11px/18px Arial,Helvetica,sans-serif;letter-spacing:1.4px;text-transform:uppercase;color:#555;">${escape(weekday)} &nbsp;·&nbsp; ${escape(year)}</p><h1 style="margin:0;font:400 43px/49px Georgia,'Times New Roman',serif;letter-spacing:-1.5px;color:#111;">${escape(monthDay)}</h1></td></tr>
<tr><td style="padding:27px 32px 29px;"><h2 style="margin:0;font:400 21px/28px Arial,Helvetica,sans-serif;letter-spacing:-.4px;color:#111;">${escape(title)}</h2>${films.length?`<p style="margin:7px 0 0;font:15px/24px Arial,Helvetica,sans-serif;color:#666;">${films.map(escape).join(' · ')}</p>`:''}</td></tr>
${timings}
<tr><td bgcolor="#101010" style="background:#101010;"><a href="${escape(url.href)}" style="display:block;padding:23px 32px;font:700 13px/22px Arial,Helvetica,sans-serif;color:#fff;text-decoration:none;mso-padding-alt:23px 32px;">Zie programma &nbsp;↗</a></td></tr>
</table><!--[if mso]></td></tr></table><![endif]-->
</td></tr></table></body></html>`;
}

function providerSender(options){
 const {provider,apiKey,from,domain,apiBaseUrl='https://api.eu.mailgun.net',fetcher=fetch}=options;
 return async(message,{id})=>{
  if(!apiKey||!from||!['mailgun','resend'].includes(provider))throw Error('Notification transport unavailable');
  let response;
  if(provider==='mailgun'){
   if(!['https://api.eu.mailgun.net','https://api.mailgun.net'].includes(apiBaseUrl)||!/^[a-z0-9]+(?:[.-][a-z0-9]+)*\.[a-z]{2,}$/i.test(domain||''))throw Error('Invalid Mailgun configuration');
   const body=new FormData();for(const [k,v] of Object.entries({from,to:message.to,subject:message.subject,text:message.text,html:message.html,'o:tracking':'no','o:tracking-opens':'no','o:tracking-clicks':'no','o:require-tls':'yes'}))body.set(k,v);
   response=await fetcher(`${apiBaseUrl}/v3/${encodeURIComponent(domain)}/messages`,{method:'POST',headers:{Authorization:'Basic '+Buffer.from('api:'+apiKey).toString('base64')},body,signal:AbortSignal.timeout(15000)});
  }else response=await fetcher('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':'filmmaand-event-'+id},body:JSON.stringify({from,to:[message.to],subject:message.subject,text:message.text,html:message.html}),signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('Notification provider rejected request');
  return {providerId:await providerAcceptanceId(response,provider)};
 };
}
export function createEventNotifications(options={}){
 const {store,enabled=false,origin='https://ely0030.xyz'}=options,send=options.send||providerSender(options),now=()=>stamp(options.now);
 async function deliver(id){
  if(!enabled||!validTime(options.activatedAt)||Date.parse(options.activatedAt)>Date.parse(now()))return {status:'disabled'};
  const selected=await transact(store,c=>{
   const ns=namespace(c.state),m=ns.outbox[id];if(!m||m.status!=='pending')return null;
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now()));
   const relevantDate=m.notice.type==='date-change-proposed'?m.notice.proposedDate:m.notice.scheduledDate;
   if(relevantDate<today){delete ns.outbox[id];return null;}
   const p=c.authStore.db.prepare('SELECT id,email FROM participants WHERE id=?').get(m.participantId);
   // Address changes, account deletion, new opt-outs and local suppression cancel queued delivery.
   if(!p||p.email.toLowerCase()!==m.to||!policyAllows(c,p,options)){delete ns.outbox[id];return null;}
   const plan=c.state.plans[m.notice.planId]?.data;
   const current=[...(plan?.programme||[]),...(plan?.confirmation?[{id:'confirmation',...plan.confirmation}]:[])].find(e=>e.id===m.notice.eventId);
   if(!current||(current.coordinationRevision||0)>(m.notice.eventVersion??0)){delete ns.outbox[id];return null;}
   if(m.notice.type==='date-change-proposed'){
    const proposal=plan?.dateChanges?.find(p=>p.id===m.notice.proposalId&&p.eventId===m.notice.eventId);
    if(!proposal||proposal.status!=='pending'||(current.coordinationRevision||0)!==m.notice.eventVersion){delete ns.outbox[id];return null;}
    // Use the current authoritative proposal consent roster, rather than a stale email copy.
    m.notice.requiredActors=Array.isArray(proposal.currentRequiredActors)?proposal.currentRequiredActors:Array.isArray(proposal.requiredActors)?proposal.requiredActors:[];
   }
   // A queued notice becomes obsolete after a newer change for the same evening.
   const events=Object.values(c.state.plans||{}).flatMap(p=>p.data.coordinationEvents||[]);
   if(events.some(e=>e.eventId===m.notice.eventId&&e.planId===m.notice.planId&&['date-changed','event-updated'].includes(e.type)&&(Date.parse(e.occurredAt)>Date.parse(m.notice.occurredAt)||(Number.isInteger(e.eventVersion)&&Number.isInteger(m.notice.eventVersion)&&e.eventVersion>m.notice.eventVersion)))){delete ns.outbox[id];return null;}
   const day=now().slice(0,10),month=day.slice(0,7);c.state.mailUsage||={};
   if((c.state.mailUsage[day]||0)>=80||(c.state.mailUsage[month]||0)>=2000)return null;
   const rendered=renderEventNotification(m.notice,{participantId:m.participantId,origin});
   m.status='attempted';m.attemptedAt=now();c.state.mailUsage[day]=(c.state.mailUsage[day]||0)+1;c.state.mailUsage[month]=(c.state.mailUsage[month]||0)+1;
   return {id:m.id,to:m.to,...rendered};
  });
  if(selected.error)throw Error('Notification claim unavailable');if(!selected.value)return {status:'skipped'};
  let acceptance;try{acceptance=await send(selected.value,{id});}catch{return {status:'uncertain'};}
  const result=await transact(store,c=>{const ns=namespace(c.state);if(!ns.outbox[id])return;ns.receipts.push({id,acceptedAt:now(),providerId:typeof acceptance?.providerId==='string'?acceptance.providerId:null});ns.receipts=ns.receipts.filter(r=>Date.parse(r.acceptedAt)>Date.parse(now())-30*DAY).slice(-2000);delete ns.outbox[id];});
  if(result.error)throw Error('Notification acceptance persistence unavailable');return {status:'accepted'};
 }
 async function drain({limit=10}={}){
  if(!enabled)return [];
  const row=await store.getWithMetadata('state-v1',{type:'json',consistency:'strong'});if(!row)return [];
  const ids=Object.keys(row.data.eventNotifications?.outbox||{}).filter(id=>row.data.eventNotifications.outbox[id].status==='pending').slice(0,Math.max(0,Math.min(Number.isInteger(limit)?limit:10,20)));
  const results=[];for(const id of ids)results.push(await deliver(id));return results;
 }
 return {queue:c=>queueCoordinationEvents(c,options),deliver,drain};
}
