// Text group chat on the date poll (phase 3, Chris 23 Sept), the same channel as the shared doodles. Stored on the poll
// (p.datePoll.chat), so a new poll starts empty. A pass (or session) may only post as its own person. Never mails, never
// notifies. Rate limit per person is computed from the stored messages at write time, so reads never write.
import {answersOpen} from './date-coordination.mjs';

const fail=(status,code,message,details)=>{throw Object.assign(new Error(message),{status,code,...(details?{details}:{})})};
const strict=(b,keys)=>b&&typeof b==='object'&&!Array.isArray(b)&&Object.keys(b).every(k=>keys.includes(k));
const hhmm=at=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(at));
export const CHAT_MAX_CHARS=500,CHAT_MAX_LINES=9,CHAT_MAX_MESSAGES=400,CHAT_RATE=[{ms:60e3,max:5},{ms:3600e3,max:40}];

// Plain text only: NFC, \r removed, no other control characters, trimmed, 1..500 code points, at most 9 lines.
export function normaliseText(text){
 if(typeof text!=='string')fail(400,'chat','Dit bericht kan niet worden verstuurd.');
 const t=text.normalize('NFC').replace(/\r/g,'').trim();
 if(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/.test(t))fail(400,'chat','Dit bericht bevat tekens die niet kunnen.');
 const n=[...t].length;if(n<1)fail(400,'chat','Dit bericht is leeg.');
 if(n>CHAT_MAX_CHARS||t.split('\n').length>CHAT_MAX_LINES)fail(400,'chat_too_long','Dit bericht is te lang.');
 return t;
}

// POST body {pollId, text}. Returns {message} (the receipt keeps exactly this); the api adds the chat view since the cursor.
export function writeChat(p,a,b,now,display){
 const q=p.datePoll;
 if(!strict(b,['pollId','text'])||typeof b.pollId!=='string')fail(400,'chat','Dit bericht kan niet worden verstuurd.');
 if(!q||q.mode!=='availability'||q.id!==b.pollId)fail(409,'date_poll_changed','Deze datumpoll is veranderd.');
 if(!answersOpen(q,now))fail(409,'date_poll_closed','Deze poll is gesloten.');
 if(!display(p,a))fail(409,'onboarding_required','Kies eerst je naam en avatar.');
 const text=normaliseText(b.text),chat=(q.chat||={seq:0,messages:[]}),t=Date.parse(now);
 if(chat.messages.length>=CHAT_MAX_MESSAGES)fail(409,'chat_full','Deze chat is vol.');
 for(const {ms,max} of CHAT_RATE){const recent=chat.messages.filter(m=>m.a===a&&t-Date.parse(m.at)<ms);
  if(recent.length>=max){const retryAfter=Math.ceil((Date.parse(recent[0].at)+ms-t)/1000);fail(429,'chat_rate','Even rustig aan: je kunt zo weer een bericht sturen.',{retryAfter})}}
 const seq=++chat.seq,m={id:'msg-'+q.id.slice(-8)+'-'+seq,seq,a,at:now,text};chat.messages.push(m);
 return {message:view(p,m,a,display)};
}
function view(p,m,me,display){const who=display(p,m.a);return {id:m.id,seq:m.seq,name:who?.name||null,avatarId:who?.avatarId??null,at:m.at,t:hhmm(m.at),text:m.text,...(m.a===me?{self:true}:{})}}

// The reader's view: visible messages after `since` (a seq; 0 = everything), the new cursor, and every hidden id so a
// client can remove one it already shows. Only people with a display profile, like the names elsewhere.
export function chatView(p,me,display,since=0){
 const chat=p.datePoll?.chat,all=chat?.messages||[];
 return {messages:all.filter(m=>m.seq>since&&!m.hidden&&display(p,m.a)).map(m=>view(p,m,me,display)),cursor:chat?.seq||0,hidden:all.filter(m=>m.hidden).map(m=>m.id)};
}
export const parseSince=v=>/^\d{1,6}$/.test(v||'')?Number(v):0;

// Organiser: every message with its hidden flag, and the kill switch {action:'hide-message', pollId, messageId, hidden}.
export function organiserChat(p,display){return (p.datePoll?.chat?.messages||[]).map(m=>({id:m.id,name:display(p,m.a)?.name||null,at:m.at,text:m.text,hidden:!!m.hidden}))}
export function hideMessage(p,b){
 if(!strict(b,['action','pollId','messageId','hidden'])||typeof b.messageId!=='string'||typeof b.hidden!=='boolean')fail(400,'chat','Ongeldige actie.');
 const q=p.datePoll;if(!q||q.mode!=='availability'||q.id!==b.pollId)fail(409,'date_poll_changed','Deze datumpoll is veranderd.');
 const m=(q.chat?.messages||[]).find(x=>x.id===b.messageId);if(!m)fail(404,'message_unknown','Dit bericht bestaat niet.');
 if(b.hidden)m.hidden=true;else delete m.hidden;
}
