/* Personal overview and canonical shared availability editor. */
(()=>{'use strict';
const base='/filmmaand/',api=base+'api/plans/home-picker-lab',prefix='filmmaand-checkin-v1:/filmmaand/api:home-picker-lab:';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const link=(text,path,cls='mh-link')=>{const n=el('a',cls,text);n.href=base+path;return n};
const button=(text,fn)=>{const n=el('button','mh-link',text);n.type='button';n.onclick=fn;return n};
const read=k=>{try{return JSON.parse(localStorage.getItem(prefix+k)||'null')}catch{return null}};
const dayFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam'});
const labelDate=(date,options={weekday:'long',day:'numeric',month:'long'})=>new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',...options}).format(new Date(date+'T12:00:00Z'));
const validDay=d=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T12:00:00Z'))&&new Date(d+'T12:00:00Z').toISOString().slice(0,10)===d;
const responseDates=r=>{if(Array.isArray(r?.dates))return r.dates.filter(validDay);if(!validDay(r?.start)||!validDay(r?.end))return[];const dates=[];for(let d=Date.parse(r.start);d<=Date.parse(r.end)&&dates.length<63;d+=864e5)dates.push(new Date(d).toISOString().slice(0,10));return dates};
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
function artwork(o){const src=o?.movie?.poster||o?.poster||o?.image?.url||window.catalogArtwork?.[o?.id];if(typeof src!=='string'||!src)return null;const img=el('img','mh-poster');img.src=src;img.alt='';img.loading='lazy';img.decoding='async';img.onerror=()=>img.replaceWith(el('span','mh-poster mh-poster-missing','Film'));return img}
function filmTitle(o){const title=o?.title||'Film',year=o?.movie?.year||o?.year;return year&&!title.includes(String(year))?title+' ('+year+')':title}
const calendarAssets=new Map();
async function calendarDependencies(){
 for(const href of ['picker/availability-calendar.css','picker/personal-availability.css'])if(!document.querySelector('link[href="'+base+href+'"]')){const n=el('link');n.rel='stylesheet';n.href=base+href;document.head.append(n)}
 for(const [path,name] of [['picker/availability-calendar.js','mountAvailabilityCalendar'],['picker/identity-transfer.js','preparePickerIdentity'],['picker/personal-availability.js','mountPersonalAvailability'],['agenda/event-marker.js','filmmaandEventScribble']]){
  if(window[name])continue;
  if(!calendarAssets.has(path))calendarAssets.set(path,new Promise((resolve,reject)=>{const n=el('script');n.src=base+path;const timer=setTimeout(()=>{n.remove();reject(Error('calendar'))},12000);n.onload=()=>{clearTimeout(timer);window[name]?resolve():reject(Error('calendar'))};n.onerror=()=>{clearTimeout(timer);n.remove();reject(Error('calendar'))};document.head.append(n)}).catch(e=>{calendarAssets.delete(path);throw e}));
  await calendarAssets.get(path);
 }
}
let disposePrevious=null;
window.mountFilmmaandAccountHome=(host,{session,portrait,onProfile,onAvatar,onLogout,onLogin})=>{
 disposePrevious?.();let dead=false,generation=0,controller=null,participantId=session.participant?.id,calendarCleanup=null;
 const root=el('div','mh-page');host.append(root);document.body.classList.add('account-home-view');
 const pageHeading=el('header','account-heading mh-page-heading'),pageTitle=el('div');pageTitle.append(el('p','eyebrow','SEPTEMBER 2026'),el('h1','','Mijn Filmmaand'));pageHeading.append(pageTitle,button('Uitloggen',onLogout));root.append(pageHeading);
 const layout=el('div','account-layout mh-layout'),mast=el('aside','profile-sidebar mh-heading'),content=el('div','mh-content');layout.append(mast,content);root.append(layout);
 function dispose(){if(dead)return;dead=true;++generation;controller?.abort();calendarCleanup?.();observer.disconnect();removeEventListener('filmmaand-session',sessionChanged);removeEventListener('storage',storageChanged);document.body.classList.remove('account-home-view');}
 const observer=new MutationObserver(()=>{if(!root.isConnected)dispose()});observer.observe(host,{childList:true});
 disposePrevious=dispose;
 function sessionChanged(e){if(e.detail?.participant?.id!==participantId){++generation;controller?.abort();content.replaceChildren();mast.replaceChildren();content.removeAttribute('aria-busy');dispose();if(root.isConnected)content.append(message('Je account is gewijzigd.',button('Opnieuw bekijken',()=>location.reload())));}}
 function storageChanged(e){if(e.key?.startsWith(prefix)&&root.isConnected)void load()}
 addEventListener('filmmaand-session',sessionChanged);addEventListener('storage',storageChanged);
 function message(text,action){const n=el('div','mh-message');n.append(el('p','',text));if(action)n.append(action);return n}
 function section(title,action){const s=el('section','account-section mh-section'),h=el('div','section-heading mh-section-heading');h.append(el('h2','',title));if(action)h.append(action);s.append(h);return s}
 function identity(p){mast.replaceChildren();const actions=el('nav','mh-account-actions');actions.setAttribute('aria-label','Je account');actions.append(button('Profiel wijzigen',onProfile),button('Avatar wijzigen',onAvatar));mast.append(portrait(p.profile.avatarId,'mh-avatar'),el('h2','',p.profile.name),actions)}
 async function request(path,signal){const r=await fetch(api+path,{credentials:'same-origin',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(12000)])});if(!r.ok)throw Object.assign(Error('request'),{status:r.status});return r.json()}
 function pending(own){const rows=[],draft=read('draft'),availability=read('availabilityDraft');if(read('receipt')||draft&&(!equal([...(draft.choices||[])].sort(),[...(own?.choices||[])].sort())||!equal(draft.rankingOrder??own?.rankingOrder??[],own?.rankingOrder??[])||!equal(responseDates(draft).sort(),responseDates(own).sort())))rows.push(link('Filmkeuzes afronden','films/'));
 if(read('availabilityReceipt')||availability&&!equal([...(availability.dates||[])].sort(),responseDates(own).sort()))rows.push(link('Beschikbaarheid afronden','programma/'));
 if(read('voteReceipt'))rows.push(link('Stem afronden','stemmen/'));
 if(rows.length){const n=el('aside','mh-pending');n.append(el('strong','','Je hebt nog een wijziging klaarstaan.'),...rows);content.append(n)}}
 function evenings(plan,own){const s=section('Mijn avonden'),today=dayFormatter.format(new Date()),selected=new Set(responseDates(own));
 const nights=(plan.programme||[]).filter(n=>validDay(n.scheduledDate)||Number.isFinite(Date.parse(n.startsAt))).map(n=>({...n,date:validDay(n.scheduledDate)?n.scheduledDate:dayFormatter.format(new Date(n.startsAt)),dateOnly:validDay(n.scheduledDate)&&!Number.isFinite(Date.parse(n.startsAt))}));const date=plan.round?.scheduledDate;
 if(validDay(date)&&!nights.some(n=>n.date===date&&n.selection!=='pending'))nights.push({date,scheduled:true,choices:(plan.round.leaderIds||[]).filter(id=>plan.options.some(o=>o.id===id))});
 const upcoming=nights.filter(n=>n.scheduled||n.dateOnly?n.date>=today:Date.parse(n.startsAt)>=Date.now()).sort((a,b)=>a.date.localeCompare(b.date)||(a.startsAt||'').localeCompare(b.startsAt||''));
 if(!upcoming.length)s.append(message('Er staat nog geen volgende filmavond gepland.',link('Bekijk het programma','programma/')));
 const cards=el('div','calendar-posters');
 for(const n of upcoming.slice(0,3)){const row=link('','programma/','calendar-poster mh-night'),visual=el('div','calendar-poster-art'),unselected=n.scheduled||n.selection==='pending';row.dataset.date=n.date;
 for(const id of (n.choices||[]).slice(0,2)){const art=artwork(plan.options.find(o=>o.id===id));if(art)visual.append(art)}if(!visual.childElementCount){const unknown=el('span','calendar-unknown','?');unknown.setAttribute('aria-hidden','true');visual.append(unknown)}
 const date=el('time','calendar-poster-date');date.dateTime=n.dateOnly?n.date:n.startsAt||n.date;date.setAttribute('aria-label',labelDate(n.date));date.append(el('strong','',String(Number(n.date.slice(-2)))),el('span','',labelDate(n.date,{weekday:'short',month:'short'})));visual.append(date);
 const titles=(n.choices||[]).map(id=>plan.options.find(o=>o.id===id)).filter(Boolean).map(filmTitle);row.append(visual,el('h3','',unselected?'Film nog te kiezen':titles.join(' + ')||'Filmavond'));
 if(!unselected&&!n.dateOnly)row.append(el('p','mh-muted',new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit'}).format(new Date(n.startsAt))));
 const attendance=el('p','mh-attendance'+(own&&selected.has(n.date)?' is-going':''),own?(selected.has(n.date)?'Je bent beschikbaar':'Nog niet geselecteerd'):'Beschikbaarheid niet geladen');if(own&&selected.has(n.date)){const check=el('span','','✓');check.setAttribute('aria-hidden','true');attendance.prepend(check)}row.append(attendance);cards.append(row)}
 if(cards.childElementCount)s.append(cards);
 if(upcoming.length>3)s.append(link('Alle '+upcoming.length+' filmavonden','programma/'));
 const calendarHost=el('div','mh-calendar');calendarHost.append(message('Beschikbaarheid laden…'));s.append(calendarHost);void mountCalendar(calendarHost,plan,nights);return s}

 async function mountCalendar(calendarHost,plan,nights){
  const serial=generation;let stopped=false,personal=null,timer=null,watch=null;
  const events=nights.map(n=>({date:n.date,title:n.scheduled?'Filmavond':n.selection==='pending'?'Mysteryavond':(n.choices||[]).map(id=>plan.options.find(o=>o.id===id)?.title||'Filmavond').join(' + ')}));
  const tip=el('div','mh-calendar-tip');tip.hidden=true;tip.id='account-calendar-name';tip.setAttribute('role','tooltip');document.body.append(tip);let activeFace=null;
  const hide=()=>{tip.hidden=true;activeFace?.removeAttribute('aria-describedby');activeFace=null};
  const show=face=>{if(!face)return;hide();activeFace=face;tip.textContent=face.getAttribute('aria-label');tip.hidden=false;face.setAttribute('aria-describedby',tip.id);const r=face.getBoundingClientRect();tip.style.left=Math.max(8,Math.min(innerWidth-tip.offsetWidth-8,r.left))+'px';tip.style.top=Math.max(8,Math.min(innerHeight-tip.offsetHeight-8,r.bottom+6))+'px'};
  const login=e=>{if(e.detail?.source==='availability'&&calendarHost.isConnected)onLogin()};
  addEventListener('filmmaand-login-required',login);addEventListener('scroll',hide,true);
  calendarCleanup=()=>{stopped=true;clearTimeout(timer);watch?.disconnect();personal?.destroy();tip.remove();removeEventListener('filmmaand-login-required',login);removeEventListener('scroll',hide,true)};
  const alive=()=>!stopped&&!dead&&serial===generation&&session.participant?.id===participantId&&calendarHost.isConnected;
  function faces(date){const row=el('span','mh-calendar-faces');for(const person of (plan.people||[]).filter(p=>!p.self&&(p.dates||[]).includes(date))){const face=el('button','mh-calendar-face');face.type='button';face.setAttribute('aria-label',person.name||'Zonder naam');const art=window.filmmaandAvatarOptions?.find(a=>a.id===person.avatarId);if(art){const img=el('img');img.src=art.src;img.alt='';if(art.filter)img.style.filter=art.filter;face.append(img)}else face.textContent=(person.name||'?').slice(0,1);face.onpointerenter=()=>show(face);face.onpointerleave=hide;face.onfocus=()=>show(face);face.onblur=hide;face.onpointerdown=e=>e.stopPropagation();face.onclick=e=>{e.stopPropagation();show(face)};face.onkeydown=e=>{if(e.key==='Escape')hide()};row.append(face)}return row}
  function sync(){if(!alive())return;
   for(const day of calendarHost.querySelectorAll('.ac-day.has-event')){const night=nights.find(n=>n.date===day.dataset.day);if(night){const ink=window.filmmaandEventScribble(day.dataset.day+'|'+(night.id||'round-'+night.date));day.style.setProperty('--event-scribble',ink.image);day.style.setProperty('--event-scribble-angle',ink.rotation)}}
   for(const a of calendarHost.querySelectorAll('.pa-picker-link'))a.href=base+'films/';
   const note=calendarHost.querySelector('.pa-message'),text=note?.textContent||'',save=calendarHost.querySelector('.pa-actions button');
   if(note)note.hidden=['','Bewaar je beschikbaarheid.','Je beschikbaarheid is bewaard.'].includes(text);
   const ordinary=save?.textContent==='Bewaar beschikbaarheid'&&text==='Bewaar je beschikbaarheid.';
   if(save)save.hidden=ordinary;
   clearTimeout(timer);if(ordinary&&!save.disabled)timer=setTimeout(()=>{if(alive()&&save.isConnected&&!save.disabled)save.click()},600);
  }
  try{await calendarDependencies();if(!alive())return;calendarHost.replaceChildren();watch=new MutationObserver(sync);watch.observe(calendarHost,{childList:true,subtree:true});personal=window.mountPersonalAvailability(calendarHost,{allowAnyOrigin:true,queueWhileSaving:true,saveVisibility:'changed',silentWhenEmpty:true,calendar:{events,dayContent:faces,dayLabel:date=>{const names=(plan.people||[]).filter(p=>!p.self&&(p.dates||[]).includes(date)).map(p=>p.name||'Zonder naam');return names.length?' · '+names.join(', '):''}},onSaved:own=>{if(!alive())return;const selected=new Set(responseDates(own));for(const row of root.querySelectorAll('.mh-night[data-date]')){const label=row.querySelector('.mh-attendance'),yes=selected.has(row.dataset.date);label.textContent=yes?'Je bent beschikbaar':'Nog niet geselecteerd';label.classList.toggle('is-going',yes)}}});sync()}
  catch{if(alive())calendarHost.replaceChildren(message('De kalender kon niet worden geladen.',button('Opnieuw proberen',()=>{calendarCleanup?.();void mountCalendar(calendarHost,plan,nights)})))}
 }
 function films(plan,own){const s=section('Mijn films',link(plan.status==='confirmed'?'Bekijk je films':'Filmkeuzes aanpassen ↗','films/'));if(!own){s.append(message('Je filmkeuzes konden niet worden geladen.',button('Opnieuw proberen',load)));return s}const choices=[...new Set(own.choices||[])],rank=(own.rankingOrder||[]).filter(id=>choices.includes(id)),ids=[...rank,...choices.filter(id=>!rank.includes(id))],options=ids.map(id=>plan.options.find(o=>o.id===id)).filter(Boolean);
 if(!options.length){s.append(message('Welke films wil jij zien?',link('Ontdek de films','films/','mh-primary')));return s}const grid=el('div','personal-films mh-films');for(const o of options){const a=link('', 'films/','personal-film mh-film'),art=artwork(o);if(art)a.append(art);else a.append(el('span','mh-poster mh-poster-missing','Film'));const copy=el('div','mh-film-copy');copy.append(el('h3','',filmTitle(o)));const i=rank.indexOf(o.id);copy.append(el('p','mh-muted',i===0?'1e voorkeur':i===1?'2e voorkeur':'Op je lijst'));a.append(copy);grid.append(a)}s.append(grid);return s}
 function voteSection(plan,vote){const s=el('aside','account-voted mh-vote');if(!vote){s.append(el('h2','','Mijn stem'),message('Je stem kon niet worden geladen.',button('Opnieuw proberen',load)));return s}const own=vote.own?.final,o=plan.options.find(o=>o.id===own),open=!vote.round?.planned&&Array.isArray(vote.round?.shortlist)&&vote.round.shortlist.length>0;
 if(o){s.append(el('p','voted-label','Je hebt gestemd op'),el('h2','mh-vote-title',filmTitle(o)),link(open?'Bekijk of wijzig je stem':'Bekijk de uitslag','stemmen/','mh-primary'))}else if(open){s.append(el('h2','','Mijn stem'),el('p','mh-muted','Je hebt nog niet gestemd.'),link('Stem op een film','stemmen/','mh-primary'))}else s.append(el('h2','','Mijn stem'),message('Er is nu geen open stemming.',link('Bekijk het programma','programma/')));return s}
 async function load(){const serial=++generation;calendarCleanup?.();calendarCleanup=null;controller?.abort();controller=new AbortController();const current=()=>!dead&&serial===generation&&root.isConnected;content.replaceChildren();content.setAttribute('aria-busy','true');const loading=message('Je Filmmaand laden…');loading.setAttribute('role','status');content.append(loading);
 try{const p=await session.refresh();if(!current())return;if(!p?.id||p.cached||!p.onboarded){content.replaceChildren(message(p?.cached?'Je account is even niet bereikbaar.':'Log in om je Filmmaand te bekijken.',p?.cached?button('Opnieuw proberen',load):button('Inloggen',onLogin)));return}if(p.id!==participantId){dispose();content.replaceChildren();return}identity(p);
 const results=await Promise.allSettled(['','/response','/vote'].map(path=>request(path,controller.signal)));if(!current()||session.participant?.id!==p.id)return;if(results.some(r=>r.status==='rejected'&&[401,403,410].includes(r.reason.status))){content.replaceChildren(message('Je sessie is verlopen. Je wijzigingen blijven bewaard.',button('Opnieuw inloggen',onLogin)));return}const [plan,own,vote]=results.map(r=>r.status==='fulfilled'?r.value:null);content.replaceChildren();if(!plan){content.append(message('Je Filmmaand is even niet bereikbaar.',button('Opnieuw proberen',load)));return}pending(own?.response);const main=el('div','mh-main');main.append(evenings(plan,own?.response),films(plan,own?.response));content.append(main,voteSection(plan,vote));if(!own)content.prepend(message('Je beschikbaarheid kon niet worden geladen.',button('Opnieuw proberen',load)));
 }catch(e){if(current())content.replaceChildren(message('Je Filmmaand is even niet bereikbaar.',button('Opnieuw proberen',load)))}finally{if(current())content.removeAttribute('aria-busy')}}
 void load();return {destroy:dispose};
};
})();
