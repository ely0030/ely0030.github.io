(()=>{'use strict';const api='/filmmaand/api',planId='home-picker-lab',$=s=>document.querySelector(s);let access=null,plan=null,pending=null,busy=false,proposed=null;
const storageKey=id=>'filmmaand-organizer-receipt-v1:'+id+':'+planId;
const status=s=>$('#status').textContent=s;
function lock(){document.querySelectorAll('#controls button,#controls input,#controls select').forEach(n=>n.disabled=busy||!!pending||!access);$('#retry').disabled=busy;$('#pending').hidden=!pending;$('#refresh').disabled=busy;if(access&&plan&&!busy&&!pending){$('#deadline-form button').disabled=plan.round.status!=='open';$('#close-form button').disabled=plan.round.status!=='open';$('#resolve-form button').disabled=plan.round.status!=='closed';$('#open-form button').disabled=plan.round.status!=='resolved'||plan.nextRound.eligible.length<3;}}
function persist(value){if(!access)throw Error('Beheerder niet bekend.');if(value)localStorage.setItem(storageKey(access.participantId),JSON.stringify(value));else localStorage.removeItem(storageKey(access.participantId));pending=value;lock()}
async function request(path,opts={}){const r=await fetch(api+path,{...opts,credentials:'same-origin',cache:'no-store',headers:{'Content-Type':'application/json',...opts.headers}});const body=await r.json();if(!r.ok)throw Object.assign(Error(body.error?.message||'Verzoek mislukt.'),{status:r.status,code:body.error?.code});return body}
function localDate(iso){return new Date(iso).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam',dateStyle:'long',timeStyle:'short'})}
function parts(ms){const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(x=>[x.type,x.value]));return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`}
function dutchUTC(value){if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value))throw Error('Vul een volledige Nederlandse datum en tijd in.');const goal=Date.parse(value+'Z');let guess=goal;for(let i=0;i<3;i++)guess+=goal-Date.parse(parts(guess)+'Z');if(parts(guess)!==value||parts(guess-3600000)===value||parts(guess+3600000)===value)throw Error('Deze lokale tijd is ongeldig of dubbel door de zomertijd. Kies een andere tijd.');return new Date(guess).toISOString()}
const title=id=>plan.options.find(o=>o.id===id)?.title||id;
function render(){const r=plan.round;$('#controls').hidden=false;$('#round').textContent=({open:'Open',closed:'Gesloten',resolved:'Afgerond'})[r.status]+' · '+(r.scheduledDate||'Filmavond nog niet ingesteld');$('#shortlist').replaceChildren(...r.shortlist.map(id=>{const li=document.createElement('li');li.textContent=title(id);return li}));$('#deadline').textContent=r.closesAt?'Stemmen sluit '+localDate(r.closesAt)+' (Nederlandse tijd).':'Er is nog geen sluitingstijd ingesteld.';const leaders=r.result?.choice?[r.result.choice]:r.leaderIds?.length?r.leaderIds:r.shortlist;$('#resolve-form select[name=choice]').replaceChildren(...leaders.map(id=>new Option(title(id),id)));const select=$('#resolve-form select[name=programmeId]');select.replaceChildren(new Option('Nieuwe programmaregel',''));for(const n of plan.programme||[])if(n.selection==='pending')select.append(new Option((n.scheduledDate||n.startsAt)+' · '+n.id,n.id));$('#ranking-info').textContent=(plan.nextRound.status==='frozen'?'Vastgezet bij sluiting. Deze selectie verandert niet meer door nieuwe hartjes. ':'De selectie volgt de ranglijst tot de stemming sluit. ')+(plan.nextRound.cutoffTieIds?.length?'Er is een gelijke stand op de grens. Kies welke drie doorgaan.':plan.nextRound.eligible.length<3?'Er zijn nog geen drie geschikte films met punten.':'Hogere plaatsen blijven behouden.');$('#candidates').replaceChildren(...plan.nextRound.eligible.map(o=>{const l=document.createElement('label');l.className='check';const c=document.createElement('input');c.type='checkbox';c.name='candidate';c.value=o.id;c.checked=plan.nextRound.shortlist.includes(o.id)&&!plan.nextRound.cutoffTieIds.includes(o.id);l.append(c,document.createTextNode(title(o.id)+' · '+o.points+' punten'));return l}));renderCoordination();void loadPollPanel();lock();}
async function load(){if(busy)return;try{access=await request('/organizer');const raw=localStorage.getItem(storageKey(access.participantId));pending=raw?JSON.parse(raw):null;if(pending&&(pending.participantId!==access.participantId||pending.planId!==planId))throw Error('Het bewaarde verzoek hoort niet bij dit account.');plan=await request('/plans/'+planId);render();status('Beheerderstoegang bevestigd.')}catch(e){access=null;$('#controls').hidden=true;status(e.message);lock()}}
async function execute(){if(busy||!pending)return;busy=true;lock();const receipt=pending;try{const current=await request('/organizer');if(current.participantId!==receipt.participantId)throw Error('Log opnieuw in met het account dat deze handeling begon.');if(current.resetGeneration!==receipt.generation)throw Error('De site is opnieuw voorbereid. Dit oude verzoek wordt niet opnieuw verzonden.');const sent=JSON.parse(receipt.body),result=await request('/plans/'+receipt.planId+'/'+(receipt.path||'round'),{method:'POST',headers:{'Idempotency-Key':receipt.key,'X-Filmmaand-Organizer-Id':receipt.participantId,'X-Filmmaand-Reset-Generation':receipt.generation},body:receipt.body});persist(null);
 // issue-passes answers with working links: never shown or kept here, only who got one and whose account is new.
 const done=sent.action==='issue-passes'&&Array.isArray(result.passes)?'Links aangemaakt voor: '+result.passes.map(x=>x.name+(x.created?' (nieuw account)':'')).join(', ')+'. Er is nog niets gemaild.':'Handeling bevestigd. De getoonde ronde komt van de server.';
 status('Handeling bevestigd.');busy=false;await load();status(done)}catch(e){const definitive=e.status>=400&&e.status<500&&![401,403,410].includes(e.status)&&!['reset_generation','organizer_changed','key_reused'].includes(e.code);if(definitive)persist(null);status(e.message+(definitive?' Vernieuw en controleer de gegevens opnieuw.':''));}finally{busy=false;lock()}}
let proposedPath='round';
function propose(action,extra,summary){proposedPath='round';if(!access||!plan||pending||busy)return;proposed={action,expectedRoundId:plan.round.id,expectedRevision:plan.round.revision,...extra};$('#summary').textContent=summary;$('#confirm').showModal();$('#cancel-confirm').focus()}
$('#cancel-confirm').onclick=()=>$('#confirm').close();$('#accept-confirm').onclick=()=>{try{persist({participantId:access.participantId,planId,generation:access.resetGeneration,key:crypto.randomUUID(),path:proposedPath,body:JSON.stringify(proposed)});$('#confirm').close();void execute()}catch(e){status('Niet verzonden: '+e.message)}};
function form(id,fn){$(id).onsubmit=e=>{e.preventDefault();try{fn(new FormData(e.currentTarget))}catch(e){status(e.message)}}}
form('#deadline-form',f=>{const closesAt=dutchUTC(f.get('close'));propose('deadline',{closesAt},'Deze stemming sluit op '+localDate(closesAt)+'. De huidige keuzes en stemmen blijven behouden.')});
form('#close-form',()=>propose('close',{},'De huidige stemming nu sluiten? Nieuwe stemmen en wijzigingen worden daarna niet meer geaccepteerd.'));
form('#resolve-form',f=>{const choice=f.get('choice'),programme=f.has('programme'),programmeId=f.get('programmeId');propose('resolve',{choice,programme,...(programme&&programmeId?{programmeId}:{})},title(choice)+' vastleggen als uitslag'+(programme?' en in het programma opnemen':'')+'?')});
form('#open-form',f=>{const shortlist=f.getAll('candidate');if(shortlist.length!==3)throw Error('Kies precies drie films.');const closesAt=dutchUTC(f.get('close'));propose('open',{shortlist,selectionSnapshot:plan.nextRound.snapshot,scheduledDate:f.get('date'),closesAt},'Nieuwe ronde met '+shortlist.map(title).join(', ')+'. Filmavond '+f.get('date')+'; stemmen sluit '+localDate(closesAt)+'. De oude ronde wordt gearchiveerd; stemmen beginnen op nul.')});

function coordinate(path,body,summary){if(!access||pending||busy)return;proposedPath=path;proposed=body;$('#summary').textContent=summary;$('#confirm').showModal();$('#cancel-confirm').focus()}
function renderCoordination(){
 let area=$('#coordination-controls');if(!area){area=document.createElement('section');area.id='coordination-controls';$('#controls').append(area)}const top=$('#poll-panel');if(top&&top.nextSibling!==area)top.after(area);area.replaceChildren();const add=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;area.append(n);return n};
 add('h2','Datum afspreken');const q=plan.datePoll;add('p',q?'Huidige poll: '+q.status+(q.mode==='availability'?' · beschikbaarheid':' · bestaande voorkeursstemmen'):'Nog geen datumpoll.');
 if(q?.status==='open'){const close=add('button','Huidige poll sluiten');close.onclick=()=>coordinate('date-poll',{action:'close',pollId:q.id},'Deze poll sluiten? De antwoorden blijven bewaard; dit kiest geen datum.');}
 else{const f=add('form'),field=(name,text,type,required=true)=>{const l=document.createElement('label');l.textContent=text;const i=document.createElement('input');i.name=name;i.type=type;i.required=required;l.append(i);f.append(l);return i};field('start','Eerste avond','date');field('end','Laatste avond (maximaal 7 dagen)','date');field('close','Sluiting — Nederlandse tijd (optioneel; verplicht bij automatisch kiezen)','datetime-local',false);
  // Manual by default (Chris picks the night in "Wie kan wanneer"); automatic only when explicitly ticked.
  const autoLabel=document.createElement('label');autoLabel.className='check';const auto=document.createElement('input');auto.type='checkbox';auto.name='auto';autoLabel.append(auto,document.createTextNode(' Automatisch kiezen op de sluitingstijd (sluiting vóór de eerste avond)'));f.append(autoLabel);
  const l=document.createElement('label');l.textContent='Avond koppelen';const select=document.createElement('select');select.name='programmeId';select.append(new Option('Nieuwe avond, filmkeuze volgt',''));for(const n of plan.programme||[])if(n.selection==='pending')select.append(new Option((n.scheduledDate||n.startsAt)+' · '+n.id,n.id));l.append(select);f.append(l);const submit=document.createElement('button');submit.textContent='Datumpoll openen';f.append(submit);
  f.onsubmit=e=>{e.preventDefault();try{const d=new FormData(f),id=d.get('programmeId'),isAuto=d.has('auto'),close=d.get('close');if(isAuto&&!close)throw Error('Automatisch kiezen heeft een sluitingstijd nodig.');const closesAt=close?dutchUTC(close):null;
   coordinate('date-poll',{action:'open',mode:'availability',...(isAuto?{}:{pick:'manual'}),window:{start:d.get('start'),end:d.get('end')},choices:[],...(closesAt?{closesAt}:{}),...(id?{programmeId:id}:{})},
    isAuto?'Deze poll openen met automatisch kiezen? Op '+localDate(closesAt)+' wordt de beste avond vastgezet en krijgt iedereen daar een mail over.':'Deze poll openen voor '+d.get('start')+' t/m '+d.get('end')+'? Jij kiest daarna zelf de avond in "Wie kan wanneer". Openen mailt niemand.'+(closesAt?' Antwoorden kan tot '+localDate(closesAt)+'.':''))}catch(e){status(e.message)}}}
 add('h2','Tijden en verplaatsen');for(const n of [...(plan.round?.scheduledDate?[{id:'round-'+plan.round.scheduledDate,scheduledDate:plan.round.scheduledDate,timing:plan.round.timing,coordinationRevision:plan.round.coordinationRevision||0,choices:plan.round.leaderIds?.length?plan.round.leaderIds:plan.round.shortlist,roundTiming:true}]:[]),...(plan.programme||[])]){const details=add('details'),summary=document.createElement('summary');summary.textContent=(n.scheduledDate||localDate(n.startsAt))+' · '+(n.choices.map(title).join(' + ')||'Filmkeuze volgt');details.append(summary);const form=document.createElement('form');for(const [name,text]of [['arrival','Inloop'],['screening','Aanvang'],['end','Einde']]){const l=document.createElement('label');l.textContent=text+' (Nederlandse tijd)';const i=document.createElement('input');i.name=name;i.maxLength=60;i.value=name==='end'&&n.timing?.endDerived?'':n.timing?.[name]||'';if(name==='end'&&n.timing?.endDerived)i.placeholder=n.timing.end+' · berekend';l.append(i);form.append(l)}const exactLabel=document.createElement('label');exactLabel.textContent='Exacte start — Nederlandse datum en tijd (optioneel, voor herinnering)';const exact=document.createElement('input');exact.type='datetime-local';exact.name='exact';exact.value=n.startsAt?parts(Date.parse(n.startsAt)):'';exactLabel.append(exact);if(!n.roundTiming)form.append(exactLabel);const reminder=document.createElement('label');reminder.textContent='Herinnering — minuten vóór exacte starttijd (leeg = uit)';const ri=document.createElement('input');ri.name='reminder';ri.type='number';ri.min=1;ri.max=10080;ri.value=n.reminderMinutes||'';reminder.append(ri);if(!n.roundTiming)form.append(reminder);const save=document.createElement('button');save.textContent='Tijden bewaren';form.append(save);form.onsubmit=e=>{e.preventDefault();try{const d=new FormData(form);coordinate('coordination',{action:'times',eventId:n.id,eventVersion:n.coordinationRevision||0,...(n.roundTiming?{expectedRoundId:plan.round.id||null}:{}),timing:Object.fromEntries(['arrival','screening','end'].map(k=>[k,d.get(k)])),...(!n.roundTiming&&exact.value!==(n.startsAt?parts(Date.parse(n.startsAt)):'')?{startsAt:exact.value?dutchUTC(exact.value):null}:{}),...(!n.roundTiming&&ri.value!==String(n.reminderMinutes||'')?{reminderMinutes:ri.value?Number(ri.value):null}:{})},'Deze handmatig gekozen tijden bewaren?')}catch(e){status(e.message)}};details.append(form);for(const q of plan.coordination?.proposals||[])if(q.eventId===n.id&&q.status==='pending'){const p=document.createElement('p');p.textContent='Voorstel '+q.proposedDate+' · '+q.required.filter(r=>r.agree===true).length+'/'+q.required.length+' akkoord';details.append(p);for(const [action,text]of [['override','Als organisator verplaatsen'],['cancel','Voorstel annuleren']]){const b=document.createElement('button');b.textContent=text;b.onclick=()=>coordinate('coordination',{action,eventId:n.id,eventVersion:n.coordinationRevision||0,proposalId:q.id},action==='override'?'Deze avond verplaatsen naar '+q.proposedDate+' zonder volledig akkoord? Beschikbaarheid wordt niet verplaatst.':'Voorstel annuleren en huidige datum behouden?');details.append(b)}}}
}

// ---- "Wie kan wanneer": the organiser panel for the manual date poll (poll pass). Reads are organiser-only POSTs that
// write nothing (list-availability, list-passes, nudge-list). Every action (pick, reminder, doodle hide) goes through
// coordinate() → the #confirm dialog (focus on "Terug", never on "Bevestigen") → the stored-receipt sender.
// Nothing here can send without that confirm path.
let pollView=null,pollSeq=0;
async function organizerRead(body){return request('/plans/'+planId+'/date-poll',{method:'POST',headers:{'X-Filmmaand-Organizer-Id':access.participantId,'X-Filmmaand-Reset-Generation':access.resetGeneration},body:JSON.stringify(body)})}
async function loadPollPanel(){
 const q=plan?.datePoll,seq=++pollSeq;pollView=null;
 if(!access||!q||q.mode!=='availability'){renderPollPanel();return}
 try{
  const [avail,passes,nudge,invite]=await Promise.all([organizerRead({action:'list-availability',pollId:q.id}),organizerRead({action:'list-passes',pollId:q.id}),organizerRead({action:'nudge-list',pollId:q.id}),organizerRead({action:'invite-list',pollId:q.id})]);
  if(seq!==pollSeq)return;pollView={poll:avail.datePoll,passes:passes.passes,nudge,invite};
 }catch(e){if(seq!==pollSeq)return;pollView={error:e.message}}
 renderPollPanel();
}
const nightName=d=>new Date(d+'T12:00:00Z').toLocaleDateString('nl-NL',{timeZone:'Europe/Amsterdam',weekday:'long',day:'numeric',month:'long'});
const names=list=>list.length?list.map(x=>x.name).join(', '):'niemand';
function renderPollPanel(){
 let area=$('#poll-panel');if(!area){area=document.createElement('section');area.id='poll-panel';$('#controls').prepend(area);const co=$('#coordination-controls');if(co)area.after(co)}area.replaceChildren();
 const add=(tag,text,parent=area)=>{const n=document.createElement(tag);if(text)n.textContent=text;parent.append(n);return n};
 const q=plan?.datePoll;if(!q||q.mode!=='availability'){area.hidden=true;return}area.hidden=false;
 add('h2','Wie kan wanneer');
 if(!pollView){add('p','Laden…');return}if(pollView.error){add('p','Niet geladen: '+pollView.error);return}
 const v=pollView.poll,open=v.status==='open';
 // (e) needsPick: a banner, never a mail.
 if(v.needsPick){const b=add('p','Tijd om een avond te kiezen: de laatste avond komt eraan.');b.id='needs-pick';b.style.cssText='background:#f4ead8;padding:14px 16px'}
 if(v.status==='confirmed'){add('p','Gekozen: '+nightName(v.scheduledDate)+'.');
  // (i) RSVP per person for the picked night: ja / nee / nog niet.
  const rs=v.rsvp||[],said=new Set(rs.map(r=>r.name)),everyone=new Set([...pollView.passes.filter(x=>x.status==='active').map(x=>x.name),...v.ranking.flatMap(r=>[...r.people,...r.no]).map(x=>x.name),...v.declined.map(x=>x.name)]);
  add('p','Komt: '+names(rs.filter(r=>r.answer==='ja')));add('p','Komt niet: '+names(rs.filter(r=>r.answer==='nee')));
  add('p','Nog niet gereageerd: '+names([...everyone].filter(n=>!said.has(n)).sort((a,b)=>a.localeCompare(b,'nl')).map(name=>({name}))));}
 else if(!open)add('p','Deze poll is gesloten.');
 // Time and place for the confirmation mail, used by "Deze avond kiezen" below.
 let tijdInput=null,waarInput=null;
 if(open||v.status==='needs-organizer'){const f=add('form');f.onsubmit=e=>e.preventDefault();
  const mk=(label,val)=>{const l=add('label',label,f),i=document.createElement('input');i.value=val;i.maxLength=40;l.append(i);return i};
  tijdInput=mk('Tijd (voor de bevestiging)','20:00');waarInput=mk('Waar','bij Alec')}
 // (g) invitees → personal links (no mail yet). Anyone who already has a live link is skipped: issuing again would ROTATE
 // it and kill a link that may already be in their mailbox.
 if(open){
  add('h2','Uitnodigen');
  const have=new Set(pollView.passes.filter(x=>x.status==='active').map(x=>x.email.toLowerCase()));
  const f=add('form'),l=add('label','Eén per regel: naam, e-mail',f),ta=document.createElement('textarea');ta.name='people';ta.rows=5;ta.style.cssText='font:inherit;padding:11px;border:1px solid #bdc7b8;border-radius:2px';l.append(ta);
  const b=add('button','Links aanmaken',f);
  f.onsubmit=e=>{e.preventDefault();try{
   const people=[],skipped=[],seen=new Set();
   for(const [i,raw] of ta.value.split('\n').entries()){const line=raw.trim();if(!line)continue;const at=line.lastIndexOf(',');const name=line.slice(0,at).trim(),email=line.slice(at+1).trim().toLowerCase();
    if(at<1||!name||name.length>32||!/^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/.test(email))throw Error('Regel '+(i+1)+' klopt niet: gebruik "naam, e-mail".');
    if(seen.has(email))continue;seen.add(email);if(have.has(email)){skipped.push(name);continue}people.push({email,name})}
   if(!people.length)throw Error(skipped.length?'Iedereen in de lijst heeft al een link: '+skipped.join(', ')+'.':'Vul minstens één regel in.');
   if(people.length>50)throw Error('Maximaal 50 mensen per keer.');
   coordinate('date-poll',{action:'issue-passes',pollId:v.id,people},'Voor '+people.length+(people.length===1?' persoon':' mensen')+' een persoonlijke link aanmaken: '+people.map(x=>x.name).join(', ')+'. Wie nog geen account heeft, krijgt er een met deze naam.'+(skipped.length?' Overgeslagen (heeft al een link): '+skipped.join(', ')+'.':'')+' Er wordt nog NIETS gemaild.')
  }catch(e){status(e.message)}};
  // (h) the invitation: one mail per person with a link who has not been invited yet.
  const inv=pollView.invite?.recipients||[];
  if(inv.length){add('p','Nog uit te nodigen: '+names(inv)+'.');const s=add('button','Uitnodiging sturen aan '+inv.length+(inv.length===1?' persoon':' mensen'));s.id='invite-send';
   s.onclick=()=>coordinate('date-poll',{action:'invite',pollId:v.id},'Dit MAILT de uitnodiging naar precies deze '+inv.length+(inv.length===1?' persoon':' mensen')+': '+names(inv)+'. Iedereen krijgt een eigen link. Wie al een uitnodiging kreeg, krijgt er geen tweede.')}
  else if(pollView.passes.some(x=>x.status==='active'))add('p','Iedereen met een link is uitgenodigd (of heeft al geantwoord).');
 }
 // (a) availability per night, best first, with names.
 const answered=new Set([...v.ranking.flatMap(r=>[...r.people,...r.no]),...v.declined].map(x=>x.name));
 const waiting=[...new Map(pollView.passes.filter(x=>x.status==='active'&&!answered.has(x.name)).map(x=>[x.name,x])).values()];
 for(const r of v.ranking){
  const d=add('details');d.open=true;add('summary',nightName(r.date)+' · '+r.available+' ja, '+r.unavailable+' nee',d);
  add('p','Ja: '+names(r.people),d);add('p','Nee: '+names(r.no),d);
  // (b) pick: mails everyone. Plain words in the confirm; focus stays on "Terug".
  if(open||v.status==='needs-organizer'){const b=add('button','Deze avond kiezen',d);b.dataset.pick=r.date;
   b.onclick=()=>{const tijd=tijdInput.value.trim()||'20:00',waar=waarInput.value.trim()||'bij Alec';coordinate('date-poll',{action:'pick',pollId:v.id,date:r.date,tijd,waar},'Kies je '+nightName(r.date)+', '+tijd+', '+waar+'? Dit MAILT iedereen in de poll meteen een bevestiging ("het wordt '+nightName(r.date)+'!") met Ja, ik kom / Toch niet. Daarna kan niemand meer stemmen. Dit kun je niet terugdraaien.')}}
 }
 add('p','Kan geen enkele avond: '+names(v.declined));
 add('p','Nog niet geantwoord: '+names(waiting));
 // (c) reminders: exactly the nudge-list people, confirmed by count and name.
 add('h2','Herinnering');
 const who=pollView.nudge.recipients||[];
 if(!pollView.nudge.answersOpen)add('p','Deze poll neemt geen antwoorden meer aan; herinneren kan niet.');
 else if(!who.length)add('p','Iedereen met een link heeft geantwoord. Niemand om te herinneren.');
 else{add('p','Krijgt een herinnering: '+names(who)+'.');const b=add('button','Herinnering sturen aan '+who.length+(who.length===1?' persoon':' mensen'));b.id='nudge-send';
  b.onclick=()=>coordinate('date-poll',{action:'nudge',pollId:v.id},'Dit MAILT precies deze '+who.length+(who.length===1?' persoon':' mensen')+': '+names(who)+'. Wie intussen antwoordt, krijgt niets. Nog een keer drukken stuurt niet opnieuw; een nieuwe herinnering is een nieuwe handeling.')}
 // (d) doodles: hide/unhide, for everyone including the author. Not a send, but still confirmed.
 add('h2','Tekeningen');
 if(!v.doodles?.length)add('p','Nog geen tekeningen.');
 for(const d of v.doodles||[]){const row=add('p',(d.name||'Onbekend')+' · '+localDate(d.at)+(d.hidden?' · verborgen':'')+' ');const b=add('button',d.hidden?'Weer tonen':'Verbergen',row);b.dataset.doodle=d.id;
  b.onclick=()=>coordinate('date-poll',{action:'hide-doodle',pollId:v.id,doodleId:d.id,hidden:!d.hidden},d.hidden?'De tekening van '+(d.name||'deze persoon')+' weer voor iedereen tonen?':'De tekening van '+(d.name||'deze persoon')+' verbergen voor iedereen, ook voor de maker? Een nieuwe tekening van deze persoon blijft ook verborgen tot je hem weer toont.')}
 // (f) chat messages: hide/unhide, same confirm path.
 add('h2','Berichten');
 if(!v.chat?.length)add('p','Nog geen berichten.');
 for(const m of v.chat||[]){const row=add('p',(m.name||'Onbekend')+' · '+localDate(m.at)+(m.hidden?' · verborgen':'')+': ');add('span',m.text,row);row.append(' ');const b=add('button',m.hidden?'Weer tonen':'Verbergen',row);b.dataset.message=m.id;
  b.onclick=()=>coordinate('date-poll',{action:'hide-message',pollId:v.id,messageId:m.id,hidden:!m.hidden},m.hidden?'Dit bericht van '+(m.name||'deze persoon')+' weer voor iedereen tonen?':'Dit bericht van '+(m.name||'deze persoon')+' verbergen voor iedereen, ook voor de schrijver?')}
 lock();
}

$('#retry').onclick=()=>void execute();$('#refresh').onclick=()=>void load();void load();})();
