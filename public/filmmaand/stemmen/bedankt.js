/* Bedankt: approved A Cinema / C De toegift, from artifact 6a10b004 r2.
 * renderBedankt(ctx) returns the real post-vote screen. A is the default;
 * ?bedankt=a|c selects a remembered composition, ?variants shows comparison controls.
 * Both use actual programme/tally data. Switching and metadata updates preserve the pudding canvas.
 */
(()=>{'use strict';
const NS='http://www.w3.org/2000/svg';
const TZ='Europe/Amsterdam';
const SHOW_NEXT=false; // hide round two for now so the film of the evening gets the room
const VARIANTS=['a','c'],NAMES={a:'Cinema',c:'De toegift'},VKEY='filmmaand-bedankt-approved-layout';

const svgEl=(tag,attrs)=>{const n=document.createElementNS(NS,tag);for(const k in attrs)n.setAttribute(k,attrs[k]);return n};
const cap=s=>s?s.charAt(0).toUpperCase()+s.slice(1):s;
function variant(){return 'a'}

/* ---------- pieces ---------- */
function checkMark(el,reduced){const wrap=el('span','st-check'+(reduced.matches?' is-still':''));wrap.setAttribute('role','img');wrap.setAttribute('aria-label','Geregistreerd');
 const svg=svgEl('svg',{viewBox:'0 0 48 48','aria-hidden':'true'});
 svg.append(svgEl('circle',{cx:24,cy:24,r:22.5,class:'st-check-ring'}),svgEl('path',{d:'M14.5 24.5l6.5 6.5L33.5 18',class:'st-check-tick'}));
 wrap.append(svg);return wrap}

function when(iso){const d=iso?new Date(iso):null;if(!d||isNaN(d))return null;
 return {date:d.toLocaleDateString('nl-NL',{timeZone:TZ,weekday:'long',day:'numeric',month:'long',year:'numeric'}),short:d.toLocaleDateString('nl-NL',{timeZone:TZ,weekday:'long',day:'numeric',month:'long'}),time:d.toLocaleTimeString('nl-NL',{timeZone:TZ,hour:'2-digit',minute:'2-digit'}),iso:d.toISOString()}}

function scheduledDay(value){if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return null;const d=new Date(value+'T12:00:00Z');if(isNaN(d)||d.toISOString().slice(0,10)!==value)return null;return {...when(d.toISOString()),iso:value,time:null}}

function art(ctx,o,cls,src){const f=ctx.el('div',cls);
 if(src){const img=ctx.el('img');img.src=src;img.alt='';img.decoding='async';f.append(img)}
 else f.append(ctx.el('span','st-poster-empty',o?o.title:'—'));return f}
const poster=(ctx,o,cls='st-ballot-poster')=>art(ctx,o,cls,o?ctx.poster(o):'');

/* Over the image: count, laurel if leading, and the faces — the finale's own language. */
function overlay(ctx,o,tally,mine){const {el}=ctx;const box=el('div','st-over');if(!tally)return box;
 const n=tally.counts[o.id]||0,lead=ctx.leaders(tally),leading=lead.includes(o.id),tie=lead.length>1;
 const num=el('p','st-over-num');num.append(el('b','',String(n)),el('span','',n===1?'stem':'stemmen'));num.setAttribute('aria-label',n+' van '+tally.total+' stemmen');box.append(num);
 if(leading){const l=el('span','st-over-lead');l.append(ctx.laurel(tie?'GELIJK':'AAN KOP'),el('span','',tie?'Gelijk aan kop':'Aan kop'));box.append(l)}
 box.append(ctx.crowd(tally,o.id,{mine,max:8}));return box}

function row(ctx,key,...value){const {el}=ctx;const r=el('div','st-row');r.append(el('span','st-row-key',key));const v=el('span','st-row-value');v.append(...value);r.append(v);return r}
function dateHead(ctx,w){const {el}=ctx;const p=el('p','st-date'+(w?'':' is-open'));p.append(el('small','','Wanneer'));
 if(w){const t=el('time');t.dateTime=w.iso;t.append(document.createTextNode(cap(w.short)));if(w.time)t.append(el('br'),document.createTextNode(w.time+' uur'));p.append(t)}
 else p.append(document.createTextNode('Wordt nog gepland'));return p}

/* What the card is about: the planned film once the night is set, until then the one winning the finale. */
function feature(ctx){const {vote,plan}=ctx;const own=vote.own,tally=vote.final,round=vote.round;
 const programme=Array.isArray(plan.programme)?plan.programme:[];
 let night=round.planned?programme.find(n=>n.choices.some(id=>round.shortlist.includes(id))):null;
 const lead=tally?ctx.leaders(tally):[];
 const id=night?night.choices.find(c=>ctx.option(c))||night.choices[0]:(lead[0]||own.final);
 const o=ctx.option(id);
 const contenders=!night&&lead.length>1?lead.map(ctx.option).filter(Boolean):[];
 return {o,contenders,mine:ctx.option(own.final),night,w:night?(when(night.startsAt)||scheduledDay(night.scheduledDate)):(scheduledDay(round.scheduledDate)||scheduledDay(plan.round?.scheduledDate)),tally,isMine:own.final===id}}

const confirmationCopy=ctx=>feature(ctx).w?'De filmavond staat in het programma.':'Zodra de avond is gepland, vind je hem in het programma.';

/* Under the image: title, meta, the programme-note description, then the date headline and the rows. */
function below(ctx,f,{title=true,date=true}={}){const {el}=ctx;const c=el('div','st-below');
 if(title){c.append(el('h2','st-ballot-title',f.o.title));const meta=ctx.metaOf(f.o);if(meta)c.append(el('p','st-ballot-meta',meta))}
 const d=ctx.describe(f.o);if(d)c.append(el('p','st-desc',d));
 if(date)c.append(dateHead(ctx,f.w));const rows=el('div','st-rows');
 if(f.night&&f.night.place)rows.append(row(ctx,'Waar',document.createTextNode(f.night.place)));
 if(f.mine)rows.append(row(ctx,'Jouw stem',document.createTextNode(f.mine.id===f.o.id?'Deze film':f.mine.title)));
 c.append(rows);return c}

/* B — scène en affiche: the picker's Forum geometry, the crowd over the still, the poster overlapping. */
function cardB(ctx,f){const {el}=ctx;const c=el('div','st-card is-b');const scene=el('div','st-b-scene');const still=f.o?ctx.still(f.o):'';
 if(still){const img=el('img','st-b-still');img.src=still;img.alt='';img.decoding='async';scene.append(img)}
 scene.append(el('div','st-b-shade'),overlay(ctx,f.o,f.tally,f.isMine),poster(ctx,f.o,'st-b-poster'));c.append(scene,below(ctx,f));return c}
/* C — het ticket: a dark portrait panel, title and crowd on it, the description below and the date on the banner. */
function cardC(ctx,f){const {el}=ctx;const c=el('div','st-card is-c');const panel=el('div','st-c-panel');const still=f.o?ctx.still(f.o):'';
 if(still){const img=el('img','st-c-still');img.src=still;img.alt='';img.decoding='async';panel.append(img)}
 panel.append(el('div','st-c-shade'));const copy=el('div','st-c-copy');copy.append(el('span','st-kicker',f.night?'De filmavond':f.tally&&ctx.leaders(f.tally).length>1?'Gelijk aan kop':'Voorlopig aan kop'),el('h2','st-ballot-title',f.o.title));const meta=ctx.metaOf(f.o);if(meta)copy.append(el('p','st-ballot-meta',meta));
 const titleNode=copy.querySelector('.st-ballot-title'),parts=f.o.title.match(/^(.*?)(\s+\d+\s*\+\s*\d+)$/);if(parts)titleNode.replaceChildren(document.createTextNode(parts[1]),el('br'),document.createTextNode(parts[2].trim()));copy.append(dateHead(ctx,f.w));panel.append(copy);const rows=el('div','st-rows st-c-receipt');if(f.night?.place)rows.append(row(ctx,'Waar',document.createTextNode(f.night.place)));const films=window.pickerProgrammeNotes?.[f.o.id]?.films||[];if(films.length){const list=el('div','st-ticket-films');for(const film of films){const line=el('p');line.append(el('strong','',film.title),el('span','',[film.year,film.director].filter(Boolean).join(' · ')));list.append(line)}rows.prepend(list);const summary=el('p','st-ticket-summary');summary.append(el('strong','',films.length===2?'Dubbele voorstelling':films.length+' films'),el('span','',ctx.metaOf(f.o)));rows.append(summary);}
 c.append(panel,rows);return c}

function tiedCard(ctx,f){const {el}=ctx,card=el('div','st-card is-c is-tied'),panel=el('div','st-c-panel st-tie-panel'),count=f.contenders.length;
 f.contenders.forEach((o,i)=>{const src=ctx.still(o)||ctx.poster(o);if(!src)return;const img=el('img','st-c-still');img.src=src;img.alt='';img.decoding='async';const left=Math.max(0,100*i/count-10),right=Math.min(100,100*(i+1)/count+10);img.style.maskImage='linear-gradient(90deg,'+(i?'transparent '+left+'%,#000 '+(left+20)+'%,':'#000 0%,')+(i<count-1?'#000 '+(right-20)+'%,transparent '+right+'%':'#000 100%')+')';panel.append(img)});
 panel.append(el('div','st-c-shade'));const copy=el('div','st-c-copy'),label=el('p','st-tie-label');label.append(el('span','st-tie-symbol','='),document.createTextNode('Gelijk aan kop'));copy.append(label);
 for(const o of f.contenders){const line=el('div','st-tie-choice');line.append(el('h2','st-tie-title',o.title),el('span','st-tie-score',String(f.tally.counts[o.id]||0)+' '+((f.tally.counts[o.id]||0)===1?'stem':'stemmen')));copy.append(line)}
 copy.append(dateHead(ctx,f.w));panel.append(copy);card.append(panel);return card}
function appendVoters(ctx,host,f){if(!f.o||!f.tally)return;const tied=f.contenders.length>1,ids=tied?Object.keys(f.tally.counts).filter(id=>f.tally.counts[id]>0&&ctx.option(id)):[f.o.id];host.classList.toggle('is-tied',tied);
 for(const id of ids){const voters=(f.tally.voters[id]||[]).filter(p=>p.avatarId!==null&&p.avatarId!==undefined),count=f.tally.counts[id]||0;if(!count)continue;const group=ctx.el('div','st-voter-group');if(tied)group.append(ctx.el('p','st-voter-film',ctx.option(id).title));const voted=ctx.el('div','st-ticket-voters'),display={...f.tally,voters:{...f.tally.voters,[id]:voters}};voted.append(ctx.crowd(display,id,{mine:false,max:tied?voters.length:6}),ctx.el('span','',count+(count===1?' stem':' stemmen')));group.append(voted);host.append(group)}}
function featureEntry(ctx,v){const {el}=ctx;const f=feature(ctx);const item=el('article','st-ballot-item is-feature');

 if(!f.o){item.append(el('h2','st-ballot-title','Nog geen film'),el('p','st-ballot-meta','De finale heeft nog geen stemmen.'));return item}
 item.append(f.contenders.length>1?tiedCard(ctx,f):cardC(ctx,f));return item}

function nextEntry(ctx){const {el,vote}=ctx;const o=ctx.option(vote.own.next),tally=vote.next;const item=el('article','st-ballot-item is-next');
 item.append(el('h3','st-kicker','De volgende ronde'));const r=el('div','st-ballot-row');r.append(poster(ctx,o));const copy=el('div','st-ballot-copy');
 if(!o)copy.append(el('h2','st-ballot-title','Niet meer beschikbaar'));else{copy.append(el('h2','st-ballot-title',o.title));if(tally)copy.append(ctx.crowd(tally,o.id,{mine:true,max:6}))}
 r.append(copy);item.append(r);return item}

/* The trial switch: B · C, under the card. Rebuilds the left column only. */
function switcher(ctx,current,onPick){const {el}=ctx;const s=el('div','st-variants');s.append(el('span','st-kicker','Proef'));
 for(const v of VARIANTS){const b=el('button','st-variant'+(v===current?' is-on':''),v.toUpperCase());b.type='button';b.setAttribute('aria-pressed',String(v===current));b.title=NAMES[v];b.onclick=()=>{try{localStorage.setItem(VKEY,v)}catch{}onPick(v)};s.append(b)}
 s.append(el('span','st-variant-name',NAMES[current]));return s}

/* Local-only composition editor. Never writes votes or remounts the native canvas. */
function mountCatPositioner(container,cat){
 if(!new URLSearchParams(location.search).has('cat-layout'))return;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);n.className=cls||'';if(text)n.textContent=text;return n};
 const figure=cat.querySelector('figure'),original=cat.getAttribute('style'),originalFigure=figure.getAttribute('style');
 const key='filmmaand-cat-position-v1:'+innerWidth;let editing=true,gesture=null,box=null,rotationApp=null;
 const toolbar=el('aside','cat-layout-toolbar');toolbar.setAttribute('aria-label','Kat positioneren');
 const toggle=el('button','','Klaar'),copy=el('button','','Kopieer positie'),reset=el('button','','Herstel');
 const status=el('output','cat-layout-status');status.setAttribute('aria-live','polite');
 for(const b of [toggle,copy,reset])b.type='button';const angleLabel=el('label','cat-layout-angle','Draaiing '),angle=el('input'),angleValue=el('output','','−36°');angle.type='range';angle.min='-180';angle.max='180';angle.step='1';angle.value='-36';angle.disabled=true;angle.setAttribute('aria-label','Beginrotatie van de kat');angleLabel.append(angle,angleValue);const tiltLabel=el('label','cat-layout-angle','Kanteling '),tilt=el('input'),tiltValue=el('output','','27°');tilt.type='range';tilt.min='-18';tilt.max='81';tilt.step='1';tilt.value='27';tilt.disabled=true;tilt.setAttribute('aria-label','Kanteling omhoog of omlaag');tiltLabel.append(tilt,tiltValue);toolbar.append(toggle,angleLabel,tiltLabel,copy,reset,status);container.append(toolbar);
 const overlay=el('div','cat-layout-overlay');overlay.tabIndex=0;overlay.setAttribute('role','group');overlay.setAttribute('aria-label','Verplaats de kat met slepen of de pijltjestoetsen');
 const handle=el('button','cat-layout-handle','↘');handle.type='button';handle.setAttribute('aria-label','Vergroot of verklein de kat met slepen of de pijltjestoetsen');overlay.append(handle);cat.append(overlay);
 const snapshot=()=>{let r=cat.getBoundingClientRect(),c=container.getBoundingClientRect(),f=figure.getBoundingClientRect();return {x:r.left-c.left,y:r.top-c.top,width:f.width,height:f.height,rotationDegrees:5,tiltDegrees:5}};
 const payload=()=>({version:1,layout:'A',viewport:{width:innerWidth,height:innerHeight},container:{width:Math.round(container.clientWidth),height:Math.round(container.clientHeight)},position:{x:Math.round(box.x),y:Math.round(box.y),width:Math.round(box.width),height:Math.round(box.height)},rotationDegrees:box.rotationDegrees,rotationAxis:'camera yaw, degrees',tiltDegrees:box.tiltDegrees,tiltAxis:'camera pitch, degrees',xPercent:+(box.x/container.clientWidth*100).toFixed(3),source:location.pathname,anchor:'top-left of '+(container.classList.contains('st-bedankt-grid')?'.st-bedankt-grid':'.composition')});
 function applyRotation(){const degrees=Number.isFinite(box.rotationDegrees)?box.rotationDegrees:5;box.rotationDegrees=Math.max(-180,Math.min(180,degrees));angle.value=String(box.rotationDegrees);angleValue.textContent=box.rotationDegrees+'°';const pitch=Number.isFinite(box.tiltDegrees)?box.tiltDegrees:5;box.tiltDegrees=Math.max(-18,Math.min(81,pitch));tilt.value=String(box.tiltDegrees);tiltValue.textContent=box.tiltDegrees+'°';if(rotationApp){rotationApp.uc.y=box.tiltDegrees*Math.PI/180;rotationApp.Y.y=rotationApp.uc.y;const radians=box.rotationDegrees*Math.PI/180;rotationApp.uc.x=radians;rotationApp.Y.x=radians;rotationApp.Sa()}}
 const onReady=window.__homePuddingReady;window.__homePuddingReady=app=>{onReady?.(app);rotationApp=app;angle.disabled=false;tilt.disabled=false;applyRotation()};angle.oninput=()=>{box.rotationDegrees=Number(angle.value);applyRotation();persist()};tilt.oninput=()=>{box.tiltDegrees=Number(tilt.value);applyRotation();persist()};
 function persist(){try{localStorage.setItem(key,JSON.stringify(box))}catch{}}
 function apply(){box.width=Math.max(70,Math.min(container.clientWidth,box.width));box.height=Math.max(60,Math.min(700,box.height));box.x=Math.max(0,Math.min(container.clientWidth-box.width,box.x));box.y=Math.max(0,box.y);Object.assign(cat.style,{position:'absolute',left:box.x+'px',top:box.y+'px',right:'auto',bottom:'auto',width:box.width+'px',maxWidth:'none',margin:'0',gridArea:'auto'});Object.assign(figure.style,{width:'100%',height:box.height+'px'});status.textContent=Math.round(box.width)+' × '+Math.round(box.height)+' · '+Math.round(box.x)+', '+Math.round(box.y);}
 box=snapshot();try{const saved=JSON.parse(localStorage.getItem(key));if(saved&&['x','y','width','height'].every(k=>Number.isFinite(saved[k])))box=saved}catch{}apply();applyRotation();
 function mode(){overlay.hidden=!editing;toggle.textContent=editing?'Klaar':'Verplaatsen';toggle.setAttribute('aria-pressed',String(editing));cat.classList.toggle('cat-layout-editing',editing)}mode();
 toggle.onclick=()=>{editing=!editing;mode();persist()};
 reset.onclick=()=>{if(original===null)cat.removeAttribute('style');else cat.setAttribute('style',original);if(originalFigure===null)figure.removeAttribute('style');else figure.setAttribute('style',originalFigure);box=snapshot();apply();applyRotation();try{localStorage.removeItem(key)}catch{}editing=true;mode()};
 overlay.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();gesture={x:e.clientX,y:e.clientY,box:{...box},resize:e.target===handle};overlay.setPointerCapture(e.pointerId)});
 overlay.addEventListener('pointermove',e=>{if(!gesture)return;const dx=e.clientX-gesture.x,dy=e.clientY-gesture.y;if(gesture.resize){const ratio=gesture.box.width/gesture.box.height,delta=Math.abs(dx)>Math.abs(dy*ratio)?dx:dy*ratio;box.width=gesture.box.width+delta;box.height=box.width/ratio}else{box.x=gesture.box.x+dx;box.y=gesture.box.y+dy}apply()});
 const end=()=>{gesture=null;persist()};overlay.addEventListener('pointerup',end);overlay.addEventListener('pointercancel',end);
 overlay.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;e.preventDefault();const d=(e.shiftKey?10:1)*(['ArrowLeft','ArrowUp'].includes(e.key)?-1:1);if(e.target===handle){const ratio=box.width/box.height;box.width+=d;box.height=box.width/ratio}else box[['ArrowLeft','ArrowRight'].includes(e.key)?'x':'y']+=d;apply();persist()});
 copy.onclick=async()=>{persist();const text=JSON.stringify(payload(),null,2);try{await navigator.clipboard.writeText(text);status.textContent='Gekopieerd'}catch{let field=toolbar.querySelector('textarea');if(!field){field=el('textarea','cat-layout-export');field.readOnly=true;field.setAttribute('aria-label','Positie om te kopiëren');toolbar.append(field)}field.value=text;field.focus();field.select();status.textContent='Kopieer de geselecteerde tekst'}};
}

