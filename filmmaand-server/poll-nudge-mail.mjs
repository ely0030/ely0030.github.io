// Reminder for people who hold a poll pass but have not answered yet. Sent only when the organiser runs the
// `nudge` action; nothing schedules it. Chris edits the wording here (mirrored in docs/poll-pass/CONTRACT.md).
// Placeholders: {{NAME}}, {{NIGHTS}} (e.g. "do 24, vr 25 of za 26 september"), {{POLL_URL}} (personal pass link).
// Chris, 23 Sept: the reminder is a card like the invite, with Cairn's sofa GIF (herinnering.gif, locked in by Chris).
// Version A of the three in jasjes2/herinnering/mail-herinnering.html; swap NUDGE_SUBJECT/NUDGE_LINE for B or C.
export const NUDGE_SUBJECT='je popcorn staat klaar';
export const NUDGE_LINE='je plekje op de bank is nog vrij.';
export const NUDGE_ALT='Alec zit op de bank en kijkt je aan. De film staat op pauze, naast hem staat jouw popcorn klaar.';
export const NUDGE_TEXT=`je plekje op de bank is nog vrij.

Movie deze week: {{NIGHTS}}. Je hebt nog niet gestemd.

Kies je avond: {{POLL_URL}}

Kun je geen enkele avond? Laat dat dan ook even weten, dan krijg je geen herinnering meer.`;
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const MONTHS=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'];
export function nudgeNights(window){
 const out=[];for(let t=Date.parse(window.start);t<=Date.parse(window.end);t+=86400000){const d=new Date(t);out.push({day:['zo','ma','di','wo','do','vr','za'][d.getUTCDay()]+' '+d.getUTCDate(),month:MONTHS[d.getUTCMonth()]});}
 const months=[...new Set(out.map(x=>x.month))],parts=out.map((x,i)=>x.day+(months.length>1&&(i===out.length-1||out[i+1].month!==x.month)?' '+x.month:''));
 const list=parts.length>1?parts.slice(0,-1).join(', ')+' of '+parts.at(-1):parts[0];
 return months.length>1?list:list+' '+months[0];
}
export function renderPollNudge({name,window,url,origin}){
 const fill=t=>t.replaceAll('{{NAME}}',name).replaceAll('{{NIGHTS}}',nudgeNights(window)).replaceAll('{{POLL_URL}}',url);
 const text=fill(NUDGE_TEXT),u=escape(url),gif=escape(new URL('/filmmaand/assets/mail/herinnering.gif',origin||url).href),F='font-family:Verdana,Arial,Helvetica,sans-serif;';
 const html='<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(NUDGE_SUBJECT)+'</title></head><body style="margin:0;padding:0;background:#ffffff;">'
  +'<div style="display:none;max-height:0;overflow:hidden;opacity:0;">'+escape(NUDGE_LINE+' '+nudgeNights(window)+'.')+'&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>'
  +'<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff"><tr><td align="center"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">'
  +'<tr><td style="padding:18px 16px 12px;'+F+'font-size:17px;line-height:24px;font-weight:bold;color:#111111;">'+escape(NUDGE_LINE)+'</td></tr>'
  +'<tr><td><a href="'+u+'" target="_blank" style="text-decoration:none;"><img src="'+gif+'" width="600" alt="'+escape(NUDGE_ALT)+'" border="0" style="display:block;border:0;width:100%;max-width:600px;height:auto;'+F+'font-size:13px;color:#0000ee;"></a></td></tr>'
  +'<tr><td align="center" style="padding:14px 12px 6px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:0 auto;"><tr><td align="center" bgcolor="#e0302a" style="border-radius:6px;">'
  +'<a href="'+u+'" target="_blank" style="display:inline-block;'+F+'font-size:18px;font-weight:bold;line-height:22px;color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:6px;">Kies je avond</a></td></tr></table></td></tr>'
  +'<tr><td align="center" style="padding:8px 16px 24px;'+F+'font-size:12px;line-height:18px;color:#777777;">Kun je geen enkele avond? Laat dat dan ook even weten, dan krijg je geen herinnering meer.</td></tr>'
  +'</table></td></tr></table></body></html>';
 return {subject:NUDGE_SUBJECT,text,html};
}
