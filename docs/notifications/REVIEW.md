# Independent notifications UI review — 2026-09-10

Scope: read-only review of shared shell loader, notification JS/CSS, session integration, and actual GET/read/preferences contract. No source edits, account writes, production access, or existing QA browser changes. Parent captain owns real two-account/backend/mail validation.

Final verdict: PASS for this bounded UI review after the two requested corrections. Both original reproductions rerun against corrected bytes: delayed GET preserves `{checked:false,saved:false}`; marking read restores focus to an `A` element in the same notification. No demonstrated cross-account disclosure in reviewed epoch/abort paths. Initial findings below retained as red-to-green history.

## R1 — stale GET can undo the displayed email preference (medium)

`public/filmmaand/site/notifications.js:24` saves preference independently of refresh; refresh assigns `preference.checked = data.preferences.importantActivityEmail` without preference-version fencing (line 109 in reviewed source).

Reproduction with real UI source and controlled browser fetch promises:
1. Load true preference; open panel.
2. Trigger focus refresh after 30-second throttle, hold GET response containing true.
3. Uncheck preference; resolve PUT successfully (server/synthetic saved value false).
4. Release earlier GET: checkbox becomes true while saved preference remains false.

Observed: after PUT `{checked:false,saved:false}`; after delayed GET `{checked:true,saved:false}`. User sees incorrect saved preference and may inadvertently reverse their intended setting on another click.

Smallest correction: track preference mutation generation. Capture it at GET start; apply GET preference only if unchanged and no preference PUT is pending. Increment/reset safely on account changes too. Merely testing `preference.disabled` at response time is insufficient because PUT may already have completed.

## R2 — marking read discards keyboard focus (medium accessibility)

`notifications.js:72` replaces all list children; `:81` removes the focused Gelezen button after successful `:90` acknowledgement refresh.

Reproduction: open panel; keyboard-focus individual Gelezen; activate it; await POST and refresh. Browser observed `document.activeElement.tagName === "BODY"`, with modal still open. The user's logical item position is lost (also possible during background refresh of a focused list item).

Smallest correction: capture focused notification ID/control before render; restore equivalent surviving control or that item's link after replacement, provided focus still belongs to this panel and account is unchanged. If item disappears, use next logical item or panel close button. Do not steal focus after panel dismissal.

## Checks and limits

- Read-only contract matches `/notifications`, `/read`, `/preferences`, versioned item ACK and serverTime mark-all fence.
- Source uses textContent and local-path allowlist; session account change aborts requests, clears private list/toast, increments epoch, and ignores stale responses.
- Cached/unvalidated participant is not shown as authenticated notification history.
- Native modal, Escape/outside close and explicit visible focus styling present; viewport-bound panel width and wrapping present. Actual integrated mobile screenshots remain captain's responsibility.
- Toast restricted to one per account/tab using sessionStorage; blocked under other open dialogs/tutorial; no synthetic live wording.
- No backend event-dedupe/mail-delivery verdict inferred from this UI review.
- Synthetic probe is a deterministic UI race reproduction, not a claim of real backend or physical-device testing.

## Reproduction artifact

`docs/notifications/review-probe.js` embeds the corrected reviewed JS and mocks all fetches on an isolated about:blank page. Run in a NEW browser session only: `agent-browser --session notifications-review open about:blank`, then `agent-browser --session notifications-review eval --stdin < docs/notifications/review-probe.js`. It does not call any real endpoint. Browser session closed after review.

## Reviewed bytes

Git HEAD: `abc2f27e6f2169f3c6aa22da906b8af4a9d79639`; working JS/CSS/loader changes uncommitted at review.

- `public/filmmaand/site/notifications.js`: `78b27834de8a87c9e5c0213bd812b9cba05d7a86a42904fef9acdf458dca40b7`
- `public/filmmaand/site/notifications.css`: `6d244198a362accc4f5ed4a6ec544e7df831169fa161d302e065962c7fb61b30`
- `public/filmmaand/site/shell.js`: `c8d88c5af01dec27b3116c4790c3edf127058b7a2a362ddbb9a6de5d0e97b6d7`

## Corrected verification

Captain added preference mutation generation fencing and focused notification ID preservation. Exactly the two original controlled browser probes were rerun; both passed. No broader tests or backend writes. Owned `notifications-review` browser closed again.

Corrected notifications.js SHA256: `78b27834de8a87c9e5c0213bd812b9cba05d7a86a42904fef9acdf458dca40b7`.
