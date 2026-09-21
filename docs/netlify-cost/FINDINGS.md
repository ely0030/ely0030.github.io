# Netlify compute burn — findings and fixes

Chalice, 21 September 2026. Companion to `CHALICE-HANDOFF.md`; see also Cameo's
`INTEGRATION.md`. **Landed:** `b9429c6` fast-forwarded onto `main` 16:03Z. The push produced no
deploy — Netlify blocks builds while usage is exceeded — so the fix sits on `main` and goes live
**only once a build is triggered**, which restoring credits does *not* do on its own (see item 4). Post-merge corrections are marked below. Cameo measured the account side
(report: `usages_exceeded: credits, ENFORCED, exceeded_at 2026-09-18T21:00:25Z`); this file covers
the per-invocation mechanism, the patch, and what is still uncertain.

## State of the site

**The site is fully down, not just the functions.** `https://ely0030.xyz/`, the Programme page and
every API path return `503 {"error":"usage_exceeded"}` with `server: Netlify`. A plain static asset
returns it too. 1000 credits were spent in seven days (11–18 September), against a monthly budget.

That also means production is unmeasurable right now: no live latency, and the account API exposes
no per-invocation duration (Cameo's dead ends: `/accounts/<id>/usage`, `/billing/usage`, `/credits`,
`/functions/<name>/logs` all 404). Everything below is measured from source and from local
instruments, and is labelled as forecast where it is forecast.

## Cause

Both functions are 1024 MB, so **GB-hours == seconds of runtime**. 104 GB-hr = 374,400 billed
seconds in 7 days = 37 s of function time per 60 s of wall clock, ~4.5x over budget.

### A. Every request rebuilt the entire state three times

`handler.mjs` ran `mail.drain()` before the request and `events.drain({limit:2})` after it, on
*every* invocation including read-only polls. Each of those, plus the API call itself, is a separate
`transact()`: a full strongly-consistent download of the `state-v1` blob, a fresh in-memory SQLite
built by re-INSERTing all ten auth tables row by row, then `JSON.stringify` over the whole state
**twice** to decide whether anything changed.

Measured locally (`bench-transact.mjs`, node 24, this machine — a 1024 MB Lambda is slower):

| state | blob | parse | hydrate | export | idle diff | one cycle |
|---|---|---|---|---|---|---|
| light history | 108 KB | 0.8 ms | 4.8 ms | 0.4 ms | 0.9 ms | **6.7 ms** |
| ~3 months of use | 531 KB | 1.9 ms | 12.3 ms | 0.7 ms | 5.0 ms | **19.9 ms** |
| retention caps reached | 2.8 MB | 13.5 ms | 60.8 ms | 3.4 ms | 17.1 ms | **99.8 ms** |

CPU is the smaller half; the three strongly-consistent blob round trips are the larger one. Note the
feedback loop: `rate_limits` and `receipts` grow with traffic, so more traffic makes every later
request more expensive.

On the browser side one open Programma tab ran three independent pollers (10 s, 15 s, 15 s) and
`programme-strip.js` sits in the shared site shell, so Films and Stemmen polled too.

### B. The public plan GET blocked on one provider call per film

`service.get()` awaited `movieCatalogue.details()` for **every** film in the plan before answering.
`createMovieRatings` and `createMovieMetadata` are both built with `cachePath: null` in production,
so a cold instance has no durable cache: ratings cost one Netlify Blob read per film (1500 ms cap
each) and metadata costs a TMDB call per film (2500 ms cap each), four at a time. With ~45 options
that is a multi-second request on every cold container, against a 10 s timeout — and a timed-out
invocation bills the full 10 s.

This was not in the handoff's suspect list. It is the reason a single poll could cost seconds
rather than the ~300 ms the blob traffic alone explains.

### C. The cron carried the whole film index

`date-coordination` is scheduled `* * * * *` (43,200 invocations/month, burning with zero visitors)
and shared `initialize()` with the API: it opened `movie-catalogue.sqlite` (150 MB) and
`movie-credits.sqlite` (24 MB), parsed the artwork/programme JSON and built the discovery and API
layers — none of which the tick touches. Both were also in the function's `included_files`, which is
most of the measured 84.8 MB bundle every cold start has to unpack.

