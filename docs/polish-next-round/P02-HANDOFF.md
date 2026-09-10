# P02 — Popular suggestion recommendation

## Base and ownership

- Exact base: `40c15fcca021bee87fa87b24bb48391c05aa11fc`
- Isolated worktree: `/home/chris/filmmaand-round2-recommendations`
- Branch: `feat/round2-recommendations`
- Deployment owner: Glimmer. This branch was not pushed or deployed.

## Behavior

The existing committed in-app activity transaction now creates a `popular-suggestion` notification when a suggested film first crosses **3 distinct saved likes from people other than its canonical suggester**. Three is the deliberately conservative P02 implementation assumption, exposed as `POPULARITY_THRESHOLD` and documented in the source.

At the crossing, only onboarded theme members who are neither the suggester nor a current liker receive: `<titel> kreeg 3 hartjes. Misschien iets voor jou?` The notification links directly to `/filmmaand/films/?film=<id>`.

A durable marker keyed by theme and film makes the recommendation once-only. Existing films already at or above the threshold are recorded as baseline state on the first subsequent committed activity transaction, without generating a notification. This also prevents unlike/re-like cycles from generating a later alert. If the same save produces shortlist or next-leader activity, those rank notices are skipped for members receiving the recommendation in that transaction; other recipients retain the existing rank behavior.

This change adds no scheduler, authentication path, store, dependency, email intent, provider behavior, or broadcast control. The playful Redball5 organizer recommendation remains pending specification.

## Files

- `filmmaand-server/account-notifications.mjs`
- `filmmaand-server/account-notifications.test.mjs`
- `docs/polish-next-round/P02-HANDOFF.md`

## Verification

From `filmmaand-server/`:

```text
node --test account-notifications.test.mjs
```

Result: 10 tests passed, 0 failed. The two focused P02 cases cover threshold crossing, recipient exclusions, direct link and wording, simultaneous rank-notice coalescing, unlike/re-like dedupe, and initial existing-state baseline behavior. Existing notification, read state, CAS/replay, scheduler, and mail tests in the same focused file remain green.
