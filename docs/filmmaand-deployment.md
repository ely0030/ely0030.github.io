# Filmmaand

Filmmaand lives under `/filmmaand/`; the existing Astro blog keeps its routes and output. Share `/filmmaand/agenda/` for the public programme. Films and voting require an onboarded account. Clicking an attendance action opens login on the same page.

## Build and runtime

`npm ci` followed by `npm run build` verifies and expands the compressed movie catalogues, installs the function's production dependencies, and builds Astro. Generated catalogues and `node_modules` are ignored by Git. The compressed catalogue contains all 633,575 original searchable records; `filmmaand-data/manifest.json` pins the expanded bytes.

Netlify bundles `netlify/functions/filmmaand.mjs` with its preserved `filmmaand-server/` tree. Its routes are scoped to Filmmaand APIs and gated HTML; Programma and other assets remain static. Configure `AWS_LAMBDA_JS_RUNTIME=nodejs24.x` in Netlify's environment settings, not in TOML. The blog's build Node setting is independent.

## Server environment

Set credentials in Netlify, never in browser code or Git:

- `RESEND_API_KEY`, `AUTH_FROM=Filmmaand <login@mail.ely0030.xyz>`, `AUTH_MAILER=resend`.
- `AUTH_REGISTRATION=public`: explicitly opens both registration and code delivery to visitors. The legacy allowlists below are ignored only in this mode. Omit this setting for restricted acceptance previews.
- `AUTH_MAIL_ALLOW`: permitted recipients in restricted mode; an empty list sends no mail.
- `AUTH_ALLOW_LIST`: optional login guest list in restricted mode; configure it together with the delivery list. Public registration retains canonical per-email/IP limits, code expiry, and the durable 80/day and 2,000/month delivery caps.
- `TMDB_READ_ACCESS_TOKEN` (or `TMDB_API_KEY`) for movie descriptions and artwork.
- `PLANNING_ADMIN_TOKEN`: separate random organizer credential, never a browser credential.
- `FILMMAAND_ORIGIN`: exact serving origin, normally `https://ely0030.xyz`.
- `FILMMAAND_STATE_STORE=filmmaand-state-v1` and `FILMMAAND_IMAGE_STORE=filmmaand-images-v1`.

Preview deployments must override the origin and both store names. The acceptance alias uses `filmmaand-qa-glimmer-preview-state` and `filmmaand-qa-glimmer-preview-images`; never promote those namespaces to production.

## Persistence and email

Plans, account data, avatar ownership, receipts and the temporary email outbox share a private Blobs document. Strong reads and conditional ETag writes commit a transaction before releasing its response. Canonical SQLite validation runs in isolated memory per attempt. Uploaded images are immutable normalized WebP objects in the image store.

Resend delivery happens only after the outbox commit and uses a stable idempotency key. Retry preserves the original code, content and expiry. Login cookies are HttpOnly, Secure and scoped to `/filmmaand/`. No development inbox or test-login helper is deployed.

The new email template has HTML and equivalent plain text, an actual expiry, and no remote assets or tracking links. Authentication and template quality do not guarantee inbox placement; the first setup message reached Gmail Spam.

## Demo data and launch evidence

Use a fresh demo plan only, never the local review database. The initial fixture contains Bas, Koen, Fre, Ruben, Lucas, Joeri and Sjoerd, all explicitly labelled as examples. It contains no login accounts or final votes. A visible notice identifies example data; real visitor choices persist normally. Removal must preserve real participants, receipts and account data and refuse to delete fixture suggestions that real users now reference.

The source integration preserves the existing blog's 143 generated files byte-for-byte. The accepted native adapter was tested for login, avatar uniqueness, claims, exact vote retry after session expiry, normalized image uploads and concurrent state updates. Public launch acceptance additionally requires a real hosted login-code and browser journey; a successful build alone is not that proof.

Operator commands are documented in `filmmaand-server/operator/operator-README.md`. Run them from that directory after installing the server dependencies; they are excluded from deployed functions. The fresh seven-person seed is `filmmaand-data/demo-plan.json`. Every removal makes a private backup and uses one conditional write; it never copies preview users into production.
