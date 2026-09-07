# Mailgun activation

Set AUTH_MAILER=mailgun for production after deploying this adapter. Required: MAILGUN_API_KEY (domain sending key), MAILGUN_DOMAIN=mail.ely0030.xyz, MAILGUN_API_BASE_URL=https://api.eu.mailgun.net, existing AUTH_FROM. Credentials are read only in Functions. No credentials were used during local tests.

The multipart request disables open/click tracking and requires TLS. A successful HTTP response is acceptance, not Inbox delivery. Private bounded receipts include provider and a validated Mailgun message ID (or unavailable); no recipient, code or body.

Mailgun sends have a durable attemptedAt claim committed before network I/O. We do not assume provider idempotency. Network failure, rejection, process interruption or lost acceptance-state write leaves the claim guarded: drain and repeated delivery will not POST again. This intentionally favors no duplicate sends over automatic recovery. The user can request a new code after the existing cooldown; the failed/uncertain challenge expires normally. Expired guarded entries are cleaned by drain. No background retry is promised. Resend retains its existing idempotency-key retry behavior.

Each new outbox message snapshots its provider and From. Legacy entries belong to Resend. Switching providers never routes an old queued message through the new provider. Rollback: AUTH_MAILER=resend; preserve its credentials/DNS. Neither switch replays guarded Mailgun entries.

Local verification: node --test filmmaand-server/mailgun.test.mjs filmmaand-server/mail-diagnostics.test.mjs filmmaand-server/email-template.test.mjs filmmaand-server/api.test.mjs filmmaand-server/registration.test.mjs filmmaand-server/state.test.mjs (30 tests). Synthetic flow verifies the exact rendered code through auth/verify and checks the session cookie. No live send or deploy performed by these tests.

Live check: coordinate one sender, request code using the real login UI so the challenge remains available, privately capture provider receipt, ask recipient for folder and authentication headers, and complete login with that code. Do not log the code or original body; do not automatically resend. Authentication and provider acceptance cannot establish Inbox placement.