## Changes

| file | change |
|---|---|
| `filmmaand-server/handler.mjs` | drains now run on mutations only; the scheduled tick became the standing drain worker for all three mail paths (`events.drain` 1→3, `mail.drain` added) |
| `filmmaand-server/handler.mjs` | `initializeMessaging()` split out — the tick builds store + mail + events + tonight and never opens the catalogue |
| `netlify.toml` | `!filmmaand-server/data/**` excluded from the `date-coordination` bundle |
| `filmmaand-server/runtime/planning/service.mjs` | enrichment runs under `ENRICH_BUDGET_MS` (600 ms, `FILMMAAND_ENRICH_BUDGET_MS`) |
| `public/filmmaand/{site,picker}/programme-strip.js` | 10 s → 60 s |
| `public/filmmaand/agenda/agenda.js` | 15 s → 30 s (`?v=` bumped in `agenda/index.html`) |
| `public/filmmaand/picker/personal-availability.js` | 15 s → 60 s, plus a visibilitychange/focus refresh so a returning tab is instant |
| `public/filmmaand/stemmen/stemmen.js` | 10 s → 20 s (two invocations per cycle) |
| `public/filmmaand/vanavond/app.js` | 30 s → 60 s |

Full state rebuilds per minute, per open page:

| page | before | after | factor |
|---|---|---|---|
| Programma | 14 req x 3 = 42 | 4 x 1 = 4 | 10.5x |
| Stemmen | 18 x 3 = 54 | 7 x 1 = 7 | 7.7x |
| Films | 6 x 3 = 18 | 1 x 1 = 1 | 18x |

## What was deliberately NOT changed

- **Cron cadence stays `* * * * *`.** Slowing it is the obvious saving and it is *not* safe as
  written: `tickCoordination` fires a programme reminder only inside a window exactly
  `reminderMinutes` wide, and Beheer accepts a reminder as short as one minute
  (`beheer.js`: `ri.min=1`). Any slower schedule can skip a short reminder entirely rather than
  delay it. Slowing it needs that minimum clamped first — a product decision, with the tick now
  cheap per invocation either way.
- **No edge caching of the plan GET.** `Netlify-CDN-Cache-Control: public, durable` would remove
  most of the remaining polling cost, but the plan GET marks the caller's own entries with
  `self: true` from their cookie, so it needs a correct `Vary` before it can be shared. Not done
  blind.
- **No read fast path in `transact()`.** Skipping CAS/export/eventual-consistency for GETs is the
  next big lever, but `queueEvents(c)` runs inside the read transaction and *can* legitimately
  write there; a naive fast path would silently drop queued notifications.
- No paid change, no migration, no test email, no live data touched.

## Checks

- `plan-get-enrichment.test.mjs` (new, focused on the changed behaviour): a warm instance still
  enriches every film; a cold one answers under budget and still serves the plan's stored artwork.
  Mutation-checked — against the old unbounded loop the second case takes 1210 ms and **fails**;
  against the patch it takes 404 ms and passes. The pre-existing suite does *not* cover this:
  forcing the budget to 1 ms leaves all of `api`/`theme-composer`/`movie-ratings`/`suggestion-autolike`
  green, which is why the test was added.
- `api`, `entry-routes`, `date-coordination`, `date-coordination-journey`, `round-lifecycle-api`,
  `state`, `event-timing`: 27/27 pass.
- `theme-composer`, `movie-ratings`, `api`, `suggestion-autolike`: 43/43 pass.
- **Pre-existing failure, not from this work, and unowned:** `programme-pending.test.mjs` is 3/6
  red at baseline (verified by reverting only this change). I guessed it belonged to the dirty
  `tonight.mjs` / `event-notifications.mjs` work; Cameo disproved that by stashing those and running
  it on clean `main` — **still 3/6 red**. So it is a real standing failure on `main`, owned by
  nobody: 'explicit date-only pending projects without a film, time or voting association',
  'transition-shaped requests are unsupported', 'concurrent exact create retries append one pending
  entry'. It did not block this merge and should not block the next one, but it needs an owner.
