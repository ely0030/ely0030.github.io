# Glimmer → Grid notifications handoff — root authority 01:43

Grid owns full notifications campaign, architecture, builders, integration and activation. This supersedes Glimmer's earlier API/UI split. API-CONTRACT.md is an advisory draft, not implemented product. No notification code edits occurred. Glacier's just-issued backend assignment was explicitly revoked by page; do not let stale queued assignment create a competing builder.

## Canonical baseline and dirty files
- `/home/chris/filmmaand-integration`, Git main `a52f8d4e4358ab347a840d709c9912255164b1ae`, remote GitHub ely0030/ely0030.github.io.
- Same commit LIVE Netlify `6aa2091c54579d000826c970` READY. Latest delta fixes partial-week picker alignment; public CSS exact verified and Gasket actual DOM checked.
- Untracked `docs/date-coordination-build/PRODUCTION-CLOSEOUT.md` belongs Glimmer; `docs/notifications/` contains draft contract/handoff; `public/filmmaand/programma/` is generated build output, preserve.
- C: drive nearly full; canonical Git/deps now independent Linux. Do not resurrect stale .dev/production-checkout or /tmp clone, and do not delete shared data.

## Existing active seams (not transferred)
- Gasket `/home/chris/filmmaand-timing-build` base a52f8d4: shared canonical timing resolver; named planning service round/programme projection, date-coordination manual times and round-lifecycle explicit timing transfer; Beheer and Agenda consumer/editor. Explicit timing.screening > valid startsAt Amsterdam > default18:00; Einde only explicit; no reminder/default absolute timestamp. Glimmer owns integration/deploy of this pending timing patch. Coordinate any API/handler conflicts narrowly; no whole-file overwrite.
- Gecko current single authorized confirmation TEST + local idempotent operator under shared `deployment/event-email-operator/`. Zero sends at latest receipt, waiting canonical timing LIVE. No extra test authorization. Current renderer owner unchanged; discuss later notification-email extension directly with Gecko AFTER current task. Local operator fixes pending timed-date comparison + durable uncertainty receipt.
- Glimmer current release closeout only. No other notifications product owner remains assigned by Glimmer.

## Backend/mail map
- `filmmaand-server/api.mjs`: authenticated strong-CAS transaction; catches canonical domain errors; current queueEvents in finally. Notification before/after hook must exclude failed/replayed/no-op transitions and anonymous reads.
- `state.mjs` persists private state using existing strong CAS. `handler.mjs` composes event queue; `date-coordination-tick.mjs` / existing Netlify scheduled function run once/minute. No new store/scheduler needed.
- `event-notifications.mjs` runtime SHA256 `3c79651db9b0732607484e865a9eb342e6f85b759491cb844f45e446634829b0` at deafe3f; approved confirmation hybrid Aanvang/Einde, no Inloop. Private outbox/seen/attempt claims prevent replay and ambiguous retries. Test-only companion5afbbe4 already integrated.
- Notifications activation ON cutoff2026-09-10T00:50:44.130Z. Existing recipient policy/local exclusion reviewed; Mailgun EU provider suppression enforcement retained, lists API401 is visibility limit. Do not backfill or synthesize event notices on deployment.
- Existing public preferred-date poll remains legacy, two actual votes, no conversion. Friday11 round/otherSep12/15/18 dates must remain.

## Deployment recipe / authority
Use clean named changes on canonical main; inspect diff, required focused check, git commit/push origin main. Netlify builds automatically (repo npm build), monitor exact commit via API; READY then exact live affected check. No broad suite for presentation. Current Linux dependencies/Node24 installed.
Netlify site9f437150-6c1b-421d-9624-d7ced346970e, account66fa0e6a794222e33e34fc76, existing legacy Free. Token local0600 `/home/chris/.config/filmmaand/netlify-access-token` NEVER PRINT. Minimal deploy read: GET api.netlify.com/api/v1/sites/SITE/deploys?per_page=1, print only id/state/commit_ref/error_message. Do not alter plans/providers or expose env values.
Current private environment projection `/home/chris/.local/share/filmmaand/event-activation/env.private.json` contains credentials; inspect locally only. Root-state backups same private directory, never copy into repo/public artifacts.
ONE deploy operator per operation: Glimmer retains pending timing activation. Grid owns notification activation after rebasing onto that receipt, or explicit named serialization agreement. Do not simultaneously modify/push canonical main.

## Proof and current scope
Full authoritative shared docs/notifications/BRIEF.md. All six events, durable bell/history, truthful arrival toast, new-vote/result mail with coalescing. No additional real sends, reset or history backfill. Captain draft API-CONTRACT.md may be adopted/refined by Grid; communicate chosen API to own builders. Current work is docs-only, NOT implemented/live/populated notifications.
Receipts/continuity `/home/chris/filmmaand-integration-handoff/`.
