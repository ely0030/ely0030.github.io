# /filmmaand/wanneer/: the date poll page

The approved invitation page (a group-chat clone with a date poll, kit `kits/invitations/05-calendly-study/jasjes2/appje2`)
as a real site page, wired to the date-poll API in `CONTRACT.md`. Branch `feat/wanneer-page` (off `feat/poll-pass`).

## Files

| file | what | edit? |
|---|---|---|
| `public/filmmaand/wanneer/index.html` | page markup + CSS + eggs CSS | **generated**: `node scripts/build-wanneer.mjs` |
| `public/filmmaand/wanneer/eggs.js` | Capsule's eggs, verbatim | **generated** |
| `public/filmmaand/assets/wanneer-pudding-<sha8>.png` | the group avatar (mascot) | **generated** |
| `public/filmmaand/wanneer/wanneer.js` | the page logic: pass, GET/PUT, render | hand-written |
| `scripts/build-wanneer.mjs` | the builder | |
| `qa/wanneer/serve.mjs` | isolated preview, in memory | |
| `filmmaand-server/wanneer-page.test.mjs` | what ships + the API flow the page performs | |

**One design, no fork.** The builder reads the kit's built `appje2.html` (the file Chris approved) and refuses to run when
it is stale against `appje2.js` / `eggs/eggs.{css,js}`. It keeps the CSS and markup as they are, apart from four changes:
the mascot becomes an asset, the sample names in the header become `Alec, jij`, the own avatar becomes a placeholder, and
one empty `.sys` chip `#note` is added. It drops the kit script (the sample people and the browser-stored state).
`wanneer.js` is a port of `appje2.js`. Its header records the sha256 of the `appje2.js` it was ported from, and the builder
fails when the kit's copy changes, so kit behaviour changes are carried over by hand and never left behind unnoticed.
It also fails if any sample name, the kit's state key or an inlined raster image would ship.

Design/eggs change → edit the kit → `python3 build-appje2.py` in the kit → `node scripts/build-wanneer.mjs [kitdir]` here →
commit the generated files (Netlify cannot see the kit; it is not in this repo).

## Behaviour

- **Link.** Minted and reminder links are now `https://ely0030.xyz/filmmaand/wanneer/?pas=<token>`. The older form
  `/filmmaand/?pas=…` redirects there with the query string preserved (handler, before any store access).
- **Pass.** On load `wanneer.js` reads `?pas=` once and removes it from the address bar with `history.replaceState`
  before the first request. It keeps the pass in memory and in this tab's `history.state` (`filmmaandPollPass`), so a reload
  keeps working (Cameo, 23 Sept). `pass_invalid` clears it from there. It sends the pass as `X-Filmmaand-Poll-Pass` on every date-poll
  request and never puts it in a URL or in browser storage. `Referrer-Policy: no-referrer` (meta + netlify.toml header) keeps
  the token out of Referer during the first requests.
- **Fallback.** On `401 pass_invalid` the page drops the pass and tries the session once. If there is no session, a calm
  `#note` chip appears ("Deze link werkt niet (meer)…" / "Open de link uit je mail nog een keer, of log in"), plus a link
  to `/filmmaand/identity/?terug=/filmmaand/wanneer/`. After logging in, the identity page returns there
  (`safeReturn` in `studio.js`: `/filmmaand/` paths of `[A-Za-z0-9/_-]` only, no `//`; tested against open redirects). `reset-guard.js` loads first, as on every Filmmaand page, and adds
  `X-Filmmaand-Reset-Generation`.
- **Data.** Nights come from `poll.window`. Each night's people come from `ranking[].people` (the viewer's own entry is
  drawn from local ticks, so a tap shows at once). Avatars map `avatarId` to `/filmmaand/identity/avatars.js`. The header
  lists `Alec`, then the invitees (`invitees` on the GET: everyone holding a live pass) plus anyone who answered, then `jij`. The rail avatar is the viewer's
  own, with the tooltip "Je antwoordt als <naam>".
