// Optional playful ratings, separate from IMDb. Example: redball:{score:99,label:'Red Ball'}
window.pickerCustomScores ||= {};
/* Collection presentation only. The picker owns identity, hearts, saves and suggestions. */
(() => {
  'use strict';
  const page = document.querySelector('#films');
  const controls = [...page.querySelectorAll('[data-films-view]')];
  const filter = page.querySelector('.films-filter');
  const query = page.querySelector('#films-query');
  const resultCount = page.querySelector('.films-result-count');
  let view = 'feature', context = null, catalogue = null, activeDate = '', lastCalendarDate = '', addOpen = false, addBaseline = null, showAllProposals = false;

  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  let sideTab='next',planningOpen=false,addReturnFocus='',addReturnNode=null,addScroll=0;
  const railQueries = {programme:'', suggestions:''};
  const normalise = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('nl');
  document.addEventListener('click',async event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const link=event.target.closest('a[href]');if(!link||link.hasAttribute('download')||(link.target&&link.target!=='_self')||!context?.plan)return;
    const url=new URL(link.href,location.href);if(url.origin!==location.origin||!/^\/filmmaand\/films\/?$/.test(url.pathname))return;
    const id=url.searchParams.get('film'),option=context.plan.options.find(o=>o.id===id);if(!option)return;
    event.preventDefault();await openOption(option);
    if(context.plan.options[context.current]?.id===id)history.replaceState(history.state,'',url.pathname+url.search+url.hash);
  });


  function setView(next) {
    view = next;
    const host = context?.host;
    const column = host?.querySelector('.hp-dates');
    const save = host?.querySelector('.hp-autosave');
    if(save&&column){if(view==='feature')column.querySelector('.films-calendar-save').append(save);else host.append(save);}
    const proposals=host?.querySelector('.films-proposals');
    if(proposals){proposals.hidden=true;if(view==='feature')column.querySelector('.films-social-planning')?.append(proposals);else host.insertBefore(proposals,catalogue);}
    page.classList.toggle('films-all', view === 'all');
    controls.forEach(button => {button.setAttribute('aria-pressed', String(view === 'all'));button.textContent=view==='all'?'Terug naar film':'Alle films';});
    filter.hidden = view !== 'all';
    if (catalogue) catalogue.hidden = view !== 'all';
    applySideTab();
    const modal=host?.querySelector('.films-add-panel');
    if(modal){if(addOpen&&!modal.open)modal.showModal();else if(!addOpen&&modal.open)modal.close();}
  }
  controls.forEach(button => button.addEventListener('click', () => {addOpen=false;setView(view==='all'?'feature':'all');}));

  function propose() {
    const target=context?.host.querySelector('.hp-suggest');if(!target)return;
    if(!addOpen){addBaseline=context.suggestedId;addReturnNode=document.activeElement;addReturnFocus=addReturnNode?.dataset.focus||'';addScroll=0;const done=target.querySelector('.hp-suggest-done');if(done)done.hidden=true;}
    addOpen=true;setView(view);
    target.querySelector('[data-focus="movie-query"], [data-focus="suggest-title"], [data-focus="suggest-send"]')?.focus({preventScroll:true});
  }
  function closeAdd(){
    addOpen=false;setView(view);
    const origin=[...page.querySelectorAll('[data-focus]')].find(n=>n.dataset.focus===addReturnFocus);
    (addReturnNode?.isConnected?addReturnNode:origin||page.querySelector('.films-add-launcher')||controls[0])?.focus({preventScroll:true});
  }

  function revealFeature() {
    if(document.body.classList.contains('has-first-visit'))return;
    const scene=context?.host.querySelector('.hp-scene');
    const description=context?.host.querySelector('.hp-description');
    if(!scene)return;
    const top=scene.getBoundingClientRect().top;
    const bottom=(description||scene).getBoundingClientRect().bottom;
    const breathing=Math.min(96,innerHeight*.1);
    if(top>=breathing&&bottom<=innerHeight-32)return;
    window.scrollTo({top:Math.max(0,scrollY+top-breathing),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  }
  // Reuse canonical navigation, then reveal the decoded selection with breathing room.
  page.addEventListener('click',event=>{
    const button=event.target.closest('.hp-option-view,.hp-personal-view');
    if(!button||!context||event.defaultPrevented)return;
    const id=button.closest('[data-option-id]')?.dataset.optionId||button.dataset.focus?.replace(/^chosen-/,'');
    const option=context.plan.options.find(o=>o.id===id);if(!option)return;
    event.preventDefault();event.stopPropagation();void openOption(option);
  },true);

  let requestedFilmId=null,selectionRun=0;
  function browsingOrder(){
    const ids=[...context.host.querySelectorAll('.hp-collection .hp-option[data-option-id]')].map(card=>card.dataset.optionId);
    return ids.length?[...new Set(ids)].map(id=>context.plan.options.find(o=>o.id===id)).filter(Boolean):collectionOrder(context.plan.options);
  }
  page.addEventListener('click',event=>{
    const arrow=event.target.closest('.hp-arrows [data-focus]');
    if(!arrow||!context||event.defaultPrevented)return;
    const direction=arrow.dataset.focus==='browse-1'?1:arrow.dataset.focus==='browse--1'?-1:0;
    if(!direction)return;
    const order=browsingOrder(),currentId=requestedFilmId||context.plan.options[context.current]?.id;
    const index=order.findIndex(o=>o.id===currentId);if(index<0||!order.length)return;
    event.preventDefault();event.stopPropagation();
    const focus=arrow.dataset.focus;
    void openOption(order[(index+direction+order.length)%order.length],{scroll:false}).then(()=>context.host.querySelector('[data-focus="'+focus+'"]')?.focus({preventScroll:true}));
  },true);

  async function openOption(option,{scroll=true}={}) {
    if (!context) return;
    const index = context.plan.options.findIndex(item => item.id === option.id);
    if (index < 0) return;
    const run=++selectionRun;requestedFilmId=option.id;
    await context.browseTo(index);
    if(run!==selectionRun)return;
    requestedFilmId=null;
    // Image decoding errors leave the canonical picker on its prior option with an error.
    if (context.plan.options[context.current]?.id !== option.id) return;
    addOpen=false;setView('feature');
    const heading = context.host.querySelector('.hp-caption h2');
    if (heading) {
      heading.tabIndex = -1;
      heading.focus({preventScroll: true});
      if(scroll)revealFeature();
    }
  }

  function filterCards() {
    if (!catalogue) return;
    const term = normalise(query.value.trim());
    let shown = 0;
    for (const card of catalogue.querySelectorAll('.films-card')) {
      card.hidden = (!!term && !card.dataset.search.includes(term)) || (!!page.querySelector('#films-liked')?.checked&&!card.classList.contains('selected'));
      if (!card.hidden) shown++;
    }
    for (const group of catalogue.querySelectorAll('.films-group')) {
      group.hidden = ![...group.querySelectorAll('.films-card')].some(card => !card.hidden);
    }
    catalogue.querySelector('.films-empty').hidden = shown > 0;
    resultCount.textContent = shown + (shown === 1 ? ' programma' : ' programma’s');
  }
  query.addEventListener('input', filterCards);
  page.querySelector('#films-liked')?.addEventListener('change',filterCards);
  page.addEventListener('click',event=>{const heart=event.target.closest('.hp-heart');if(heart)queueMicrotask(()=>{filterCards();if(!context)return;const id=heart.dataset.optionId,liked=heart.getAttribute('aria-pressed')==='true';context.choices=liked?[...new Set([...context.choices,id])]:context.choices.filter(x=>x!==id);refreshSocial(context);renderRailLikers(context);const next=context.host.querySelector('.films-next-pane');if(next){window.renderFilmsNext(next,context,{open:o=>openOption(o),browse:()=>setView('all')});renderCutoff(context);}});});
  page.querySelector('.films-proposals-jump')?.addEventListener('click',()=>{addOpen=false;planningOpen=true;sideTab='social';setView('feature');applySideTab();const planning=context?.host.querySelector('.films-social-planning');if(planning)planning.open=true;context?.host.querySelector('.films-proposals')?.scrollIntoView({block:'start',behavior:'instant'});});

  function cardFor(option, ctx) {
    const card = el('article', 'films-card hp-option'+(FilmsSocialModel.completedIds(ctx.plan).has(option.id)?' is-watched':''));
    card.dataset.optionId = option.id;
    card.classList.toggle('selected', ctx.choices.includes(option.id));
    const notes = window.pickerProgrammeNotes?.[option.id];
    card.dataset.search = normalise([option.title, option.detail, option.recommender?.name,
      ...(option.movie?.directors || []), ...(option.movie?.genres || []),
      ...(notes?.films || []).flatMap(film => [film.title, film.director])].join(' '));
    const open = el('button', 'films-card-open');
    open.type = 'button';
    open.dataset.focus = 'films-open-' + option.id;
    open.setAttribute('aria-label', 'Bekijk ' + option.title);
    open.addEventListener('click', () => openOption(option));
    // Distinct image role keeps the picker's decoded image pool from moving rail/hero nodes.
    open.append(ctx.cover(option, 'films-grid'), el('h3', '', option.title));
    card.append(open);
    const detail = option.movie
      ? [option.movie.year, option.movie.runtime ? option.movie.runtime + ' min' : null, ...(option.movie.genres || []).slice(0, 2)].filter(Boolean).join(' · ')
      : option.detail;
    if (detail) card.append(el('p', 'films-card-detail', detail));
    const foot = el('div', 'films-card-foot');
    foot.append(ctx.heartButton(option, 'films-heart', 'films-heart-' + option.id));
    const count = ctx.plan.optionCounts?.[option.id] || 0;
    foot.append(el('span','films-card-likes',count===1?'1 hartje':count+' hartjes'));
    card.append(foot);
    const badge = ctx.recommenderBadge(option, true);
    if (badge) card.append(badge);
    return card;
  }

  function avatarRow(people,limit=4,cls=''){
    const row=el('span','films-avatars '+cls);
    for(const person of people.slice(0,limit)){const avatar=window.filmmaandAvatarOptions?.find(a=>a.id===person.avatarId);if(avatar){const image=el('img');image.src=avatar.src;image.alt=person.name||'Zonder naam';image.title=person.name||'Zonder naam';if(avatar.filter)image.style.filter=avatar.filter;row.append(image);}else{const anonymous=el('span','films-anonymous','?');anonymous.title='Zonder profiel';row.append(anonymous);}}
    if(people.length>limit)row.append(el('span','films-avatar-more','+'+(people.length-limit)));
    return row;
  }
  // One viewport-level label avoids the banner crop and transformed sticker parents.
  let bannerName=null,bannerFace=null;
  function hideBannerName(){
    if(bannerFace){bannerFace.removeAttribute('aria-describedby');bannerFace.classList.remove('is-name-open');}
    bannerFace=null;
    if(bannerName){if(bannerName.hasAttribute('popover')&&bannerName.matches(':popover-open'))bannerName.hidePopover();bannerName.hidden=true;}
  }
  function showBannerName(face,event){
    if(!face?.isConnected)return;
    if(bannerFace&&bannerFace!==face){bannerFace.removeAttribute('aria-describedby');bannerFace.classList.remove('is-name-open');}
    if(!bannerName){bannerName=el('div','films-avatar-tooltip');bannerName.id='films-banner-avatar-name';bannerName.setAttribute('role','tooltip');if(typeof bannerName.showPopover==='function')bannerName.setAttribute('popover','manual');document.body.append(bannerName);}
    bannerFace=face;bannerName.textContent=face.getAttribute('aria-label');face.setAttribute('aria-describedby',bannerName.id);bannerName.hidden=false;
    if(bannerName.hasAttribute('popover')&&!bannerName.matches(':popover-open'))bannerName.showPopover();
    const box=face.getBoundingClientRect(),pointer=event&&event.pointerType!=='touch'&&(event.clientX||event.clientY),x=pointer?event.clientX:box.left+box.width/2,y=pointer?event.clientY:box.bottom;
    const width=bannerName.offsetWidth,height=bannerName.offsetHeight,gap=12;
    bannerName.style.left=Math.max(8,Math.min(innerWidth-width-8,x+gap))+'px';
    bannerName.style.top=Math.max(8,Math.min(innerHeight-height-8,y+gap+height>innerHeight-8?y-height-gap:y+gap))+'px';
  }
  document.addEventListener('pointerdown',event=>{if(bannerFace&&!event.target.closest('.films-poster-people,.films-tile-likers,.films-tile-likers-names'))hideBannerName();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape')hideBannerName();});
  document.addEventListener('scroll',hideBannerName,true);window.addEventListener('resize',hideBannerName);
  function isProposer(person,option){return person.self===true&&option.recommender?.self===true;}
  function likerPeople(ctx,option){
    const model=FilmsSocialModel.project(ctx,new Date().toISOString().slice(0,10)),people=model.fans(option);
    if(option.proposerOnlyLiker===true&&model.count(option)===1)return [];
    return people;
  }
  function wireLikerNames(row){
    row.addEventListener('click',event=>{event.stopPropagation();const face=event.target.closest('.battle-person');if(!face)return;const wasOpen=face.classList.contains('is-name-open');face.focus({preventScroll:true});if(wasOpen)hideBannerName();else{showBannerName(face,event);face.classList.add('is-name-open');}});
    row.addEventListener('keydown',event=>{event.stopPropagation();if(['Enter',' '].includes(event.key)){event.preventDefault();event.target.closest('.battle-person')?.click();}if(event.key==='Escape')hideBannerName();});
    row.addEventListener('pointermove',event=>{if(event.pointerType!=='touch'){const face=event.target.closest('.battle-person');if(face)showBannerName(face,event);}});
    row.addEventListener('pointerleave',()=>{if(!bannerFace?.classList.contains('is-name-open'))hideBannerName();});
    row.addEventListener('focusin',event=>showBannerName(event.target.closest('.battle-person')));
    row.addEventListener('focusout',event=>{if(!row.contains(event.relatedTarget))hideBannerName();});
  }
  function renderRailLikers(ctx){
    for(const card of ctx.host.querySelectorAll('.hp-rail .hp-option')){
      card.querySelector('.films-tile-likers')?.remove();
      const option=ctx.plan.options.find(o=>o.id===card.dataset.optionId);if(!option)continue;
      const people=likerPeople(ctx,option).filter(p=>!p.self||isProposer(p,option));if(!people.length)continue;
      const row=el('div','films-tile-likers');row.setAttribute('role','group');row.setAttribute('aria-label','Vinden dit leuk');
      for(const p of people.slice(0,3)){
        const face=el('button','battle-person');face.type='button';face.setAttribute('aria-label',p.self?'Jij'+(p.name?' · '+p.name:''):p.name||'Zonder naam');
        const avatar=window.filmmaandAvatarOptions?.find(a=>a.id===p.avatarId);
        if(avatar){const image=el('img');image.src=avatar.src;image.alt='';if(avatar.filter)image.style.filter=avatar.filter;face.append(image);}else face.append(document.createTextNode((p.name||'?').slice(0,1).toUpperCase()));row.append(face);
      }
      if(people.length>3){const more=el('button','battle-person films-likers-more','+'+(people.length-3));more.type='button';more.setAttribute('aria-label',people.slice(3).map(p=>p.self?'Jij':p.name||'Zonder naam').join(', '));row.append(more);}
      wireLikerNames(row);card.append(row);
    }
  }
  function renderPosterSupporters(ctx){
    hideBannerName();
    const option=ctx.plan.options[ctx.current],scene=ctx.host.querySelector('.hp-scene');
    ctx.host.querySelector('.hp-scene>.hp-supporters')?.remove();
    if(!scene)return;
    const total=ctx.plan.optionCounts?.[option.id]||0;if(!total)return;
    const people=likerPeople(ctx,option);if(!people.length)return;
    const profiled=people.filter(p=>window.filmmaandAvatarOptions?.some(a=>a.id===p.avatarId));
    const ordered=[...profiled.filter(p=>p.self),...profiled.filter(p=>!p.self)];
    const row=el('div','films-poster-people');row.setAttribute('role','group');row.setAttribute('aria-label',total+' vinden dit leuk');
    function sticker(label,person){const face=el('span','battle-person'+(person?.self?' battle-own':''));face.tabIndex=0;face.setAttribute('role','button');face.setAttribute('aria-label',label);face.append(el('span','battle-name',label));return face;}
    for(const person of ordered){const label=(person.self?'Jij'+(person.name?' · '+person.name:''):person.name||'Zonder naam'),face=sticker(label,person),avatar=window.filmmaandAvatarOptions.find(a=>a.id===person.avatarId),img=el('img');img.src=avatar.src;img.alt='';if(avatar.filter)img.style.filter=avatar.filter;face.append(img);row.append(face);}
    for(const person of people.filter(p=>!window.filmmaandAvatarOptions?.some(a=>a.id===p.avatarId))){const face=sticker(person.name||'Zonder naam',person);face.classList.add('battle-initial');face.append(document.createTextNode((person.name||'?').slice(0,1).toUpperCase()));row.append(face);}

    wireLikerNames(row);
    scene.append(row);
  }

  function renderProposals(ctx,parent){
    const section=el('section','films-proposals');section.setAttribute('aria-label','Voorgestelde filmavonden');
    const groups=ctx.proposal.view?.proposals||[];
    const badge=page.querySelector('[data-proposal-count]');if(badge)badge.textContent=String(groups.length);
    const top=el('div','films-proposals-heading');top.append(el('h3','','Voorgestelde avonden'),el('span','',String(groups.length)));section.append(top);
    if(!groups.length)section.append(el('p','films-proposals-empty','Nog geen filmavond voorgesteld.'));
    const own=ctx.proposal.view?.own;
    for(const group of (showAllProposals?groups:groups.slice(0,3))){
      const option=ctx.plan.options.find(o=>o.id===group.optionId);if(!option)continue;
      const row=el('article','films-proposal-row'),open=action('','films-proposal-open',async()=>{activeDate=group.date;lastCalendarDate=ctx.calendarLast||'';await openOption(option);context?.host.querySelector('.films-night-panel')?.scrollIntoView({block:'center',behavior:'instant'});},'proposal-open-'+group.optionId+'-'+group.date);
      open.setAttribute('aria-label','Bekijk voorstel '+option.title+' op '+dateLabel(group.date));
      open.append(ctx.cover(option,'proposal-'+group.date));const copy=el('span','films-proposal-copy');copy.append(el('strong','',option.title),el('span','',dateLabel(group.date)));open.append(copy);row.append(open);
      const isOwn=own?.optionId===group.optionId&&own?.date===group.date;
      const meta=el('div','films-proposal-meta');meta.append(avatarRow(group.people||[]),el('span','',isOwn?(group.count===1?'Jouw voorstel':'Ook jouw voorstel'):group.count===1?'1 voorstel':group.count+' voorstellen'));row.append(meta);
      const names=(group.people||[]).map(p=>p.name||'Zonder profiel').join(', ');if(names)meta.title=names;
      if(isOwn){const cancel=action('Intrekken','films-proposal-cancel',()=>ctx.proposal.submit(null,null),'proposal-list-withdraw');cancel.disabled=ctx.proposal.busy||ctx.proposal.pending;row.append(cancel);}
      section.append(row);
    }
    if(groups.length>3){const more=action(showAllProposals?'Minder tonen':'Alle '+groups.length+' voorstellen','films-proposals-more',()=>{showAllProposals=!showAllProposals;const holder=section.parentNode,next=section.nextSibling;section.remove();renderProposals(ctx,holder);holder.insertBefore(holder.lastElementChild,next);},'proposals-more');section.append(more);}
    parent.append(section);
  }
  function renderAdd(ctx){
    if(ctx.suggestionPending)addOpen=true;
    const form=ctx.host.querySelector('.hp-suggest');if(!form)return;
    const panel=el('dialog','films-add-panel');panel.setAttribute('aria-label','Film toevoegen');panel.id='films-add-dialog';
    const close=action('Sluiten ×','films-add-back',closeAdd,'add-back');
    panel.append(close,form);
    panel.addEventListener('keydown',event=>{if(event.key!=='Escape')return;const expanded=event.target.closest('[role=combobox]')?.getAttribute('aria-expanded')==='true';if(!expanded){event.preventDefault();event.stopPropagation();closeAdd();}},true);
    panel.addEventListener('cancel',event=>{event.preventDefault();closeAdd();});
    panel.addEventListener('click',event=>{if(event.target===panel){const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)closeAdd();}});
    panel.addEventListener('scroll',()=>{addScroll=panel.scrollTop;});
    const eyebrow=form.querySelector('.hp-suggest-intro .eyebrow');if(eyebrow)eyebrow.textContent='Film toevoegen';
    const send=form.querySelector('[data-focus="suggest-send"]');if(send&&!send.disabled&&!ctx.suggestionPending)send.textContent=form.querySelector('[data-focus="suggest-mode-theme"][aria-pressed="true"]')?'Thema toevoegen':'Film toevoegen';
    refineAddForm(form);
    const done=form.querySelector('.hp-suggest-done');
    if(done&&(!addOpen||ctx.suggestedId===addBaseline))done.hidden=true;
    if(done&&!done.hidden)form.insertBefore(done,form.querySelector('.hp-suggestion-editor'));
    ctx.host.prepend(panel);
    if(addOpen){panel.showModal();panel.scrollTop=addScroll;}
  }

  // C Soft changes presentation only; fields keep their canonical handlers.
  function refineAddForm(form) {
    form.querySelector('.hp-suggest-intro')?.remove();
    form.closest('dialog').setAttribute('aria-label','Film toevoegen');
    const search=form.querySelector('[data-focus="movie-query"]');
    if(search)search.placeholder='Welke film wil je voorstellen?';
    const note=form.querySelector('[data-focus="suggest-detail"]');
    if(note){
      note.rows=2;note.placeholder='Bijvoorbeeld: deze wil ik met jullie zien.';
      if(note.parentNode.firstChild?.nodeType===Node.TEXT_NODE)note.parentNode.firstChild.textContent='Een bericht erbij (optioneel)';
    }
    const chosen=form.querySelector('.hp-chosen-movie');
    if(chosen){
      const copy=el('div','films-chosen-copy');
      for(const child of [...chosen.children])if(!child.classList.contains('hp-chosen-poster'))copy.append(child);
      chosen.append(copy);
      const fallback=()=>{if(!chosen.querySelector('.films-poster-fallback')){const empty=el('span','films-poster-fallback','Geen poster');empty.setAttribute('aria-hidden','true');chosen.prepend(empty);}};
      const poster=chosen.querySelector('.hp-chosen-poster');
      if(poster)poster.addEventListener('error',fallback,{once:true});else fallback();
    }
    const send=form.querySelector('[data-focus="suggest-send"]');
    if(send){
      const row=el('div','films-submit-row'),caption=send.nextElementSibling;
      if(caption?.classList.contains('ci-note')){caption.textContent='Je voorstel verschijnt voor iedereen.';row.append(caption);}
      send.parentNode.append(row);row.append(send);
    }
    form.querySelector('[data-focus="existing-movie"]')?.addEventListener('click',()=>{addOpen=false;setView('feature');});
  }

  // Collection display only; canonical option order still determines ballot ties.
  function collectionOrder(items, idOf=item=>item.id) {
    const promoted=['horror','anime'].map(id=>items.find(item=>idOf(item)===id)).filter(Boolean);
    const rest=items.filter(item=>!promoted.includes(item));
    return [...rest.slice(0,3),...promoted,...rest.slice(3)];
  }

  function renderRailSearch(ctx) {
    for(const section of ctx.host.querySelectorAll('.hp-collection')){
      const key=section.dataset.collection,rail=section.querySelector('.hp-rail'),top=section.querySelector('.hp-collection-title');
      if(!rail||!top||!(key in railQueries))continue;
      if(key==='suggestions')top.querySelector('h3').textContent='Suggesties';
      const oldAdd=top.querySelector('[data-focus="open-suggestion"]');if(oldAdd)oldAdd.remove();
      const search=el('div','films-rail-search'),label=el('label','',key==='programme'?'Zoek films & activiteiten':'Zoek suggesties'),input=el('input');
      input.type='search';input.id='films-search-'+key;input.dataset.focus=input.id;input.placeholder='Zoeken';input.autocomplete='off';input.value=railQueries[key];label.htmlFor=input.id;
      const count=el('span','films-rail-count');count.setAttribute('role','status');count.setAttribute('aria-live','polite');
      const icon=el('span','films-search-icon');icon.setAttribute('aria-hidden','true');icon.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>';search.append(label,icon,input,count);top.querySelector(':scope > .ci-note')?.remove();top.querySelector('h3').after(search);
      const cards=[...rail.querySelectorAll('.hp-option')];
      if(key==='programme')for(const card of collectionOrder(cards,card=>card.dataset.optionId))rail.append(card);
      const empty=el('p','films-rail-empty','Geen films gevonden.');rail.after(empty);
      if(key==='suggestions'&&ctx.host.querySelector('.hp-suggest')){
        const tile=action('','films-add-tile',propose,'add-film-tile');tile.setAttribute('aria-label','Voeg je eigen film of thema toe');
        tile.append(el('span','films-add-tile-cover','+'),el('span','','Eigen film toevoegen'));rail.prepend(tile);
        section.querySelectorAll(':scope > .ci-note').forEach(n=>n.remove());
      }
      function apply(reset=false){
        const term=normalise(railQueries[key].trim());let shown=0;
        for(const card of cards){const option=ctx.plan.options.find(o=>o.id===card.dataset.optionId),notes=window.pickerProgrammeNotes?.[option?.id];
          const text=normalise([option?.title,option?.detail,option?.recommender?.name,...(option?.movie?.directors||[]),...(option?.movie?.genres||[]),...(notes?.films||[]).flatMap(f=>[f.title,f.director])].join(' '));
          card.hidden=!!term&&!text.includes(term);if(!card.hidden)shown++;
        }
        empty.hidden=shown>0||!term;count.textContent=term?shown+' gevonden':'';
        if(reset)rail.scrollLeft=0;
        rail.dispatchEvent(new Event('scroll'));
      }
      input.addEventListener('input',()=>{railQueries[key]=input.value;apply(true);});apply();
    }
  }

  const dateLabel = value => new Date(value+'T12:00:00').toLocaleDateString('nl-NL',{weekday:'long',day:'numeric',month:'long'});
  function action(text,cls,fn,key){const b=el('button',cls,text);b.type='button';b.onclick=fn;if(key)b.dataset.focus=key;return b;}
  function renderNight(ctx) {
    const column=ctx.host.querySelector('.hp-dates'),option=ctx.plan.options[ctx.current];
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Amsterdam',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const dates=Object.keys(ctx.plan.dateCounts).filter(d=>d>today).sort();
    if(ctx.calendarLast&&ctx.calendarLast!==lastCalendarDate){activeDate=ctx.calendarLast;lastCalendarDate=ctx.calendarLast;}
    if(!dates.includes(activeDate))activeDate=ctx.proposal.view?.own.date&&dates.includes(ctx.proposal.view.own.date)?ctx.proposal.view.own.date:dates.slice().sort((a,b)=>(ctx.plan.dateCounts[b]||0)-(ctx.plan.dateCounts[a]||0)||a.localeCompare(b))[0]||'';
    const effectiveCount=d=>Math.max(0,(ctx.plan.dateCounts[d]||0)-(ctx.savedDates.includes(d)?1:0)+(ctx.dates.includes(d)?1:0));
    const publicSelf=(ctx.plan.people||[]).find(p=>p.self);
    const ownPerson=ctx.ownProfile?{...ctx.ownProfile,self:true}:publicSelf;
    const maxAvailability=Math.max(1,...dates.map(effectiveCount));
    const peopleForDate=d=>[...(ctx.plan.people||[]).filter(p=>!p.self&&(p.dates||[]).includes(d)),...(ownPerson&&ctx.dates.includes(d)?[ownPerson]:[])];
    const programmeDay=FilmsSocialModel.programmeDate;
    const programme=(ctx.plan.programme||[]).filter(n=>programmeDay(n)).slice().sort((a,b)=>programmeDay(a).localeCompare(programmeDay(b)));
    const calendarNights=programme.map(n=>({id:n.id,date:programmeDay(n),pending:n.selection==='pending',title:n.selection==='pending'?'Mysteryavond':n.choices.map(id=>ctx.plan.options.find(o=>o.id===id)?.title||'Filmavond').join(' + ')}));
    const scheduledDate=programmeDay({scheduledDate:ctx.plan.round?.scheduledDate});
    if(scheduledDate&&!calendarNights.some(n=>n.date===scheduledDate&&!n.pending))calendarNights.push({id:'round-'+scheduledDate,date:scheduledDate,title:'Filmavond'});
    const events=calendarNights.map(({date,title})=>({date,title}));

    const surface=el('section','films-night');surface.setAttribute('aria-label','Kalender en beschikbaarheid');
    surface.append(el('span','eyebrow','Samen naar de film'),el('h2','films-night-heading','Wanneer kunnen we?'));
    const calendar=el('div','hp-calendar films-calendar');surface.append(calendar);

    const save=el('div','films-calendar-save');surface.append(save);
    const panel=el('section','films-night-panel');panel.setAttribute('aria-label','Jouw filmavond');surface.append(panel);
    column.prepend(surface);
    ctx.mountCalendar(calendar,{events,dayContent:d=>{const n=effectiveCount(d),tag=el('span','films-day-count');tag.dataset.level=String(n?Math.max(1,Math.ceil(n/maxAvailability*4)):0);tag.setAttribute('aria-hidden','true');const people=peopleForDate(d).filter(person=>!person.self);tag.append(avatarRow(people,people.length,'films-calendar-faces'));return tag;},dayLabel:d=>{const people=peopleForDate(d);return ' · '+effectiveCount(d)+' beschikbaar'+(people.length?' · '+people.map(p=>p.name).join(', '):'');}});
    if(calendarNights.length){const nights=el('div','films-scheduled-cards');for(const night of calendarNights){const actual=programme.find(n=>n.id===night.id),film=actual?.choices?.length===1?ctx.plan.options.find(o=>o.id===actual.choices[0]):null;const entry=film?action('','films-scheduled-card',()=>openOption(film),'scheduled-'+night.id):el('a','films-scheduled-card');if(!film)entry.href='/filmmaand/programma/';entry.setAttribute('aria-label',dateLabel(night.date)+' · '+night.title);const stamp=el('span','films-scheduled-date');stamp.append(el('b','',String(Number(night.date.slice(8)))),el('small','',new Date(night.date+'T12:00:00Z').toLocaleDateString('nl-NL',{month:'short'})));entry.append(stamp,el('span','films-scheduled-title',film?film.title:night.title));nights.append(entry);}surface.append(nights);}
    const legend=el('p','films-calendar-legend','Groen: jij kunt · avatars: wie er kan');calendar.querySelector('.ac-grid').after(legend);
    function paintPanel(){
      panel.replaceChildren();const own=ctx.proposal.view?.own,ownOption=ctx.plan.options.find(o=>o.id===own?.optionId),same=own?.optionId===option.id&&own?.date===activeDate;
      panel.append(el('span','eyebrow','Jouw filmavond'));
      const selection=el('div','films-night-selection');selection.append(ctx.cover(option,'night-selection'));
      const copy=el('div');copy.append(el('h3','',option.title),el('p','films-night-date',activeDate?dateLabel(activeDate):'Geen beschikbare datums'));
      if(activeDate){copy.append(el('p','films-night-own',ctx.dates.includes(activeDate)?'Jij kunt':'Niet in jouw beschikbaarheid'));const n=effectiveCount(activeDate);copy.append(el('p','films-night-group',n+' '+(n===1?'persoon kan':'mensen kunnen')));}
      selection.append(copy);panel.append(selection);
      const people=peopleForDate(activeDate);
      if(people.length){const who=el('div','films-date-people');who.append(avatarRow(people,6),el('span','',people.map(p=>p.name).join(', ')));panel.append(who);}
      const submit=action(ctx.proposal.busy?'Opslaan…':same?'Voorgesteld ✓':own?.optionId?'Vervang je voorstel →':'Stel deze filmavond voor →','films-night-submit',()=>ctx.proposal.submit(option.id,activeDate),'night-propose');
      submit.disabled=!activeDate||same||ctx.proposal.busy||ctx.proposal.pending||!ctx.proposal.view;panel.append(submit);
      if(own?.optionId){const saved=el('div','films-night-saved');saved.setAttribute('role','status');saved.append(el('strong','','Jouw voorstel'),el('p','', (ownOption?.title||own.optionId)+' · '+dateLabel(own.date)),el('span','films-night-unconfirmed','Nog niet ingepland'));
        const cancel=action('Voorstel intrekken','films-night-withdraw',()=>ctx.proposal.submit(null,null),'night-withdraw');cancel.disabled=ctx.proposal.busy||ctx.proposal.pending;saved.append(cancel);panel.append(saved);}
      if(ctx.proposal.error||ctx.proposal.pending){const notice=el('p','films-night-error',ctx.proposal.error||'Je voorstel wacht op bevestiging.');notice.setAttribute('role','status');panel.append(notice);if(ctx.proposal.pending){const retry=action(ctx.proposal.busy?'Controleren…':'Controleer voorstel','films-night-retry',()=>ctx.proposal.submit(null,null),'night-retry');retry.disabled=ctx.proposal.busy;panel.append(retry);}}

    }
    // Delegation survives the shared calendar's own month/selection DOM refresh.
    calendar.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)){const day=document.activeElement?.closest('[data-day]');if(day&&!day.disabled){activeDate=day.dataset.day;paintPanel();}}});
    calendar.addEventListener('pointerdown',event=>{const day=event.target.closest('[data-day]');if(day&&!day.disabled){activeDate=day.dataset.day;paintPanel();}});
    paintPanel();
    renderProposals(ctx,surface);
    renderOverlap(ctx,surface,calendar,peopleForDate,effectiveCount,today);
  }

  function refreshSocial(ctx){const host=ctx.host.querySelector('.films-social-content');if(host)window.renderFilmsSocial(host,ctx,{open:o=>openOption(o),add:propose,browse:()=>setView('all'),planNight:async(o,date)=>{activeDate=date;lastCalendarDate=context.calendarLast||'';planningOpen=true;await openOption(o,{scroll:false});sideTab='social';applySideTab();const section=context.host.querySelector('.films-social-planning');if(section){section.open=true;section.scrollIntoView({block:'center',behavior:'instant'});section.querySelector('.films-night-submit')?.focus({preventScroll:true});}}});renderFriendOrders(ctx);renderSuggestionAuthors(ctx);}
  function applySideTab(){const column=context?.host.querySelector('.hp-dates');if(!column)return;for(const button of column.querySelectorAll('[data-side-tab]')){const selected=button.dataset.sideTab===sideTab;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;}column.querySelector('.films-night').hidden=sideTab!=='availability';column.querySelector('.films-social-pane').hidden=sideTab!=='social';const next=column.querySelector('.films-next-pane');if(next)next.hidden=sideTab!=='next';const add=column.querySelector('.films-add-pane');if(add)add.hidden=sideTab!=='add';}
  function renderSocialTabs(ctx){const column=ctx.host.querySelector('.hp-dates'),availability=column.querySelector('.films-night');column.querySelector('.hp-personal-shelf')?.remove();availability.querySelector(':scope>.eyebrow')?.remove();availability.querySelector(':scope>.films-night-heading')?.remove();availability.id='films-availability-pane';availability.setAttribute('role','tabpanel');availability.setAttribute('aria-labelledby','films-tab-availability');
    const tabs=el('div','films-side-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Samen plannen en ontdekken');
    for(const [id,label] of [['next','Leaderboard'],['social','Samen ontdekken'],['availability','Kalender']]){const b=action(label,'films-side-tab',()=>{sideTab=id;applySideTab();},'side-tab-'+id);b.dataset.sideTab=id;b.id='films-tab-'+id;b.setAttribute('role','tab');b.setAttribute('aria-controls',id==='availability'?'films-availability-pane':id==='social'?'films-social-pane':'films-next-pane');b.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','Home','End'].includes(e.key)){e.preventDefault();e.stopPropagation();const ids=['next','social','availability'];sideTab=e.key==='Home'?ids[0]:e.key==='End'?ids[2]:ids[(ids.indexOf(sideTab)+(e.key==='ArrowRight'?1:2))%3];applySideTab();tabs.querySelector('[data-side-tab="'+sideTab+'"]').focus({preventScroll:true});}});tabs.append(b);}
    const add=action('Film toevoegen','films-side-tab films-add-launcher',propose,'side-tab-add');add.setAttribute('aria-haspopup','dialog');add.setAttribute('aria-controls','films-add-dialog');
    const bar=el('div','films-side-bar');bar.append(tabs,add);
    const social=el('section','films-social-pane');social.id='films-social-pane';social.setAttribute('role','tabpanel');social.setAttribute('aria-labelledby','films-tab-social');social.append(el('div','films-social-content'));
    const planning=el('details','films-social-planning');planning.hidden=true;planning.open=false;planning.append(el('summary','','Een filmavond voorstellen'));planning.addEventListener('toggle',()=>{if(planning.isConnected)planningOpen=planning.open;});for(const node of [availability.querySelector('.films-night-panel'),availability.querySelector('.films-proposals')])if(node)planning.append(node);social.append(planning);
    const next=el('section','films-next-pane');next.id='films-next-pane';next.setAttribute('role','tabpanel');next.setAttribute('aria-labelledby','films-tab-next');column.prepend(bar);column.append(social,next);refreshSocial(ctx);window.renderFilmsNext(next,ctx,{open:o=>openOption(o),browse:()=>setView('all')});renderCutoff(ctx);applySideTab();
  }

  const mountRanking=window.mountFilmsRanking;
  let rankingStatusObserver=null;
  window.mountFilmsRanking=(host,ctx,actions)=>{
    rankingStatusObserver?.disconnect();
    const dispose=mountRanking(host,ctx,actions),result=host.querySelector('.fr-result'),heading=result?.querySelector('h3');
    if(heading){const hint=el('p','films-next-purpose','Voor de volgende stemronde');hint.id='films-next-purpose';heading.setAttribute('aria-describedby',hint.id);heading.title='Deze koplopers vormen de selectie voor de volgende stemronde.';const top=el('div','films-result-heading'),copy=el('div','films-result-heading-copy');result.prepend(top);copy.append(hint,heading);top.append(copy);}
    const current=new Set(ctx.plan.round?.shortlist||[]);
    for(const item of host.querySelectorAll('.fr-personal .fr-item')){
      const handle=item.querySelector('[data-rank-id]');if(!handle||!current.has(handle.dataset.rankId)||item.classList.contains('is-watched'))continue;
      item.classList.add('is-current-ballot');const note=el('a','films-current-ballot','In deze stemronde');note.href='/filmmaand/stemmen/';note.title='Deze film staat al in de huidige stemronde en telt niet mee voor de volgende selectie.';note.setAttribute('aria-label','In deze stemronde. Deze film telt niet mee voor de volgende selectie. Bekijk de huidige stemronde.');note.id='current-ballot-'+handle.dataset.rankId;handle.setAttribute('aria-describedby',note.id);item.querySelector('.fr-film-title')?.after(note);
    }
    const status=host.querySelector('.fr-status');
    function trimSaved(){if(status?.textContent==='Opgeslagen')status.textContent='';}
    trimSaved();const observer=new MutationObserver(trimSaved);if(status)observer.observe(status,{childList:true,characterData:true,subtree:true});rankingStatusObserver=observer;
    return ()=>{observer.disconnect();dispose?.();};
  };
  let cutoffClock=null;
  function renderCutoff(ctx){
    const pane=ctx?.host.querySelector('.films-next-pane'),next=ctx?.plan.nextRound;if(!pane)return;
    if(!next||!['collecting','frozen'].includes(next.status)){pane.removeAttribute('data-selection-status');pane.classList.remove('has-cutoff-tie');pane.querySelector('.films-cutoff')?.remove();pane.querySelector('.films-result-footer')?.remove();pane.querySelector('.films-cutoff-ties')?.remove();pane.querySelector('.films-cutoff-future')?.remove();return;}
    const stamp=Date.parse(ctx.plan.serverTime);if(Number.isFinite(stamp)&&(!cutoffClock||cutoffClock.value!==ctx.plan.serverTime))cutoffClock={value:ctx.plan.serverTime,at:performance.now()};
    const state=FilmsSocialModel.cutoffState(next,cutoffClock?.value,cutoffClock?performance.now()-cutoffClock.at:0);
    pane.dataset.selectionStatus=next.status;pane.classList.toggle('has-cutoff-tie',state.frozen&&state.ties.length>0);
    const result=pane.querySelector('.fr-result');if(!result)return;
    let status=result.querySelector('.films-cutoff');if(!status){status=el('div','films-cutoff');status.append(el('span','films-cutoff-label'),el('time','films-cutoff-time'));(result.querySelector('.films-result-heading')||result).append(status);}
    let footer=result.querySelector('.films-result-footer');if(!footer){footer=el('div','films-result-footer');footer.append(el('p','films-cutoff-detail'));const link=el('a','films-cutoff-current','Nu stemmen ↗');link.href='/filmmaand/stemmen/';link.setAttribute('aria-label','Stem in de huidige ronde');footer.append(link);result.append(footer);}
    footer.querySelector('.films-cutoff-current').hidden=ctx.plan.round?.status!=='open';
    const label=status.querySelector('.films-cutoff-label'),time=status.querySelector('time'),detail=footer.querySelector('.films-cutoff-detail');if(label.textContent!==state.label)label.textContent=state.label;if(time.textContent!==state.time)time.textContent=state.time;time.hidden=!state.time;if(next.closesAt)time.dateTime=next.closesAt;
    const explanation=state.detail||'Jullie punten bepalen de selectie';if(detail.textContent!==explanation)detail.textContent=explanation;
    status.title=Number.isFinite(Date.parse(next.closesAt))?'Sluit '+new Date(next.closesAt).toLocaleString('nl-NL',{timeZone:'Europe/Amsterdam',day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}):'';
    let tieRow=result.querySelector('.films-cutoff-ties');if(state.frozen&&state.ties.length){const key=JSON.stringify([next.snapshot,state.ties]);if(!tieRow||tieRow.dataset.key!==key){tieRow?.remove();tieRow=el('div','films-cutoff-ties');tieRow.dataset.key=key;tieRow.setAttribute('aria-label','Gelijke stand voor de volgende selectie');for(const id of state.ties){const option=ctx.plan.options.find(o=>o.id===id);if(!option)continue;const pick=action('','films-cutoff-tie',()=>openOption(option),'cutoff-tie-'+id);pick.setAttribute('aria-label',option.title+' · '+(next.points[id]||0)+' punten · gelijke stand');pick.append(ctx.cover(option,'cutoff-tie-'+id),el('span','films-cutoff-title',option.title),el('small','',(next.points[id]||0)+' pts'));tieRow.append(pick);}result.append(tieRow);}}else tieRow?.remove();
    let future=pane.querySelector('.films-cutoff-future');if(state.frozen&&!future){future=el('p','films-cutoff-future','Je favorieten tellen verder voor een latere selectie.');pane.querySelector('.fr-personal .fr-heading')?.after(future);}else if(!state.frozen)future?.remove();
  }
  window.setInterval(()=>{if(context&&!document.hidden)renderCutoff(context);},1000);
  document.addEventListener('visibilitychange',()=>{if(context&&!document.hidden)renderCutoff(context);});

  function render(ctx) {
    context = ctx;
    if (!ctx.plan) return;
    renderPosterSupporters(ctx);
    const banner=ctx.host.querySelector('.films-poster-people'),otherLikes=(ctx.plan.people||[]).filter(p=>!p.self&&p.choices?.includes(ctx.plan.options[ctx.current]?.id)).length;
    if(banner&&otherLikes)banner.append(el('span','banner-like-count',otherLikes+' '+(otherLikes===1?'vindt':'vinden')+' dit ook leuk'));
    const selected=ctx.plan.options[ctx.current],scheduled=(ctx.plan.programme||[]).filter(n=>n.choices?.includes(selected?.id)&&FilmsSocialModel.programmeDate(n)).sort((a,b)=>FilmsSocialModel.programmeDate(a).localeCompare(FilmsSocialModel.programmeDate(b)))[0];
    const caption=ctx.host.querySelector('.hp-caption');ctx.host.querySelector('.films-schedule-status')?.remove();
    if(caption&&scheduled){const status=el('div','films-schedule-status'+(scheduled?' is-planned':''));status.append(el('span','films-schedule-dot'));status.append(document.createTextNode(scheduled?'Gepland · '+new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',day:'numeric',month:'long'}).format(new Date(FilmsSocialModel.programmeDate(scheduled)+'T12:00:00Z')):'Nog niet gepland'));caption.after(status);}

    renderNight(ctx);
    renderSocialTabs(ctx);
    renderAdd(ctx);
    renderRailSearch(ctx);
    renderRailLikers(ctx);
    const displayOrder=browsingOrder(),position=displayOrder.findIndex(o=>o.id===ctx.plan.options[ctx.current]?.id),counter=ctx.host.querySelector('.hp-caption .eyebrow');
    if(counter&&position>=0)counter.textContent=String(position+1).padStart(2,'0')+' / '+displayOrder.length;
    catalogue = el('section', 'films-catalogue');
    catalogue.setAttribute('aria-label', 'Alle films en programma’s');
    for (const [kind, title] of [['programme', 'Uit het programma'], ['suggestion', 'Voorgesteld door vrienden']]) {
      const options = ctx.plan.options.filter(option => kind === 'suggestion' ? option.kind === 'suggestion' : option.kind !== 'suggestion');
      if (!options.length) continue;
      const group = el('section', 'films-group');
      group.append(el('h2', 'films-group-title', title));
      const grid = el('div', 'films-grid');
      (kind==='programme'?collectionOrder(options):options).forEach(option => grid.append(cardFor(option, ctx)));
      group.append(grid);
      catalogue.append(group);
    }
    const empty = el('div', 'films-empty');
    empty.append(el('p', '', 'Geen films gevonden.'));
    const add = el('button', 'films-propose', 'Voeg een film toe ↗');
    add.type = 'button';
    add.addEventListener('click', propose);
    empty.append(add);
    catalogue.append(empty);
    ctx.host.querySelector('.films-catalogue')?.remove();
    ctx.host.prepend(catalogue);
    setView(view);
    filterCards();
  }


  let selectedFriendIndex=0,inspectedDate='';
  function renderOverlap(ctx,surface,calendar,peopleForDate,effectiveCount,today){
    const entries=[...new Set([...Object.keys(ctx.plan.dateCounts||{}),...ctx.dates])].filter(d=>d>=today&&d>=ctx.plan.window.start&&d<=ctx.plan.window.end).map(date=>({date,people:peopleForDate(date),count:effectiveCount(date)})).filter(d=>d.count>0).sort((a,b)=>b.count-a.count||a.date.localeCompare(b.date)).slice(0,3);
    if(!entries.length)return;
    const section=el('section','calendar-overlap');section.append(el('h3','','Meeste overlap'));
    for(const entry of entries){const row=action('','overlap-row',()=>{inspectedDate=entry.date;for(const other of section.querySelectorAll('.overlap-row'))other.setAttribute('aria-pressed',String(other===row));for(const day of calendar.querySelectorAll('[data-day]'))day.classList.toggle('overlap-inspected',day.dataset.day===entry.date);},'overlap-'+entry.date);row.setAttribute('aria-pressed',String(inspectedDate===entry.date));row.setAttribute('aria-label',dateLabel(entry.date)+' · '+entry.count+' beschikbaar');row.append(el('span','overlap-date',new Date(entry.date+'T12:00:00Z').toLocaleDateString('nl-NL',{weekday:'short',day:'numeric',month:'short'})),avatarRow(entry.people,entry.people.length,'overlap-faces'));const count=el('span','overlap-count',String(entry.count));count.append(el('small','','/'+Math.max(ctx.plan.responseCount||0,(ctx.plan.people||[]).length,entry.count)));row.append(count);section.append(row);}surface.append(section);
  }
  function wireSocialLikerNames(row){
    for(const face of row.querySelectorAll('.films-social-avatar')){face.classList.add('battle-person');face.setAttribute('role','button');face.removeAttribute('title');}
    row.classList.add('films-tile-likers-names');wireLikerNames(row);
  }
  function renderSuggestionAuthors(ctx){
    for(const card of ctx.host.querySelectorAll('.fs-new .fs-mini-card')){const key=card.querySelector('.fs-mini-open')?.dataset.focus,id=key?.replace(/^social-open-new-/,'');const option=ctx.plan.options.find(o=>o.id===id);if(!option)continue;if(!likerPeople(ctx,option).length)card.querySelector('.fs-mini-stickers')?.remove();const stickers=card.querySelector('.fs-mini-stickers');if(stickers){const n=stickers.querySelectorAll('.films-social-avatar').length;stickers.style.setProperty('--liker-size',(n>10?17:n>6?20:22)+'px');wireSocialLikerNames(stickers);}const badge=ctx.recommenderBadge(option,true);if(badge){card.querySelector('.fs-mini-author')?.remove();card.append(badge);}}
  }
  function renderFriendOrders(ctx){
    const host=ctx.host.querySelector('.films-social-content'),people=(ctx.plan.people||[]).filter(p=>!p.self&&p.rankingOrder?.some(id=>p.choices?.includes(id)&&ctx.plan.options.some(o=>o.id===id)));
    if(!host||!people.length)return;
    selectedFriendIndex=Math.min(selectedFriendIndex,people.length-1);
    const section=el('section','friend-order'),tabs=el('div','friend-order-tabs'),shelf=el('div','friend-order-shelf');section.append(el('h3','','Favorieten van vrienden'),tabs,shelf);host.append(section);tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Kies een vriend');shelf.setAttribute('role','tabpanel');
    people.forEach((person,index)=>{const b=action('','',()=>{selectedFriendIndex=index;paint();},'friend-order-'+index);b.title=person.name||'Zonder naam';b.setAttribute('aria-label',b.title);b.setAttribute('role','tab');b.append(avatarRow([person],1));b.addEventListener('keydown',event=>{if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();selectedFriendIndex=(selectedFriendIndex+(event.key==='ArrowRight'?1:people.length-1))%people.length;paint();tabs.children[selectedFriendIndex].focus();}});tabs.append(b);});
    function paint(){const person=people[selectedFriendIndex];for(const [index,b] of [...tabs.children].entries()){b.setAttribute('aria-selected',String(index===selectedFriendIndex));b.tabIndex=index===selectedFriendIndex?0:-1;}shelf.replaceChildren();shelf.append(el('p','friend-order-name',person.name||'Zonder naam'));const row=el('div','friend-order-posters'),order=[...new Set(person.rankingOrder)].filter(id=>person.choices.includes(id)),points=FilmsSocialModel.contribution(person.choices,order,ctx.plan.nextRound?.rule);for(const id of order){const option=ctx.plan.options.find(o=>o.id===id);if(!option)continue;const b=action('','',()=>openOption(option),'friend-pick-'+id);b.title=option.title;b.setAttribute('aria-label','Bekijk '+option.title);b.append(ctx.cover(option,'friend-order-'+selectedFriendIndex+'-'+id));const badge=el('span','friend-order-points');badge.append(avatarRow([person],1),el('b','','+'+(['rank-3-2-1','rank-5-4-3-2-1'].includes(ctx.plan.nextRound?.rule)?points[id]:1)),el('small','',['rank-3-2-1','rank-5-4-3-2-1'].includes(ctx.plan.nextRound?.rule)?'pt':'♥'));if(FilmsSocialModel.completedIds(ctx.plan).has(id)){b.classList.add('is-watched');b.append(el('span','friend-watched','Al bekeken'));}else b.append(badge);row.append(b);}shelf.append(row);if(order.length>1){const guide=el('div','friend-order-direction');guide.style.setProperty('--friend-count',order.length);const segments=el('div','friend-order-segments');segments.setAttribute('aria-hidden','true');order.forEach((_,i)=>{const bar=el('i');bar.style.background=(ctx.plan.nextRound?.rule==='rank-5-4-3-2-1'?['#202020','#505050','#858585','#b8b8b8','#dedede']:['#202020','#858585','#dedede'])[Math.min(i,ctx.plan.nextRound?.rule==='rank-5-4-3-2-1'?4:2)];segments.append(bar);});const ends=el('div','friend-order-ends');ends.append(el('span','','Meest favoriet'),el('span','','Minst favoriet'));guide.append(segments,ends);shelf.append(guide);}}paint();
  }

  window.pickerConfig = {mode: 'collection', onRender: render};
})();

(()=>{
const host=document.querySelector('#home-picker'),tip=document.createElement('div');tip.className='calendar-face-label';tip.id='calendar-face-label';tip.hidden=true;tip.setAttribute('role','tooltip');document.body.append(tip);let active=null;
function hide(){tip.hidden=true;active?.removeAttribute('aria-describedby');active=null}
function show(face,event){if(!face)return;active=face;tip.textContent=face.alt||face.dataset.name||'';if(!tip.textContent)return;tip.hidden=false;face.setAttribute('aria-describedby',tip.id);const r=face.getBoundingClientRect(),x=event?.clientX??r.left,y=event?.clientY??r.bottom;tip.style.left=Math.max(8,Math.min(innerWidth-tip.offsetWidth-8,x+10))+'px';tip.style.top=Math.max(8,Math.min(innerHeight-tip.offsetHeight-8,y+12))+'px'}
function prepare(){host.querySelectorAll('.films-calendar-faces img, .overlap-faces img').forEach(face=>{face.tabIndex=0;face.setAttribute('role','button');face.setAttribute('aria-label',face.alt);face.removeAttribute('title');face.closest('.films-day-count')?.removeAttribute('aria-hidden')})}
new MutationObserver(prepare).observe(host,{subtree:true,childList:true});prepare();
host.addEventListener('pointerdown',e=>{if(e.target.closest('.films-calendar-faces img, .overlap-faces img'))e.stopPropagation()},true);
host.addEventListener('pointermove',e=>{const face=e.target.closest('.films-calendar-faces img, .overlap-faces img');if(face)show(face,e);else if(active)hide()});host.addEventListener('pointerleave',hide);host.addEventListener('focusin',e=>show(e.target.closest('.films-calendar-faces img, .overlap-faces img')));host.addEventListener('focusout',hide);host.addEventListener('click',e=>{const face=e.target.closest('.films-calendar-faces img, .overlap-faces img');if(face){e.stopPropagation();show(face)}});host.addEventListener('keydown',e=>{if(e.key==='Escape')hide();else if(['Enter',' '].includes(e.key)&&e.target.matches('.films-calendar-faces img, .overlap-faces img')){e.preventDefault();show(e.target)}});window.addEventListener('scroll',hide,true);
})();