/* ---------- the screen ---------- */
window.renderBedankt=function(ctx){
 const {el,vote,reduced}=ctx;const own=vote.own,planned=!!vote.round.planned;
 const s=el('section','st-stage st-bedankt');s.dataset.planned=String(planned);const grid=el('div','st-bedankt-grid');

 const ballot=el('aside','st-ballot');ballot.setAttribute('aria-label','De filmavond');
 const fill=v=>{s.dataset.layout=v;ballot.dataset.variant=v;ballot.replaceChildren(featureEntry(ctx,v));if(SHOW_NEXT)ballot.append(nextEntry(ctx));};fill(variant());

 const confirm=el('div','st-confirm');
 const heading=el('h1','st-confirm-title');heading.append(el('span','st-heading-first','Bedankt'),el('span','st-heading-middle',' voor'),el('span','st-heading-last',' je stem.'));confirm.append(checkMark(el,reduced),heading);
 const savedTitle=ctx.option(own.final)?.title;const saved=el('p','st-saved-choice',savedTitle?'Je stem op '+savedTitle+' is bewaard.':'Je stem is bewaard.');confirm.append(saved);
 const lead=el('p','st-confirm-lead',confirmationCopy(ctx));confirm.append(lead);
 const w=when(own.updatedAt);if(w){const t=el('time','st-confirm-when','Geregistreerd '+w.date+', '+w.time+' uur');t.dateTime=w.iso;confirm.append(t)}

 const pudding=el('section','st-bedankt-pudding');pudding.setAttribute('aria-label','Speel met de pudding');
 const kit=el('div','st-bedankt-pudding-kit');pudding.append(kit);

 const actions=el('div','st-confirm-actions');actions.append(ctx.button('Naar het programma',null,ctx.agendaHref));if(!planned)actions.append(ctx.textLink('Stem wijzigen',ctx.changeVote));

 const attendance=el('div','st-confirm-attendance');const refreshAttendance=()=>{attendance.replaceChildren();appendVoters(ctx,attendance,feature(ctx))};refreshAttendance();confirm.append(actions,attendance);grid.append(ballot,confirm,pudding);if(ctx.preview){const preview=el('aside','st-preview-notice');preview.setAttribute('role','note');preview.append(el('strong','','Voorbeeld'),el('span','','Fictieve datum en stemmen · geen echte planning.'));const link=el('a','','Naar de echte stemming →');link.href='/filmmaand/stemmen/';preview.append(link);s.append(preview);}s.append(grid);
 s.updateBedankt=next=>{ctx=next;lead.textContent=confirmationCopy(ctx);fill(ballot.dataset.variant||variant());refreshAttendance();const title=ctx.option(ctx.vote.own.final)?.title;saved.textContent=title?'Je stem op '+title+' is bewaard.':'Je stem is bewaard.';const stamp=when(ctx.vote.own.updatedAt),node=confirm.querySelector('.st-confirm-when');if(stamp&&node){node.dateTime=stamp.iso;node.textContent='Geregistreerd '+stamp.date+', '+stamp.time+' uur';}};
 queueMicrotask(()=>{if(kit.isConnected){ctx.mountPudding(kit,{copy:false});const ready=window.__homePuddingReady;window.__homePuddingReady=app=>{ready?.(app);app.uc.x=app.Y.x=5*Math.PI/180;app.uc.y=app.Y.y=5*Math.PI/180;app.Sa()};mountCatPositioner(grid,pudding)}});
 return s};
})();
