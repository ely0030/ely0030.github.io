// Renders the pick confirmation through the pluggable template (poll-confirm-template.mjs) and checks it did its job:
// both the ja and the nee link in text and html.
import * as template from './poll-confirm-template.mjs';
import {MAIL_ASSET_PATH} from './poll-invite-mail.mjs';
const MONTHS=['januari','februari','maart','april','mei','juni','juli','augustus','september','oktober','november','december'],DAYS=['zondag','maandag','dinsdag','woensdag','donderdag','vrijdag','zaterdag'];
export const avondOf=date=>{const d=new Date(date+'T12:00:00Z');return DAYS[d.getUTCDay()]+' '+d.getUTCDate()+' '+MONTHS[d.getUTCMonth()]};
export function renderPollConfirm({name,date,tijd,waar,namen,url,origin}){
 const ja=url+'&antwoord=ja',nee=url+'&antwoord=nee';
 const ctx=Object.freeze({name,avond:avondOf(date),tijd,waar,namen:Object.freeze([...namen]),jaUrl:ja,neeUrl:nee,assetBase:new URL(MAIL_ASSET_PATH,origin).href.replace(/\/$/,'')});
 const out={subject:String(template.subject(ctx)),text:String(template.text(ctx)),html:String(template.html(ctx))};
 const amp=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));// the same escaping as the template
 if(!out.subject.trim()||!out.text.includes(ja)||!out.text.includes(nee)||!out.html.includes(amp(ja))||!out.html.includes(amp(nee)))throw Error('Confirmation template must carry the ja and nee links in text and html');
 return out;
}
