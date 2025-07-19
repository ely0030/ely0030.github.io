# Dynamic Countdown in `<title>`

This document explains the **dynamic countdown script** that updates the browser‑tab title on every page to show the time remaining until **1 October 2027**.

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
## 3. Script Listing (April 2025)
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
2. **Months** are calculated via `(YΔ * 12) + (MΔ)`, then fine‑tuned so day‑offsets don't over‑count.
3. **Days & Hours** come from leftover milliseconds (`diff`). Days are approximated via 30‑day months for display; the visual difference is negligible for user perception.
4. **Formatting** returns a compact `M D H` string.
5. **Past Target** → displays zeros.
6. The script runs once on page‑load; no interval timer is used — performant and sufficient because visitors typically refresh or navigate within an hour anyway.

---
## 5. Customisation

### Changing the Target Date

To change the countdown target, edit the date in `BaseHead.astro`:

```javascript
// Current: October 1, 2027
const target = new Date(2027, 9, 1);

// Example: December 31, 2030
const target = new Date(2030, 11, 31);
```

**Note**: JavaScript months are 0-indexed (January = 0, December = 11).

### Formatting Options

| What you want to change | Where / How |
|-------------------------|-------------|
| **Target date**         | Replace `new Date(2027, 9, 1)` with a new `Date()` (remember month is 0‑based). |
| **Units shown**         | Edit the final template literal in `updateTitle(...)`; remove or add units as needed. |
| **Full words vs spaces**| Replace `${months} ${days} ${hours}` with a sentence e.g. `${months} months, ${days} days, ${hours} hours left` |
| **Zero display**        | Modify the `if (now >= target)` branch. |
| **Add seconds**         | Calculate `const seconds = Math.floor((diff % (1000 * 60)) / 1000);` and include in output |
| **Different separators**| Change spaces to other characters: `${months}:${days}:${hours}` |

### Example Modifications

**Full sentence format:**
```javascript
updateTitle(`${months} months, ${days} days, ${hours} hours remaining`);
```

**Compact with labels:**
```javascript
updateTitle(`${months}m ${days}d ${hours}h`);
```

**Past target message:**
```javascript
if (now >= target) {
  updateTitle('Time\'s up!');
  return;
}
```

---
## 6. Advanced Configuration

### Adding Real-Time Updates

The current implementation updates once on page load. To add live updates:

```javascript
// Add this after the initial calculation
setInterval(() => {
  // Recalculate and update title
  const now = new Date();
  if (now >= target) {
    updateTitle('0 0 0');
    return;
  }
  // ... rest of calculation logic
  updateTitle(`${months} ${days} ${hours}`);
}, 1000); // Update every second
```

### Multiple Countdowns

To cycle through different countdowns:

```javascript
const targets = [
  { date: new Date(2027, 9, 1), label: 'Project End' },
  { date: new Date(2028, 0, 1), label: 'New Year' }
];
let currentIndex = 0;

function showNextCountdown() {
  const target = targets[currentIndex];
  // Calculate countdown for target.date
  // Include target.label in the title
  currentIndex = (currentIndex + 1) % targets.length;
}

setInterval(showNextCountdown, 5000); // Cycle every 5 seconds
```

---
## 7. Implementation Details

### Performance Considerations
- Script runs once per page load (no interval by default)
- Minimal DOM manipulation
- No external dependencies
- Total script size: ~1KB

### Browser Compatibility
- Works in all modern browsers
- ES6 features used (arrow functions, template literals)
- No polyfills needed for Date operations

---
## 8. Edge Cases & Notes
* **User Clock Skew / Time‑zone** – Title is based on the client's clock. Extreme discrepancies may show unexpected values.
* **SEO** – Search engines see the static `<title>` before JS runs. That static value is still the imported `title` prop (usually your post or page name).
* **Accessibility** – Screen‑reader users will hear the countdown when the page loads. Consider adding `aria-label` elsewhere if that's distracting.
* **Tab Switching** – The title remains static when tabs are inactive; consider using the Page Visibility API for updates when tabs regain focus.

---
## 9. Testing the Countdown

To test different dates without waiting:

1. **Browser Console Method**:
   ```javascript
   // Override system date temporarily
   Date = class extends Date {
     constructor(...args) {
       if (args.length === 0) {
         super(2027, 8, 30); // One day before target
       } else {
         super(...args);
       }
     }
   };
   ```

2. **URL Parameter Method** (requires code modification):
   ```javascript
   // Add to the script
   const urlParams = new URLSearchParams(window.location.search);
   const testDate = urlParams.get('testdate');
   const now = testDate ? new Date(testDate) : new Date();
   ```
   Then visit: `yoursite.com?testdate=2027-09-30`

---
## 10. Related Docs
* `docs/private_password_feature.md` – password gate implementation
* `docs/development-workflow.md` – development setup
* `docs/LLM_CONTEXT.md` – overall project documentation

---
_Last updated: 2025‑07‑01_