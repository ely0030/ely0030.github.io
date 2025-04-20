# Astro ➜ Netlify – Definitive Deployment Guide

_Last updated: {{DATE}}_

> **Goal** → Have a single, friction‑free workflow where every push to `main` automatically builds and publishes the Astro site on Netlify – no manual steps, no workflow‑token surprises.

---

## 1  Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node | **≥ 20.3.0** | Matches `netlify.toml`; use nvm → `nvm install 20.3 && nvm use 20.3` |
| npm  | **≥ 9.8** | Ships with Node 20 |
| Git  | Any recent | SSH key or PAT w/ `repo` scope |
| Netlify account | Free tier is fine | GitHub integrations enabled |

---

## 2  Repo Structure Recap

```text
/docs/…               ← Developer docs (this file)
/netlify.toml          ← Netlify build instructions
/package.json          ← Scripts + deps (Astro, MDX, etc.)
/src/…                 ← Astro components & pages
/src/content/blog/…    ← Markdown articles
```

---

## 3  Configuration Files

### 3.1  `netlify.toml`
```toml
[build]
  command     = "npm run build"   # Astro build
  publish     = "dist"            # Output folder
  node_version = "20.3.0"         # Keep in sync with .nvmrc
```
**Rules**
1. **Never** commit a different `node_version` without bumping `.nvmrc`.
2. Add redirects/headers here (e.g. `[ [redirects] ]`).

### 3.2  `.nvmrc`
```
20.3.0
```
Keeps dev and CI environments aligned.

---

## 4  One‑Time Netlify Setup

1. Log into Netlify → **Add new site → Import from Git**.
2. Pick repository `ely0030/ely0030.github.io`.
3. Verify build settings (auto‑detected):
   * Build command: `npm run build`
   * Publish directory: `dist`
   * Production branch: `main`
4. Click **Deploy site**.
5. (Optional) Add custom domain – Netlify manages Let's Encrypt certs automatically.

That's it. Netlify will create a webhook so every push to `main` triggers:
```
clone → npm ci → npm run build → deploy dist/ to CDN
```

---

## 5  Daily Developer Workflow

```bash
# 1. Get latest
git pull origin main

# 2. Work as usual
#    – add/edit files in src/ or content/

# 3. Test locally
npm ci        # first time or when deps change
npm run dev   # live‑reload preview at http://localhost:4321

# 4. Commit + push
git add .
git commit -m "feat: amazing new post"
git push origin main
```
Netlify will build & deploy automatically. Check the Netlify dashboard for a green ✔︎.

---

## 6  Git Authentication Cheat‑Sheet

| Method | Pros | Cons | Setup |
|--------|------|------|-------|
| **SSH key** (recommended) | No PAT scopes to worry about | One‑time key setup | `ssh-keygen`, add public key to GitHub → `git remote set-url origin git@github.com:ely0030/ely0030.github.io.git` |
| PAT (token) | Works everywhere | Must *not* include `workflow` scope or you'll unintentionally push workflows | Generate PAT w/ **only** `repo` scope, store in Keychain or `.netrc` |

**Never** commit or paste tokens in chats or code. Revoke any leaked token immediately.

---

## 7  Branching & PR Strategy

* **main** – always deployable. Netlify production builds run from here.
* **feature/*** branches – optional; Netlify will auto‑create **Preview Deploys** so you get a URL per PR.
* Merge via PR to keep history clean and let Netlify comment with preview links.

---

## 8  Troubleshooting

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `git push` rejected with *workflow scope* error | Your PAT includes a commit that modifies `.github/workflows/*` but lacks `workflow` scope | Remove the workflow file from the commit **or** push via SSH **or** add `workflow` scope |
| Netlify build fails: *Node version mismatch* | `node_version` in `netlify.toml` differs from runtime | Update both `netlify.toml` and `.nvmrc` to match, re‑deploy |
| 404 after deploy | GitHub Pages still enabled or DNS cached old site | Disable GitHub Pages, clear DNS, wait for propagation |
| Build succeeds but new blog post missing | Wrong front‑matter date or slug; run `npm run dev` locally & validate |

---

## 9  FAQ

**Q • Do we still need `.github/workflows/deploy.yml`?**  
A • No. Netlify handles CI/CD; keep GitHub Actions out unless you have *other* automation needs.

**Q • Can we trigger a manual redeploy?**  
A • Yes – Netlify UI → **Deploys → Trigger Deploy → Deploy site**.

**Q • How to roll back?**  
A • Netlify → **Deploys** → pick an older successful deploy → **Publish deploy**.

---

## 10  Future Enhancements

* **Redirects / Headers** – configure in `netlify.toml`.
* **Serverless Functions** – add `netlify/functions/*` if dynamic behavior is needed.
* **Sitemap** – already generated via `@astrojs/sitemap`.

---

### 🎉 You now have a bullet‑proof Astro + Netlify workflow. Push → Ship → Relax. 