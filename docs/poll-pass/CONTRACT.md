# Poll pass: API contract

Branch `feat/poll-pass`. Design: `kits/invitations/POLL-PASS.md` (Cameo, 22 Sept). Code:
`filmmaand-server/runtime/planning/auth/poll-passes.mjs`, `api.mjs` (date-poll route),
`runtime/planning/service.mjs` (`getDatePollAs`, `voteDatePollAs`, `datePollInfo`), table
`poll_passes` in `runtime/planning/auth/store.mjs` + `state.mjs`. Tests: `filmmaand-server/poll-pass.test.mjs`.

## What a pass is

- A random 43-character base64url token (32 random bytes). One per recipient per poll, plus one extra per
  reminder mail (see `nudge`). Only its SHA-256 is stored (`poll_passes.token_hash`). No plaintext token is
  written to state, to receipts, to the mail outbox, or to logs.
- It identifies **one participant for one date poll on one plan**. With it you can read that poll
  (`GET`) and set **your own** availability (`PUT`). Nothing else: every other route ignores the header.
- It is valid while **all** of these hold: the plan in the URL is the plan it was minted for, that plan's
  *current* poll is the poll it was minted for, it is not revoked, it has not expired (below), and the
  participant still has a name/avatar (is onboarded).
- **Expiry** depends on how the poll is decided:
  - **Manual poll** (`pick:"manual"`, the organiser picks; this is the September poll): valid **while the
    poll is open**, then **24h read-only** after the organiser closes it (`closedAt + 24h`). After a **pick** it also
    stays valid until the **end of the picked night** (Amsterdam midnight), when the chat closes, plus the same 24h
    read-only (Cameo/Chris, 23 Sept). Voting and doodles close at the pick; the chat does not. During
    those 24h the GET works (shows the picked night) and the PUT returns `409 date_poll_closed`. A hard
    ceiling is stored with the pass: `window.end + 2 days` 00:00Z (about 24h after the last night ends),
    which is the `expiresAt` that `issue-passes`/`list-passes` report. `list-passes` compares against that
    ceiling only, so a pass that stopped working 24h after the pick can still be listed as `active`.
  - **Auto poll** (no `pick`, the old behaviour): unchanged, `closesAt + 24h`.
- It is **not** a login. It never sets a cookie and never creates a session. (The design's optional
  "log that browser in after the first tap" add-on is **not built**. Default off, as designed.)
