// Shared display timing. Defaults and derived ends never enable a reminder.
const label=value=>typeof value==='string'&&value.trim()?value.trim():null;
const minutes=value=>Number.isFinite(value)&&value>0&&value<=10080?value:null;
function optionDuration(o){
 if(!o)return null;
 if(Array.isArray(o.movies)&&o.movies.length&&(!o.lineup?.length||o.lineup.length===o.movies.length)&&o.movies.every(m=>minutes(m.runtime)))return {minutes:o.movies.reduce((sum,m)=>sum+m.runtime,0),approximate:false};
 if((!o.lineup?.length||o.lineup.length===1)&&minutes(o.movie?.runtime))return {minutes:o.movie.runtime,approximate:false};
 // Established curated duration label, not arbitrary numbers in descriptions or titles.
 const part=typeof o.detail==='string'?o.detail.split('·').at(-1).trim():'';
 const m=/^(ca\.?\s*)?(\d+(?:[.,]\d+)?)\s*(uur|u|min(?:uten)?)(?:\s*(\d+)\s*min(?:uten)?)?$/i.exec(part);
 if(!m)return null;
 const value=Number(m[2].replace(',','.'))*(/^(uur|u)$/i.test(m[3])?60:1)+Number(m[4]||0);
 return minutes(value)?{minutes:Math.round(value),approximate:!!m[1]}:null;
}
export function eveningDuration(n,options=[]){
 if(!Array.isArray(n.choices)||!n.choices.length||new Set(n.choices).size!==n.choices.length)return null;
 const durations=n.choices.map(id=>optionDuration(options.find(o=>o.id===id)));
 return durations.every(Boolean)?{minutes:durations.reduce((sum,d)=>sum+d.minutes,0),approximate:durations.some(d=>d.approximate)}:null;
}
export function resolvedEventTiming(n={},options=[]) {
 const explicit=label(n.timing?.screening);
 const stamp=typeof n.startsAt==='string'?Date.parse(n.startsAt):NaN;
 const screening=explicit||(Number.isFinite(stamp)?new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(stamp)):'18:00');
 const arrival=label(n.timing?.arrival),base={...(arrival?{arrival}:{}),screening};
 const end=n.timing?.endDerived?null:label(n.timing?.end);
 if(end)return {...base,end};
 const duration=eveningDuration(n,options),clock=/^([01]\d|2[0-3]):([0-5]\d)$/.exec(screening);
 if(!duration||!clock)return base;
 const total=Number(clock[1])*60+Number(clock[2])+duration.minutes,days=Math.floor(total/1440),hour=Math.floor(total%1440/60),minute=total%60;
 const time=String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');
 return {...base,end:(duration.approximate?'ca. ':'')+time+(days?' (+'+days+(days===1?' dag':' dagen')+')':''),endDerived:true};
}
