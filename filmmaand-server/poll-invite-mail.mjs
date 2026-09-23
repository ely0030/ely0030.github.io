// Renders the invitation through the pluggable template (poll-invite-template.mjs) and checks it did its job:
// a subject, a text and an html body that both carry the recipient's own link.
import * as template from './poll-invite-template.mjs';
import {nudgeNights} from './poll-nudge-mail.mjs';
export const MAIL_ASSET_PATH='/filmmaand/assets/mail/';
export function renderPollInvite({name,window,url,origin}){
 const ctx=Object.freeze({pollUrl:url,name,nights:nudgeNights(window),assetBase:new URL(MAIL_ASSET_PATH,origin).href});
 const out={subject:String(template.subject),text:String(template.text(ctx)),html:String(template.html(ctx))};
 if(!out.subject.trim()||!out.text.includes(url)||!out.html.includes(url.replace(/&/g,'&amp;')))throw Error('Invitation template must put the poll link in text and html');
 return out;
}