- Resolving a pass only reads. No last-used timestamp, no counter, no rate limit, no consumption. So a
  mail scanner that fetches the link (or even runs the page's JS and issues the GET) changes nothing.

## How the page carries the token

1. The mail link is `https://ely0030.xyz/filmmaand/wanneer/?pas=<token>` (the date poll page, see `WANNEER.md`);
   `issue-passes` and the reminder mail both mint this form. The older form `/filmmaand/?pas=…` is 302-redirected
   to `/filmmaand/wanneer/?…` **with the query string preserved** and without touching state (the redirect happens
   before any store access).
2. On first load the page reads `pas` from `location.search`, keeps it **in memory only** (not
   localStorage/cookies), and removes it from the visible URL:
   `history.replaceState(null, '', location.pathname + location.hash)` (keep any other params you need).
3. Every date-poll API request from the page then sends the header
   **`X-Filmmaand-Poll-Pass: <token>`**. The API does **not** accept the token as a query parameter
   (`?pas=` on an API URL is ignored, so the request is treated as having no pass), and it must **not** be
   sent as `Authorization: Bearer`, because a 43-character bearer is the legacy anonymous-actor namespace.
4. Send the header **only if you have a pass**. If you send it, it decides the identity for that request,
   even if a session cookie for someone else is present (e.g. the organiser testing a friend's link on
   his own laptop). An invalid pass is an error, never a silent fallback to the session.
5. If the page gets `401 pass_invalid`, drop the in-memory pass. If the visitor has a normal session,
   retry without the header (the session path works as before); otherwise show the message and the
   normal login.

## Endpoints

All live on the existing route `/filmmaand/api/plans/<planId>/date-poll`. Every response on this route,
success **and** error, carries `Cache-Control: private, no-store`. No `Set-Cookie` is ever sent on the
pass path.

### GET: read the poll as the pass holder (read-only)

```
GET /filmmaand/api/plans/<planId>/date-poll
X-Filmmaand-Poll-Pass: <token>          # or: a normal session cookie, no pass header
```

200:

```json
{
  "pollId": "date-poll-c8262fd81de9e876e824",
  "revision": 1,
  "availability": {"2026-09-24": false, "2026-09-25": false, "2026-09-26": true},
  "favourite": null,
  "poll": {
    "id": "date-poll-c8262fd81de9e876e824",
    "mode": "availability",
    "pick": "manual",
    "status": "open",
    "window": {"start": "2026-09-24", "end": "2026-09-26"},
    "choices": [],
    "closesAt": null,
    "ranking": [
      {"date": "2026-09-26", "available": 2, "unavailable": 1, "favourites": 1,
       "people": [{"name": "Noor", "avatarId": 4}, {"name": "Sam", "avatarId": 7, "self": true}],
       "no": [{"name": "Joep", "avatarId": 9}]},
      {"date": "2026-09-24", "available": 1, "unavailable": 2, "favourites": 0,
       "people": [{"name": "Noor", "avatarId": 4}],
       "no": [{"name": "Joep", "avatarId": 9}, {"name": "Sam", "avatarId": 7, "self": true}]},
      {"date": "2026-09-25", "available": 0, "unavailable": 3, "favourites": 0, "people": [],
       "no": [{"name": "Joep", "avatarId": 9}, {"name": "Noor", "avatarId": 4}, {"name": "Sam", "avatarId": 7, "self": true}]}
    ],
    "leaderDates": ["2026-09-26"],
    "voteCount": 3,
    "people": [],
    "declined": [{"name": "Joep", "avatarId": 9}]
  },
  "viewer": {"name": "Sam", "avatarId": 7}
}
```

- Top level (`pollId`, `revision`, `availability`, `favourite`) is **your own** answer, the same shape
  the session GET returned before. `revision` must be echoed on the next PUT.
- `poll` is the public projection (`publicDatePoll`) **plus names**, like a WhatsApp poll. Per night,
  sorted best first: the counts, `people` = who said **yes** and `no` = who said **no** to that night
  (`name`, `avatarId`), each sorted by name. `declined` (top level) = who said no to **every** night.
  The viewer's own entries carry `"self": true`. Only people with a display profile (onboarded account) are
  counted or named, exactly as for the counts. The top-level `poll.people` is always `[]` in availability
  mode (legacy field of the old single-date poll).
- **Answered vs. not answered.** A person has *responded* once at least one night is explicitly `true` or
  `false`. "I can't make any of these nights" is a PUT with every night `false` (and `favourite: null`): a
  saved answer, listed in `declined`, counted in `voteCount`, and **never reminded**. An empty
  `availability: {}` (or no PUT) is "not answered yet". The page should offer an explicit
  "Ik kan geen van deze avonden" button that sends all nights `false`. `voteCount` = number of people who
  responded.
- Names are only on this route (pass GET, session GET) and in organiser responses. The **public plan GET**
  (`GET /plans/<planId>`) still shows **counts only**: no `people`/`no` per night, no `declined`.
- `pick` is `"manual"` (organiser picks) or `"auto"` (deadline picks). `closesAt` is `null` for a manual
  poll without a deadline. `scheduledDate` / `programmeId` appear once the poll is decided
  (`status: "confirmed"`). Answers are accepted while `status` is `"open"` and, if `closesAt` is set, before
  it. A manual poll past its `closesAt` stays `"open"` (waiting for the organiser) but refuses answers.
- `invitees` (top level, date-poll GET only, pass or session): the display names of everyone holding a live pass for
  this poll (not revoked, not expired, onboarded), sorted, so the page can list members who have not answered yet. Never
  on the public plan GET. It is a read and writes nothing.
- `viewer` is the pass holder's public name/avatar so the page can say "Je antwoordt als Sam".
- The session GET (no pass header) now returns the same shape. `poll` and `viewer` were added; the
  existing fields are unchanged.
- Response header `X-Filmmaand-Reset-Generation` is present as on every API response. Keep it for the PUT.

### PUT: save your own availability (only on a real tap)

```
PUT /filmmaand/api/plans/<planId>/date-poll
X-Filmmaand-Poll-Pass: <token>
Content-Type: application/json
Idempotency-Key: <16–100 chars [A-Za-z0-9_-], new per logical save, reused on retry>
X-Filmmaand-Reset-Generation: <value from the GET response header>   # required when it isn't "0"
```

```json
{
  "pollId": "date-poll-c8262fd81de9e876e824",
  "revision": 0,
  "availability": {"2026-09-24": false, "2026-09-25": false, "2026-09-26": true},
  "favourite": "2026-09-26"
}
```

- Strict body: exactly these four keys. There is no field that selects *who* votes; the pass decides.
- `availability`: any subset of the poll's nights → `true`/`false`. Nights left out are "unknown".
- `favourite`: `null` or one night that is `true`.
- 200 returns your saved own answer (same object as the GET's top level, `revision` + 1). It does **not**
  include `poll`: this is the existing receipted result, so an exact retry returns byte-identical JSON.
  To show everyone's updated counts, **GET again** after a successful PUT (one cheap read-only request).
  An alternative is to adjust the counts locally.
- The PUT must be triggered by a user action (tap on a night / "Klaar"), never on load.

### POST: organiser pass management

Same URL, `POST`, JSON body with an `action`. Authenticated as organiser, exactly like the existing
`date-poll-manage` route: **either** the organiser cookie (allow-listed account) plus
`X-Filmmaand-Organizer-Id: <own participant id>`, `X-Filmmaand-Reset-Generation`, a same-origin request,
**or** `Authorization: Bearer <PLANNING_ADMIN_TOKEN>` (operator scripts). A pass never authorises these.

| action | body | 200 response |
|---|---|---|
| `issue-passes` | `{"action":"issue-passes","pollId":"…","emails":["a@…"],"people":[{"email":"lotte@…","name":"Lotte","avatarId":12}]}` (1–50 in total; either list may be left out) | `{"pollId","expiresAt","passes":[{"participantId","email","name","created","token","url"}]}` |
| `revoke-passes` | `{"action":"revoke-passes","pollId":"…","emails":[…]}` | `{"pollId","revoked":<count>}` |
| `list-passes` | `{"action":"list-passes","pollId":"…"}` | `{"pollId","passes":[{"participantId","email","name","createdAt","expiresAt","status":"active"\|"revoked"\|"expired"}]}` |
| `list-availability` | `{"action":"list-availability","pollId":"…"}` | `{"datePoll":{…,"needsPick":true\|false}}`: the `poll` object above with names, no `self` flags. Read-only. |
| `nudge-list` | `{"action":"nudge-list","pollId":"…"}` | `{"pollId","answersOpen","recipients":[{"participantId","email","name"}]}`. Read-only. |
| `nudge` | `{"action":"nudge","pollId":"…"}` + **`Idempotency-Key`** | `{"pollId","recipients":[{"participantId","name"}]}`: who was queued a reminder. |

- All but `nudge` need no `Idempotency-Key` (with the organiser cookie they still need `X-Filmmaand-Reset-Generation`).

**Accounts at mint time (`people`).** `emails` = people who already have an onboarded account (unchanged
rules: unknown → `404 recipient_unknown`, no name/avatar → `409 recipient_not_onboarded`). `people` = friends
who may not have one: `{email, name, avatarId?}` (name 1–32 chars, no markup; `avatarId` optional, an
active avatar from the collection; if left out, the first free avatar is assigned).
- No account: one is created with that name + avatar (`created: true`). It is created exactly like the
  email-code login creates accounts, so the friend can later log in with an email code as that account,
  already onboarded.
- Account without name/avatar: that name + avatar is set (`created: false`).
- Account with a profile: nothing about it changes; the supplied name/avatar is ignored (`created: false`).
- The profile is set at mint time because the poll ignores answers from people without one. So every
  minted friend's vote counts.
- **All-or-nothing**: accounts and passes are written in one transaction. Any bad entry (invalid name or
  email, avatar already someone else's or chosen twice, unknown plain email) refuses the whole request
  with `details.emails`, and nothing is created or minted.
- Test addresses (`*.test`, `example.com`, …) never receive notification mail.

**Reminders (`nudge-list`, `nudge`).** Organiser-triggered only. Nothing schedules, queues or sends a
reminder by itself (the tick and every read leave the outbox untouched; tested).
- Who: people with a working pass for this poll (not revoked, not expired, onboarded) who have **not
  responded**. Anyone who answered, **including all-no**, is left out. People without a pass are never
  included. When the poll no longer takes answers (picked, closed, past `closesAt`), `nudge-list` is empty
  and `nudge` is `409 date_poll_closed`.
- `nudge` records a plan receipt under the `Idempotency-Key` (the existing pattern: an exact retry returns
  the same body and queues nothing again, even after delivery; the same key with another body is
  `409 key_reused`). It queues one mail per recipient into the **existing event-notification outbox**
  (type `poll-nudge`). Delivery goes through the normal event drain (after a write request or on the
  scheduled tick) and only when event notifications are enabled, with the usual recipient policy
  (opt-outs, suppressions, allow-list, daily/monthly caps).
- At delivery the reminder is dropped if the poll moved on, stopped taking answers, or the person answered
  in the meantime.
- **The link.** Only token hashes are stored, so the literal earlier link cannot be put in the reminder.
  Delivery mints **one extra pass** for the same person and poll inside the delivery transaction, puts it
  in the mail, and keeps only its hash. The earlier link keeps working. `issue-passes` (rotate) and
  `revoke-passes` revoke all of that person's passes for the poll.

**Reminder text** (edit in `filmmaand-server/poll-nudge-mail.mjs`; `{{NIGHTS}}` becomes e.g.
"do 24, vr 25 of za 26 september"):

```
Onderwerp: Movie deze week?

Hoi {{NAME}},

Movie deze week? Je hebt nog niet gestemd.

Welke avond kun jij: {{NIGHTS}}? Kun je geen enkele avond, laat dat dan ook even weten. Dan krijg je hierover geen herinnering meer.

Stemmen: {{POLL_URL}}

Alec Filmmaand
```

**`needsPick`** (organiser responses only: `list-availability`, and `open`/`pick`/`close`): `true` while a
manual poll is still open from the day before its last night (Amsterdam), i.e. from vr 25 Sept 00:00 for
the 24–26 poll. It is a flag for Beheer, never a mail. Participants never see it.

- `issue-passes` is **all-or-nothing** and requires an **open availability poll** whose id equals
  `pollId`. Issuing for someone who already has an active pass for this poll **rotates** it: the old link
  stops working immediately. `expiresAt`: see *Expiry* above (manual: `window.end` + 2 days; auto:
  `closesAt` + 24h).
- The plaintext `token`/`url` is returned **once**, in this response only. It cannot be listed or
  recovered later. If a link is lost, issue again (rotate).
- `list-passes` never returns tokens or hashes.
- Other `action`s go to the existing `manageDatePoll` (organiser auth **and** an `Idempotency-Key`, 16–100
  chars `[A-Za-z0-9_-]`). They return `{"datePoll":{…}}` with names per night:

| action | body | notes |
|---|---|---|
| `open` | `{"action":"open","mode":"availability","pick":"manual","window":{"start","end"},"choices":[]}` (+ optional `"closesAt"`, `"programmeId"`) | Window: 1–7 upcoming days inside the plan. **Manual**: `closesAt` optional; if given, in the future and on an Amsterdam date **≤ `window.end`**. **Auto** (no `pick` or `"auto"`): `closesAt` required and on an Amsterdam date **before `window.start`** (unchanged). |
| `pick` | `{"action":"pick","pollId":"…","date":"YYYY-MM-DD"}` | The organiser decides. `date`: a night in the window, today or later, whatever the counts. Allowed while the poll is `open` (manual or auto) or `needs-organizer` (auto deadline found no night). Does what the deadline did for auto polls: puts the night on the programme (the linked `programmeId` night, else a new pending night `night-<pollId>`), sets `status:"confirmed"`, `scheduledDate`, `programmeId`, `closedAt`, and emits the `date-confirmed` notice (**this queues the "De datum staat vast" mail to participants**, as the auto path always did). Once only. |
| `close` | `{"action":"close","pollId":"…"}` | Unchanged; for availability polls it now also records `closedAt` (starts the 24h pass grace for a manual poll). Schedules nothing. |

- **Manual polls are never scheduled by time.** Neither the scheduled coordination job nor the read-path tick
  touches a manual poll, however far past `closesAt` or past the window. If the organiser never picks,
  the poll just stays open (tested up to three weeks past the window).

## Shared doodles (the /filmmaand/wanneer/ stickers)

One doodle per person per poll, drawn in the page's notebook pad (Capsule's eggs) and shown to everyone in the poll as a
sticker with name and time. Stored on the poll (`datePoll.doodles`), so a new poll starts empty.

```
PUT /filmmaand/api/plans/<planId>/date-poll-doodle
X-Filmmaand-Poll-Pass: <token>            # or the session cookie (onboarded account)
Idempotency-Key: <16–100 chars>           # X-Filmmaand-Reset-Generation as for any write
{"pollId":"date-poll-…","s":[["k",[[12.3,40.1],[13,41.5]]],["r",[[50,50]]]],"t":"21:07"}
```

- **Own only.** Adds or replaces the caller's own doodle. The strict body has no field that selects whose doodle, so a pass
  can never write anyone else's. This is the one route besides `date-poll` that accepts a pass, and only for `PUT`
  (every other method → `405`). A dead pass → the uniform `401 pass_invalid`.
- **Shape** = what Capsule's eggs produce (`kits/…/jasjes2/eggs/CHAT-CADENCE.md`): `s` = `[[ink,[[x,y],…]],…]`, ink
  `"k"`|`"r"`, x/y finite numbers, clamped to 0..100 and rounded to 0.1. The client's `t` is accepted and ignored: the
  server stamps author, `at` and `t` (HH:MM Amsterdam). Hard caps after rounding: **4096 bytes of JSON**, 64 strokes, 2000 points (`400 doodle_too_big`);
  anything else malformed → `400 doodle`.
- 200 → `{"doodle":{"id":"doodle-<16 hex>","at":"<ISO>","t":"HH:MM","s":[…]},"doodles":[…everyone's visible…]}`. The id is
  stable per person per poll. The response already carries the full list, so the page needs **no GET after a send**.
- Only while the poll takes answers (`409 date_poll_closed` after a pick/close/`closesAt`); `409 date_poll_changed` on
  a stale `pollId`.
- **Read.** The date-poll GET (pass or session) gets a top-level `doodles`:
  `[{"id","name","avatarId","at","t","s","self"?}]`, oldest first. It includes only people with a display profile and
  never includes hidden doodles. The public plan GET never has doodles.
- **Never mail.** A doodle touches no notice, outbox or notification (tested: the state diff is exactly the caller's
  slot plus the receipt). Private, `Cache-Control: private, no-store`, no `Set-Cookie`.
- **Kill switch (organiser).** `POST …/date-poll` `{"action":"hide-doodle","pollId","doodleId","hidden":true|false}`,
  with organiser auth and an `Idempotency-Key`, like `pick`/`close`. Hiding is per person and sticky: a replacement stays
  hidden until unhidden. The author doesn't see it either. `list-availability` (and every organiser `datePoll`
  response) carries `doodles:[{id,name,at,hidden,bytes}]` without strokes. Unknown id → `404 doodle_unknown`.

## Text chat (phase 3, same channel)

```
POST /filmmaand/api/plans/<planId>/date-poll-chat?since=<cursor>
X-Filmmaand-Poll-Pass: <token>            # or the session cookie (onboarded account)
Idempotency-Key: <16–100 chars>           # X-Filmmaand-Reset-Generation as for any write
{"pollId":"date-poll-…","text":"movie zaterdag?"}
```

- **Own person only.** The strict body `{pollId, text}` has no field for author, name, time or seq; the server stamps
  them. A pass writes as its holder; a dead pass → `401 pass_invalid`. Only `POST` (other methods → `405`).
- **Text.** Plain text, NFC, `\r` dropped, trimmed; 1..500 code points, at most 9 lines (`400 chat_too_long`). Control and
  bidi-override characters (incl. tab, U+2028/2029) → `400 chat`. **Render with `textContent`**: HTML stays text.
- **Rate limit** per person: 5 per minute and 40 per hour → `429 chat_rate` with `details.retryAfter` (seconds). It is
  computed from the stored messages at write time, so reads never write. Per poll at most 400 messages
  (`409 chat_full`). Open while the poll takes answers **and after a pick until the end of the picked night**
  (Amsterdam 23:59; `chat.open` on the GET says which). A close without a pick closes it at once (`409 date_poll_closed`).
- 200 → `{"message":{id,seq,name,avatarId,at,t,text,self:true},"chat":{"messages":[…seq > since…],"cursor":<n>,"hidden":[ids]}}`.
  The receipt stores only `{message}`, so an exact retry returns just that (keep your cursor and dedupe by `id`).
- **Read** = the date-poll GET with `?since=<cursor>` (pass or session): top-level
  `chat:{messages:[{id,seq,name,avatarId,at,t,text,self?}], cursor, hidden:[ids]}`. `since` absent or invalid = 0 =
  everything. `hidden` lists every hidden id so a client can remove one it already shows. Never on the public plan GET.
- **Never mail**, private, `no-store`, no cookie.
- **Kill switch (organiser):** `POST …/date-poll` `{"action":"hide-message","pollId","messageId","hidden":true|false}`
  (+ `Idempotency-Key`). Hidden for everyone, including the writer. Organiser views carry `chat:[{id,name,at,text,hidden}]`;
  Beheer lists them under "Berichten" with Verbergen / Weer tonen. Unknown id → `404 message_unknown`.

**Cadence (Chris, "B").** The page reads on open, on tab visible or window focus (at most once per 15 s), and twice after a
doodle send (+20 s, +60 s, visible tab only). Nothing else is timed: an idle page makes zero requests.

## Confirmation after the pick + RSVP ("Ben je erbij?")

- **The pick** (organiser, Beheer "Deze avond kiezen" or `pick`) takes optional `tijd` and `waar` (plain text, ≤ 40 chars;
  defaults `"20:00"` / `"bij Alec"`). For a **manual** poll it queues **one confirmation per poll participant** (live pass
  holders + everyone who answered, onboarded) in the same transaction, type `poll-confirm`. Replays queue nothing more.
  The generic site-wide "De datum staat vast" fan-out is **skipped** for that pick (the coordination event carries
  `pollConfirm`), so nobody gets two mails and accounts outside the poll get none (tested, mutation-checked).
- **Delivery** mints the person's own pass and renders the **pluggable** `filmmaand-server/poll-confirm-template.mjs`
  (`subject(ctx)`, `text(ctx)`, `html(ctx)`; `ctx = {name, avond, tijd, waar, namen, jaUrl, neeUrl, assetBase}`;
  `namen` = who said yes to that night; `assetBase` without a trailing slash). The renderer refuses a template without
  both links. It ships **plain** (Chris, 23 Sept): subject "het wordt zaterdag 26 september!", "Hoi <naam>," /
  "De avond staat vast: <avond>, <tijd>, <waar>." / "Ben je erbij?" / Ja, ik kom + Toch niet links / "Je kunt het nog
  aanpassen tot de avond zelf." / "Alec". Dropped at delivery once the night is over or the poll moved on.
- **Links**: `jaUrl`/`neeUrl` = `/filmmaand/wanneer/?pas=<token>&antwoord=ja|nee`. The page **only pre-selects** from
  `antwoord` (and strips it from the URL); a GET never saves anything (tested).
- **RSVP**: `PUT /filmmaand/api/plans/<planId>/date-poll-rsvp` (pass or session, `Idempotency-Key`), strict body
  `{"pollId","answer":"ja"|"nee"}`: your own answer only (no field selects whose). Open from the pick until the end of
  the picked night (Amsterdam midnight); then `409 rsvp_closed`; before a pick also `409 rsvp_closed`. Only `PUT`.
  The date-poll GET carries your own `rsvp: {answer, at, open}`. Organiser views carry `rsvp:[{name, answer, at}]`;
  Beheer shows Komt / Komt niet / Nog niet gereageerd under the picked night.
- The pass scope widens to exactly this `PUT` (besides the date-poll GET/PUT, doodle PUT and chat POST).

## Error codes

| status | code | when |
|---|---|---|
| 401 | `pass_invalid` | Pass malformed, unknown, revoked, rotated, expired, for another plan, for an earlier/other poll, for a plan that doesn't exist, or holder no longer onboarded. **One identical body for all cases**, so nothing leaks about existence. Message: "Deze link werkt niet (meer). Vraag de organisator om een nieuwe link." |
| 405 | `method` | Pass header on a method other than GET/PUT (e.g. POST `close`). Nothing runs. |
| 400 | `date_poll` / `availability` | PUT body shape wrong / night outside the poll / favourite not a "yes" night. |
| 400 | `request_key` | Missing or bad `Idempotency-Key`. |
| 409 | `revision_conflict` | Your answer changed elsewhere (other device). GET again, then retry. |
| 409 | `date_poll_changed` | `pollId` in the body isn't the current poll. |
| 409 | `date_poll_closed` | PUT: poll decided/closed, or past `closesAt`; GET still works during the 24h grace. `pick`: already decided or closed. |
| 400 | `date_poll_deadline` | `open`: `closesAt` breaks the rule for its mode (see `open` above). |
| 400 | `date_poll_date` | `pick`: date outside the window or already past. |
| 409 | `event_changed` | `pick`: the linked programme night changed since the poll opened. |
| 409 | `key_reused` | Same Idempotency-Key with a different body. |
| 409 | `reset_generation` | Missing/stale `X-Filmmaand-Reset-Generation` on a write. Reload. |
| 401 / 403 / 409 | `unauthorized`, `session_required`, `organizer_required`, `organizer_changed` | Organiser actions without valid organiser auth. |
| 404 | `recipient_unknown` | `issue`/`revoke`: a plain email has no account (use `people` with a name). `details.emails`. Nothing minted. |
| 409 | `recipient_not_onboarded` | An account has no name/avatar yet, so their answers would not be counted. `details.emails`. |
| 409 | `date_poll_not_open` | `issue`: no open availability poll. |
| 409 | `date_poll_changed` | `pollId` is not the current poll (`issue`, `pick`, `close`, `list-availability`, `nudge-list`, `nudge`). |
| 400 | `recipients` / `name` / `avatar` | `issue`: bad recipient list or `people` entry. `details.emails`. Nothing created. |
| 409 | `avatar_taken` / `avatar_unavailable` | `issue`: chosen avatar belongs to someone else (or twice in the request) / no free avatar left. Nothing created. |
| 503 | `pass_limit` | More than 2000 stored passes (rows >30 days past expiry are pruned on issue). |

## Beheer: "Wie kan wanneer" (the organiser panel, no curl needed)

`/filmmaand/beheer/`, logged in as the organiser. It appears when the current poll is an availability poll:
- a **needsPick banner** ("Tijd om een avond te kiezen…") from `list-availability`;
- **per night**, best first: yes names, no names; plus "Kan geen enkele avond" (declined) and "Nog niet geantwoord"
  (active pass holders who haven't answered);
- **Deze avond kiezen** per night → confirm: "Dit MAILT iedereen in de poll meteen 'De datum staat vast'…" → `pick`;
- **Herinnering**: the exact `nudge-list` names → "Herinnering sturen aan N mensen" → confirm naming them → `nudge`;
- **Tekeningen**: every doodle with Verbergen / Weer tonen → confirm → `hide-doodle`.

Reads are the read-only `list-availability`, `list-passes` and `nudge-list`. Every action uses Beheer's existing path:
the confirm dialog (focus on "Terug", never on "Bevestigen"), a stored receipt with an `Idempotency-Key`, then the send.
Tests: `filmmaand-server/beheer-poll-panel.test.mjs`, `launch.test.mjs`.

### The launch, all from Beheer (no curl)

1. **Datumpoll openen** (section right under the panel): first/last night; **manual by default** (`pick:"manual"`),
   the deadline is optional. "Automatisch kiezen op de sluitingstijd" (off by default) gives the old auto poll and needs
   a deadline. Opening mails nobody.
2. **Uitnodigen**: a textarea, one person per line `naam, e-mail` → **Links aanmaken** → confirm → `issue-passes` with
   `people` (atomic; accounts are created for newcomers). The status line shows who got a link and whose account is new.
   The working links in that response are **never shown or kept** in Beheer. Anyone who already has a live link is
   **skipped**, because issuing again would rotate it and kill a link that may already be mailed. Issuing mails nobody.
3. **Uitnodiging sturen aan N mensen** → confirm naming them → action `invite` (below).

### `invite-list` / `invite` (organiser, like `nudge-list` / `nudge`)

- `invite-list` (read-only): live pass holders who have **not been invited yet** for this poll and haven't answered.
- `invite` + `Idempotency-Key`: queues **one** invitation per such person into the event outbox (type `poll-invite`).
  **One per person per poll, ever**: the seen-ledger key has no request scope, so a replay, a second click or a new key
  never mails anyone twice. People added later are invited by the next send. `409 date_poll_closed` once answers close.
- **Delivery** mints that person's own extra pass inside the delivery transaction, as reminders do (only hashes stored),
  and renders the **pluggable template** `filmmaand-server/poll-invite-template.mjs` (`subject`, `text(ctx)`,
  `html(ctx)`; `ctx = {pollUrl, name, nights, assetBase}`; the renderer refuses a template that drops the link).
  Images: `assetBase` = `https://ely0030.xyz/filmmaand/assets/mail/` (files in `public/filmmaand/assets/mail/`).
  It ships with a **plain placeholder** (subject "movie deze week?", "Hoi <naam>," / "movie deze week? <avonden>" / link /
  "Alec"); Chris's chosen design goes into that file.
- Dropped at delivery if the poll moved on or closed (e.g. picked), if the person already answered, or if they have no
  profile. It follows the normal recipient policy (opt-outs, suppressions, allow-list, `.test`/`example.com` never
  mailed) and the daily/monthly caps. Nothing is sent unless event notifications are enabled with a transport; QA and
  tests use a captured sender.

## Organiser steps (do 24 – za 26 September, manual)

`$ORIGIN` = `https://ely0030.xyz`, `$PLAN` = the plan id. With the organiser cookie instead of the bearer,
add `X-Filmmaand-Organizer-Id` and `X-Filmmaand-Reset-Generation` as in Beheer.

1. **Open the poll**, manual, no deadline (answers stay open until you pick):

   ```sh
   curl -sS -X POST "$ORIGIN/filmmaand/api/plans/$PLAN/date-poll" \
     -H "Authorization: Bearer $PLANNING_ADMIN_TOKEN" -H "Idempotency-Key: open-sept-manual-0001" \
     -H 'Content-Type: application/json' \
     -d '{"action":"open","mode":"availability","pick":"manual","window":{"start":"2026-09-24","end":"2026-09-26"},"choices":[]}'
   ```

   Optional: add `"closesAt":"2026-09-26T16:00:00Z"` to stop answers at a time (any moment up to
   za 26 Sept 23:59 Amsterdam). If an older poll is still open, `close` it first (`409 date_poll_open`).
   Note the returned `datePoll.id`.
2. **Recipients**: people with an account go in `emails`; friends without one (or without name/avatar) go
   in `people` with a name (and optionally an avatar). Their account is created on the spot.
3. **Mint the passes**:

   ```sh
   curl -sS -X POST "$ORIGIN/filmmaand/api/plans/$PLAN/date-poll" \
     -H "Authorization: Bearer $PLANNING_ADMIN_TOKEN" -H 'Content-Type: application/json' \
     -d '{"action":"issue-passes","pollId":"<datePoll.id>","emails":["noor@…","sam@…"],"people":[{"email":"lotte@…","name":"Lotte"}]}'
   ```

   Put each `passes[i].url` into that person's own mail as `{{POLL_URL}}`. Treat the response as a
   secret (it contains working links). Don't paste it into issues/chat and don't commit it.
4. **See who can come** (names per night, best night first):

   ```sh
   curl -sS -X POST "$ORIGIN/filmmaand/api/plans/$PLAN/date-poll" \
     -H "Authorization: Bearer $PLANNING_ADMIN_TOKEN" -H 'Content-Type: application/json' \
     -d '{"action":"list-availability","pollId":"<datePoll.id>"}'
   ```

   Or open the poll page logged in as yourself (session GET shows the same names). `needsPick: true`
   from vr 25 means: time to pick.
5. **Remind who hasn't answered** (optional, only when you decide to). First look:

   ```sh
   curl -sS -X POST "$ORIGIN/filmmaand/api/plans/$PLAN/date-poll" \
     -H "Authorization: Bearer $PLANNING_ADMIN_TOKEN" -H 'Content-Type: application/json' \
     -d '{"action":"nudge-list","pollId":"<datePoll.id>"}'
   ```

   Then send (this queues real mail to exactly that list; people who said no to everything are never on it):

   ```sh
   curl -sS -X POST "$ORIGIN/filmmaand/api/plans/$PLAN/date-poll" \
     -H "Authorization: Bearer $PLANNING_ADMIN_TOKEN" -H "Idempotency-Key: nudge-sept-poll-0001" \
     -H 'Content-Type: application/json' \
     -d '{"action":"nudge","pollId":"<datePoll.id>"}'
   ```

   A second reminder later needs a new `Idempotency-Key`; retrying with the same key sends nothing new.
6. **Pick the night** (e.g. vr 25):

   ```sh
   curl -sS -X POST "$ORIGIN/filmmaand/api/plans/$PLAN/date-poll" \
     -H "Authorization: Bearer $PLANNING_ADMIN_TOKEN" -H "Idempotency-Key: pick-sept-night-0001" \
     -H 'Content-Type: application/json' \
     -d '{"action":"pick","pollId":"<datePoll.id>","date":"2026-09-25"}'
   ```

   The night goes on the programme, the poll becomes `confirmed`, and the normal "De datum staat vast"
   notification is queued. Retrying with the same `Idempotency-Key` returns the same result.
7. **Rotate** one person's link: `issue-passes` with just their email. **Revoke**: `revoke-passes`.
   **Check**: `list-passes`.
8. Nothing to clean up: passes stop working 24h after the pick (or `close`), and at the latest 28 Sept
   00:00Z, or when a new poll replaces this one.

## Cost notes

- The pass GET does one strongly consistent state read (the same `transact` read every API request does)
  plus an in-memory SQLite lookup by primary key. No writes, no drains (the handler skips drains on GET),
  no movie-catalogue enrichment (that only runs on the plan GET). Byte-identical state before/after is
  tested.
- The new `poll_passes` table is left out of the exported state until it has a row, so deploying this
  does not make the first reads after deploy write the state blob.
- Writes (PUT, organiser POST) behave like existing date-poll writes (same mail/event drain path).

## Decided (Chris, 23 Sept)

- The organiser picks the night (`pick:"manual"`); nothing is auto-scheduled. The old auto mode stays for
  polls opened without `pick`.
- Manual `closesAt` is optional and may fall on or before the last night.
- Names per night, for yes **and** no, are visible to everyone in the poll (pass/session GET) and to the
  organiser. Not on the public plan GET.
- Pass grace: valid while open, 24h read-only after the pick/close.
- Friends without an account: `issue-passes` creates it from email + name (+ avatar).
- "None of these nights" is a real answer and is never reminded.
- Reminders only when the organiser runs `nudge`; the "nobody picked yet" reminder is the `needsPick` flag,
  not a mail.

## Open questions for the product owner

1. **Names on the public plan page.** Still date-poll route only (see above). If the plan page should show
   them too, that is a one-line change, but it makes names public to anyone with the plan link.
2. **Unverified addresses.** An account created at mint time trusts the email the organiser typed (like the
   organiser mailing the link himself). It can receive reminders and, later, log in with an email code
   sent to that address. OK?
