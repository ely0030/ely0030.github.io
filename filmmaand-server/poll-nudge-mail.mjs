// Reminder for people who hold a poll pass but have not answered yet. Sent only when the organiser runs the
// `nudge` action; nothing schedules it. Chris edits the wording here (mirrored in docs/poll-pass/CONTRACT.md).
// Placeholders: {{NAME}}, {{NIGHTS}} (e.g. "do 24, vr 25 of za 26 september"), {{POLL_URL}} (personal pass link).
export const NUDGE_SUBJECT='Movie deze week?';
export const NUDGE_TEXT=`Hoi {{NAME}},

Movie deze week? Je hebt nog niet gestemd.

Welke avond kun jij: {{NIGHTS}}? Kun je geen enkele avond, laat dat dan ook even weten. Dan krijg je hierover geen herinnering meer.

Stemmen: {{POLL_URL}}

Alec Filmmaand`;
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
export function nudgeNights(window){
 const out=[];for(let t=Date.parse(window.start);t<=Date.parse(window.end);t+=86400000){const d=new Date(t);out.push({day:['zo','ma','di','wo','do','vr','za'][d.getUTCDay()]+' '+d.getUTCDate(),month:MONTHS[d.getUTCMonth()]});}
 const months=[...new Set(out.map(x=>x.month))],parts=out.map((x,i)=>x.day+(months.length>1&&(i===out.length-1||out[i+1].month!==x.month)?' '+x.month:''));
 const list=parts.length>1?parts.slice(0,-1).join(', ')+' of '+parts.at(-1):parts[0];
 return months.length>1?list:list+' '+months[0];
}
export function renderPollNudge({name,window,url}){
 const fill=t=>t.replaceAll('{{NAME}}',name).replaceAll('{{NIGHTS}}',nudgeNights(window)).replaceAll('{{POLL_URL}}',url);
 const text=fill(NUDGE_TEXT);
 const html=`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(NUDGE_SUBJECT)}</title></head><body style="margin:0;background:#fff;color:#111;font:15px/24px Arial,Helvetica,sans-serif;"><div style="max-width:600px;margin:auto;padding:30px 32px;">${text.split('\n\n').map(p=>p.includes(url)?`<p><a href="${escape(url)}" style="color:#111;font-weight:700;">Stemmen</a></p>`:`<p>${escape(p).replace(/\n/g,'<br>')}</p>`).join('')}</div></body></html>`;
 return {subject:NUDGE_SUBJECT,text,html};
}
