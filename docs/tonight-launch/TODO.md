# Tonight invitation launch — 15 September 2026

User authorizes implementation and public deployment for review. Group invitation email is ON HOLD until Chris checks the page. Do not reset live users or existing plan data. Root owns frontend; Glimmer owns API, mail integration and deployment. Record progress here; brief handoff only.

## Selected product
- Standalone D4 page, no site header/navigation. Peppa Pig poster, Vanavond film?, proposed 18:00, Kattendiep35c. Minimum3, initial real counts (never demo).
- Ja, ik kom (be there); Ik kan niet (be square). Neutral until saved; selected green/red. First No records No; second click becomes Andere datum and opens date picker. Separate alternative date button always present.
- Public response names/avatars and suggested times; optional time input; alternative date picker with actual shared choices. No fake voters, deadlines, confirmations.
- Private message to directie: persisted organizer-only and forwarded to broodislekker@gmail.com, with dedupe and delivery status. Must not expose private messages/emails publicly.
- Email design approved separately; group send NOT authorized until user review now completed.

## Checklist
- [x] Capture selected design and launch boundary.
- [x] Confirm authoritative current main and API contract (Glimmer verified cb0d89c = remote).
- [x] Durable isolated RSVP event: real yes/no, time, alternative-date suggestions; concurrency-safe and authenticated writes.
- [x] Use existing login flow, return to this page, preserve intended answer; no tutorial/navigation detour (new and existing accounts checked).
- [x] Build clean production frontend matching selected D4; remove artifact/review/demo controls.
- [x] Serve actual Peppa poster and site fonts locally.
- [x] Private message storage + organizer view + email forwarding to Chris; safe retries.
- [x] Prepare approved invitation template/recipient links, WITHOUT sending batch.
- [x] Focused functional checks: save/reload, two participants, No second-click, date/time, login return, captured private message delivery. Backend authorization checks recorded by Glimmer.
- [ ] Build/deploy using sole operator; verify exact release live.
- [ ] Give Chris live URL and concise actions to check.
- [ ] Chris reviews live page. GROUP SEND REMAINS ON HOLD.

## Design sources
Selected final artifact7187c5c5-056c-4ed1-91ce-d61b4137a2a7 r11.
Source /home/chris/filmmaand-prototypes/tonight-rsvp/final-preview.html (prototype only, accumulated CSS and embedded picker).
Email c461478a-d709-4d84-9a13-d842a1bce1b5 r7, source email-original.html samefolder.
No (maybe)/(unconfirmed) badges. No promise minimum auto-confirms without explicit modeled event state. Event date September15; times Europe/Amsterdam. Date alternatives must not invent deadline from prototype.
