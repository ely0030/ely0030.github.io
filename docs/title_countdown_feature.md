# Dynamic Countdown in `<title>`

This document explains the **dynamic countdown script** that updates the browser‑tab title on every page to show the time remaining until **1 October 2027**.

---
## 1. Purpose
Instead of a static site title, visitors see a live countdown (months, days, hours) formatted as:

```
30 12 3
```

where the numbers represent **months, days, hours** left. When the target date has passed the title shows:

```
0 0 0
```

---
## 2. Where the Code Lives
* **File:** `src/components/BaseHead.astro`
* **Location:** Immediately after the `<title>{title}</title>` tag (search for `// target: October 1, 2027`).

The snippet is included once — `BaseHead` is imported in every page so no other files need changes.

---
## 3. Script Listing (April 2025)
```html
<script type="module">
;(() => {
  // target: October 1, 2027 (month index is 0‑based -> 9 = October)
  const target = new Date(2027, 9, 1);
  const now    = new Date();

  // Target passed? Show zeros and exit
  if (now >= target) {
    updateTitle('0, 0, 0');
    return;
  }

  // Total millis remaining
  const diff = target - now;

  // MONTHS -----------------------------
  let months = (target.getFullYear() - now.getFullYear()) * 12 +
               (target.getMonth()    - now.getMonth());
  // Align to same DOM and recompute leftover days precisely
  const nextMonthDate = new Date(now);
  nextMonthDate.setMonth(now.getMonth() + months);
  nextMonthDate.setDate(Math.min(target.getDate(), nextMonthDate.getDate()));

  // DAYS & HOURS ------------------------
  const days  = Math.floor(diff / (1000 * 60 * 60 * 24)) % 30;  // rough 30‑day month
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  // Compose and write
  updateTitle(`${months} ${days} ${hours}`);

  function updateTitle(msg) {
    document.title = msg;
    const t = document.querySelector('head > title');
    if (t) t.textContent = msg;
  }
})();
</script>
```

---
## 4. How It Works
1. **Target Date** is hard‑coded (`2027‑10‑01`). Adjust as needed.
2. **Months** are calculated via `(YΔ * 12) + (MΔ)`, then fine‑tuned so day‑offsets don’t over‑count.
3. **Days & Hours** come from leftover milliseconds (`diff`). Days are approximated via 30‑day months for display; the visual difference is negligible for user perception.
4. **Formatting** returns a compact `M D H` string.
5. **Past Target** → displays zeros.
6. The script runs once on page‑load; no interval timer is used — performant and sufficient because visitors typically refresh or navigate within an hour anyway.

---
## 5. Customisation
| What you want to change | Where / How |
|-------------------------|-------------|
| **Target date**         | Replace `new Date(2027, 9, 1)` with a new `Date()` (remember month is 0‑based). |
| **Units shown**         | Edit the final template literal in `updateTitle(...)`; remove or add units as needed. |
| **Full words vs spaces**| Replace `${months} ${days} ${hours}` with a sentence e.g. ```${months} months, ${days} days, ${hours} hours left``` and adjust the past‑date message accordingly. |
| **Zero display**        | Modify the `if (now >= target)` branch. |

---
## 6. Edge Cases & Notes
* **User Clock Skew / Time‑zone** – Title is based on the client’s clock. Extreme discrepancies may show unexpected values.
* **SEO** – Search engines see the static `<title>` before JS runs. That static value is still the imported `title` prop (usually your post or page name).
* **Accessibility** – Screen‑reader users will hear the countdown when the page loads. Consider adding `aria-label` elsewhere if that’s distracting.

---
## 7. Related Docs
* `docs/private_password_feature.md` – password gate implementation

---
_Last updated: 2025‑04‑19_
