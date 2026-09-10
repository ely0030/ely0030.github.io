// Shared display timing. A default wall-clock label never enables a reminder.
const label=value=>typeof value==='string'&&value.trim()?value.trim():null;
export function resolvedEventTiming(n={}) {
 const explicit=label(n.timing?.screening);
 const stamp=typeof n.startsAt==='string'?Date.parse(n.startsAt):NaN;
 const screening=explicit||(Number.isFinite(stamp)?new Intl.DateTimeFormat('nl-NL',{timeZone:'Europe/Amsterdam',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(stamp)):'18:00');
 const end=label(n.timing?.end);
 return {screening,...(end?{end}:{})};
}