- The handler drain gating has no test harness (`handler.mjs` needs live Netlify Blobs) and was
  reviewed by reading. **Cameo verified it by execution after the merge and it is a net improvement,
  not a trade:** a login code is delivered inline on the POST (`api.mjs:139`, `deliverMail`), so it
  never depended on `drain()` at all, and `/api/auth/code` is a POST so it still drains. The old
  rescue path required *someone to be actively polling*, which meant a stranded send with nobody
  browsing was never rescued; adding `mail.drain()` to `coordinationScheduled` makes it guaranteed
  within 60 s at zero traffic. Cameo also walked the full transitive import graph from the cron
  entry (15 modules, zero references to `data/`, `movie-catalogue`, `movie-credits` or
  `movie-artwork`) and confirmed the catalogue modules do no module-scope file access, so the
  `data/**` exclusion cannot break the import.

## Remaining uncertainty — read this before declaring it fixed

1. **These are forecasts, not a measured bill.** No per-invocation duration is obtainable from the
   Netlify API and production is down, so the split between causes A, B and C is inferred from
   mechanism. The reduction in *work* is certain; the reduction in *credits* is not yet observed.
2. **Headroom is thin, and the burn was worse than 104 GB-hr shows.** Netlify recorded
   `grace_topup_granted_at 2026-09-17T23:27:42Z`, ~21 h before the hard stop, so real consumption
   exceeded the 1000-credit budget rather than just reaching it. 104 GB-hr/7 days is ~4460
   credits/month against that budget and is therefore a *floor*. An 8x reduction lands near 550
   credits/month — under budget, but it scales with how many tabs are open. Watch the first days
   after service resumes; the two deferred levers above are the next step.
3. **Cold-start behaviour changed.** For the first poll or two after a new container starts, films
   may lack overview/backdrop/ratings. Posters committed to the plan are unaffected (asserted in the
   new test). Raise `FILMMAAND_ENRICH_BUDGET_MS` if that is too visible.
4. ~~A topup buys ~3.5 days at the old burn rate; deploy the fixes first.~~
   ~~Corrected after the merge — the ordering problem is gone; a topup now restores the site on new
   code.~~ **Corrected twice. Both earlier versions were wrong, and the second one was dangerous.**

   A topup does **not** restore the site on new code. Restoring credits unpauses the project and it
   serves its **last published deploy** — and that is still `5db79e5`, the 15 September build, i.e.
   exactly the code that burned the credits. There is no build in the resume path. Measured by Cameo
   after the merge:

   - `GET /sites/<id>/deploys` returns 4 records, newest `5db79e5` at `2026-09-15T08:31:22Z`.
     **No deploy record exists for `b9429c6`** — the push was dropped, not queued. (This also closes
     the gap Chalice could not confirm first-hand because of API rate limiting.)
   - `site.published_deploy.commit_ref` = `5db79e5e991bb83ae5eb9010b80cfed0bd2ffa1d`, state `ready`,
     published `2026-09-15T08:32:20.657Z`.
   - `build_settings.stop_builds` = `false`, so nothing at the *site* level blocks building. The
     blocker is purely the account credit state, which means a build triggered after credits return
     will succeed.

   **Therefore the operational requirement is:** after a topup or the 11 Oct reset, a deploy must be
   **explicitly triggered** (a push to `main`, or a manual redeploy). Until that happens the site is
   live on the unfixed code and will burn a fresh balance at the old rate — roughly 3.5 days for a
   500-credit topup. The trap was not closed by landing on `main`; it was *moved*, from "the fix is
   not merged" to "the merged fix is not built". Do not let a restored site be mistaken for a fixed
   one.

   Still not authorized to buy — Chris's call, and `auto_topup_enabled` is false, so nothing is
   being charged silently.
