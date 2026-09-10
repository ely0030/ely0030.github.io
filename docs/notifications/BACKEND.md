# Notifications backend handoff — 2026-09-10

Builder: Grid's sole bounded backend worker. Base `abc2f27` in `/home/chris/filmmaand-notifications-recovered`. Shared worktree, no commit/push/deploy or provider/network mail performed by this worker. Captain owns integration and final live acceptance.

Owned implementation files:
- `filmmaand-server/account-notifications.mjs` (new)
- `filmmaand-server/api.mjs`
- `filmmaand-server/date-coordination-tick.mjs`
- `filmmaand-server/event-notifications.mjs`
- `filmmaand-server/account-notifications.test.mjs` (new, test only)

API remains the pinned contract: onboarded account-only history, opaque cursor, max50 page, private version-aware read ACK, server-time mark-all fence, important email preference. Writes retain existing generation and CSRF boundaries. Account selectors are rejected; public plan excludes all private notification data. Missing GET history does not initialize the notification namespace. Authentication retains its existing session touch behavior.

All six requested in-app classes use canonical plan before/after diffs and committed receipt-backed changes: suggestion, other-account likes of exact canonical suggester (including transferred legacy ownership), eligible next-shortlist entry, tied/sole next leader, tied/sole current voting leader, and close/resolve outcome. Round opened is also recorded. Suggestion and like links target the existing `films/?film=ID` route. Programme outcomes use the existing bare Programme destination. Group updates also refresh the destination and show cumulative like-event count in text.

The hook runs only after a successful planning mutation, inside the same strong-CAS transaction. Failed operations/outer writes and exact receipt replays do not emit. First mutation uses its BEFORE snapshot as baseline, retaining its new activity without historical backfill. Existing scheduler initializes a baseline silently and then detects timed closure. A successful mutation crossing a previously baselined deadline also retains the closure event. No domain scoring/lifecycle/timing implementation changed by this worker.

Retention: latest100/account within90days, pagination max50. Like groups retain a film's count; rapid leader/result changes update one group within10minutes, retaining original creation time and moving updatedAt/read version. Group timestamps increase by at least1ms if multiple commits share the same clock. Private mail intents bounded2000/90days. Existing outbox seen/receipt protection remains authoritative.

Mail reuses `createEventNotifications`, existing activation gate, verified-recipient restrictions, date suppression, quota, attempted-before-provider fence, and scheduler/manual serialized claims. Important preference applies on queue and immediate delivery claim. Obsolete pending round-open notices are dropped if the round changes/closes/resolves. Close followed by resolve replaces a pending unresolved outcome; an already-delivered close can legitimately be followed by the actual resolution. If matching date confirmation is queued in the same transaction, actual outcome text is folded into that confirmation (HTML+plain). If the date log arrives later, a per-recipient committed coalescing marker prevents a second date-confirmation email; the original result email includes actual programme date. Important opt-out still preserves independently applicable existing date notifications.

Validation: `node --test filmmaand-server/account-notifications.test.mjs filmmaand-server/event-notifications.test.mjs filmmaand-server/api.test.mjs filmmaand-server/round-lifecycle-api.test.mjs` → **37/37 PASS**. Exact output `docs/notifications/backend-tests.txt`. New coverage includes real account API isolation, CAS retry/failure, receipt replay, self/claimed-owner exclusion, grouping/ACK race, retention and future fence, new eligible shortlist/leader, real vote tie/close/resolve/open, silent scheduler baseline and deadline event, concurrent captured mail, important preference and same/later-transaction result-confirmation coalescing. Existing mail tests retain provider uncertainty, quota, suppression, preactivation and commit safety coverage.

No live state, production accounts, test votes, or actual mail sends. Captain performs final browser/restart/deployment proof. Gecko's authorized three-moment confirmation renderer followup and Gasket's timing work are separate; preserve `resultText` insertion when merging confirmation presentation. Evidence hashes are in `backend-freeze.sha256`; no backend edits after that freeze without an explicit followup.
