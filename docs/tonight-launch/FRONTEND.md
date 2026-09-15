# Frontend handoff
Root owns public/filmmaand/vanavond, source ready for backend integration. No fake data or Cluster dependencies. Actual bundled fonts/poster, D4layout, same-origin account iframe. API contract agreed with Glimmer.

Golden local UI fixture4491: Yes saves 1/3 and survives reload; firstNo saves, secondNo opens date; date selection saves and closes. Manager message rendering escapes content. Network failures retain idempotency key/body; login resume same action; cross-account pending actions require explicit cancel rather than applying to another account. URL ?answer=yes/no focuses but NEVER writes on GET. Metadata stays18:00, threshold from backend.

Server fixture is synthetic only, /tmp/tonight-ui-preview.mjs. Do not count this as durable/CAS/auth/live proof. Actual backend tests/forwarding/deploy owned Glimmer. No group sends. Prepared email docs/tonight-launch/invitation.html is email-compatible markup, no JS/SVG/base64; links lead to intended RSVP and require real click on page.

Check after integration: exact contract naming delivery result.status, organizer GET returns canManageRounds; manager message status; own.id or participant.id for selected date preview. API alternatives7days. Login iframe full real account must return here with queued action and no tour/navigation.

Prepared group email lives only in docs (not sent). Email links use ?answer=yes/no, which focuses the relevant control without recording a response; safe against link scanners. Handful of stateful frontend safeguards: single in-flight mutation, persisted request key on uncertain outcomes, cancel pending, account-bound retry, refresh only after acknowledgement. Manager link discovered using existing organizer endpoint.

## Actual integrated acceptance — 15 Sep
Used Glimmer's4415 real createApi + isolated CAS/captured sender. Separate one/two sessions savedYes19:30 andNo+Sep18; fresh reload showed both and decoded avatars,390px nooverflow. Message captured once and shown in admin manager view. AnonymousYes→existing real email/code login→samepage queuedYes saved. Also anonymousYes→brand-new email/code→name/animal→avatar→save completed and returned directly to /filmmaand/vanavond/ with savedYes, no tour/navigation. No production data or email used in these checks. UI frozen ready for deployment.
