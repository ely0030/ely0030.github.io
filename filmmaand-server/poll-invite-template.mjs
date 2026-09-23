// THE INVITATION MAIL TEMPLATE: pluggable. Keep the three exports: subject, text(ctx), html(ctx).
// FINAL (Chris, 23 Sept): Capsule's greeting card, kits/invitations/05-calendly-study/jasjes2/kaartje/
// mail-ophalen-b-mobiel.prod.html + .txt, ported byte-for-byte below: only {{POLL_URL}} → ctx.pollUrl and
// {{ASSET_BASE}} → ctx.assetBase are filled in (the preheader is kept).
// !! THE CARD ART IS SPECIFIC TO THIS POLL: "do 24 · vr 25 · za 26" is drawn into card-groot.gif, and the preheader and
// the text body name those nights too. For another poll, make a new card (and text) instead of reusing this one.
// Image: public/filmmaand/assets/mail/card-groot.gif, served from ctx.assetBase. (23 Sept, Chris: no 'of ga naar …' line and
// a plain-text '- Alec' sign-off instead of the handwritten sig.png, knowingly overriding MAIL-BRIEF's raw-address rule.
// 23 Sept 14:50, after the self-test landed in the inbox: no confirmation/spam line and no sign-off. Card + one button only.)
// ctx = {pollUrl, name, nights, assetBase}
//   pollUrl    the recipient's own link https://ely0030.xyz/filmmaand/wanneer/?pas=<token>, minted at delivery
//   assetBase  https://ely0030.xyz/filmmaand/assets/mail   (NO trailing slash: the design writes {{ASSET_BASE}}/card-groot.gif)
//   name, nights  available for other designs; this card does not use them
// Values are HTML-escaped before they go into the html.
const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const HTML="<!doctype html><html lang=\"nl\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>movie deze week?</title></head><body style=\"margin:0;padding:0;background:#ffffff;\"><div style=\"display:none;max-height:0;overflow:hidden;opacity:0;\">movie deze week? do 24, vr 25, za 26. Kies je avond.&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" bgcolor=\"#ffffff\"><tr><td align=\"center\"><table role=\"presentation\" width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" style=\"max-width:600px;\"><tr><td><a href=\"{{POLL_URL}}\" target=\"_blank\" style=\"text-decoration:none;\"><img src=\"{{ASSET_BASE}}/card-groot.gif\" width=\"600\" alt=\"Kaartje van Alec: movie deze week? Donderdag 24, vrijdag 25 of zaterdag 26 september. Klik om je avond te kiezen.\" border=\"0\" style=\"display:block;border:0;width:100%;max-width:600px;height:auto;font-family:Verdana,Arial,Helvetica,sans-serif;font-size:13px;font-weight:bold;color:#0000ee;\"></a></td></tr><tr><td align=\"center\" style=\"padding:14px 12px 6px;\"><table role=\"presentation\" cellpadding=\"0\" cellspacing=\"0\" border=\"0\" align=\"center\" style=\"margin:0 auto;\"><tr><td align=\"center\" bgcolor=\"#e0302a\" style=\"border-radius:6px;\"><a href=\"{{POLL_URL}}\" target=\"_blank\" style=\"display:inline-block;font-family:Verdana,Arial,Helvetica,sans-serif;font-size:18px;font-weight:bold;line-height:22px;color:#ffffff;text-decoration:none;padding:14px 34px;border-radius:6px;\">Kies je avond</a></td></tr></table></td></tr><tr><td style=\"padding:0 0 22px;line-height:1px;font-size:1px;\">&nbsp;</td></tr></table></td></tr></table></body></html>";
const TEXT="movie deze week?\n\nmovie deze week? Donderdag 24, vrijdag 25 of zaterdag 26 september.\nKies je avond: {{POLL_URL}}\n";
export const subject='movie deze week?';
export const text=({pollUrl})=>TEXT.replaceAll('{{POLL_URL}}',pollUrl);
export const html=({pollUrl,assetBase})=>HTML.replaceAll('{{POLL_URL}}',esc(pollUrl)).replaceAll('{{ASSET_BASE}}',esc(assetBase));
// For tests: the untouched source, so the port can be checked byte-for-byte.
export const SOURCE_HTML=HTML,SOURCE_TEXT=TEXT;
