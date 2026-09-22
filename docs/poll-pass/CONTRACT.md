# Poll pass: API contract

Branch `feat/poll-pass`. Design: `kits/invitations/POLL-PASS.md` (Cameo, 22 Sept). Code:
`filmmaand-server/runtime/planning/auth/poll-passes.mjs`, `api.mjs` (date-poll route),
`runtime/planning/service.mjs` (`getDatePollAs`, `voteDatePollAs`, `datePollInfo`), table
`poll_passes` in `runtime/planning/auth/store.mjs` + `state.mjs`. Tests: `filmmaand-server/poll-pass.test.mjs`.

## What a pass is

- A random 43-character base64url token (32 random bytes). One per recipient per poll. Only its SHA-256 is
  stored (`poll_passes.token_hash`). No plaintext token is written to state, to receipts, or to logs.
- It identifies **one participant for one date poll on one plan**. With it you can read that poll
  (`GET`) and set **your own** availability (`PUT`). Nothing else: every other route ignores the header.
- It is valid while **all** of these hold: the plan in the URL is the plan it was minted for, that plan's
  *current* poll is the poll it was minted for, it is not revoked, `now < poll.closesAt + 24h`, and the
  participant still has a name/avatar (is onboarded).
- It is **not** a login. It never sets a cookie and never creates a session. (The design's optional
  "log that browser in after the first tap" add-on is **not built**. Default off, as designed.)
