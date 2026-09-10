# Notifications — authorized implementation, 2026-09-10

Owner of scope: Gyre. Captain/builder/integration/activation: Grid (explicit user reassignment). Glimmer supplies authoritative checkout/deployment handoff and retains existing timing release work. User requests complete implementation, not another prototype round. Reuse established Filmmaand design and canonical state/mail infrastructure. Preserve ongoing timing/default18:00 work and one authorized test email.

## Outcome
A signed-in friend returns, sees relevant genuine group activity beside their profile, opens durable history, and follows a direct link to participate. Important new votes and confirmed decisions can email them. No need to explore the whole site or complete a tutorial to discover a vote.

## In-app events (all requested)
- Someone else likes a film/theme you suggested: recipient is canonical suggester; exclude self; group repeated likes per film.
- New film enters the eligible next-round leaderboard (top displayed shortlist, not every liked catalogue item).
- New number-one next-round film, including truthful tied-leader representation.
- Current voting leader changes; ties must not imply a sole winner.
- A vote concludes: show actual outcome, tie/unresolved state or winner, and link to appropriate vote/programme destination.
- Another participant suggests a new film/theme; canonical saved suggestion only, exclude self.
Emit only committed changes, never drag previews, client calculations, receipt replays or failed writes. Do not invent activity during deploy; initialize existing state as baseline. Group rapid related leader changes into latest truthful summary rather than endless feed churn. Do not change scoring or vote lifecycle.

## UI
Small bell next to top-right profile avatar; compact unread indicator; click opens polished anchored history panel. On mobile use bounded accessible panel/sheet, no overflow. Existing typography, restrained cinema aesthetic, no dashboard restyling. Each item has actor avatar where useful, concise Dutch text, real relative timestamp plus accessible exact time, and meaningful deep link. Empty/loading/error states. Mark read individually on open/action and mark all read; durable account-bound unread across reload/devices. Escape/outside close, focus return, keyboard/touch support; do not remove visible keyboard focus.
Show at most one grouped, dismissible toast below bell on arrival for relevant genuine unread activity, with wording 'Sinds je laatste bezoek' and original timestamps. Do not pretend old activity is happening live. Do not obscure login/tutorial/dialogs or replay on every route navigation. No fake notifications, browser push permission, sound, sockets or real-time infrastructure. Refresh on normal entry/focus with bounded request frequency; live push deferred.

## Emails
- New voting round opens: one useful email, direct voting CTA.
- Vote concluded/locked: notify actual outcome; reuse/coalesce existing confirmed-event mail when same transition would otherwise generate duplicate emails. Existing date confirmation coverage must not be mistaken for vote-result coverage: inspect actual path.
- 'Date getting messy' means concrete proposed change, confirmed move/cancellation or explicit organizer intervention, not popularity fluctuations. Reuse existing date-change events; no vague automatic concern emails.
Reuse approved confirmation style and existing verified provider/suppression/opt-out/outbox policy. Important-activity email preference available to account; existing suppression respected. No retrospective emails on deployment. Durable event/recipient keys, commit before delivery, concurrent scheduled/manual delivery and uncertain provider attempts protected. No additional real test emails authorized by this task; only Gecko's already-authorized ONE test remains. Capture tests locally.

## Storage/contract
Private account-authorized notification history/read state. Canonical actor/recipient identity, no emails or private IDs leaked in public plan. Bounded retention/pagination (e.g. most recent90days/100 per account) and deterministic dedupe. Existing strong-CAS state and scheduled delivery, no second competing scheduler/store or broad auth rewrite. Read acknowledgements cannot alter another account. No mutation on anonymous public reads and no mass import/reset.

## Ownership/execution
Grid obtains Glimmer’s authoritative checkout/HEAD and outstanding leases, then owns the whole campaign. He may split bounded independent work using a written contract; no competing captain. Glimmer freezes and transfers any started notification work. Do not divert Gasket from timing. Gecko mail extension follows his current test/macro completion, not competing edits. Captain can own backend or delegate one available domain agent if needed; no reviewer committee.
Each owner writes OWN-NAME.md in this directory: owned files/base, decisions, completion facts, integration patch and exact remaining limitations. Communicate only boundary conflicts, real blockers or final handoff. Reuse evidence; no broad suites for copy/CSS. Stateful event dedupe/recipient isolation and mail side-effect boundaries need focused tests. One integrated actual two-account journey (suggest/like -> bell -> read persistence; vote change/close -> history + captured mail), mobile glance, then deploy and check exact artifacts. No synthetic production writes/emails.

## Completion
All listed event classes wired to real committed transitions, UI usable, durable unread, relevant email transitions active without old-event backfill, integrated deployed version verified. Report implemented/live/populated separately; newly deployed empty feed is expected. Provide test URL and concise behavior list. Do not call component-ready fully done. Preview links may be delivered earlier for visibility.
