/* Read-only derived data. Public actor flags, never name/avatar matching. */
(function(root){
const programmeDayFormat=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'});
function programmeDate(n){
 const stamp=Date.parse(n?.startsAt);
 if(Number.isFinite(stamp))return programmeDayFormat.format(new Date(stamp));
 const day=n?.scheduledDate;
 if(typeof day!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(day))return '';
 const date=new Date(day+'T12:00:00Z');
 return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===day?day:'';
}
function completedIds(plan,instant=new Date()){
 const today=programmeDayFormat.format(instant),known=new Set((plan.options||[]).map(o=>o.id)),done=new Set();
 for(const night of plan.programme||[]){if(night.selection==='pending'||!Array.isArray(night.choices)||!night.choices.length)continue;if(night.startsAt!==undefined){const stamp=Date.parse(night.startsAt);if(typeof night.startsAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(night.startsAt)||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==night.startsAt.slice(0,10))continue;}const day=programmeDate(night);if(!day||day>=today)continue;for(const id of night.choices)if(known.has(id))done.add(id);}
 return done;
}
function project(ctx,today){
 const plan=ctx.plan,self=(plan.people||[]).find(p=>p.self),profile=ctx.ownProfile||self;
 const people=[...(plan.people||[]).filter(p=>!p.self),...(profile?[{...profile,self:true,choices:ctx.choices,dates:ctx.dates}]:[])];
 const count=o=>Math.max(0,(plan.optionCounts?.[o.id]||0)+(self?Number(ctx.choices.includes(o.id))-Number(self.choices?.includes(o.id)):0));
 const fans=o=>people.filter(p=>p.choices?.includes(o.id));
 const ranked=plan.options.filter(o=>count(o)>0).slice().sort((a,b)=>count(b)-count(a)||a.title.localeCompare(b.title,'nl'));
 const mine=ctx.choices.map(id=>plan.options.find(o=>o.id===id)).filter(Boolean);
 const recent=plan.options.filter(o=>o.kind==='suggestion'&&!o.recommender?.self).slice().sort((a,b)=>(b.createdAt||'').localeCompare(a.createdAt||'')||a.title.localeCompare(b.title,'nl'));
 const occupied=new Set((plan.programme||[]).map(programmeDate).filter(Boolean));
 const roundDay=programmeDate({scheduledDate:plan.round?.scheduledDate});if(roundDay)occupied.add(roundDay);
 const near=[];
 const matches=[];for(const o of plan.options){const byDate=new Map();for(const p of fans(o))for(const d of new Set(p.dates||[])){if(d<=today||d<plan.window.start||d>plan.window.end||occupied.has(d))continue;const list=byDate.get(d)||[];list.push(p);byDate.set(d,list);}for(const [date,group] of byDate){if(group.length>=2)matches.push({option:o,date,people:group});const all=fans(o);if(group.length>=2&&all.length===count(o)&&all.length-group.length===1)near.push({option:o,date,people:group,missing:all.filter(p=>!p.dates.includes(date)),total:all.length});}}
 matches.sort((a,b)=>b.people.length-a.people.length||a.date.localeCompare(b.date)||count(b.option)-count(a.option)||a.option.title.localeCompare(b.option.title,'nl'));
 const overlap=ranked.length>1?people.filter(p=>p.choices?.includes(ranked[0].id)&&p.choices?.includes(ranked[1].id)):[];
 near.sort((a,b)=>b.people.length-a.people.length||a.date.localeCompare(b.date)||a.option.title.localeCompare(b.option.title,'nl'));
 return {near,people,self,count,fans,ranked,mine,recent,matches,overlap,total:plan.options.reduce((n,o)=>n+count(o),0)};
}
if(typeof module!=='undefined'&&module.exports)module.exports={project,programmeDate,completedIds};else root.FilmsSocialModel={project,programmeDate,completedIds};
})(typeof window==='undefined'?globalThis:window);
/* Ranked points are separate from heart counts and the current ballot. */
(function(root){
 const api=typeof module!=='undefined'&&module.exports?module.exports:root.FilmsSocialModel;
 function contribution(choices,order=[],rule='rank-5-4-3-2-1'){const liked=new Set(choices),rank=[...new Set(order)].filter(id=>liked.has(id));return Object.fromEntries([...liked].map(id=>[id,rank.indexOf(id)>=0?Math.max(1,(rule==='rank-3-2-1'?3:5)-rank.indexOf(id)):1]));}
 function ranking(ctx,order=ctx.ranking?.order||[]){const next=ctx.plan.nextRound,weighted=['rank-3-2-1','rank-5-4-3-2-1'].includes(next?.rule),self=(ctx.plan.people||[]).find(p=>p.self),own=weighted?contribution(ctx.choices,order,next.rule):Object.fromEntries(ctx.choices.map(id=>[id,1])),saved=weighted?(next.ownPoints||contribution(self?.choices||[],self?.rankingOrder||[],next.rule)):Object.fromEntries((self?.choices||[]).map(id=>[id,1]));if(next?.status==='frozen'&&ctx.tutorialOwnContribution!==true){
 const eligible=Array.isArray(next.eligible)?next.eligible:[],ties=new Set(next.cutoffTieIds||[]),selected=new Set(next.shortlist||[]);
 const candidates=eligible.filter(entry=>selected.has(entry.id)&&!ties.has(entry.id)).map((entry,i)=>({optionId:entry.id,score:next.points?.[entry.id]??entry.points,i}));
 return {weighted,own,candidates,frozen:true,eligible,cutoffTieIds:[...ties],ready:next.ready===true,snapshot:next.snapshot};
 }const totals={...(weighted?next.points:ctx.plan.optionCounts)};for(const id of new Set([...Object.keys(saved),...Object.keys(own)]))totals[id]=Math.max(0,(totals[id]||0)-(saved[id]||0)+(own[id]||0));const excluded=new Set([...(ctx.plan.round?.shortlist||[]),...(ctx.plan.programme||[]).flatMap(n=>n.choices||[])]);const candidates=ctx.plan.options.map((o,i)=>({optionId:o.id,score:totals[o.id]||0,i})).filter(x=>x.score>0&&!excluded.has(x.optionId)).sort((a,b)=>b.score-a.score||a.i-b.i).slice(0,3);return {weighted,own,candidates};}
 function cutoffState(next,serverTime,elapsedMs=0){
 if(!next||!['collecting','frozen'].includes(next.status))return null;
 const frozen=next.status==='frozen',end=Date.parse(next.closesAt),server=Date.parse(serverTime),remaining=Number.isFinite(end)&&Number.isFinite(server)?end-server-Math.max(0,elapsedMs):null;
 const eligible=Array.isArray(next.eligible)?next.eligible:[],ties=next.cutoffTieIds||[];
 let label='Voorlopige selectie',detail='',time='';
 if(frozen){label='Selectie vastgezet';detail=ties.length?'Gelijke stand · volgende ronde nog niet geopend':eligible.length<3?eligible.length+' van 3 kandidaten · nog niet geopend':'Volgende stemronde nog niet geopend';}
 else if(remaining!==null){if(remaining<=0)label='Sluiting controleren…';else{label='Selectie sluit over';const seconds=Math.ceil(remaining/1000),days=Math.floor(seconds/86400);time=(days?days+'d ':'')+[Math.floor(seconds%86400/3600),Math.floor(seconds%3600/60),seconds%60].map(n=>String(n).padStart(2,'0')).join(':');}}
 if(!frozen&&ties.length)detail=remaining!==null&&remaining<=0?'Gelijke stand':'Gelijke stand · selectie nog open';else if(!frozen&&eligible.length<3)detail=eligible.length+' van 3 kandidaten';
 return {frozen,label,detail,time,remaining,ties,eligible,waiting:frozen};
 }
 api.contribution=contribution;api.ranking=ranking;api.cutoffState=cutoffState;
})(typeof window==='undefined'?globalThis:window);
