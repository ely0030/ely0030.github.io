# ely0030.xyz / Filmmaand

Production: https://ely0030.xyz/filmmaand/programma/

Filmmaand is the shared film-night app on the personal Astro site. GitHub `main` is the source of truth; the connected Netlify site deploys pushed changes automatically. GitHub Pages also has a legacy workflow, but cannot run Filmmaand’s API.

**Continuing on a Mac or a fresh machine: [MAC-CODEX.md](docs/MAC-CODEX.md).** Agents should read [AGENTS.md](AGENTS.md) before editing.

## Quick local setup

Install Git and Node 24 first. If using nvm, run `nvm install && nvm use` in this repo.

```sh
npm run setup:filmmaand
npm run dev:filmmaand
```

Open http://localhost:4412/filmmaand/programma/ or http://localhost:4412/filmmaand/beheer/ . This is an isolated synthetic account with captured mail, **not your live account**. Sample state resets each time this developer server starts. No production credentials are needed.

For the Astro homepage/blog, use `npm run dev:site` (normally http://localhost:4321/). Astro alone does not provide the Filmmaand API. The older `npm run dev` launches legacy blog editor tooling; use the explicit commands above for this handoff.

## Source map

- `public/filmmaand/`: real app HTML, JS, CSS, fonts and images.
- `public/filmmaand/agenda/`: canonical Programme source. `/programma/` is a generated route; do not edit generated copies.
- `filmmaand-server/`: API, auth, planning, strong-CAS storage and notifications.
- `netlify/functions/`: HTTP/scheduled entrypoints; `netlify.toml` describes deployment.
- `filmmaand-data/`: compressed catalogue shipped in Git, expanded by setup/build.
- `src/`: personal site’s Astro pages/content.

Build with `npm run build`. Use focused checks for changed behavior, not the entire test suite for every visual edit. Live data, credentials, resets, emails and operator commands are separate from deploying code: read the handoff before using them.
