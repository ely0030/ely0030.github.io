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
  function clearToast() { toast?.remove(); toast = null; }
  function hide(focus = true) { if (panel.open) panel.close(); bell.setAttribute('aria-expanded', 'false'); if (focus && !root.hidden) bell.focus({preventScroll: true}); }
  function position() {
    const box = bell.getBoundingClientRect(), width = Math.min(420, document.documentElement.clientWidth - 24);
    panel.style.width = width + 'px'; panel.style.left = Math.max(12, Math.min(box.right - width, document.documentElement.clientWidth - width - 12)) + 'px';
    const top = Math.max(12, Math.min(box.bottom + 12, innerHeight - 200)); panel.style.top = top + 'px'; panel.style.maxHeight = Math.max(160, innerHeight - top - 16) + 'px';
    if (toast) { toast.style.top = (box.bottom + 12) + 'px'; toast.style.right = Math.max(12, document.documentElement.clientWidth - box.right) + 'px'; }
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
    n.textContent = new Intl.RelativeTimeFormat('nl-NL', {numeric: 'auto'}).format(-units[1], units[0]); return n;
  }
  function href(value) { try { const u = new URL(value, location.origin); return u.origin === location.origin && /^\/filmmaand\/(films|stemmen|programma|agenda)\//.test(u.pathname) ? u.pathname + u.search + u.hash : '/filmmaand/programma/'; } catch { return '/filmmaand/programma/'; } }
  function render() {
    count(); const focusedItem = list.contains(document.activeElement) ? document.activeElement.closest('li')?.dataset.id : null; list.replaceChildren();
    for (const item of items) {
      const row = el('li', item.readAt ? '' : 'is-unread'), content = el('div', 'fm-notifications-copy');
      row.dataset.id = item.id;
      const avatar = window.filmmaandAvatarOptions?.find(a => a.id === item.actor?.avatarId);
      if (avatar?.src) { const image = el('img', 'fm-notifications-avatar'); image.src = avatar.src; image.alt = item.actor?.name || ''; if (avatar.filter) image.style.filter = avatar.filter; row.append(image); }
      else { const mark = el('span', 'fm-notifications-mark', '·'); mark.setAttribute('aria-hidden', 'true'); row.append(mark); }
      const link = el('a', '', item.text); link.href = href(item.href);
      link.onclick = async e => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || item.readAt) return; e.preventDefault(); const token = epoch; if (await acknowledge({items: [{id: item.id, updatedAt: item.updatedAt}]})) { if (token === epoch) location.assign(link.href); } };
      const meta = el('div', 'fm-notifications-meta'); meta.append(stamp(item.updatedAt || item.createdAt));
      if (!item.readAt) { const read = button('Gelezen', () => acknowledge({items: [{id: item.id, updatedAt: item.updatedAt}]})); read.setAttribute('aria-label', 'Markeer als gelezen: ' + item.text); meta.append(read); }
      content.append(link, meta); row.append(content); list.append(row);
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
    const item = items.find(i => !i.readAt); if (!item) return;
    toast = el('aside', 'fm-notifications-toast'); toast.setAttribute('aria-label', 'Sinds je laatste bezoek');
    const dismiss = button('×', clearToast, 'fm-notifications-close'); dismiss.setAttribute('aria-label', 'Melding sluiten');
    const open = button('', () => { clearToast(); void toggle(); }, 'fm-notifications-toast-open'); open.append(el('strong', '', 'Sinds je laatste bezoek'), el('span', '', item.text), stamp(item.updatedAt || item.createdAt)); toast.append(dismiss, open); document.body.append(toast); position();
  }
  async function refresh(force = false, next = null) {
    if (loading) { if (force && refreshTask) { const token = epoch; await refreshTask; if (token === epoch) return refresh(force, next); } return; }
    if (!account || (!force && Date.now() - lastRequest < 30000)) return;
    loading = true; lastRequest = Date.now(); const token = epoch, prefToken = preferenceVersion;
    if (!loaded) status.textContent = 'Meldingen laden…'; count();
    refreshTask = (async () => { try {
      const data = await api(next ? '?cursor=' + encodeURIComponent(next) + '&limit=20' : '?limit=20');
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