- Resolving a pass only reads. No last-used timestamp, no counter, no rate limit, no consumption. So a
  mail scanner that fetches the link (or even runs the page's JS and issues the GET) changes nothing.

## How the page carries the token

1. The mail link is `https://ely0030.xyz/filmmaand/?pas=<token>`. The existing handler 302-redirects
   `/filmmaand/?…` to `/filmmaand/programma/?…` **with the query string preserved** and without touching
   state (the redirect happens before any store access).
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
  "revision": 0,
  "availability": {},
  "favourite": null,
  "poll": {
    "id": "date-poll-c8262fd81de9e876e824",
    "mode": "availability",
    "status": "open",
    "window": {"start": "2026-09-23", "end": "2026-09-26"},
    "choices": [],
    "closesAt": "2026-09-22T21:00:00.000Z",
    "ranking": [
      {"date": "2026-09-26", "available": 1, "unavailable": 0, "favourites": 1},
      {"date": "2026-09-23", "available": 1, "unavailable": 0, "favourites": 0},
      {"date": "2026-09-24", "available": 0, "unavailable": 1, "favourites": 0},
      {"date": "2026-09-25", "available": 0, "unavailable": 1, "favourites": 0}
    ],
    "leaderDates": ["2026-09-26"],
    "voteCount": 1,
    "people": []
  },
  "viewer": {"name": "Sam", "avatarId": 7}
}
```

- Top level (`pollId`, `revision`, `availability`, `favourite`) is **your own** answer, the same shape
  the session GET returned before. `revision` must be echoed on the next PUT.
- `poll` is exactly the public projection the plan GET already shows everyone (`publicDatePoll`):
  per-night counts, sorted best first. Availability mode shows **counts, not names** (`people` is
  always `[]`); see the open question at the end. `scheduledDate` / `programmeId` appear once the poll
  is decided.
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
  "availability": {"2026-09-23": true, "2026-09-24": false, "2026-09-25": false, "2026-09-26": true},
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
| `issue-passes` | `{"action":"issue-passes","pollId":"…","emails":["a@…","b@…"]}` (1–50) | `{"pollId","expiresAt","passes":[{"participantId","email","name","token","url"}]}` |
| `revoke-passes` | `{"action":"revoke-passes","pollId":"…","emails":[…]}` | `{"pollId","revoked":<count>}` |
| `list-passes` | `{"action":"list-passes","pollId":"…"}` | `{"pollId","passes":[{"participantId","email","name","createdAt","expiresAt","status":"active"\|"revoked"\|"expired"}]}` |

- `issue-passes` is **all-or-nothing** and requires an **open availability poll** whose id equals
  `pollId`. Issuing for someone who already has an active pass for this poll **rotates** it: the old link
  stops working immediately. `expiresAt` = poll `closesAt` + 24h.
- The plaintext `token`/`url` is returned **once**, in this response only. It cannot be listed or
  recovered later. If a link is lost, issue again (rotate).
- `list-passes` never returns tokens or hashes.
- Other `action`s (`open`, `close`, …) keep going to the existing `manageDatePoll` unchanged.

## Error codes

| status | code | when |
|---|---|---|
| 401 | `pass_invalid` | Pass malformed, unknown, revoked, rotated, expired, for another plan, for an earlier/other poll, for a plan that doesn't exist, or holder no longer onboarded. **One identical body for all cases**, so nothing leaks about existence. Message: "Deze link werkt niet (meer). Vraag de organisator om een nieuwe link." |
| 405 | `method` | Pass header on a method other than GET/PUT (e.g. POST `close`). Nothing runs. |
| 400 | `date_poll` / `availability` | PUT body shape wrong / night outside the poll / favourite not a "yes" night. |
| 400 | `request_key` | Missing or bad `Idempotency-Key`. |
| 409 | `revision_conflict` | Your answer changed elsewhere (other device). GET again, then retry. |
| 409 | `date_poll_changed` | `pollId` in the body isn't the current poll. |
| 409 | `date_poll_closed` | Poll closed (past `closesAt`); GET still works during the 24h grace. |
| 409 | `key_reused` | Same Idempotency-Key with a different body. |
| 409 | `reset_generation` | Missing/stale `X-Filmmaand-Reset-Generation` on a write. Reload. |
| 401 / 403 / 409 | `unauthorized`, `session_required`, `organizer_required`, `organizer_changed` | Organiser actions without valid organiser auth. |
| 404 | `recipient_unknown` | `issue`/`revoke`: an email has no account. `details.emails` lists them. Nothing minted. |
| 409 | `recipient_not_onboarded` | An account has no name/avatar yet, so their answers would not be counted. `details.emails`. |
| 409 | `date_poll_not_open` | `issue`: no open availability poll. |
| 503 | `pass_limit` | More than 2000 stored passes (rows >30 days past expiry are pruned on issue). |

## Organiser steps (for the 23–26 September poll)

1. **Open the poll** (existing route, unchanged): in Beheer, or

   ```sh
   curl -sS -X POST "$ORIGIN/filmmaand/api/plans/$PLAN/date-poll" \
     -H "Authorization: Bearer $PLANNING_ADMIN_TOKEN" -H "Idempotency-Key: open-sept-poll-000001" \
     -H 'Content-Type: application/json' \
     -d '{"action":"open","mode":"availability","window":{"start":"2026-09-23","end":"2026-09-26"},"choices":[],"closesAt":"2026-09-22T21:00:00Z"}'
   ```

   Existing rule: `closesAt` must fall on an Amsterdam **date before** the first candidate night, so for
   wo 23 Sept the poll must close by **22 Sept 23:59 Amsterdam (21:59Z)**. See the open questions.
   Note the returned `datePoll.id`.
2. **Every recipient needs an onboarded account** (name + avatar). `issue-passes` names anyone who doesn't.
3. **Mint the passes**:

   ```sh
   curl -sS -X POST "$ORIGIN/filmmaand/api/plans/$PLAN/date-poll" \
     -H "Authorization: Bearer $PLANNING_ADMIN_TOKEN" -H 'Content-Type: application/json' \
     -d '{"action":"issue-passes","pollId":"<datePoll.id>","emails":["noor@…","sam@…"]}'
   ```

   Put each `passes[i].url` into that person's own mail as `{{POLL_URL}}`. Treat the response as a
   secret (it contains working links). Don't paste it into issues/chat and don't commit it.
4. **Rotate** one person's link: `issue-passes` with just their email. **Revoke**: `revoke-passes`.
   **Check**: `list-passes`.
5. Nothing to clean up: passes die at `closesAt + 24h`, or when a new poll replaces this one.

## Cost notes

- The pass GET does one strongly consistent state read (the same `transact` read every API request does)
  plus an in-memory SQLite lookup by primary key. No writes, no drains (the handler skips drains on GET),
  no movie-catalogue enrichment (that only runs on the plan GET). Byte-identical state before/after is
  tested.
- The new `poll_passes` table is left out of the exported state until it has a row, so deploying this
  does not make the first reads after deploy write the state blob.
- Writes (PUT, organiser POST) behave like existing date-poll writes (same mail/event drain path).

## Open questions for the product owner

1. **Deadline today.** With the current rule (poll closes before the first candidate night), a poll that
   includes wo 23 Sept must close by **tonight, 22 Sept 23:59**. At the deadline the existing tick
   finalises it automatically and schedules the best night. Do we want that, or should the rule allow
   closing on/after the first candidate night? That would be a separate change to `openAvailabilityPoll`,
   which I did not touch.
2. **"Everyone's answers visible."** The availability poll shows per-night counts (`2 kunnen, 1 niet`),
   not names. Showing who can make which night means a change to `publicDatePoll` (and it would become
   visible on the public plan GET too). Counts only, or names?
3. **Friends without an account.** A pass needs an existing, onboarded account. Minting for a new email
   is refused, not auto-created. OK, or should minting create accounts?
4. **Grace period** is 24h after `closesAt` (read-only, since writes stop at close). Fine?
