/** Private account activity, derived only inside the durable state transaction. */
import {createHash} from 'node:crypto';
import {rankedSelection,roundLifecycle,frozenResult} from './runtime/planning/round-lifecycle.mjs';
const hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const DAY=86400000, clean=v=>String(v||'').replace(/[\u0000-\u001f]/g,' ').slice(0,180);
// A recommendation becomes genuine at the first crossing of three distinct likes
// from people other than the suggester. The durable marker makes that crossing
// once-only for a film within its theme, even after unlike/re-like activity.
export const POPULARITY_THRESHOLD=3;
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const ns=c=>{const state=c.state.accountNotifications||={version:1,accounts:{},baselines:{},mailIntents:{}};state.recommendations||={};return state;};
const canonical=(p,a)=>p.claimedBy?.[a]||a;
function owner(p,o){for(const [key,r] of Object.entries(p.receipts||{})){const i=key.indexOf(':'),a=key.slice(0,i),k=key.slice(i+1);if(r.result?.option?.id===o.id&&o.id==='suggestion-'+createHash('sha256').update(a+':'+k).digest('hex').slice(0,20))return canonical(p,a);}return null;}
export function activityProjection(p,at){
 const planned=[...(p.programme||[]),...(p.confirmation?[p.confirmation]:[])].flatMap(n=>n.choices||[]);
 const counts=Object.fromEntries(p.options.map(o=>[o.id,0]));for(const r of Object.values(p.responses||{}))for(const id of r.choices||[])if(Object.hasOwn(counts,id))counts[id]++;
 const shortlist=p.round?.shortlist||p.options.map((o,i)=>({id:o.id,i,count:counts[o.id]})).filter(o=>!planned.includes(o.id)).sort((a,b)=>b.count-a.count||a.i-b.i).slice(0,3).map(o=>o.id);
 const selection=p.round?.nextSelection||rankedSelection(p,shortlist),eligible=selection.eligible||[],top=eligible[0]?.points;
 return {round:roundLifecycle(p,at,shortlist.some(id=>planned.includes(id))),leaders:(p.round?.finalTally||frozenResult(p,shortlist)).leaderIds,shortlist,entries:selection.shortlist||[],numberOne:eligible.filter(o=>o.points===top).map(o=>o.id),suggestions:p.options.filter(o=>o.kind==='suggestion').map(o=>({id:o.id,owner:owner(p,o)})),likes:Object.fromEntries(Object.entries(p.responses||{}).map(([a,r])=>[canonical(p,a),r.choices||[]]))};
}
export const captureActivity=(c,at)=>Object.fromEntries(Object.entries(c.state.plans||{}).map(([id,row])=>[id,activityProjection(row.data,at)]));
function retain(account,at){account.items=(account.items||[]).filter(n=>Date.parse(n.updatedAt)>Date.parse(at)-90*DAY).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.id.localeCompare(a.id)).slice(0,100);}
export function commitActivity(c,before,at,{scheduled=false}={}){
 const n=ns(c),people=c.authStore.db.prepare('SELECT id,name,avatar_id FROM participants WHERE onboarded=1').all();
 for(const [planId,row] of Object.entries(c.state.plans||{})){
  const p=row.data,after=activityProjection(p,at),prior=structuredClone(scheduled?n.baselines[planId]:before[planId]);const stored=n.baselines[planId];n.baselines[planId]=after;if(!prior)continue;
  if(stored?.round.id===prior.round.id&&stored.round.status==='open'&&prior.round.status==='closed')prior.round=stored.round;
  const title=id=>clean(p.options.find(o=>o.id===id)?.title||'Een film'),titles=ids=>ids.map(title).join(' · '),roundId=after.round.id;
  function emit(type,key,text,{actorId=null,recipient=null,recipients=null,excludeRecipients=null,href='/filmmaand/films/',count=1,group=true}={}){
   const person=people.find(p=>'p_'+p.id===actorId),actor=person?{name:clean(person.name),avatarId:person.avatar_id}:null;
   for(const person of people){const personId='p_'+person.id;if(recipient&&recipient!==personId||recipients&&!recipients.has(personId)||excludeRecipients?.has(personId)||actorId===personId)continue;const account=n.accounts[person.id]||={items:[],importantActivityEmail:true};retain(account,at);const groupKey=hash([planId,type,key]),old=account.items.find(i=>i.groupKey===groupKey&&(type==='suggestion-liked'||Date.parse(at)-Date.parse(i.updatedAt)<10*60*1000));
    if(group&&old){old.text=clean(text);old.href=href;old.actor=actor;old.updatedAt=new Date(Math.max(Date.parse(at),Date.parse(old.updatedAt)+1)).toISOString();old.readAt=null;old.count=type==='suggestion-liked'?old.count+count:count;if(type==='suggestion-liked')old.text=clean(text.replace('een hartje.',old.count+' keer een hartje.'));}
    else account.items.push({id:hash([groupKey,at,p.version]),groupKey,type,text:clean(text),href,actor,count,createdAt:at,updatedAt:at,readAt:null});retain(account,at);
   }
  }
  const recommendedRecipients=new Set();
  for(const o of after.suggestions){if(!prior.suggestions.some(x=>x.id===o.id)&&o.owner)emit('film-suggested',o.id,title(o.id)+' is voorgesteld.',{actorId:o.owner,group:false,href:'/filmmaand/films/?film='+encodeURIComponent(o.id)});
   const likers=Object.entries(after.likes).filter(([a,ids])=>a!==o.owner&&ids.includes(o.id)&&!(prior.likes[a]||[]).includes(o.id));if(o.owner&&likers.length)emit('suggestion-liked',o.id,'Je voorstel '+title(o.id)+' kreeg een hartje.',{recipient:o.owner,actorId:likers.at(-1)[0],count:likers.length,href:'/filmmaand/films/?film='+encodeURIComponent(o.id)});
   if(o.owner){const recommendationKey=hash([planId,o.id]),otherLikes=Object.entries(after.likes).filter(([a,ids])=>a!==o.owner&&ids.includes(o.id)).map(([a])=>a),priorOtherLikes=Object.entries(prior.likes).filter(([a,ids])=>a!==o.owner&&ids.includes(o.id)).map(([a])=>a);
    if(!n.recommendations[recommendationKey]&&priorOtherLikes.length<POPULARITY_THRESHOLD&&otherLikes.length>=POPULARITY_THRESHOLD){const recipients=new Set(people.map(person=>'p_'+person.id).filter(id=>id!==o.owner&&!otherLikes.includes(id)));n.recommendations[recommendationKey]={planId,optionId:o.id,occurredAt:at};for(const id of recipients)recommendedRecipients.add(id);emit('popular-suggestion',o.id,title(o.id)+' kreeg '+otherLikes.length+' hartjes. Misschien iets voor jou?',{recipients,group:false,href:'/filmmaand/films/?film='+encodeURIComponent(o.id)});}
    else if(priorOtherLikes.length>=POPULARITY_THRESHOLD)n.recommendations[recommendationKey]||={planId,optionId:o.id,occurredAt:at,baseline:true};}}
  const entered=after.entries.filter(id=>!prior.entries.includes(id));if(entered.length)emit('leaderboard-entry',roundId,titles(entered)+' staat nu in de top voor de volgende ronde.',{excludeRecipients:recommendedRecipients,href:entered.length===1?'/filmmaand/films/?film='+encodeURIComponent(entered[0]):'/filmmaand/films/'});
  if(!same(after.numberOne,prior.numberOne))emit('next-leader',roundId,after.numberOne.length>1?'Gedeeld bovenaan voor de volgende ronde: '+titles(after.numberOne):after.numberOne.length?titles(after.numberOne)+' staat bovenaan voor de volgende ronde.':'Er is nog geen koploper voor de volgende ronde.',{excludeRecipients:recommendedRecipients});
  if(after.round.id===prior.round.id&&after.round.status==='open'&&!same(after.leaders,prior.leaders))emit('vote-leader',roundId,after.leaders.length>1?'Gelijke stand in de stemming: '+titles(after.leaders):after.leaders.length?titles(after.leaders)+' gaat aan kop in de stemming.':'De stemming heeft nog geen koploper.',{href:'/filmmaand/stemmen/'});
  let mailType,text;
  if(after.round.id!==prior.round.id&&after.round.status==='open'){mailType='round-opened';text='Een nieuwe stemronde is open. Kies je film.';}
  else if(after.round.id===prior.round.id&&((prior.round.status==='open'&&after.round.status!=='open')||!same(after.round.result,prior.round.result)&&after.round.result)){mailType='round-concluded';text=after.round.result?'De stemming is afgerond: '+title(after.round.result.choice)+'.':after.leaders.length>1?'De stemming is gesloten met een gelijke stand: '+titles(after.leaders)+'. Een besluit volgt.':after.leaders.length?'De stemming is gesloten. Koploper: '+titles(after.leaders)+'.':'De stemming is gesloten zonder stemmen. Een besluit volgt.';}
  if(mailType){const href=after.round.result?.programmeId?'/filmmaand/programma/':'/filmmaand/stemmen/';emit(mailType,roundId,text,{href});const id=hash([planId,roundId,mailType,after.round.status]);n.mailIntents[id]={id,type:mailType,planId,eventId:roundId,occurredAt:at,scheduledDate:p.roundSchedule?.date||null,title:text,href,programmeId:after.round.result?.programmeId||null};}
 }
 for(const account of Object.values(n.accounts))retain(account,at);
 for(const [index,[id,intent]] of Object.entries(n.mailIntents).sort((a,b)=>b[1].occurredAt.localeCompare(a[1].occurredAt)).entries())if(index>=2000||Date.parse(intent.occurredAt)<Date.parse(at)-90*DAY)delete n.mailIntents[id];
}
const fail=()=>{throw Object.assign(Error('Ongeldig notificatieverzoek.'),{status:400,code:'notifications_input'})};
export function notificationRequest(c,participantId,{method,part,body={},url,at}){
 if(method!=='GET'&&(!body||typeof body!=='object'||['participantId','recipientId','accountId'].some(key=>Object.hasOwn(body,key))))fail();
 const current=c.state.accountNotifications?.accounts?.[participantId],items=(current?.items||[]).filter(i=>Date.parse(i.updatedAt)>Date.parse(at)-90*DAY).sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||b.id.localeCompare(a.id));
 const unread=()=>items.filter(i=>!i.readAt).length;
 if(method==='GET'&&!part){let offset=0;if(url.searchParams.get('cursor')){try{const cursor=JSON.parse(Buffer.from(url.searchParams.get('cursor'),'base64url').toString());offset=items.findIndex(i=>i.id===cursor.id&&i.updatedAt===cursor.at)+1;if(!offset)offset=items.length;}catch{fail();}}const limit=Math.min(50,Math.max(1,Number(url.searchParams.get('limit'))||20)),page=items.slice(offset,offset+limit),last=page.at(-1);return {items:page.map(({groupKey,...item})=>item),unreadCount:unread(),nextCursor:offset+limit<items.length?Buffer.from(JSON.stringify({id:last.id,at:last.updatedAt})).toString('base64url'):null,serverTime:at,preferences:{importantActivityEmail:current?.importantActivityEmail!==false}};}
 if(method==='PUT'&&part==='preferences'){if(typeof body.importantActivityEmail!=='boolean')fail();const account=ns(c).accounts[participantId]||={items:[]};account.importantActivityEmail=body.importantActivityEmail;return {importantActivityEmail:account.importantActivityEmail};}
 if(method==='POST'&&part==='read'){if(body.allThrough!==undefined){if(typeof body.allThrough!=='string'||!Number.isFinite(Date.parse(body.allThrough))||Date.parse(body.allThrough)>Date.parse(at))fail();for(const item of items)if(item.updatedAt<=body.allThrough)item.readAt||=at;}else{if(!Array.isArray(body.items)||body.items.length>100||body.items.some(i=>!i||typeof i.id!=='string'||typeof i.updatedAt!=='string'))fail();for(const seen of body.items){const item=items.find(i=>i.id===seen.id&&i.updatedAt===seen.updatedAt);if(item)item.readAt||=at;}}return {unreadCount:unread()};}fail();
}
