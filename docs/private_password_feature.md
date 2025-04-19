# Private Posts & Inline Password Input – Comprehensive Documentation

_Last updated: 2025‑04‑20_

## 1. Purpose
This document explains **all** functionality implemented to protect private blog posts and provide an inline password‑entry experience on the index page. Reading this alone should let any maintainer reproduce or extend the feature with no blind spots.

## 2. Enabling a Private Post
Add two fields to the post front‑matter:

```yaml
---
private: true                    # Marks the post as private
passwordHash: "<SHA‑256‑digest>"   # Hex digest of your chosen password
---
```

### 2.1 Generating the Hash
Use any SHA‑256 tool, e.g.

```bash
echo -n "myPassword" | shasum -a 256
```
Copy the 64‑character hex result into `passwordHash`.

## 3. Index Page Behaviour (`src/pages/index.astro`)
### 3.1 Visual States
| State | Lock Icon | Bullet | Title | Password Field |
|-------|-----------|--------|-------|----------------|
| Normal | Hidden | Shown | Clickable link | – |
| Hover  | Fades **in** (0.2 s) | Unchanged | Underlined link | – |
| Click  | Remains visible | Unchanged | Transforms into inline password input | Fades **in** (0.3 s) |
| Wrong password | Lock shakes side-to-side & up-down (0.5 s) | Unchanged | Password cleared, input re-focused | – |
| Correct password (first-time) | Lock rotates & brightens (0.4 s), then turns to 🔓 | Unchanged | Link disabled during animation | – |
| Pre-authorized click (already entered password) | 🔒 pops then turns to 🔓 | Unchanged | Link disabled during animation | – |
| Dismiss (click elsewhere) | Input fades **out** (0.3 s); lock fades **out** (0.2 s) | Unchanged | Restored link | – |

### 3.2 DOM Structure (simplified)
```html
<li class="post-item">
  <span class="mark">!!</span>         <!-- optional emphasis symbols -->
  <h2>
    <a href="/slug/" class="private-link" data-hash="<sha256>">Title</a>
    <span class="lock" aria-label="Private">🔒</span>
  </h2>
</li>
```

### 3.3 CSS Highlights
```css
.post-item { position: relative; }
.private-link { display: inline-block; }
.lock {
  position: absolute;      /* left of bullet */
  left: -1.5em;
  top: 50%; transform: translateY(-50%);
  font-size: 0.85em;
  opacity: 0;              /* hidden by default */
  transition: opacity .2s ease;
  user-select: none;
}
/* Show lock on hover or while active form is open */
.private-link:hover + .lock,
.post-item.has-active-form .lock { opacity: .9; }

.inline-pw-form {
  display: inline-flex;
  align-items: center;
  gap: .25em;
  height: 1.4em;
  opacity: 0;
  transform: translateY(-0.2em);
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.post-item.has-active-form .inline-pw-form {
  opacity: 1;
  transform: translateY(0);
}
.inline-pw-form input {
  height: 1.4em;
  box-sizing: border-box;
  line-height: 1;
  padding: 2px 4px;
  border: 1px solid #ccc;
  outline: none;
}

/* Pre-authorized unlock animation (pop effect) */
@keyframes unlockPop {
  0%   { transform: translateY(-50%) scale(1); }
  40%  { transform: translateY(-50%) scale(1.15); }
  100% { transform: translateY(-50%) scale(1); }
}
.lock.unlocking {
  animation: unlockPop 0.3s cubic-bezier(0.175,0.885,0.32,1.275) forwards;
}

/* New password success animation (rotate & brighten) */
@keyframes unlockSuccess {
  0%   { transform: translateY(-50%) rotate(0deg); filter: brightness(1); }
  40%  { transform: translateY(-50%) rotate(-15deg); filter: brightness(1.5); }
  70%  { transform: translateY(-50%) rotate(10deg); filter: brightness(1.3); }
  100% { transform: translateY(-50%) rotate(0deg); filter: brightness(1); }
}
.lock.success {
  animation: unlockSuccess 0.4s ease-out forwards;
}

/* Wrong password shake animation */
@keyframes shakeError {
  0%   { transform: translateY(-50%) translateX(0); }
  20%  { transform: translateY(-51.5%) translateX(-3px); }
  40%  { transform: translateY(-48.5%) translateX(3px); }
  60%  { transform: translateY(-51.5%) translateX(-3px); }
  80%  { transform: translateY(-48.5%) translateX(3px); }
  100% { transform: translateY(-50%) translateX(0); }
}
.lock.error {
  animation: shakeError 0.5s cubic-bezier(0.36,0.07,0.19,0.97) forwards;
}
```

