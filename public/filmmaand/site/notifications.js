/* Private activity history. Canonical server events only; no client-derived activity. */
(() => {
  'use strict';
  if (window.filmmaandNotifications) return;
  window.filmmaandNotifications = true;
  const host = document.querySelector('.site-shell-header .navigation');
  if (!host) return;
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text) n.textContent = text; return n; };
  const button = (text, action, cls = '') => { const b = el('button', cls, text); b.type = 'button'; b.onclick = action; return b; };
  const root = el('div', 'fm-notifications'); root.hidden = true;
  const bell = button('', toggle, 'fm-notifications-bell');
  bell.setAttribute('aria-label', 'Meldingen'); bell.setAttribute('aria-haspopup', 'dialog'); bell.setAttribute('aria-expanded', 'false'); bell.setAttribute('aria-controls', 'fm-notifications-panel');
  bell.innerHTML = '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M5 16.5h14l-1.5-2V9a5.5 5.5 0 0 0-11 0v5.5L5 16.5Z"/><path d="M10 20h4M12 2v1.5"/></svg>';
  const badge = el('span', 'fm-notifications-badge'); badge.hidden = true; badge.setAttribute('aria-hidden', 'true'); bell.append(badge); root.append(bell);
  const panel = el('dialog', 'fm-notifications-panel'); panel.id = 'fm-notifications-panel'; panel.setAttribute('aria-labelledby', 'fm-notifications-title');
  const top = el('div', 'fm-notifications-top'), heading = el('h2', '', 'Meldingen'); heading.id = 'fm-notifications-title';
  const close = button('×', () => hide(), 'fm-notifications-close'); close.setAttribute('aria-label', 'Meldingen sluiten'); top.append(heading, close);
  const status = el('p', 'fm-notifications-status'); status.setAttribute('role', 'status');
  const all = button('Alles gelezen', () => acknowledge({allThrough: serverTime}), 'fm-notifications-all');
  const list = el('ol', 'fm-notifications-list');
  const more = button('Eerdere meldingen', () => refresh(true, cursor), 'fm-notifications-more'); more.hidden = true;
  const settings = el('label', 'fm-notifications-preference'), preference = el('input'); preference.type = 'checkbox';
  settings.append(preference, el('span', '', 'E-mail bij een nieuwe stemronde of uitslag'));
  preference.onchange = async () => { const desired = preference.checked, token = epoch; preferenceVersion++; preference.disabled = true; try { await api('/preferences', 'PUT', {importantActivityEmail: desired}); if (token === epoch) { preference.checked = desired; status.textContent = 'E-mailvoorkeur bewaard.'; } } catch (e) { if (token === epoch) { preference.checked = !desired; showError(e); } } finally { if (token === epoch) preference.disabled = false; } };
  panel.append(top, all, status, list, more, settings); document.body.append(panel);
  let refreshTask = null, preferenceVersion = 0;
  let account = null, epoch = 0, items = [], unread = 0, cursor = null, serverTime = null, lastRequest = 0, loading = false, loaded = false, toast = null, toastConsidered = false;
  const requests = new Set();
  const blocked = () => !!document.querySelector('dialog[open]:not(.fm-notifications-panel),.first-visit,.account-unlock[open]') || document.body.classList.contains('has-first-visit');
  function mount() { const profile = host.querySelector('.profile-menu'); if (profile && root.nextSibling !== profile) profile.before(root); else if (!root.isConnected) host.append(root); }
  new MutationObserver(mount).observe(host, {childList: true}); mount();
  function clearToast() { toast?.remove(); toast = null; root.classList.remove('is-arriving'); }
  function hide(focus = true) { if (panel.open) panel.close(); bell.setAttribute('aria-expanded', 'false'); if (focus && !root.hidden) bell.focus({preventScroll: true}); }
  function position() {
    const box = bell.getBoundingClientRect(), width = Math.min(460, document.documentElement.clientWidth - 24);
    panel.style.width = width + 'px'; panel.style.left = Math.max(12, Math.min(box.right - width, document.documentElement.clientWidth - width - 12)) + 'px';
    const top = Math.max(12, Math.min(box.bottom + 12, innerHeight - 460)); panel.style.top = top + 'px'; panel.style.maxHeight = Math.max(160, innerHeight - top - 16) + 'px';
    if (toast) { const toastWidth = Math.min(360, document.documentElement.clientWidth - 24); toast.style.width = toastWidth + 'px'; toast.style.left = Math.max(12, Math.min(box.right - toastWidth, document.documentElement.clientWidth - toastWidth - 12)) + 'px'; toast.style.top = Math.max(12, Math.min(box.bottom + 12, innerHeight - toast.offsetHeight - 12)) + 'px'; }
  }
  async function toggle() {
    if (panel.open) return hide(); if (blocked()) return;
    clearToast(); host.querySelector('.profile-menu')?.close?.(); panel.showModal(); bell.setAttribute('aria-expanded', 'true'); position(); close.focus();
    if (!loaded) await refresh(true); else { render(); void refresh(); }
  }
  panel.addEventListener('cancel', e => { e.preventDefault(); hide(); });
  panel.addEventListener('click', e => { if (e.target === panel) { const r = panel.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) hide(); } });
  window.addEventListener('resize', position); window.addEventListener('scroll', () => { if (panel.open || toast) position(); }, {passive: true});
  window.addEventListener('filmmaand-login-opened', () => { clearToast(); hide(false); });
  new MutationObserver(() => { if (blocked()) { clearToast(); if (panel.open) hide(false); } }).observe(document.body, {childList: true, attributes: true, attributeFilter: ['class', 'open'], subtree: true});
  async function api(path = '', method = 'GET', body) {
    const token = epoch, controller = new AbortController(); requests.add(controller); const timer = setTimeout(() => controller.abort(), 15000);
    try {
      await window.filmmaandResetGuard?.ready;
      if (!account || token !== epoch) throw Error('Account gewijzigd.');
      const response = await fetch('/filmmaand/api/notifications' + path, {method, credentials: 'same-origin', cache: 'no-store', signal: controller.signal, headers: body ? {'Content-Type': 'application/json'} : {}, ...(body ? {body: JSON.stringify(body)} : {})});
      const data = await response.json();
      if (token !== epoch) throw Error('Account gewijzigd.');
      if (!response.ok) { if ([401, 410].includes(response.status)) { change(null); window.dispatchEvent(new CustomEvent('filmmaand-login-required', {detail: {reason: 'notifications-expired'}})); } throw Error(data?.error?.message || 'Meldingen konden niet worden geladen.'); }
      return data;
    } finally { clearTimeout(timer); requests.delete(controller); }
  }
  function count() { badge.hidden = unread === 0; badge.textContent = unread > 99 ? '99+' : String(unread); bell.setAttribute('aria-label', unread ? `Meldingen, ${unread} ongelezen` : 'Meldingen'); all.disabled = !unread || !serverTime || loading; }
  function stamp(value) {
    const date = new Date(value), n = el('time'); if (!Number.isFinite(+date)) return n;
    n.dateTime = date.toISOString(); const exact = new Intl.DateTimeFormat('nl-NL', {dateStyle: 'long', timeStyle: 'short', timeZone: 'Europe/Amsterdam'}).format(date);
    n.title = exact; n.setAttribute('aria-label', exact);
    const seconds = Math.max(0, (Date.now() - date) / 1000), units = seconds < 3600 ? ['minute', Math.max(1, Math.floor(seconds / 60))] : seconds < 86400 ? ['hour', Math.floor(seconds / 3600)] : ['day', Math.floor(seconds / 86400)];
    n.textContent = seconds < 60 ? 'Zojuist' : new Intl.RelativeTimeFormat('nl-NL', {numeric: 'auto'}).format(-units[1], units[0]); return n;
  }
  function href(value) { try { const u = new URL(value, location.origin); return u.origin === location.origin && /^\/filmmaand\/(films|stemmen|programma|agenda)\//.test(u.pathname) ? u.pathname + u.search + u.hash : '/filmmaand/programma/'; } catch { return '/filmmaand/programma/'; } }
  const kinds = {
    'suggestion-liked': ['Een hartje voor jou', '♥'],
    'film-suggested': ['Nieuw in de selectie', '+'],
    'leaderboard-entry': ['De top krijgt gezelschap', '↗'],
    'next-leader': ['Een nieuwe nummer één', '1'],
    'vote-leader': ['Het wordt spannend', '↗'],
    'round-concluded': ['De uitslag is binnen', '✓'],
    'round-opened': ['Tijd om te kiezen', '→']
  };
  function subjects(item) {
    if (item.subjects?.length) return item.subjects;
    const id = new URL(href(item.href), location.origin).searchParams.get('film');
    return id ? [{id, title: ''}] : [];
  }
  let artworkOptions = [], artworkTask;
  async function loadArtwork() {
    if (!artworkTask) artworkTask = fetch('/filmmaand/api/plans/home-picker-lab', {credentials: 'same-origin', cache: 'no-store', signal: AbortSignal.timeout(2500)})
      .then(r => r.ok ? r.json() : null).then(data => { artworkOptions = data?.options || []; })
      .catch(() => { artworkTask = null; });
    return artworkTask;
  }
  function posterSource(subject) {
    const option = artworkOptions.find(o => o.id === subject.id);
    const value = option?.image?.url || option?.movie?.poster || option?.movies?.[0]?.poster || subject.poster || window.catalogArtwork?.[subject.id];
    if (!value) return null;
    if (/^data:image\/(jpeg|png|webp);base64,/.test(value)) return value;
    try { const u = new URL(value, location.origin); return (u.origin === location.origin && u.pathname.startsWith('/filmmaand/')) || (u.protocol === 'https:' && ['image.tmdb.org','m.media-amazon.com'].includes(u.hostname)) ? u.href : null; } catch { return null; }
  }
  function covers(item) {
    const wrap = el('span', 'fm-notifications-posters');
    for (const subject of subjects(item)) {
      const src = posterSource(subject); if (!src) continue;
      const image = el('img', 'fm-notifications-poster'); image.src = src; image.alt = subject.title || ''; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
      image.onerror = () => { image.remove(); if (!wrap.children.length) wrap.remove(); };
      wrap.append(image);
    }
    return wrap.children.length ? wrap : null;
  }
  function activityIcon(type) {
    const paths = {
      'film-suggested': '<path d="M12 5v14M5 12h14"/>',
      'leaderboard-entry': '<path d="M4 20V13h5v7M9 20V8h6v12M15 20V4h5v16M3 20h18"/>',
      'next-leader': '<path d="M8 4h8v5a4 4 0 0 1-8 0ZM8 6H5v2a4 4 0 0 0 4 4M16 6h3v2a4 4 0 0 1-4 4M12 13v5M8 20h8M10 18h4"/>',
      'vote-leader': '<path d="m4 17 6-6 4 3 6-9M14 5h6v6"/>',
      'round-concluded': '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
      'round-opened': '<path d="M8 12H5l-2 8h18l-2-8h-3M8 15h8"/><path d="m8 3 9 3-3 9-9-3ZM9 8l1 2 3-2"/>'
    };
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('fill', 'none'); icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '1.8'); icon.setAttribute('stroke-linecap', 'round'); icon.setAttribute('stroke-linejoin', 'round'); icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = paths[type] || paths['film-suggested']; return icon;
  }
  function face(item) {
    const wrap = el('span', 'fm-notifications-face'); wrap.dataset.activity = item.type;
    const avatar = window.filmmaandAvatarOptions?.find(a => a.id === item.actor?.avatarId);
    if (avatar?.src) {
      wrap.classList.add('has-avatar'); if (avatar.transparent) wrap.classList.add('has-cutout');
      const image = el('img', 'fm-notifications-avatar'); image.src = avatar.src; image.alt = item.actor?.name || '';
      if (avatar.filter) image.style.filter = avatar.filter; wrap.append(image);
    } else if (item.actor) wrap.append(el('span', 'fm-notifications-monogram', item.actor.name?.slice(0,1) || '?'));
    else { wrap.classList.add('is-activity'); wrap.append(activityIcon(item.type)); }
    if (item.actor) {
      const mark = el('span', 'fm-notifications-reaction'); mark.setAttribute('aria-hidden', 'true');
      if (item.type === 'suggestion-liked') mark.textContent = '♥'; else mark.append(activityIcon(item.type));
      wrap.append(mark);
    }
    return wrap;
  }
  function message(item) {
    const copy = el('span', 'fm-notifications-message');
    const title = subjects(item)[0]?.title;
    if (item.actor && item.type === 'suggestion-liked' && item.count === 1 && title) copy.append(el('strong', '', item.actor.name), document.createTextNode(' gaf je voorstel '), el('strong', '', title), document.createTextNode(' een hartje.'));
    else if (item.actor && item.type === 'film-suggested' && title) copy.append(el('strong', '', item.actor.name), document.createTextNode(' stelde '), el('strong', '', title), document.createTextNode(' voor.'));
    else copy.textContent = item.text;
    return copy;
  }
  function render() {
    count(); const focusedItem = list.contains(document.activeElement) ? document.activeElement.closest('li')?.dataset.id : null; list.replaceChildren();
    for (const item of items) {
      const row = el('li', item.readAt ? '' : 'is-unread'), content = el('div', 'fm-notifications-copy');
      row.dataset.id = item.id;
      row.dataset.type = item.type;
      row.append(face(item));
      const link = el('a'); link.href = href(item.href);
      link.append(message(item));
      link.onclick = async e => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || item.readAt) return; e.preventDefault(); const token = epoch; if (await acknowledge({items: [{id: item.id, updatedAt: item.updatedAt}]})) { if (token === epoch) location.assign(link.href); } };
      const meta = el('div', 'fm-notifications-meta'); meta.append(stamp(item.updatedAt || item.createdAt));
      if (!item.readAt) { const read = button('•', () => acknowledge({items: [{id: item.id, updatedAt: item.updatedAt}]})); read.setAttribute('aria-label', 'Markeer als gelezen: ' + item.text); meta.append(read); }
      content.append(link, meta); row.append(content); const art = covers(item); if (art) row.append(art); list.append(row);
    }
    if (focusedItem && panel.open) [...list.children].find(row => row.dataset.id === focusedItem)?.querySelector('a')?.focus({preventScroll: true});
    more.hidden = !cursor; more.disabled = loading;
    if (!items.length && loaded) status.textContent = 'Nog geen meldingen. Nieuwe activiteit verschijnt hier.';
  }
  function showError(e) { status.replaceChildren(document.createTextNode(e.name === 'AbortError' ? 'De verbinding duurde te lang. ' : (e.message || 'Laden mislukt.') + ' '), button('Opnieuw proberen', () => refresh(true))); }
  async function acknowledge(body) {
    if (!account) return false; const token = epoch;
    try { await api('/read', 'POST', body); if (token !== epoch) return false; await refresh(true); return true; }
    catch (e) { if (token === epoch) showError(e); return false; }
  }
  function arrival() {
    if (toastConsidered || !unread || panel.open || blocked()) return;
    toastConsidered = true; const key = 'filmmaand-notifications-arrival:' + account;
    try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* Per-page guard remains. */ }
    const newest = items.find(i => !i.readAt); if (!newest) return;
    // One action can also change the ranking. Prefer its personal event in the arrival card.
    const item = items.find(i => !i.readAt && ['suggestion-liked', 'film-suggested'].includes(i.type) && Math.abs(Date.parse(i.updatedAt) - Date.parse(newest.updatedAt)) < 1000) || newest;
    toast = el('aside', 'fm-notifications-toast'); toast.setAttribute('aria-label', 'Sinds je laatste bezoek'); toast.setAttribute('role', 'status');
    const dismiss = button('×', clearToast, 'fm-notifications-close'); dismiss.setAttribute('aria-label', 'Melding sluiten');
    toast.dataset.type = item.type;
    const open = button('', () => { clearToast(); void toggle(); }, 'fm-notifications-toast-open');
    const body = el('span', 'fm-notifications-toast-body'), copy = el('span', 'fm-notifications-toast-copy');
    const detail = el('span', 'fm-notifications-toast-detail');
    const dot = el('span', 'fm-notifications-unread-dot'); dot.setAttribute('aria-hidden', 'true');
    detail.append(dot, stamp(item.updatedAt || item.createdAt));
    if (unread > 1) detail.append(el('span', 'fm-notifications-remaining', '+ ' + (unread - 1) + ' andere'));
    copy.append(message(item), detail);
    body.append(face(item), copy); const art = covers(item); if (art) body.append(art);
    open.append(body); toast.append(dismiss, open); document.body.append(toast); root.classList.add('is-arriving'); position();

  }
  async function refresh(force = false, next = null) {
    if (loading) { if (force && refreshTask) { const token = epoch; await refreshTask; if (token === epoch) return refresh(force, next); } return; }
    if (!account || (!force && Date.now() - lastRequest < 30000)) return;
    loading = true; lastRequest = Date.now(); const token = epoch, prefToken = preferenceVersion;
    if (!loaded) status.textContent = 'Meldingen laden…'; count();
    refreshTask = (async () => { try {
      const data = await api(next ? '?cursor=' + encodeURIComponent(next) + '&limit=20' : '?limit=20');
      if (data.items.some(i => subjects(i).some(s => !artworkOptions.some(o => o.id === s.id)))) artworkTask = null;
      await loadArtwork();
      if (token !== epoch) return;
      items = next ? [...new Map([...items, ...data.items].map(i => [i.id, i])).values()] : data.items;
      unread = data.unreadCount; cursor = data.nextCursor; serverTime = data.serverTime; if (prefToken === preferenceVersion && !preference.disabled) preference.checked = data.preferences.importantActivityEmail;
      loaded = true; status.textContent = ''; render(); arrival();
    } catch (e) { if (token === epoch) showError(e); }
    finally { if (token === epoch) { loading = false; count(); more.disabled = false; } } })();
    return refreshTask;
  }
  function change(p) {
    const id = p?.onboarded && !p.cached ? p.id : null;
    if (id === account) return;
    epoch++; for (const r of requests) r.abort(); requests.clear(); hide(false); clearToast(); account = id; items = []; unread = 0; cursor = null; serverTime = null; loaded = false; loading = false; lastRequest = 0; toastConsidered = false; preference.checked = false; preference.disabled = false; status.textContent = ''; list.replaceChildren(); root.hidden = !id; count(); if (id) void refresh();
  }
  window.addEventListener('filmmaand-session', e => change(e.detail?.participant));
  window.addEventListener('focus', () => { if (account) void refresh(); });
  // Defer until parser-loaded session and profile scripts have executed.
  const start = () => { if (window.filmmaandSession) void window.filmmaandSession.ready().then(change); };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, {once: true}); else start();
})();
