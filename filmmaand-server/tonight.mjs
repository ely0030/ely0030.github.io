import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {transact} from './state.mjs';
import {providerSender} from './event-notifications.mjs';
export const TONIGHT={id:'tonight-2026-09-15',title:'Vanavond film?',date:'2026-09-15',time:'18:00',location:'Kattendiep35c',minimum:3,alternatives:Array.from({length:7},(_,i)=>'2026-09-'+String(i+16).padStart(2,'0'))};
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const fail=(status,code,message)=>{throw Object.assign(Error(message),{status,code})};
const avatarWindow={};new Function('window',readFileSync(new URL('./runtime/artifacts/identity-studio/avatars.js',import.meta.url),'utf8'))(avatarWindow);
const avatarURL=id=>{const src=avatarWindow.filmmaandAvatarOptions?.find(a=>a.id===id)?.src;return typeof src==='string'&&src.startsWith('/identity/')?'/filmmaand'+src:null;};
const blank=()=>({responses:{},receipts:{},messages:{}});
const publicId=id=>hash([TONIGHT.id,id]).slice(0,24);
export function tonightView(c,account,avatars=[]){
 const state=c.state.tonight?.[TONIGHT.id]||blank();
 const people=c.authStore.db.prepare('SELECT id,name,avatar_id FROM participants WHERE onboarded=1').all();
 const attendees=people.filter(p=>state.responses[p.id]).map(p=>({id:publicId(p.id),name:p.name,avatarUrl:avatarURL(p.avatar_id),...state.responses[p.id]}));
 const person=account?people.find(p=>p.id===account.participantId):null;
 const own=person?{id:publicId(person.id),name:person.name,avatarUrl:avatarURL(person.avatar_id),answer:null,time:null,date:null,...state.responses[person.id]}:null;
 return {event:TONIGHT,attendees,own};
}
export function tonightWrite(c,account,key,part,body,now){
 if(!/^[A-Za-z0-9_-]{16,100}$/.test(key||''))fail(400,'request_key','Een verzoekcode ontbreekt.');
 if(!body||typeof body!=='object'||Array.isArray(body))fail(400,'input','Ongeldige invoer.');
 const state=c.state.tonight?.[TONIGHT.id]||blank(),receiptKey=hash([account.participantId,key]),fingerprint=hash([part,body]);
 const prior=state.receipts[receiptKey];if(prior){if(prior.fingerprint!==fingerprint)fail(409,'receipt_conflict','Dit verzoek is eerder anders gebruikt.');return part==='messages'?{id:prior.result.id,status:state.messages[prior.result.id]?.status||'pending'}:prior.result;}
 let result;
 if(part==='response'){
  if(!Object.keys(body).length||Object.keys(body).some(k=>!['answer','time','date'].includes(k))||body.answer!==undefined&&!['yes','no'].includes(body.answer)||body.time!==undefined&&body.time!==null&&!/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(body.time)||body.date!==undefined&&body.date!==null&&!TONIGHT.alternatives.includes(body.date))fail(400,'input','Kies een geldig antwoord, tijdstip of datum.');
  const own={answer:null,time:null,date:null,...state.responses[account.participantId],...body};state.responses[account.participantId]=own;result={own};
 }else{
  if(Object.keys(body).some(k=>k!=='message')||typeof body.message!=='string'||!body.message.trim()||body.message.length>2000)fail(400,'message','Schrijf een bericht van maximaal 2000 tekens.');
  const recent=Object.values(state.messages).filter(m=>m.participantId===account.participantId&&Date.parse(m.createdAt)>Date.parse(now)-3600000);if(recent.length>=5)fail(429,'rate_limit','Je hebt al meerdere berichten gestuurd. Probeer het later opnieuw.');
  const id=hash([TONIGHT.id,receiptKey]);state.messages[id]={id,participantId:account.participantId,message:body.message.trim(),createdAt:now,status:'pending'};result={id,status:'pending'};
 }
 state.receipts[receiptKey]={fingerprint,result};c.state.tonight||={};c.state.tonight[TONIGHT.id]=state;return result;
}
export function tonightMessages(c){const state=c.state.tonight?.[TONIGHT.id];return {messages:Object.values(state?.messages||{}).map(m=>({id:m.id,name:c.authStore.db.prepare('SELECT name FROM participants WHERE id=?').get(m.participantId)?.name||'Verwijderd account',message:m.message,createdAt:m.createdAt,status:m.status})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))};}
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function createTonightForwarder(options){
 const {store}=options,now=options.now||(()=>new Date().toISOString()),send=options.send||providerSender(options);
 async function deliver(id){
  const claim=await transact(store,c=>{const m=c.state.tonight?.[TONIGHT.id]?.messages[id];if(!m||m.status!=='pending')return null;
   const day=now().slice(0,10),month=day.slice(0,7);c.state.mailUsage||={};if((c.state.mailUsage[day]||0)>=80||(c.state.mailUsage[month]||0)>=2000)return null;
   m.status='uncertain';m.attemptedAt=now();c.state.mailUsage[day]=(c.state.mailUsage[day]||0)+1;c.state.mailUsage[month]=(c.state.mailUsage[month]||0)+1;
   const p=c.authStore.db.prepare('SELECT name FROM participants WHERE id=?').get(m.participantId);return {id:m.id,message:m.message,name:p?.name||'Deelnemer'};});
  if(claim.error||!claim.value)return null;
  const m=claim.value;let accepted;try{accepted=await send({to:'broodislekker@gmail.com',subject:'Filmmaand · bericht aan directie',text:m.name+' schrijft over vanavond:\n\n'+m.message,html:'<p>'+escape(m.name)+' schrijft over vanavond:</p><p style="white-space:pre-wrap">'+escape(m.message)+'</p>'},{id:'tonight-message-'+m.id});}catch{return {id,status:'uncertain'};}
  try{const saved=await transact(store,c=>{const row=c.state.tonight?.[TONIGHT.id]?.messages[id];if(row){row.status='accepted';row.acceptedAt=now();row.providerId=accepted?.providerId||null;}return true;});return {id,status:saved.error?'uncertain':'accepted'};}catch{return {id,status:'uncertain'};}
 }
 async function drain(){const row=await store.getWithMetadata('state-v1',{type:'json',consistency:'strong'});const m=Object.values(row?.data?.tonight?.[TONIGHT.id]?.messages||{}).find(m=>m.status==='pending');if(m)await deliver(m.id);}
 return {deliver,drain};
}
