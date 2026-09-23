// THE INVITATION MAIL TEMPLATE: pluggable. Replace this file with the chosen design; keep the three exports.
//   subject            string
//   text(ctx) → string plain-text body (required: some mail clients show only this)
//   html(ctx) → string full HTML document
// ctx = {pollUrl, name, nights, assetBase}
//   pollUrl    the recipient's own link: https://ely0030.xyz/filmmaand/wanneer/?pas=<token>, minted at delivery
//   name       the recipient's display name
//   nights     "do 24, vr 25 of za 26 september"
//   assetBase  absolute URL of the hosted mail images, ending in '/': https://ely0030.xyz/filmmaand/assets/mail/
//              (the files live in public/filmmaand/assets/mail/ in this repo)
// Values in ctx are raw: escape them in html(). Never put the link anywhere but in the body (no tracking, no images
// carrying it). This placeholder is deliberately plain: Chris has not picked the design yet.
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const subject='movie deze week?';
export const text=({pollUrl,name,nights})=>`Hoi ${name},

movie deze week? ${nights}

${pollUrl}

Alec`;
export const html=({pollUrl,name,nights})=>`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;background:#fff;"><div style="padding:16px 18px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#222;"><div>Hoi ${esc(name)},</div><div><br></div><div>movie deze week? ${esc(nights)}</div><div><br></div><div><a href="${esc(pollUrl)}" style="color:#1155cc;">${esc(pollUrl.replace(/^https:\/\//,'').replace(/\?.*$/,''))}</a></div><div><br></div><div>Alec</div></div></body></html>`;
