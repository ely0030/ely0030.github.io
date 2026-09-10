# Date coordination — integrated builder handoff

Status: implemented in independent Linux checkout `/home/chris/filmmaand-date-coordination`, base `2e3d99108a6aca75e7c8e61b9d0c27a8812bba95`. Not deployed by builder. Captain owns production integration/configuration. No production data reads/writes or real emails in this build.

## Usable local runtime

- Actual Programme: http://localhost:4412/filmmaand/programma/
- Actual organizer controls: http://localhost:4412/filmmaand/beheer/
- Fixture clock/captured-email control: http://localhost:4412/

These share one isolated file-backed plan and synthetic authenticated organizer. No login code or external email required. They invoke the actual API/auth/planning/state modules. The fixture injects only its synthetic cookie at the local HTTP boundary. It cannot connect to production. `node qa/date-coordination/serve.mjs` from the Linux checkout starts a NEW isolated fixture on 4412; do not restart while someone is reviewing it. Private fixture state is ignored by git and not shipped. Source/static serving needs no Astro build.

Current browser fixture has a completed poll and its resulting evening moved by organizer to September 14; month availability was not migrated. To explore a new poll: Beheer → Datum afspreken → choose up to seven upcoming September days, a Dutch deadline before the first candidate day, leave association on New evening → confirm. Programme → explicit Ja/Nee per date and optional favourite → Antwoord opslaan. Open fixture clock page and click “Fixture: deadline bereiken”; this invokes the SAME transactional scheduled finalizer at that isolated poll's deadline, then captures delivery locally. Reload Programme: real persisted pending-film evening. To change it, open its date-coordination disclosure, propose a date; the current date remains until required consent or explicit Beheer override. The fixture clock never configures a real schedule.

## State contract

- New `mode:availability` polls are explicit organizer opt-in. Legacy date-only preference polls and their existing votes remain unchanged. Close/open archives historical polls; no migration, inferred availability, retroactive deadline or real poll configuration.
- Up to seven dates; explicit true/false only, omitted = unknown. Optional favourite must be true. At deadline: available count, favourite count, earliest Amsterdam calendar date. Deleted/non-onboarded profiles excluded. Zero positive -> needs-organizer, no evening.
- One canonical Programme event is created (film selection pending); only explicitly associated pending event may be reused, fenced by revision + original date + empty selection. No ballot/likes/month dates change. CAS + stable IDs make simultaneous ticks/retries once-only.
- `p.dateChanges[]` stores proposal ID, event ID/revision, original/proposed date, creation attendee snapshot (`requiredActors`), refreshed roster (`currentRequiredActors`), consent revisions and resolution audit. Another open proposal for same event is rejected. Changed event/date makes stale proposal unusable. No vacuous zero-attendee consensus; organizer override exists.
- **Existing attendance is saved canonical response dates, not event-specific RSVP.** Saved availability on ORIGINAL event date determines consent roster; recheck at resolution, new joiners require yes, cancellations no longer block. All month dates remain byte-preserved. After move, consent history is NOT RSVP or destination-date availability. Programme's existing attendance continues to show actual destination responses; UI states availability is unchanged.
- Organizer manual arrival/screening/end labels remain manual, no calculated runtime. Optional exact Amsterdam start can be supplied separately and must fall on the existing event date. Reminder minutes optional/null (off); requires exact start. A date move clears obsolete absolute timestamp, retains known wall-clock screening as a manual label and requires organizer to set an exact start again for reminders.
- Private `p.coordinationEvents[]` logs feed Gecko's private outbox in SAME state CAS. Network delivery only after committed state. Public projection contains names/avatar/own consent, never private actor IDs or emails.

## Scheduling / notification activation

New `netlify/functions/date-coordination.mjs`: cron every minute, calls the same `runCoordinationTick`. Published Netlify schedules run independently of browser visits; normal latency is next scheduled invocation, not exact-to-the-second. One notification delivery per scheduled tick bounds provider timeout; API invocation also drains up to two after commit. Platform reference: https://docs.netlify.com/build/functions/scheduled-functions/

Gecko commits `c254d40`, `b9e1488`, `62e0723`, `f32f002` included as prerequisite cherry-picks. Do not duplicate them if captain already has them. Default dispatch OFF. To configure future notifications captain uses explicit `FILMMAAND_EVENT_EMAILS=1` and ISO `FILMMAAND_EVENT_EMAILS_ACTIVATED_AT`, existing provider/server sender and registration recipient policy. Cutoff prevents old logs from being queued on activation. Eligible existing accounts only, exclusions/optouts/suppression rechecked before attempted send, current proposal/version fence, durable attempt before provider call, no automatic retry of ambiguous Mailgun attempts. Reminder schedule has no invented lead time.

No actual organizer window/deadline/time has been chosen for live. Compatible code may deploy before live organizer explicitly closes/transitions the legacy poll. Notifications remain off pending captain configuration. No delivered-live-email claim.

## Focused evidence

`qa/date-coordination/tests.txt`: **35/35** focused tests: pure date transitions, existing legacy poll tests, existing organizer authorization guards, Gecko mail tests, and two actual API/file-state journeys.

`date-coordination-journey.test.mjs`: authenticated actual API response → file persisted state → simultaneous deadline ticks → one real pending Programme evening → one captured email after commit; replay after close does not create/send again. Separate actual API proposal/consent moves stable event once, preserves response bytes; stale consent rejected; nonorganizer times forbidden; organizer exact start/manual labels/reminder accepted.

Browser on real `/filmmaand/programma/`: explicit availability saved, fixture finalizer creates visible Programme event, captured email count1/real send0; actual move proposal stayed pending with zero attendees; actual Beheer native confirmation performed override. Mobile390 and desktop1440 no horizontal overflow. Found/fixed Programme CSS reset overriding selected Ja styling. Screenshots: `qa/date-coordination/programme-mobile.png`, `programme-desktop.png`, `organizer-mobile.png`. Browser date entry used native input assignment plus input event followed by keyboard Enter; API/persistence were real, not mocked. No broad unrelated suites.

## Integration files

New lifecycle: `runtime/planning/date-coordination.mjs`, `date-coordination-tick.mjs`; additive legacy poll/service/API wiring; handler event queue/drain and scheduled function/config. UI: new `agenda/date-coordination.js`, loader in agenda.js, compatibility wrapper in date-poll.js, scoped date-poll.css; Beheer reuses existing confirmed account-bound pending receipt executor with endpoint stored in receipt. No scoring/ballot function changes. QA files remain outside public assets. Exact build commit and hashes accompany captain message.