5. `/.netlify/functions/date-coordination` is publicly reachable; anyone hitting it runs a full
   tick. Not exploited here, not fixed here, worth a follow-up.

---

## Second pass, 21 September — an idle site should cost almost nothing

Chris asked for another look. Two more real findings, and a list of what was examined and rejected,
because the rejections are the more useful half.

### D. The scheduled tick read the whole state four times to find nothing to do — my own regression

Making the cron the standing drain worker (change A) was right, but I did not look at what the drains
cost. `mail.drain()`, `events.drain()` and `tonight.drain()` each *open* with their own full
strongly-consistent read of the same `state-v1` blob, and `runCoordinationTick` had already read it.
So every idle minute downloaded the entire state **four times** to discover there was nothing to
send — 1,440 times a day, forever, with nobody visiting.

The tick already holds that state open in a transaction. It now reports which drains have work, and
`coordinationScheduled` skips the ones that do not: an idle tick is **one read instead of four**.

The hint is fail-safe by construction — an absent or unrecognised hint drains everything exactly as
before, so a wrong hint can only cost a read, never strand a queued send. Each drain still re-reads
and CAS-guards its own delivery, so a hint that goes stale between the tick and the drain just defers
one tick. The dangerous direction is a false negative, and
`coordination-tick-work.test.mjs` pins it: forcing all three hints to `false` fails 4 of the 5 cases,
and the one that still passes is the idle case that *should* report nothing.

This matters out of proportion to its share of the bill: it is the floor the site pays with zero
visitors, and a friend-group site is idle most of the time.

### E. Uploaded images were billed as compute on every first view

`/api/images/<hash>.webp` is served by the function and already answers
`Cache-Control: public, max-age=31536000, immutable`. But that is a *browser* directive — Netlify does
not edge-cache a function response without an explicit CDN directive, so every visitor's first view of
every uploaded image cost a function invocation plus a blob download. Added
`Netlify-CDN-Cache-Control: public, max-age=31536000, immutable, durable` (directive per Cameo's read
of the current docs). Zero privacy change: these bytes were already declared public and immutable.
Small in steady state, but it also means a shared link opened by ten people no longer multiplies.

### Examined and rejected — do not spend time re-deriving these

- **Session touch.** `authenticate()` writes `last_seen_at`, and any write means uploading the whole
  blob. But `sessionTouchSeconds` is 3600 against a 180-day TTL, so it is ~1 write per active user per
  hour. Real mechanism, immaterial magnitude, and it is auth. Left alone.
- **`eventNotifications.seen` is never pruned.** It is deliberate — the permanent replay guard that
  stops a notification being re-sent after bodies and receipts expire. Growth is tens of ~150-byte
  entries a month, so it is unbounded in principle and trivial in practice. Pruning a replay guard to
  save kilobytes is how you send duplicate mail. Left alone.
- **A read fast path in `transact()`** (skip CAS/export/double-stringify for GETs). Still the largest
  single lever left, and after the first pass the arithmetic already fits without it — see below. It
  also needs `queueEvents` gated off read paths first. Not worth the risk at the current margin.
- **Guarding the public `/.netlify/functions/date-coordination`.** Anyone hitting that URL runs a full
  tick. The standard guard keys off Netlify's scheduled-invocation payload, and I could not verify its
  shape offline — no `@netlify/functions` in the tree — and the site is 503 so I cannot probe it. A
  guard I cannot test could silently kill the drain worker. Not shipped; still worth doing by whoever
  can test it against a live deploy.

### Where that leaves the budget

Budget is 1000 credits/month = 100 GB-hr = 12,000 billed seconds/day, i.e. **8.3 s of function time
per 60 s of wall clock**. Idle cost is now roughly one blob read and one hydrate per minute. A busy
Programma tab is 4 requests/minute at one state rebuild each. The remaining levers are worth single
-digit percentages; the first pass was worth multiples. That is the honest reason to stop here rather
than keep cutting.

Still forecast. No bill has been measured, and none can be until the site is built and served again.

