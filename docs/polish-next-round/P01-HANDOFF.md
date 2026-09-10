# P01 handoff — Programme calendar participant avatars

- Base: `40c15fcca021bee87fa87b24bb48391c05aa11fc`
- Scope: Programme availability calendar only; canonical `plan.people[].dates` supplies other participants. Own selected-day green treatment remains unchanged. The weekly preferred-date poll and vote/crown logic are untouched.
- Files: `public/filmmaand/agenda/agenda.js`, `public/filmmaand/agenda/agenda.css`
- Checked: `node --check`, `git diff --check`, and a real 390×844 browser pass with mocked read-only plan data. Verified compact avatars, immediate hover name, keyboard focus label, tap-open name, Escape dismissal without closing the calendar dialog, grouped overflow names, accessible day names, and retained selected-day green.
