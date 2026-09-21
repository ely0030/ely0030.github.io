// Match the API entrypoint: retain package resolution beside the backend's own dependencies.
export default async function(request,context){const mod=await import(new URL('../../filmmaand-server/handler.mjs',import.meta.url).href);return mod.coordinationScheduled(context);}
// Cadence is deliberately left at one minute. tickCoordination fires programme reminders inside a
// window exactly reminderMinutes wide, and Beheer accepts a reminder as short as one minute
// (beheer.js: ri.min=1), so any slower schedule can skip a short reminder entirely rather than
// merely delay it. Slowing this is a product decision that has to clamp that minimum first;
// docs/netlify-cost/FINDINGS.md carries the numbers. The tick itself is now cheap per invocation.
export const config={schedule:'* * * * *'};
