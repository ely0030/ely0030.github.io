# Tonight RSVP integration — 15 September 2026

Canonical base: cb0d89c, verified against origin/main. Public target: https://ely0030.xyz/filmmaand/vanavond/.

Implemented a separate tonight event in the existing private transactional state. Existing plans, ballots, attendance and accounts are preserved. Public projection contains opaque response IDs, names, canonical avatars and voluntary answers/times/dates; private messages and email addresses are excluded. Mutations require existing authenticated onboarding, CSRF/reset guards and immutable request keys. Partial response writes merge against each fresh CAS state; replay never restores an older answer.

Private messages are organizer-only. Forwarding goes only to the authorized Chris address, after durable commit. A durable uncertain marker precedes provider I/O; ambiguous delivery is never automatically retried. Accepted status means provider acceptance, not inbox delivery. Existing shared quotas apply; pending messages can drain through the existing scheduled function. No group invitation or synthetic real email was sent.

Verification: three focused actual API/auth/CAS tests pass (concurrent responses, exact replay, private access, accepted delivery and ambiguous-send dedupe). Gyre independently exercised the actual integrated isolated server: two accounts, save/reload, time/date, 390px decoded avatars, private organizer message, and existing-account email/code return with queued response. All fixture mail captured locally. Fixture: node tests/tonight/server.mjs, loopback4415, synthetic memory only.

Release status: build/deployment in progress. Group invitation remains HOLD until Chris reviews the live page; prepared invitation.html is not a sent campaign.
