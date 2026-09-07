# Private email acceptance diagnostics

`mailReceipts` lives only in the existing private state blob. No route, log output, provider webhook, external request or tracking is added. A receipt means Resend's send endpoint returned HTTP success; it does not mean SMTP delivery or Inbox placement.

The receipt stores only the validated Resend UUID (or null/unavailable), local acknowledgement UTC, queue UTC, static template fingerprint and retention deadline. It contains no recipient, challenge/session identifier, real code, body or body hash. The fingerprint uses the renderer with fixed synthetic code and expiry. It identifies the queued template, including across deployments/retries; pre-feature outbox entries remain unknown.

At most 100 receipts remain. Records expire after seven days and are removed on the next queue, delivery or drain operation (including an empty drain). Idle deployments do not run scheduled deletion. Operator backups are outside this retention mechanism. Delete task-specific exported diagnostic evidence when the investigation closes; do not export the entire private state.

Successful responses with absent, invalid or unreadable JSON retain existing success semantics and get an unavailable ID. Failed provider calls keep the identical queued body and idempotency key. Receipt insertion and outbox removal commit together; concurrent acknowledgement/CAS retries produce one receipt. An interrupted final state write retains the outbox and existing provider-deduplicated retry behavior.

For an authorized test, capture request UTC and deployed revision. The operator reads only the nearby acceptance receipt from the private blob, then matches its UUID in the authenticated Resend dashboard to Events/Insights and Gmail's Message-ID. Never expose private blob snapshots or use Resend's public message-share feature for login mail.

Verification: `node --test filmmaand-server/mail-diagnostics.test.mjs filmmaand-server/api.test.mjs filmmaand-server/registration.test.mjs filmmaand-server/state.test.mjs` uses in-memory storage and synthetic provider responses only.
