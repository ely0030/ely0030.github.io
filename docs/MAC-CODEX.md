# Mac development and Codex handoff

Updated 2026-09-10. This file is the portable starting point; historical `/home/chris`, `/mnt/c`, `/tmp` paths in older handoffs are evidence locations on Windows/WSL, not required setup paths.

## 1. Git access on the Mac (once)

Install Git, Node 24 and optionally GitHub CLI with your usual package manager. GitHub authentication must happen on the Mac using Chris’s own account; it cannot be transferred through a repository commit. If GitHub CLI is installed:

```sh
gh auth login --hostname github.com --git-protocol https --web
gh auth setup-git
gh repo clone ely0030/ely0030.github.io
cd ely0030.github.io
```

Without GitHub CLI, clone `https://github.com/ely0030/ely0030.github.io.git` and use GitHub-supported HTTPS credentials or an SSH key for pushing. Never put a token into the remote URL.

Set the commit author if Git has not been configured on this Mac. Use the name/email you actually want published in Git history (GitHub’s noreply address is fine). Open **this cloned folder** in your coding agent, not a copied WSL temporary directory.

## 2. Install and preview

Use Node 24 (`.nvmrc`); Node 20 from old blog instructions cannot execute the backend’s `node:sqlite`.

```sh
# Only if you use nvm:
nvm install
nvm use

npm run setup:filmmaand
npm run dev:filmmaand
```

Setup installs both lockfiles and verifies/extracts the catalogue; it does not read production credentials. This works from repo-relative paths and installs platform-specific packages on the Mac; do not copy Linux node_modules.

Local links:
- Programme: http://localhost:4412/filmmaand/programma/
- Organizer: http://localhost:4412/filmmaand/beheer/
- Fixture clock/mail count: http://localhost:4412/

This uses the existing date-coordination development fixture: fictional films/account, synthetic organizer authentication, local state, captured email. **Restarting resets this fixture**. It is useful for UI/date/backend work, but does not prove real email login, production Blobs scheduling, or a populated social feed. For those changes, use the nearest focused tests and a separately configured isolated environment; never point an ad hoc development server at production storage. The static preview must not be represented as the real user’s session.

`npm run dev:site` runs the Astro personal site on port4321. `npm run build` builds what Netlify publishes, including the Programme alias. Local Cluster artifacts and the old localhost4206/44xx prototypes are not deployed app dependencies and do not automatically transfer to a new Mac.

## 3. Make changes and push

Start from current GitHub main, not a pinned historical commit:

```sh
git switch main
git pull --ff-only origin main
git switch -c fix/short-description
# edit, inspect the diff, and run checks appropriate to the change
npm run build
git add <specific-files>
git commit -m "fix(filmmaand): describe the change"
git push -u origin HEAD
```

Use a PR or, when Chris authorizes production deployment, fast-forward the reviewed branch into main and push:

```sh
git switch main
git pull --ff-only origin main
git merge --ff-only fix/short-description
git push origin main
```

If main advanced, rebase the feature branch and resolve only your own conflicts before trying the fast-forward again. Never force-push main. Pushing a feature branch does not update production. Pushing **main** triggers the connected Netlify deployment automatically. No Netlify API key is needed for ordinary Git-based pushes. Check the exact commit reaches READY in Netlify and then verify the affected live page before saying it is live. GitHub Pages green status alone is not proof of Filmmaand backend deployment.

## 4. Current product and integration boundaries

- Public Programme; authenticated Films/voting. Real participants and their data are already live. No reset or demo import without an explicit new instruction.
- Header, Canela/sans conventions, current Programme composition and moire are settled; do not replace them wholesale.
- Per-night timing is editable in Beheer; shared resolver default Aanvang18:00. Current Friday’s explicit values override defaults. Do not change deadlines or times based on outdated examples.
- Notifications: durable bell/read history, six original activity types, popular-suggestion alert after3 other-person likes, no retrospective notification backfill. Email provider is Mailgun. Existing suppression, outbox/dedupe and uncertain-send guards must remain.
- Calendar avatar repair: agenda.js bundles sizing with renderer; intrinsic12px images and bounded cells prevent unstyled image expansion. Old failed P01 CSS must not be reapplied. notifications.js has an idempotent class-removal guard preventing a MutationObserver loop on opening dialogs.
- `public/filmmaand/agenda/index.html` holds asset version queries. Refresh changed JS/CSS versions coherently when cached pages could mix incompatible versions.
- Small UI tasks: targeted syntax/diff + actual affected desktop/mobile interaction. Stateful auth/vote/mail changes need focused invariant tests. Avoid repeated broad testing for copy-only edits.
- Glimmer was the sole deployment operator in the Windows session. Before concurrent work from two machines, explicitly agree who pushes main; different machines do not make overlapping deployments safe.

## 5. Credentials, operator tools, and mail

Production runtime credentials remain in Netlify. Local testing above needs none. If changing provider settings, diagnosing private state or running an organizer batch, use an authenticated account/service session and transfer any needed secret through a secure channel; do not copy it into Git, issue bodies or chat.

`filmmaand-server/operator/` documents operational commands. Some earlier batch tools/receipts and private credentials exist only on the Windows machine; they are not prerequisites for code edits/pushes. An old receipt is not authorization to send a new batch. Manual and automatic notifications must share dedupe; provider acceptance is not proof of inbox delivery.

## Prompt for Mac Codex

> Read AGENTS.md and docs/MAC-CODEX.md. This is the real ely0030.xyz / Filmmaand production repository. Inspect git status/current main, use repo-relative paths, and preserve live data and settled design. I want to work on: [task]. Implement it with proportionate checks. Use the isolated local fixture where appropriate, and clearly distinguish local preview from deployment. Do not send emails/reset data or push main without authorization for those actions. When I authorize deployment, push through this repository’s existing Netlify main-branch flow and verify the deployed commit.

## Portability verification

Setup/build and isolated API preview are verified on Linux from a fresh checkout. No physical Mac was available during this handoff, so macOS execution and Mac Git authentication must be checked on that machine.