- **Saving.** "Klaar" sends a PUT: every night explicit `true`/`false`, `favourite:null`, the last `revision`, and a fresh
  `Idempotency-Key`, reused on the single network retry. Then it GETs again. After voting, each tap is saved the same way
  (700 ms debounce). "Ik kan deze week niet" sends all `false`. On `revision_conflict` the page GETs, keeps the tap and
  retries once. `date_poll_closed` / `date_poll_changed` → GET again and show a chip. Nothing is written on load.
- **Closed / picked.** When the poll is not open, the taps are disabled and the send button is hidden. A picked poll shows
  "De avond staat vast: <dag>." No poll → "Er staat nu geen vraag open."
- **Eggs.** `eggs.js` is started by `wanneer.js` after the first GET, so it sees the real `body.voted` (a returning voter's
  sticker is already there; a new vote gets the typing → sticker reply).
- **Cadence B.** GET on open, on tab visible / window focus (at most once per 15 s, never while a tap is unsaved),
  and +20 s / +60 s after a doodle send (visible tab only). The doodle PUT response carries everyone's doodles. An idle page
  makes zero requests (tested). The vote PUT is still followed by one GET (as in the contract).

## Shared doodles: the page hook (phase 2)

Server contract: `CONTRACT.md`, "Shared doodles". `wanneer.js` only moves data. Capsule's `eggs.js` renders the doodles
and uses the hook when it exists (the kit page has no hook and keeps its local-only path):

```js
window.filmmaandDoodles.list()        // {canSave, mine:{id,at,t,strokes}|null, others:[{id,name,avatarId,avatar,at,t,strokes}]}
window.filmmaandDoodles.save(strokes) // Promise<{id,at,strokes}>; replaces your own; rejects with Error.code
window.filmmaandDoodles.subscribe(cb) // cb(list()) now and after every poll GET; returns unsubscribe
// plus a 'filmmaand-doodles' CustomEvent on window after every GET (detail = list())
```

## Text chat: the page hook (phase 3)

```js
window.filmmaandChat.list()        // {canSend, messages:[{id,seq,name,avatarId,avatar,at,t,text,self?}]} (hidden ones removed)
window.filmmaandChat.send(text)    // Promise<message>; rejects with Error.code (chat_rate → e.details.retryAfter, chat_too_long, …)
window.filmmaandChat.subscribe(cb) // cb(list()) now and after every read/send; returns unsubscribe
// plus a 'filmmaand-chat' CustomEvent on window
```
The page keeps a cursor: every GET asks `?since=<cursor>`, and a send's response carries everything since it. A different
poll or viewer resets the chat with one full read. Render `text` with `textContent`.

## After the pick: "Ben je erbij?"

When the poll is confirmed, the page shows the `#note` chip "De avond staat vast: <avond>." and the `#rsvp` block
(the kit's `.wrapx`/`.ask`/`.quick`/`.sub` pieces, added by the builder): **Ja, ik kom!** / **Toch niet**. A tap PUTs your
own RSVP (`aria-pressed` shows the saved answer). `?antwoord=ja|nee` from the confirmation mail only marks the button
(`data-pre="true"`, for Cameo/Capsule to style) with "Klopt dit? Tik op je antwoord om het door te geven."; it never saves.
Changeable until the end of the picked night; the chat stays open until then too.

## Run it

```sh
node qa/wanneer/serve.mjs                # http://localhost:4419/ (WANNEER_QA_PORT to change)
```

The index lists fresh pass links for four fictional friends (two have already answered) and a "log in as (session)" link
per friend. It also has a dead-pass link, a no-pass link, "rotate all passes" and "organiser picks za 26". Everything runs
in memory with the real `createApi`. No mail leaves: login codes are captured.

Tests: `node --test filmmaand-server/wanneer-page.test.mjs` (or the full `npm run test:filmmaand`).

## Known limits / open

- The pass sits in the tab's session history (`history.state`), by decision. A new tab opened on the bare URL has no pass.
