# Private operator commands

Copy `operator-state.mjs` and `operator-fixture.mjs` together into an operator/scripts directory in the clean source repo. Keep them outside public files and Function entry directories. Requires Node22.13+ and resolvable `@netlify/blobs`11.0.3 (the application already uses this dependency). No SQLite, LocalStore or application-server imports.

Set `NETLIFY_AUTH_TOKEN` and `NETLIFY_SITE_ID` in the operator's environment using the normal secure credential mechanism. Neither is printed, hardcoded or read from a machine-specific path. Every command requires an explicit store name and backup directory; there is no default production target.

New preview/demo state (existing state is refused):
```
node operator-state.mjs initialize \
  --store filmmaand-qa-glimmer-preview-state \
  --plan /private/path/demo-plan.seven.r17.json \
  --backup-dir /private/path/filmmaand-backups
```

Remove only the registered seven-friend fixture from an existing plan:
```
node operator-state.mjs remove-demo \
  --store filmmaand-qa-glimmer-preview-state \
  --plan-id home-picker-lab \
  --backup-dir /private/path/filmmaand-backups
```

The removal function is copied byte-for-byte from the shared `scripts/social-fixture.mjs`, with its hash recorded in `operator-fixture.mjs`. It refuses claimed actors and demo films referenced by real responses, votes, proposals, confirmed/programmed nights or the current shortlist. Auth accounts/sessions, image ownership, mail outbox, other plans and all remaining real state are preserved.

Every operation performs a strong read, writes a mode0600 full backup inside a new mode0700 directory, then performs exactly one conditional write (`onlyIfNew` initialization / ETag removal). A concurrent change stops the command; rerun to read and back up fresh state. Do not blindly restore a backup over later writes. Backups contain private account/session data and must never be committed or publicly uploaded.

The transport guard distinguishes missing GET/HEAD/DELETE404 from failed writes; PUT/POST404 must throw because SDK11 otherwise reports conditional writes as modified. Conditional412 remains a conflict.

Local tests only: `node --test operator-state.test.mjs`. They verify backups/modes, preservation, claimed/reference refusals, conditional-write loss, fresh-input validation and real SDK response interpretation. No remote execution was performed while preparing these scripts. Current preview was already initialized by Gyre; do not initialize it again.
