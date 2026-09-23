// THE CONFIRMATION MAIL TEMPLATE ("De avond staat vast"): pluggable, like poll-invite-template.mjs. Replace freely;
// keep the three exports. Chris (23 Sept): a PLAIN, calm mail for now (the island design is saved for a later night).
//   subject(ctx) → string   text(ctx) → string   html(ctx) → string
// ctx = {name, avond, tijd, waar, namen, jaUrl, neeUrl, assetBase}
//   name       the recipient's display name        avond   "zaterdag 26 september"
//   tijd/waar  from the pick (defaults "20:00" / "bij Alec")
//   namen      display names who said yes to that night (array; unused by this plain template)
//   jaUrl      https://ely0030.xyz/filmmaand/wanneer/?pas=<token>&antwoord=ja   (the page only PRE-SELECTS; a tap saves)
//   neeUrl     the same with antwoord=nee
//   assetBase  https://ely0030.xyz/filmmaand/assets/mail   (no trailing slash; for designs with images)
// ctx values are raw: escape them in html().
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const subject=({avond})=>`het wordt ${avond}!`;
export const text=({name,avond,tijd,waar,jaUrl,neeUrl})=>`Hoi ${name},

De avond staat vast: ${avond}, ${tijd}, ${waar}.

Ben je erbij?

Ja, ik kom: ${jaUrl}
Toch niet: ${neeUrl}

Je kunt het nog aanpassen tot de avond zelf.

Alec`;
export const html=({name,avond,tijd,waar,jaUrl,neeUrl})=>`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>het wordt ${esc(avond)}!</title></head><body style="margin:0;background:#fff;"><div style="padding:16px 18px;font:14px/1.5 Arial,Helvetica,sans-serif;color:#222;"><div>Hoi ${esc(name)},</div><div><br></div><div>De avond staat vast: ${esc(avond)}, ${esc(tijd)}, ${esc(waar)}.</div><div><br></div><div>Ben je erbij?</div><div><br></div><div><a href="${esc(jaUrl)}" style="color:#1155cc;">Ja, ik kom</a></div><div><a href="${esc(neeUrl)}" style="color:#1155cc;">Toch niet</a></div><div><br></div><div>Je kunt het nog aanpassen tot de avond zelf.</div><div><br></div><div>Alec</div></div></body></html>`;
