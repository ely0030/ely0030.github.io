# Explicit voting rounds and deadlines

Prepared implementation; no live deadline or advancement policy is selected. Existing production votes are not migrated/reset on import or reads. There is no automatic opening/finalization job. All actions below use the existing authenticated `POST /filmmaand/api/plans/:id/round` and an exact `Idempotency-Key`.

## Read and configure

GET plan and own vote now return round `id`, `revision`, `lifecycle`, `status` (`open`, `closed`, `resolved`), `opensAt`, `closesAt`, `closedAt`, `result`. Vote GET also returns `serverTime`. `scheduledDate` remains the screening day, separate from closing timestamp. Existing unconfigured rounds expose a stable ID with no deadline; current choices/votes remain untouched.

Every action carries `expectedRoundId` and `expectedRevision` from a fresh read. A repeat with the same key/body returns the original result. Changed body with reused key or stale round/revision is rejected.

- `action: "deadline", closesAt: "<future UTC ISO>"`: opt current round into lifecycle and set/update its cutoff, preserving existing votes. Cannot reopen an expired/closed round. **Deploy paired voting client before activating this**: newly submitted votes now require the round ID. Pending historical receipts remain exact and can settle.
- `action: "close"`: explicitly close current round, freezing tally, even without a deadline. Deadline enforcement itself does not depend on this command or an active browser: vote writes check server time during each CAS attempt.
- `action: "resolve", choice: "<option ID>"`: require closed round. Unique leader must be chosen; tied leader must be explicitly selected; zero-vote round allows explicit organizer choice, labelled as such. `programme: true` also publishes on this round's configured screening day, with no invented time. If an entry already exists on that day, supply the exact `programmeId` of its pending entry; finalized entries are never overwritten. With no existing entry, a stable round-linked entry is appended. Exact retries cannot duplicate it.
- `action: "open", selectionSnapshot, shortlist: [three IDs], scheduledDate, closesAt`: require explicitly resolved previous round. Use `nextRound.snapshot` from public plan and select the top3 saved ranked-point candidates. Higher places are mandatory; tied cutoff positions allow explicit choice only among equal contenders. Changed rankings reject stale snapshot. Zero/fewer-than3 positive candidates cannot open. Current round/votes are archived in `roundHistory`; next round has new ID and empty votes. Hearts, rankings, dates, profile data and all receipts persist. Current/next automatic opening remains a user policy decision; this source offers only explicit actions.

The legacy shortlist-only operation can initialize a vote-free unconfigured round, but cannot replace a lifecycle round or a round containing votes. It now receives a distinct ID. New lifecycle rounds exclusively use the saved5/4/3/2/1 calculation, with sixth/unranked hearts1 and current/programmed exclusions. Legacy unconfigured auto-derivation is retained only for backward compatibility; the current production shortlist is already frozen and is never silently reranked.

## Participant safety

New PUT vote bodies add `roundId`; existing `expectedRevision` and `final` semantics remain. At/after cutoff new votes, edits and withdrawals are rejected. Receipt lookup runs before closure/stale-round validation, so a committed earlier request can recover its original result after closure/advancement. Auth expiry still requires real reauthentication first. An old round result is not adopted or animated as a vote in the current round. Pending bodies/keys are never rewritten during refresh or login.

The client counts down from fresh server time plus monotonic elapsed time; device clock changes do not affect it. At local zero it disables new submissions and checks server status, showing "Sluiting controleren…" until authoritative closure. Closed users can see/finish their receipt but cannot edit. Timer ticks update one time node, retaining DVD nodes. New round ID resets selection state even if film IDs repeat. Bedankt's unavailable edit control is hidden through voting-owned CSS, without changing Bedankt composition.

## Verification and deployment boundary

`node --test filmmaand-server/round-lifecycle.test.mjs filmmaand-server/round-lifecycle-api.test.mjs filmmaand-server/round-lifecycle-ui.test.mjs filmmaand-server/ranked-five.test.mjs`

Focused coverage: cutoff/CAS race; migration preserving existing votes; exact lost acknowledgement through close/relogin; historical retry and repeated film in later round; rank weighting/cutoff tie/stale snapshot; explicit pending programme update/idempotence; zero/<3 cases; invalid/admin guards; server-vs-local countdown state.

Persistent browser proof outside repo: `.dev/voting-lifecycle-proof/`. Isolated4373 actual API/auth with synthetic account and memory-only state, no mail or shared data. Native Matrix selection + Lock in savedrevision1. Advancing fixture server clock closed the real API; UI showed closed, hid edit, retained same clock/DVD nodes and allowed thanks. Desktop/mobile no overflow; thanks edit unavailable. No public activation. Captain owns integration/deployment, then explicit approved schedule/actions.
