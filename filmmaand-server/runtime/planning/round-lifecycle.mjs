import {createHash} from 'node:crypto';
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code,message,details)=>{throw Object.assign(new Error(message),{status:409,code,details})};
const invalid=(code,message)=>{throw Object.assign(new Error(message),{status:400,code})};
export const legacyRoundId=p=>'round-legacy-'+hash(p.id).slice(0,16);
export function roundLifecycle(p,now,planned=false){
 const r=p.round||{},id=r.id||legacyRoundId(p);
 const closed=planned||!!r.closedAt||(!!r.closesAt&&Date.parse(now)>=Date.parse(r.closesAt));
 return {id,revision:r.revision||0,lifecycle:!!r.lifecycle,status:r.result?'resolved':closed?'closed':'open',opensAt:r.opensAt||r.since||null,closesAt:r.closesAt||null,closedAt:r.closedAt||(closed?r.closesAt||null:null),result:r.result||null};
}
// Eligibility belongs to this plan's explicit round history, not a person's display order.
export function rankingEligibility(p,shortlist=p.round?.shortlist||[]){
 const known=new Set(p.options.map(o=>o.id)),valid=ids=>[...new Set(ids)].filter(id=>known.has(id));
 const retiredIds=valid([p.round?.result?.choice,...(p.roundHistory||[]).map(h=>h.round?.result?.choice)]);
 const plannedIds=valid([...(p.programme||[]).flatMap(n=>n.choices||[]),...(p.confirmation?.choices||[])]);
 const suspendedIds=p.round?.result?.choice?[]:valid(shortlist).filter(id=>!retiredIds.includes(id)&&!plannedIds.includes(id));
 return {suspendedIds,retiredIds,plannedIds,excludedIds:valid([...retiredIds,...plannedIds,...suspendedIds])};
}
export function eligibleContribution(response,excluded=[]){
 const blocked=new Set(excluded),choices=[...new Set(response?.choices||[])],rank=[...new Set(response?.rankingOrder||[])].filter(id=>choices.includes(id)&&!blocked.has(id));
 return Object.fromEntries(choices.map(id=>[id,blocked.has(id)?0:rank.indexOf(id)>=0?Math.max(1,5-rank.indexOf(id)):1]));
}
export function rankingPoints(p,excluded=rankingEligibility(p).excludedIds){
 const points=Object.fromEntries(p.options.map(o=>[o.id,0]));
 for(const response of Object.values(p.responses||{}))for(const [id,value] of Object.entries(eligibleContribution(response,excluded)))if(Object.hasOwn(points,id))points[id]+=value;
 return points;
}
export function rankedSelection(p,excluded=[]){
 const blocked=new Set([...excluded,...rankingEligibility(p).excludedIds]),points=rankingPoints(p,blocked),eligible=p.options.map((o,i)=>({id:o.id,points:points[o.id],i})).filter(o=>o.points>0&&!blocked.has(o.id)).sort((a,b)=>b.points-a.points||a.i-b.i).map(({id,points})=>({id,points}));
 const cutoff=eligible[2]?.points,cutoffIds=cutoff===undefined?[]:eligible.filter(o=>o.points===cutoff).map(o=>o.id),above=eligible.filter(o=>o.points>cutoff).map(o=>o.id);
 const tiedCutoff=cutoff!==undefined&&cutoffIds.length>3-above.length;
 return {points,eligible,shortlist:eligible.slice(0,3).map(o=>o.id),cutoffTieIds:tiedCutoff?cutoffIds:[],ready:eligible.length>=3&&!tiedCutoff,snapshot:hash({roundId:p.round?.id||legacyRoundId(p),eligible})};
}
// Materialize before any accepted post-cutoff write; later preferences cannot rewrite this round's handoff.
export function freezeNextSelection(p,now,excluded,{force=false}={}){
 const r=p.round;if(!r||r.nextSelection)return false;
 if(!force&&!r.closedAt&&!(r.closesAt&&Date.parse(now)>=Date.parse(r.closesAt)))return false;
 r.nextSelection={...rankedSelection(p,excluded),status:'frozen',sourceRoundId:r.id||legacyRoundId(p),closesAt:r.closesAt||r.closedAt||now,frozenAt:r.closedAt||r.closesAt||now};
 return true;
}
export function frozenResult(p,shortlist){
 const counts=Object.fromEntries(shortlist.map(id=>[id,0]));
 for(const vote of Object.values(p.votes||{}))if(Object.hasOwn(counts,vote.final))counts[vote.final]++;
 const total=Object.values(counts).reduce((a,b)=>a+b,0),top=Math.max(0,...Object.values(counts));
 return {counts,total,leaderIds:top?shortlist.filter(id=>counts[id]===top):[]};
}
function closingTime(value,now){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value.slice(0,10)||Date.parse(value)<=Date.parse(now))invalid('round_deadline','Kies een toekomstige sluitingstijd in UTC.');
 return new Date(value).toISOString();
}
function screeningDate(p,value){
 if(typeof value!=='string'||!/^\d{4}-\d\d-\d\d$/.test(value)||!Number.isFinite(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value||value<p.window.start||value>p.window.end)invalid('round_date','Kies een geldige filmavonddatum.');
 return value;
}
export function guardRoundWrite(p,body,round){
 if((round.lifecycle||body?.roundId!==undefined)&&body?.roundId!==round.id)fail('round_changed','Deze stemronde is veranderd. Bekijk de huidige ronde.',{round});
 if(round.status!=='open')fail('round_closed','Deze stemronde is gesloten.',{round});
}
// Called inside the existing receipt-first compare-and-swap mutation. No clock, scheduler or network side effects here.
export function changeRound(p,b,{now,key,round,excluded}){
 if(!b||b.expectedRoundId!==round.id||b.expectedRevision!==round.revision)fail('round_conflict','De stemronde is elders gewijzigd.',{round});
 const ensure=()=>{p.round={...p.round,id:round.id,shortlist:[...round.shortlist],derived:p.round?.derived??true,lifecycle:true,revision:round.revision,opensAt:round.opensAt||now};return p.round;};
 const close=()=>{const r=ensure();r.closedAt=round.closedAt||now;freezeNextSelection(p,now,excluded,{force:true});r.finalTally??=frozenResult(p,r.shortlist);return r;};
 switch(b.action){
  case 'deadline':{
   if(round.status!=='open')fail('round_closed','Een gesloten stemronde kan niet opnieuw worden geopend.');
   const closesAt=closingTime(b.closesAt,now),r=ensure();r.closesAt=closesAt;r.revision++;break;
  }
  case 'close':{
   if(round.status==='resolved')fail('round_resolved','Deze ronde is al afgerond.');
   close().revision++;break;
  }
  case 'resolve':{
   if(round.status==='open')fail('round_open','Sluit eerst de stemronde.');
   if(round.status==='resolved')fail('round_resolved','Deze ronde is al afgerond.');
   const r=close(),t=r.finalTally,allowed=t.leaderIds.length?t.leaderIds:r.shortlist;
   if(!allowed.includes(b.choice))invalid('round_choice','Kies expliciet een van de koplopers; zonder stemmen een van de kandidaten.');
   r.result={choice:b.choice,kind:t.leaderIds.length===1?'winner':t.leaderIds.length?'tie-resolved':'organizer-choice',resolvedAt:now};
   if(b.programme===true){
    const day=screeningDate(p,p.roundSchedule?.date),items=p.programme||=[],existing=items.find(n=>n.id===b.programmeId);
    const dateOf=n=>n.scheduledDate||(n.startsAt?new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam'}).format(new Date(n.startsAt)):null);
    if(b.programmeId){if(!existing||existing.selection!=='pending'||dateOf(existing)!==day)invalid('programme_transition','Kies de open filmavond op de datum van deze ronde.');existing.choices=[b.choice];delete existing.selection;existing.roundId=r.id;existing.confirmedAt=now;r.result.programmeId=existing.id;}
    else {if(items.some(n=>dateOf(n)===day)||p.confirmation&&dateOf(p.confirmation)===day)fail('programme_exists','Er bestaat al een filmavond op deze datum. Kies de open filmavond expliciet.');const night={id:'night-'+hash(r.id).slice(0,12),roundId:r.id,scheduledDate:day,choices:[b.choice],confirmedAt:now};(p.programme||=[]).push(night);r.result.programmeId=night.id;}
   }
   r.revision++;break;
  }
  case 'open':{
   if(round.status!=='resolved')fail('round_unresolved','Rond de huidige stemming eerst expliciet af.');
   const proposal=p.round?.nextSelection||rankedSelection(p,excluded);
   if(b.selectionSnapshot!==proposal.snapshot)fail('ranking_changed','De ranglijst is veranderd. Controleer de nieuwe selectie.',{selection:proposal});
   const selected=b.shortlist;
   if(!Array.isArray(selected)||selected.length!==3||new Set(selected).size!==3||selected.some(id=>excluded.includes(id)||!proposal.eligible.some(o=>o.id===id)))invalid('shortlist','Kies drie verschillende kandidaten met punten uit de ranglijst.');
   const cutoff=proposal.eligible[2]?.points,required=proposal.eligible.filter(o=>o.points>cutoff).map(o=>o.id),allowed=proposal.eligible.filter(o=>o.points>=cutoff).map(o=>o.id);
   if(required.some(id=>!selected.includes(id))||selected.some(id=>!allowed.includes(id)))invalid('shortlist','Behoud de hogere plaatsen en kies alleen tussen gelijkstaande kandidaten op de grens.');
   const closesAt=closingTime(b.closesAt,now),day=screeningDate(p,b.scheduledDate),old=ensure();
   (p.roundHistory||=[]).push({round:structuredClone(old),scheduledDate:p.roundSchedule?.date||null,votes:structuredClone(p.votes||{}),archivedAt:now});
   p.round={id:'round-'+hash([p.id,key]).slice(0,20),revision:0,lifecycle:true,derived:true,shortlist:[...selected],opensAt:now,since:now,closesAt,selection:{rule:'rank-5-4-3-2-1',snapshot:proposal.snapshot,points:Object.fromEntries(selected.map(id=>[id,proposal.points[id]]))}};
   p.roundSchedule={date:day};p.votes={};break;
  }
  default: invalid('round_action','Kies een geldige handeling voor de stemronde.');
 }
}
