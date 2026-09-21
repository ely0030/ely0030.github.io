# Compute-burn fix — integration record

Landed by Cameo, 21 September 2026. Patch authored by Chalice on `fix/netlify-compute-burn`,
measurement lane by Cameo. This file records what I verified before merging, not what was claimed.

**Merged:** `b9429c6` fast-forwarded onto `main` and pushed to `ely0030/ely0030.github.io`.
No merge commit; no rebase; branch shape preserved.

---

## What I checked before landing

Chalice named two things he had not executed. Both now have execution-level evidence.

### 1. The `data/**` exclusion in `netlify.toml` — VERIFIED SAFE

Risk: `date-coordination.mjs` imports `handler.mjs`, which *statically* imports
`movie-catalogue.mjs` and `movie-discovery.mjs`. If anything on the cron path touched the now-excluded
SQLite, the cron would break in production only.

- Walked the full **transitive** import graph from the cron entry chain: 15 modules reachable
  (`date-coordination-tick`, `runtime/planning/date-coordination`, `event-timing`, `round-lifecycle`,
  `state`, `blob-store`, `mail`, `email-template`, `mail-diagnostics`, `mail-plain-text-test`,
  `event-notifications`, `tonight`, `account-notifications`, `registration`, `auth/store`).
  **Zero** references to `data/`, `movie-catalogue`, `movie-credits` or `movie-artwork`.
- Confirmed the catalogue modules have **no module-scope file access**. `DEFAULT_MOVIE_CATALOGUE` is a
  path string via `fileURLToPath`; `new DatabaseSync(...)` happens only inside `openMovieCatalogue()`,
  which the cron never calls. Importing the module is therefore safe without its data file.

### 2. The drain gating in `handler.mjs` — VERIFIED SOUND, and the user-facing worry is unfounded

My concern was that gating `mail.drain()` to non-GET would delay a friend's **login code** from ~15 s
(rescued by any poll) to ~60 s (rescued by the cron).

It does not, and the proof is one line:

```
api.mjs:139   if(path==='/api/auth/code' && response.status===200 && deliverMail)
                await deliverMail(response.body.challengeId);
```

A login code is delivered **inline and synchronously on the POST itself** via `deliverMail`. It never
depended on `drain`. `drain` is only the rescue path for a send committed but not acknowledged — and
`/api/auth/code` is a POST, so it still drains anyway.

Net effect on the rescue path is an **improvement**: it used to require someone to be actively polling,
so a stranded send with nobody browsing was never rescued at all. Chalice added `mail.drain()` to
`coordinationScheduled` (it never had it), so rescue is now guaranteed within 60 s at zero traffic.

### 3. Tests — re-run, not taken on trust

- `api` · `entry-routes` · `date-coordination` · `date-coordination-journey` · `round-lifecycle-api` ·
  `state` · `event-timing` · `plan-get-enrichment` → **29 pass, 0 fail** (node 24.11.1).
- The new `plan-get-enrichment.test.mjs` cold-instance case runs in **407 ms**, matching Chalice's
  reported 404 ms against the patch (and his reported 1210 ms **failure** against the old unbounded loop).

### 4. `programme-pending.test.mjs` — pre-existing, and worse than reported

Chalice flagged it 3/6 red at baseline and suspected it sat next to the dirty `tonight.mjs` work.
I went further: stashed the dirty `tonight.mjs` / `event-notifications.mjs` / `tonight.test.mjs`,
checked out clean `main`, and it is **still 3/6 red**. So it is not Chalice's, and it is not the dirty
work either — it is a genuine pre-existing failure on `main`:

- `explicit date-only pending projects without a film, time or voting association; replay is exact`
- `transition-shaped requests are unsupported and cannot update or append another night`
- `concurrent exact create retries append one pending entry`

**Unowned.** Did not block this merge; someone should pick it up.

---

## Account facts found while integrating (not in the original investigation)

- `auto_topup_enabled: false` — Chris is **not** being charged automatically. No runaway billing.
- `has_stripe_payment_method: true` — a card *is* on file, contradicting the 7 Sept scratchpad note
  ("autoTopup false / no payment method"). A top-up is one click, which also means enabling auto-topup
  before the burn is proven fixed would be genuinely risky.
- `grace_topup_granted_at: 2026-09-17T23:27:42Z` — Netlify granted a **grace top-up ~21 h before the
  hard stop**. The real consumption therefore exceeded 1,000 credits; the headline understates it.
- Last successful deploy was **15 Sept**. Nothing has deployed since, so the 104 GB-hours were burned
  entirely at runtime — no build cost involved.

---

## State after landing

The fix is on `main` and pushed. It is **not live**: the project is paused on
`usage_exceeded` and cannot deploy while credits are at zero
(`block_builds_when_usage_exceeded` is in force).

> **CORRECTION (same session).** An earlier version of this section said service would resume "**with**
> the fix already in". **That was wrong**, and I am leaving the error visible because the corrected
> version is the operationally important one.
>
> Restoring credits unpauses the project and it serves its **last published deploy**. That is still
> `5db79e5` — the 15 September build, i.e. the code that burned the credits. **There is no build in the
> resume path.** Measured after the merge:
>
> - `GET /sites/<id>/deploys` → 4 records, newest `5db79e5` at `2026-09-15T08:31:22Z`.
>   **No deploy record exists for `b9429c6`.** The push was dropped, not queued.
> - `site.published_deploy.commit_ref` = `5db79e5e991bb83ae5eb9010b80cfed0bd2ffa1d`, `ready`,
>   published `2026-09-15T08:32:20.657Z`.
> - `build_settings.stop_builds` = `false` — nothing at the site level blocks building, so a build
>   triggered *after* credits return will succeed.
>
> **Operational requirement: after a top-up or the 11 Oct reset, a deploy must be explicitly
> triggered** (push to `main`, or manual redeploy). Until then the site is live on unfixed code and
> will burn a fresh balance at the old rate — about 3.5 days for a 500-credit top-up.

Landing on `main` rather than holding the branch was still right: it removes the merge from the critical
path, so restoring service is now a single deploy trigger rather than a merge-plus-deploy. But it did not
*close* the trap — it **moved** it, from "the fix is not merged" to "the merged fix is not built".
A restored site must not be mistaken for a fixed one.

## Not solved, and must not be called solved

Chalice's ceiling stands and I am repeating it deliberately: **this is forecast, not a measured bill.**
104 GB-hr/7 d extrapolates to ~4,460 credits/month against a 1,000 budget; an 8× cut lands near 550 —
under budget, but thin, and it scales with the number of open tabs.

Remaining levers, in order, if it is still high a week after service resumes:

1. **Lever 2 — edge-cache the plan GET.** Deliberately not taken: the response marks the caller's own
   entries `self:true` from their cookie, so a public `durable` cache needs a correct `Vary` first.
   Caching it blind would leak one person's view to another.
2. **Lever 3 — slow the cron.** Deliberately not taken, and **do not let anyone do this casually.**
   `tickCoordination` fires a programme reminder only inside a window exactly `reminderMinutes` wide and
   `beheer.js` sets `ri.min = 1`, so a `*/5` or `*/15` schedule can **skip a short reminder entirely**,
   not merely delay it. Slowing it requires clamping that minimum first. The reason is written into
   `netlify/functions/date-coordination.mjs` so the next person meets it before the temptation.
3. `sharp` lazy-import (bundle still 84.8 MB for the request function).
4. `/.netlify/functions/date-coordination` is **publicly reachable** — anyone hitting that URL triggers
   a full tick. Logged, not fixed.
