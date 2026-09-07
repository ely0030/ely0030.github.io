/* Load early in the head so interaction is observed before DOMContentLoaded. */
(() => {
  'use strict';
  if (window.openFilmmaandWelcome) return;
  const storageKey = 'filmmaand-welcome-dismissed-v1';
  let dialog, returnFocus, interacted = false;
  const interactionEvents = ['pointerdown', 'keydown', 'touchstart', 'wheel'];
  const noteInteraction = () => { interacted = true; };
  interactionEvents.forEach(type => window.addEventListener(type, noteInteraction, { capture: true, passive: true }));

  function hasDismissed() {
    try { if (localStorage.getItem(storageKey) === 'true') return true; } catch { /* Storage may be unavailable. */ }
    try { return sessionStorage.getItem(storageKey) === 'true'; } catch { return false; }
  }

  function anotherDialogIsOpen() {
    return [...document.querySelectorAll('dialog[open], [role="dialog"][aria-modal="true"]')]
      .some(node => node !== dialog && !node.hidden && node.getClientRects().length > 0);
  }

  function mount() {
    if (dialog || !document.body) return;
    dialog = document.createElement('dialog');
    dialog.className = 'filmmaand-welcome';
    dialog.setAttribute('aria-labelledby', 'filmmaand-welcome-title');
    dialog.setAttribute('aria-describedby', 'filmmaand-welcome-intro');
    dialog.innerHTML = `
      <h2 id="filmmaand-welcome-title">Kom je film kijken?</h2>
      <p id="filmmaand-welcome-intro">Kies de film voor de volgende avond. In het programma zie je wanneer we kijken en kun je aangeven of je erbij bent.</p>
      <button type="button" class="filmmaand-welcome-action" autofocus>Ik doe mee</button>`;
    dialog.querySelector('button').addEventListener('click', () => dialog.close());
    // Native Escape cancellation closes the dialog and follows the same dismissal path.
    dialog.addEventListener('close', () => {
      try { localStorage.setItem(storageKey, 'true'); } catch { /* Keep browsing possible without storage. */ }
      try { sessionStorage.setItem(storageKey, 'true'); } catch { /* Best effort fallback. */ }
      if (returnFocus?.isConnected && returnFocus !== document.body && !anotherDialogIsOpen()) {
        returnFocus.focus({ preventScroll: true });
      }
    });
    document.body.append(dialog);
  }

  function open() {
    mount();
    if (!dialog || typeof dialog.showModal !== 'function' || dialog.open || anotherDialogIsOpen()) return false;
    returnFocus = document.activeElement;
    dialog.showModal();
    return true;
  }
  window.openFilmmaandWelcome = open;

  function firstVisit() {
    // Calendar introduction owns explicit review entry and verified account onboarding.
    let account=false;try{account=localStorage.getItem('filmmaand-auth-v1')==='account'}catch{}
    let touring=false;try{touring=!!sessionStorage.getItem('filmmaand-first-visit-v1')}catch{}
    if(new URLSearchParams(location.search).get('intro')==='1'||new URLSearchParams(location.search).get('tour')==='1'||account||touring) {
      interactionEvents.forEach(type=>window.removeEventListener(type,noteInteraction,true));
      return;
    }
    // One early attempt only: never interrupt a task or wait for another modal to close.
    const focus = document.activeElement;
    const focusedControl = focus && focus !== document.body && focus !== document.documentElement;
    if ((!hasDismissed() || new URLSearchParams(location.search).get('welkom') === '1') && !interacted && !focusedControl && !window.scrollY && document.visibilityState === 'visible') open();
    interactionEvents.forEach(type => window.removeEventListener(type, noteInteraction, true));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', firstVisit, { once: true });
  else firstVisit();
})();
