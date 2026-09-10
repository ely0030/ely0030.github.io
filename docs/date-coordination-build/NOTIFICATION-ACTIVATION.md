# Future event notification activation

Authorized by Chris/root; future event delivery enabled with cutoff `2026-09-10T00:50:44.130Z`.

Read-only current-state review: five eligible verified member accounts; no fixture groups, local opt-outs/suppressions/exclusions, prior coordination event logs or queued event messages. No accounts or dates changed. No test email sent.

Provider Mailgun EU suppression list GETs returned401 with current key. This is NOT evidence of empty provider lists. Mailgun automatically suppresses known bounces/complaints/unsubscribes; sending code has no bypass fields. Provider enforcement retained; no local suppression synchronization claimed. Reference https://documentation.mailgun.com/docs/mailgun/user-manual/reporting/metric-definitions . Current recipient identity/verification/optout checks run before each send.

`FILMMAAND_EVENT_EMAILS=1` and explicit cutoff set only in production context. Netlify legacyFree rejects functions-only scope (403 upgrade required), so existing all-scope fallback used without plan change. Exact references inspected: runtime handler only, no client/build interpolation; these values are a feature flag and cutoff, not credentials. Readback matches. A new deploy activates runtime settings.

Historical events before cutoff never queue. Reminder lead time remains unset. Existing legacy preferred-date poll remains unchanged; new availability poll requires organizer configuration. No provider acceptance/Inbox claim is made by enabling this feature.