### 3.4 JavaScript Flow (index page)
1. **Click handler** intercepts clicks on `.private-link` (data‑hash present).
2. Prevents default navigation.
3. **Early authorization check**: looks up `localStorage.getItem('pw:/<slug>')`.
   - **If a matching hash is found:**
     1. Disable link pointer events.
     2. Show quick unlock animation: `🔒` gets `.unlocking` class (0.3 s pop) then changes to `🔓` after ~180 ms.
     3. Navigate to the post ~220 ms later (total ~400 ms).
     4. **No password form is created.**
4. If not authorized yet, continue:
   - If the same link is already active → do nothing.
   - Remove any existing active form (`restore()`):
     - Re‑injects original link HTML
     - Ensures lock icon is properly moved back to its original position in the DOM
     - Removes `has-active-form` class → lock can fade out via CSS.
   - Builds a `<form class="inline-pw-form">` with a password `<input>`.
   - Form enters with a fade + slight upward movement animation.
   - Measures the original `<h2>` height to lock layout.
   - Moves the lock icon outside the `<h2>` so it remains visible while the `<h2>` is cleared.
   - Adds `has-active-form` to the `<li>` so the lock stays visible.
   - On **form submit**:
     - Hashes entered password with `js-sha256` (`import { sha256 } from cdn`).
     - If hash matches `data-hash`:
       1. Store `localStorage.setItem('pw:/slug', hash)`.
       2. Show success animation: `🔒` gets `.success` class (0.4 s rotate & brighten) then changes to `🔓` after ~280 ms.
       3. Navigate to the post ~220 ms later (total ~500 ms).
     - Else → shake the lock icon with `.error` class, clear and re-focus the input.
5. Clicking **anywhere else**:
   - If outside any link → `restore()` (input fades out, lock fades out).
   - If another private link → switch active form without flicker.

### 3.5 Local Storage Keys
```
pw:/my-private-slug  →  <sha256>
```
Presence means user already supplied correct password; direct navigation skips the prompt.

## 4. Direct URL Protection (`src/components/PasswordGate.astro`)
When a private post URL is accessed directly:
1. `PasswordGate` checks `localStorage` for the key.
2. If stored hash matches → reveals article (scrolls to top, removes wrapper spacing).
3. Otherwise shows a centered password form (with ← back link).
4. Successful entry stores hash and reveals content.

## 5. Accessibility & UX Details
- **Focus outlines:** Removed only for `.private-link`; other links keep default focus style.
- **Input outline:** Inline `style="outline:none;"` avoids flash.
- **Layout stability:** Fixed heights (`1.4em`) on form/input + measured `<h2>` height prevents vertical jumps.
- **Smooth transitions:** Form appears/disappears with fade and transform animations.
- **Error feedback:** Wrong passwords trigger subtle shake animation instead of error text.
- **Success feedback:** Distinct animations for first-time correct password vs pre-authorized access.

## 6. Security Notes
- Hash is client‑side; actual password never stored.
- SHA‑256 digests are public; protect with strong passwords.
- This is adequate for casual privacy, **not** high‑security.

## 7. File Overview
| File | Purpose |
|------|---------|
| `src/pages/index.astro` | Lists posts; handles inline password logic, CSS, lock icon | 
| `src/components/PasswordGate.astro` | Full‑page password gate for direct URLs |
| `src/styles/global.css` | Base styles (unchanged by this feature) |

## 8. Extending / Customising
- Change lock icon by editing `.lock` content or replacing with SVG.
- Adjust fade duration via the CSS transition.
- Modify layout offsets by tweaking `left: -1.5em`.
- Customize animations by editing the keyframes and timing functions.
- Improve security by moving verification server‑side (requires API changes).

---
**End of document**
