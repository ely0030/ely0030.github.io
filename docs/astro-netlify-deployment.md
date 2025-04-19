# Astro + Netlify Deployment Guide

_Last updated: {{DATE}}_

## 1  Background

* The site was originally a single **static‑HTML GitHub Pages** site.
* We replaced it with a full **Astro** project (component‑based, Markdown‑first).
* GitHub Pages rejected workflow pushes because the Personal Access Token (PAT) lacked the `workflow` scope.
* We decided to drop GitHub Pages entirely and deploy **exclusively through Netlify** for simplicity and richer features.

---

## 2  Repository Clean‑up

| Action | Why |
|--------|-----|
| Disabled **GitHub Pages** in repo settings | Prevent hosting conflict & 404 confusion |
| Deleted (or never created) a `gh-pages` branch | No longer needed |
| Removed `.github/workflows/*` | Token lacked `workflow` scope & Netlify handles CI/CD |
| Added **`netlify.toml`** | Tells Netlify how to build & where to publish |
| Simplified **npm scripts** in `package.json` | Removed absolute paths & `deploy` script |
| Removed `gh-pages` npm dependency | Not used with Netlify |

---

## 3  `netlify.toml`

```toml
[build]
  command = "npm run build"   # Astro build
  publish = "dist"            # Astro output folder
  node_version = "18"
```

> Netlify auto‑detects Astro but this file guarantees consistency and lets us add redirects/headers later.

---

## 4  Netlify Setup Steps

1. **Create / Connect Site**  → "Import from Git" → pick `ely0030/ely0030.github.io`.
2. Build settings (auto‑detected; verify):
   * Build command: `npm run build`
   * Publish directory: `dist`
   * Production branch: `main`
3. Click **Deploy Site**.
4. (Optional) Add custom domain → Netlify will provision Let's Encrypt TLS automatically.

Every push to `main` now triggers:
```
clone → npm ci ⇒ npm run build ⇒ deploy dist/ to CDN
```

---

## 5  Secure Git Pushes

* Never expose PATs in plaintext chats or code.  
  → **Revoke any leaked token immediately** (`Settings → Developer settings → PATs`).
* Preferred auth: **SSH keys** (`ssh-keygen` → add public key to GitHub → `git remote set-url origin git@github.com:ely0030/ely0030.github.io.git`).
* If you must use PAT: scope it to **`repo`** only; no `workflow` permission is required anymore.

---

## 6  Typical Workflow (Post‑Migration)

1. `git pull` (stay up‑to‑date)
2. Add / edit content under `src/` or `content/`.
3. `git add`, `git commit -m "feat: …"`, `git push`.
4. Netlify builds → green check ✅
5. Visit production URL or use Netlify Preview URLs for feature branches.

---

## 7  Troubleshooting Checklist

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| `git push` hangs | Credential helper waiting for input | Use SSH or store PAT in Keychain |
| Netlify build fails w/ Node mismatch | Wrong runtime | Set `node_version` in `netlify.toml` or Netlify env var |
| 404 after deploy | DNS / custom domain mis‑pointing or cached GitHub Pages site | Clear DNS cache; ensure GitHub Pages disabled |
| Token push error about workflows | Pushing `.github/workflows/*` without `workflow` scope | Delete workflow or add token scope |

---

## 8  Future Enhancements

* **Preview Deploy Comments**: Enable Netlify's GitHub app to comment PR preview URLs automatically.
* **Redirects**: Add `[ [redirects] ]` blocks to `netlify.toml`.
* **Functions / Forms**: Netlify supports serverless functions if dynamic behavior is needed.
* **Sitemap**: Already handled via `@astrojs/sitemap`.

---

### 🎉  You are now running a modern Astro site with hassle‑free Netlify deploys! 