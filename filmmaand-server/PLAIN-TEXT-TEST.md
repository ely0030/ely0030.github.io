# Controlled plain-text test — inactive by default

Support may be deployed without enabling an experiment. Default mail remains unchanged. Activating a designation or sending a real message requires the separately authorized one-request protocol; deployment alone does neither.

## Private delivery evidence
Delivery correlation records and provider identifiers remain in private operator evidence. They are intentionally excluded from this public guide. Provider acceptance alone does not establish inbox placement.

## Delay and replacement semantics
Auth service computes expiry at request processing, before queueing/submission: 600 seconds. The server does not restart the clock when Mailgun accepts or the mailbox receives a message. A successful replacement request after the 60-second cooldown invalidates previous open codes for the same email; a later-arriving old message does not restore validity. Provider-queued messages cannot be withdrawn by this application's outbox deletion. Rate limits remain five requests/email/hour, twenty/IP/fifteen minutes, plus daily/monthly mail caps.

After acceptance, the UI displays 'We hebben een code gestuurd naar …', a Spam hint, input, other-email action and cooldown-controlled resend. It does not query provider delivery status or show a delivery-pending state/expiry countdown. An expired or superseded challenge gets HTTP410/code_expired; UI asks for a new code. Resend success explicitly says the previous code no longer works. No validity changes are proposed.

## Minimal opt-in implementation
Only a designated POST /filmmaand/api/auth/code with header x-filmmaand-plain-text-test is eligible. Activation would require three server settings: AUTH_PLAIN_TEXT_TEST_SHA256 (SHA256 of a random 32+ character token), AUTH_PLAIN_TEXT_TEST_RECIPIENT (exact normalized consenting address), AUTH_PLAIN_TEXT_TEST_EXPIRES_AT (short UTC window). These are NOT set by this patch. No header means baseline, even when configured. Invalid, expired, wrong-recipient or already-used designations reject without sending rather than silently creating a mislabeled baseline.

A durable token-hash usage marker is committed with the outbox under existing CAS. No raw token is persisted or sent to Mailgun. The existing rendered HTML field alone is omitted; subject/text/sender/provider/expiry/tracking/TLS stay unchanged. Receipt fingerprint uses the same fixed synthetic inputs with HTML omitted, distinguishing treatment from baseline without hashing real codes. No public diagnostic fields or UI controls added. Usage markers stay private; retire settings after the comparison. Never recycle a token. Existing send guards remain unchanged.

## Protocol after separate review and authorization
1. Web checks current Ziggo response and confirms the privately recorded correlation. Gather the user's reported fresh Gmail authentication summary as evidence; earlier sample verdicts are not interchangeable.
2. Observe one consenting, genuinely requested unchanged post-MX baseline. Record UTC request, acceptance, exact provider ID, initial folder, recipient authentication, sending IP, provider events/latency. Do not mark Not spam until initial folder is recorded; record any intervention as a confounder.
3. For one subsequent consenting login, after cooldown and baseline completion, activate the narrowly scoped configuration and attach its token only to that real UI request (via a reviewed one-request browser interception). Preserve the returned challenge in the same UI; do not create a detached test challenge. Do not log the token, body or code.
4. Record the same measurements for treatment; confirm its synthetic receipt fingerprint and absence of HTML in provider inspection without exposing the body. The application acceptance timestamp differs from provider-event timestamps by processing time. Ask Web to match exact IDs and IPs; a changed IP is a confounder, not a content result.
5. Stop after one comparison and disable the test settings. No automatic follow-up, retry loop or third variant. One outcome cannot establish broad deliverability or isolate reputation from recipient history.

## Google sign-in fallback assessment — not implemented
Estimated engineering effort: roughly 1–2 focused working days including security review and integration testing, assuming an available Google Cloud project/OAuth client and no consent/configuration blocker. This is an estimate, not a same-night promise.

Work includes Google Identity Services button and authorized origins; server endpoint validating Google's signature via maintained library, issuer, audience, expiry and chosen flow's CSRF/nonce protections; durable provider identity mapping keyed by issuer+sub (never email alone); and transactional issuance of existing secure sessions/onboarding. Persist identity mappings across this app's serialized SQLite/state import/export, with uniqueness and CAS concurrency tests. Keep email-code login available.

Link an existing participant only after proof of the existing account/session; do not silently merge on matching email. A Google account using a third-party address such as home.nl does not establish current control of that mailbox merely because email_verified is true. Define whether a new Google-only identity can exist independently of mailbox ownership; that requires adapting the current email-keyed participant model, not falsely verifying an arbitrary address.

Tests must cover wrong audience/issuer/signature, expired tokens, CSRF/replay, concurrent first login, identity collision, unauthorized linking and preservation of existing participant data. Reference: https://developers.google.com/identity/gsi/web/guides/verify-google-id-token
