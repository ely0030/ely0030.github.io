/* Real shared voting UI. API contract: voting/docs/API.md. No synthetic totals. */
(() => {
'use strict';
const mounts=new WeakMap();let active=null;
const clone=x=>JSON.parse(JSON.stringify(x));
const equal=(a,b)=>a.length===b.length&&[...a].sort().every((x,i)=>x===[...b].sort()[i]);
function element(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=String(text);return n;}
function mount(host,options={}){
 if(!(host instanceof HTMLElement))throw new TypeError('Voting host required');mounts.get(host)?.();
 const config={...(window.festivalVotingConfig||{}),...options};
 const apiBase=String(config.apiBase||'').replace(/\/+$/,'');const requestedPoll=String(config.pollId||'september-2026');
 const prefix='alec-filmmaand-shared-voting-v1:'+encodeURIComponent(apiBase)+':';const draftKey=prefix+'draft:'+requestedPoll,receiptKey=prefix+'request:'+requestedPoll,identityKey=prefix+'identity';
 const root=element('section','fv-page');root.setAttribute('aria-label','Publiekskeuze');host.append(root);
 let identityChanged=false,dead=false,poll=null,ballot={choices:[],revision:0,updatedAt:null},draft=[],draftLoaded=false,connected=false,loading=false,pending=false,error='',notice='',tone='',token='',storageOK=true,updatedAt=null,requestRecord=null,readSerial=0,readPromise=null,queuedCandidate=null;
 let suggestion={title:'',detail:''};const aborters=new Set();const listeners=[];
 function readStorage(key){try{return localStorage.getItem(key);}catch{storageOK=false;return null;}}
 function store(key,value){try{if(value===null)localStorage.removeItem(key);else localStorage.setItem(key,JSON.stringify(value));return true;}catch{storageOK=false;return false;}}
 function parseStored(key){try{return JSON.parse(readStorage(key)||'null');}catch{return null;}}
 try{token=readStorage(identityKey)||'';if(!/^[A-Za-z0-9_-]{43}$/.test(token)){const bytes=crypto.getRandomValues(new Uint8Array(32));token=btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');localStorage.setItem(identityKey,token);}}catch{storageOK=false;}
 const storedDraft=parseStored(draftKey);if(storedDraft&&Array.isArray(storedDraft.choices)&&storedDraft.choices.every(x=>typeof x==='string')){draft=[...new Set(storedDraft.choices)];draftLoaded=true;}
 const receipt=parseStored(receiptKey);if(receipt&&['ballot','suggestion'].includes(receipt.kind)&&typeof receipt.key==='string'&&receipt.body&&typeof receipt.body==='object')requestRecord=receipt;
 function on(el,type,fn,opts){el.addEventListener(type,fn,opts);listeners.push(()=>el.removeEventListener(type,fn,opts));}
 function visible(){return !document.hidden&&host.getClientRects().length>0;}
 function snapshot(){return {pollId:poll?.id||requestedPoll,status:poll?.status||'unavailable',resolution:poll?.resolution?clone(poll.resolution):null,ballot:[...ballot.choices],draft:[...draft],counts:poll?{...poll.counts}:{},candidates:poll?clone(poll.options):[],loaded:!!poll,connected,pending:pending||!!requestRecord,error,ballotRevision:ballot.revision};}
 function emit(){const state=snapshot();try{config.onState?.(state);}catch(e){console.error('Voting state callback failed',e);}window.dispatchEvent(new CustomEvent('festival-voting-state',{detail:state}));}
 function validPoll(p){if(!p||p.id!==requestedPoll||!['draft','open','closed'].includes(p.status)||!Array.isArray(p.options)||!p.counts||!p.rules||!Number.isInteger(p.rules.maxChoices)||p.rules.maxChoices<1||!Number.isInteger(p.ballotCount)||p.ballotCount<0)throw Error('De stemserver gaf een onvolledig antwoord.');const ids=new Set();for(const c of p.options){if(!c||typeof c.id!=='string'||typeof c.title!=='string'||ids.has(c.id)||!Number.isInteger(p.counts[c.id])||p.counts[c.id]<0)throw Error('De stemserver gaf een onvolledig antwoord.');ids.add(c.id);}return p;}
 function validBallot(b){if(!b||!Array.isArray(b.choices)||!b.choices.every(x=>typeof x==='string')||!Number.isInteger(b.revision)||b.revision<0)throw Error('Je opgeslagen stem kon niet worden gelezen.');return b;}
 async function api(path,{method='GET',body,key,auth=false}={}){
  const controller=new AbortController();aborters.add(controller);const timer=setTimeout(()=>controller.abort(),15000);
  try{const headers={Accept:'application/json'};if(auth)headers.Authorization='Bearer '+token;if(body!==undefined)headers['Content-Type']='application/json';if(key)headers['Idempotency-Key']=key;
   const response=await fetch(apiBase+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),cache:'no-store',credentials:'omit',signal:controller.signal});let data;try{data=await response.json();}catch{throw Error('Het antwoord van de stemserver kon niet worden gelezen.');}
   if(!response.ok){const e=Error(data?.error?.message||'De stemserver kon dit verzoek niet verwerken.');e.code=data?.error?.code;e.details=data?.error?.details;e.status=response.status;throw e;}return data;
  }catch(e){if(e.name==='AbortError')throw Error('De verbinding duurde te lang. Probeer opnieuw.');throw e;}finally{clearTimeout(timer);aborters.delete(controller);}
 }
 const pollPath='/polls/'+encodeURIComponent(requestedPoll);
 function persistDraft(){store(draftKey,{choices:draft,updatedAt:new Date().toISOString()});}
 async function refresh(){
  if(dead||identityChanged||!apiBase||pending)return;if(readPromise)return readPromise;
  const serial=++readSerial;loading=true;render();
  readPromise=(async()=>{try{
   const [p,b]=await Promise.all([api(pollPath),api(pollPath+'/ballot',{auth:true})]);if(dead||serial!==readSerial)return;
   const next=validPoll(p),own=validBallot(b.ballot);poll=next;ballot=own;connected=true;updatedAt=new Date();error='';
   if(!draftLoaded){draft=[...own.choices];draftLoaded=true;}
   else if(!requestRecord&&equal(draft,own.choices)){store(draftKey,null);}
   if(queuedCandidate){const id=queuedCandidate;queuedCandidate=null;selectCandidate(id);}
  }catch(e){if(!dead&&serial===readSerial){connected=false;error=messageFor(e);}}finally{if(!dead&&serial===readSerial){loading=false;readPromise=null;render();emit();}}})();return readPromise;
 }
 function canEdit(){return !!poll&&poll.status==='open'&&connected&&!pending&&!requestRecord&&(poll.rules.editable!==false||ballot.revision===0);}
 function selectCandidate(id){
  if(!poll){queuedCandidate=String(id);refresh();return false;}if(!canEdit()){notice=requestRecord?'Controleer eerst het vorige verzoek.':poll.status!=='open'?'Deze stemronde is niet open.':'Je stem kan nu niet worden aangepast.';tone='error';render();return false;}
  if(!poll.options.some(c=>c.id===id)){notice='Deze keuze staat niet in de huidige stemronde.';tone='error';render();return false;}
  if(draft.includes(id))draft=draft.filter(x=>x!==id);else{if(draft.length>=poll.rules.maxChoices){notice=`Je kunt maximaal ${poll.rules.maxChoices} keuzes bewaren. Verwijder eerst een keuze.`;tone='error';render();return false;}draft.push(id);}
  persistDraft();notice=equal(draft,ballot.choices)?'Je selectie komt overeen met je opgeslagen stem.':'Je wijzigingen zijn nog niet verstuurd.';tone='';render();emit();return true;
 }
 function messageFor(e){const messages={poll_not_found:'Deze stemronde is nog niet klaargezet.',not_configured:'De stembus wordt nog voorbereid.',ballot_conflict:'Je stem is elders gewijzigd. Je concept is bewaard. Vergelijk het met de opgeslagen stem voordat je opnieuw opslaat.',poll_closed:'Deze stemronde is gesloten. Je laatste wijzigingen zijn niet opgeslagen.',poll_not_open:'Deze stemronde is niet open.',suggestions_disabled:'Nieuwe voorstellen zijn niet toegestaan in deze stemronde.',too_many_choices:'Je hebt meer keuzes geselecteerd dan deze ronde toestaat.',invalid_text:'Gebruik gewone tekst zonder opmaaktekens. Een titel mag 160 tekens bevatten; een toelichting 1000.',suggestion_limit:'Je kunt in deze ronde geen extra voorstellen meer toevoegen.',ballot_locked:'Je opgeslagen stem kan in deze ronde niet meer worden aangepast.',unknown_choice:'Een geselecteerde keuze is niet meer beschikbaar.',unauthorized:'Je stemsleutel wordt niet geaccepteerd. Herlaad de pagina om de verbinding te controleren.'};return messages[e.code]||e.message||'Opslaan is niet gelukt.';}
 async function mutate(kind,body,retry=false){
  if(dead||identityChanged||pending||!apiBase)return;if(!storageOK){notice='Deze browser kan je anonieme stemsleutel niet bewaren. Sta browseropslag toe om te stemmen.';tone='error';render();return;}
  if(!retry&&(!connected||!poll||poll.status!=='open'||requestRecord))return;
  const record=retry?requestRecord:{kind,body:clone(body),key:crypto.randomUUID()};if(!record)return;
  if(!store(receiptKey,record)){notice='Het verzoek kon niet veilig worden bewaard. Er is niets verstuurd.';tone='error';render();return;}
  requestRecord=record;pending=true;notice=record.kind==='ballot'?'Je stem wordt opgeslagen…':'Je voorstel wordt toegevoegd…';tone='';++readSerial;readPromise=null;loading=false;render();emit();
  try{
   const result=await api(pollPath+(record.kind==='ballot'?'/ballot':'/suggestions'),{method:record.kind==='ballot'?'PUT':'POST',body:record.body,key:record.key,auth:true});if(dead)return;
   if(record.kind==='ballot'){ballot=validBallot(result.ballot);draft=[...ballot.choices];draftLoaded=true;store(draftKey,null);notice=ballot.choices.length?'Je stem is opgeslagen op de stemserver.':'Je stem is ingetrokken op de stemserver.';}
   else{if(!result.suggestion||typeof result.suggestion.id!=='string')throw Error('De bevestiging van je voorstel ontbreekt.');suggestion={title:'',detail:''};notice='Je voorstel is opgeslagen. Het telt mee zodra iemand erop stemt.';}
   requestRecord=null;store(receiptKey,null);tone='success';
  }catch(e){if(dead)return;notice=messageFor(e);tone='error';
   // A definitive client error is safe to abandon. Network/5xx may have committed:
   // retain the exact key and payload so Retry retrieves the original receipt.
   if(e.status>=400&&e.status<500&&e.status!==408){requestRecord=null;store(receiptKey,null);if(e.code==='ballot_conflict'&&e.details?.ballot){try{ballot=validBallot(e.details.ballot);}catch{connected=false;}}}
   else notice='Nog geen bevestiging ontvangen. Je verzoek blijft bewaard; probeer hetzelfde verzoek opnieuw.';
  }finally{if(!dead){pending=false;render();emit();await refresh();}}
 }
 function focusState(){const f=document.activeElement;if(!root.contains(f))return null;return {key:f.dataset.fvFocus,start:typeof f.selectionStart==='number'?f.selectionStart:null,end:typeof f.selectionEnd==='number'?f.selectionEnd:null};}
 function render(){
  if(dead)return;const focus=focusState();root.replaceChildren();
  const top=element('div','fv-top');const back=element('a','','← Het programma');back.href='#/';top.append(back,element('span','','Publiekskeuze'));root.append(top);
  const heading=element('div','fv-heading'),title=element('div');title.append(element('span','fv-kicker','Alec Filmmaand'),element('h1','',poll?.title||'Wat kijken we?'));heading.append(title,element('p','',poll?`Kies maximaal ${poll.rules.maxChoices} films of thema’s. ${poll.rules.editable!==false?'Je kunt je opgeslagen stem aanpassen zolang de ronde open is.':'Je kunt je stem één keer insturen.'}`:'Kies mee voor de volgende filmavond. De actuele stemronde wordt opgehaald bij de stemserver.'));root.append(heading);
  if(config.environment==='local'){root.append(element('p','fv-note','Lokale gedeelde testronde · nog niet bereikbaar voor vrienden. Dit is geen publieke stembus.'));}else if(config.connectionLabel){root.append(element('p','fv-note',config.connectionLabel));}
  if(!apiBase||(!poll&&(error||loading))){const block=element('div','fv-connection');block.append(element('h2','',!apiBase?'De stembus is nog niet verbonden.':loading?'De stembus wordt opgehaald.':'De stembus is niet bereikbaar.'),element('p','',!apiBase?'Zodra de stemserver is aangesloten, kun je hier je keuzes bewaren en voorstellen toevoegen. Er kan vanuit deze pagina nog geen stem worden verstuurd.':loading?'Een moment. We halen de keuzes, telling en je opgeslagen stem op.':'We kunnen je opgeslagen stem en de actuele telling nu niet bevestigen. Je lokale concept blijft bewaard.'));
   if(error)block.append(element('p','',error));if(apiBase&&!loading)block.append(button('Opnieuw verbinden','fv-secondary',()=>refresh(),'retry'));root.append(block);emitFocus();return;}
  if(!poll){emitFocus();return;}
  const meta=element('div','fv-meta');const status={open:'Stemronde open',draft:'Stemronde nog niet open',closed:'Stemronde gesloten'}[poll.status];meta.append(element('strong','',status));
  const deadline=poll.deadlineAt||poll.closesAt;meta.append(element('span','',deadline&&!Number.isNaN(Date.parse(deadline))?'Sluit '+formatDate(deadline):poll.status==='closed'&&poll.closedAt?'Gesloten '+formatDate(poll.closedAt):'Geen sluitingsmoment aangekondigd'));meta.append(element('span','',`${poll.ballotCount} opgeslagen ${poll.ballotCount===1?'stem':'stemmen'}`));root.append(meta);
  if(!connected){const banner=element('div','fv-inline-error');banner.append(element('span','','Verbinding verbroken. De telling hieronder is de laatst opgehaalde stand; opslaan is tijdelijk niet mogelijk. '),button('Opnieuw verbinden','fv-text-button',()=>refresh(),'retry'));root.append(banner);}
  if(!storageOK)root.append(element('p','fv-inline-error','Browseropslag is niet beschikbaar. Je kunt de telling bekijken, maar geen herbruikbare anonieme stem bewaren.'));
  if(poll.status==='closed'){const result=element('section','fv-result');result.append(element('span','fv-kicker','De uitslag'));const winner=poll.resolution&&poll.options.find(c=>c.id===poll.resolution.winnerId);result.append(element('h2','',winner?winner.title:'De stemmen zijn geteld.'));result.append(element('p','',winner?'Gekozen voor het programma. De vertoningsdatum wordt apart bekendgemaakt.':'De stemronde is gesloten. De definitieve keuze is nog niet bekendgemaakt.'));root.append(result);}
  const layout=element('div','fv-layout'),main=element('div'),aside=element('aside','fv-ballot');const lh=element('div','fv-list-heading');lh.append(element('h2','','Films & thema’s'),element('span','','Telling van opgeslagen stemmen'));main.append(lh);
  const list=element('div');for(const candidate of poll.options){const row=element('label','fv-candidate');const checkbox=element('input');checkbox.type='checkbox';checkbox.checked=draft.includes(candidate.id);checkbox.disabled=!canEdit();checkbox.dataset.fvFocus='choice:'+candidate.id;checkbox.setAttribute('aria-label',candidate.title);checkbox.addEventListener('change',()=>selectCandidate(candidate.id));
   const copy=element('span');if(candidate.source==='suggestion')copy.append(element('span','fv-candidate-tag','Publieksvoorstel'));copy.append(element('span','fv-candidate-title',candidate.title));if(candidate.detail)copy.append(element('span','fv-candidate-copy',candidate.detail));const count=element('span','fv-count');count.append(element('strong','',poll.counts[candidate.id]),element('small','',poll.counts[candidate.id]===1?'stem':'stemmen'));row.append(checkbox,copy,count);list.append(row);}
  main.append(list);if(!poll.options.length)main.append(element('p','fv-empty','Er zijn nog geen keuzes in deze ronde.'));
  aside.append(element('span','fv-kicker','Jouw stem'),element('h2','',`${draft.length} van ${poll.rules.maxChoices} gekozen`));const selected=element('ul','fv-ballot-list');for(const id of draft){const c=poll.options.find(c=>c.id===id);const li=element('li');li.append(element('span','',c?.title||'Niet meer beschikbare keuze'));const remove=button('×','',()=>{draft=draft.filter(x=>x!==id);persistDraft();notice='Je wijzigingen zijn nog niet verstuurd.';tone='';render();emit();},'remove:'+id);remove.disabled=!canEdit();remove.setAttribute('aria-label','Verwijder '+(c?.title||'keuze'));li.append(remove);selected.append(li);}aside.append(selected);if(!draft.length)aside.append(element('p','fv-empty','Selecteer een film of thema in de lijst.'));
  const invalid=draft.length>poll.rules.maxChoices||draft.some(id=>!poll.options.some(c=>c.id===id));
  const save=button(pending?'Bezig met opslaan…':requestRecord?'Hetzelfde verzoek opnieuw proberen':equal(draft,ballot.choices)&&ballot.revision>0?'Stem opgeslagen':draft.length?'Bewaar mijn stem':ballot.choices.length?'Trek mijn stem in':'Selecteer je films','fv-primary',()=>requestRecord?mutate(null,null,true):mutate('ballot',{choices:[...draft],expectedRevision:ballot.revision}),'save');
  if(!equal(draft,ballot.choices)||pending||requestRecord)save.classList.add('fv-mobile-save');
  save.disabled=pending||!storageOK||(!requestRecord&&(!canEdit()||invalid||equal(draft,ballot.choices)));aside.append(save);
  const state=element('p','fv-save-state',notice||(requestRecord?'Een eerder verzoek heeft nog geen bevestiging. Probeer datzelfde verzoek opnieuw.':!equal(draft,ballot.choices)?'Concept op dit apparaat · nog niet verstuurd.':ballot.revision>0?'Je selectie is bevestigd door de stemserver.':'Je hebt nog geen stem verstuurd.'));state.setAttribute('role','status');state.dataset.tone=tone;aside.append(state);
  if(invalid)aside.append(element('p','fv-save-state','Je concept past niet meer bij deze ronde. Verwijder ongeldige of extra keuzes.'));
  if(!equal(draft,ballot.choices)){aside.append(element('p','fv-note','Opgeslagen: '+(ballot.choices.map(id=>poll.options.find(c=>c.id===id)?.title||id).join(' · ')||'geen keuzes')+'.'));const actions=element('div','fv-draft-actions');const restore=button('Gebruik mijn opgeslagen stem','fv-text-button',()=>{draft=[...ballot.choices];persistDraft();notice='Je opgeslagen stem is hersteld in de selectie.';tone='';render();emit();},'restore');restore.disabled=pending||!!requestRecord;actions.append(restore);aside.append(actions);}
  aside.append(element('p','fv-note','Anoniem via deze browser. Je stemsleutel staat los van namen en beschikbaarheid. Een ander apparaat of gewiste browseropslag krijgt een andere stemsleutel.'));
  if(poll.rules.allowSuggestions!==false){const section=element('section','fv-suggestion');section.append(element('span','fv-kicker','Een eigen idee'),element('h2','','Stel iets voor.'),element('p','','Een film, double bill of thema. Je voorstel verschijnt na opslaan voor iedereen in de stemronde. Het krijgt niet automatisch jouw stem.'));
   if(poll.status!=='open')section.append(element('p','','Voorstellen toevoegen kan alleen terwijl de stemronde open is.'));else{const form=element('form','fv-form');const tl=element('label','','Film of thema');const input=element('input');input.type='text';input.maxLength=160;input.required=true;input.value=suggestion.title;input.dataset.fvFocus='suggestion-title';input.autocomplete='off';input.disabled=pending||!!requestRecord||!connected;input.addEventListener('input',()=>{suggestion.title=input.value;});tl.append(input);
    const dl=element('label','','Toelichting (optioneel)');const area=element('textarea');area.maxLength=1000;area.rows=3;area.value=suggestion.detail;area.dataset.fvFocus='suggestion-detail';area.disabled=input.disabled;area.addEventListener('input',()=>{suggestion.detail=area.value;});dl.append(area);const footer=element('div','fv-form-footer');const submit=element('button','fv-primary','Voeg voorstel toe');submit.type='submit';submit.disabled=pending||!!requestRecord||!connected||!storageOK;footer.append(submit,element('p','','Alleen de titel en toelichting worden gedeeld.'));form.append(tl,dl,footer);form.addEventListener('submit',e=>{e.preventDefault();if(suggestion.title.trim())mutate('suggestion',{title:suggestion.title.trim(),detail:suggestion.detail.trim()});});section.append(form);}main.append(section);}
  const updated=element('p','fv-updated',updatedAt?'Stand opgehaald om '+updatedAt.toLocaleTimeString('nl-NL',{hour:'2-digit',minute:'2-digit'})+'. ':'');const refreshButton=button(loading?'Vernieuwen…':'Vernieuw telling','fv-refresh',()=>refresh(),'refresh');refreshButton.disabled=loading||pending;updated.append(refreshButton);main.append(updated);layout.append(main,aside);root.append(layout);emitFocus();
  function emitFocus(){if(focus?.key){const next=[...root.querySelectorAll('[data-fv-focus]')].find(n=>n.dataset.fvFocus===focus.key);if(next&&!next.disabled){next.focus({preventScroll:true});if(focus.start!==null&&typeof next.setSelectionRange==='function')try{next.setSelectionRange(focus.start,focus.end);}catch{}}}}
 }
 function button(text,cls,fn,key){const b=element('button',cls,text);b.type='button';if(key)b.dataset.fvFocus=key;b.addEventListener('click',fn);return b;}
 function formatDate(value){return new Date(value).toLocaleString('nl-NL',{day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'});}
 const interval=setInterval(()=>{if(visible())refresh();},Math.max(5000,Number(config.refreshMs)||10000));
 on(document,'visibilitychange',()=>{if(visible())refresh();});on(window,'hashchange',()=>requestAnimationFrame(()=>{if(!dead&&visible())refresh();}));on(window,'online',()=>{if(visible())refresh();});
 on(window,'storage',e=>{if((e.key===identityKey||e.key===null)&&readStorage(identityKey)!==token){identityChanged=true;connected=false;error='De stemsleutel is in een ander tabblad gewijzigd. Herlaad deze pagina.';notice=error;tone='error';render();emit();}else if(e.key===draftKey){notice='Een ander tabblad heeft een concept gewijzigd. Je huidige selectie blijft behouden.';render();}});
 function cleanup(){if(dead)return;dead=true;++readSerial;clearInterval(interval);aborters.forEach(c=>c.abort());listeners.forEach(f=>f());root.remove();if(mounts.get(host)===cleanup)mounts.delete(host);if(active===cleanup)active=null;}
 cleanup.refresh=refresh;cleanup.selectCandidate=selectCandidate;cleanup.getState=snapshot;mounts.set(host,cleanup);active=cleanup;render();emit();refresh();return cleanup;
}
window.mountFestivalVoting=mount;
window.festivalVoting={mount,refresh:()=>active?.refresh(),selectCandidate:id=>active?.selectCandidate(id)||false,getState:()=>active?.getState()||null};
})();
