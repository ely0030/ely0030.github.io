import { stepFlock, drawDitheredFly } from './weather-boids.js';
// A fictional, northern-hemisphere microclimate. No location or network requests.
export function seasonAt(date = new Date()) {
  return ['winter', 'spring', 'summer', 'autumn'][Math.floor(((date.getMonth() + 1) % 12) / 3)];
}

export const climates = {
  spring: ['drizzle', 'rain', 'petals', 'clear'],
  summer: ['swarm', 'drizzle', 'rain', 'storm', 'clear'],
  autumn: ['drizzle', 'rain', 'gusts', 'storm', 'leaves', 'clear'],
  winter: ['drizzle', 'snow', 'flurries', 'clear'],
};
const fronts = {
  drizzle: { density: .28, speed: 170, wind: 12 },
  rain: { density: .65, speed: 310, wind: 35 },
  storm: { density: 1, speed: 440, wind: 120 },
  gusts: { density: .6, speed: 250, wind: 190 },
  snow: { density: .4, speed: 30, wind: 14 },
  flurries: { density: .7, speed: 48, wind: 85 },
  leaves: { density: .19, speed: 35, wind: 45 },
  petals: { density: .2, speed: 27, wind: 28 },
  swarm: { density: .65, speed: 0, wind: 0 },
  clear: { density: 0, speed: 120, wind: 10 },
};

export function mountWeather(root) {
  if (root.dataset.mounted) return;
  const canvas = root.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  root.dataset.mounted = 'true';
  const label = root.querySelector('[data-weather-label]');
  const pause = root.querySelector('[data-weather-pause]');
  const next = root.querySelector('[data-weather-next]');
  const seasonPicker = root.querySelector('[data-weather-season]');
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  let choice = 'auto';
  try {
    const saved = localStorage.getItem('index-weather-season');
    if (saved === 'auto' || Object.hasOwn(climates, saved)) choice = saved;
  } catch { /* Storage is optional. */ }
  seasonPicker.value = choice;
  seasonPicker.querySelector('[value="auto"]').textContent = `auto (${seasonAt()})`;
  let season = choice === 'auto' ? seasonAt() : choice;
  let sequence = climates[season];
  const opening = { winter: 'snow', spring: 'petals', summer: 'swarm', autumn: 'drizzle' };
  let index = choice === 'auto' ? 0 : sequence.indexOf(opening[season]);
  let mode = sequence[index];
  let remaining = mode === 'swarm' ? 90 : 24 + Math.random() * 12;
  let paused = motion.matches;
  try { paused ||= localStorage.getItem('index-weather-paused') === 'true'; } catch { /* Storage is optional. */ }
  let width = 0, height = 0, last = 0, frame = 0, elapsed = 0;
  let drops = [], splashes = [], bolt = null;
  let density = fronts[mode].density, wind = fronts[mode].wind;
  let protectedAreas = [];
  let eventIn = 9;
  const random = (a, b) => a + Math.random() * (b - a);
  let stronger = true;


  function updateLabel() {
    label.textContent = `/ ${mode}${paused ? ' / paused' : ''}`;
    root.dataset.season = season;
    pause.textContent = paused ? '[resume]' : '[pause]';
    pause.setAttribute('aria-pressed', String(paused));
    root.dataset.weather = mode;
  }
  function measure() {
    width = innerWidth; height = innerHeight;
    const ratio = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.font = stronger ? '15px monospace' : '13px monospace';
    // Leave the text itself dry; the rest of the page remains open sky.
    protectedAreas = [...document.querySelectorAll('main h1, main h2, main li, .sidebar a, .inline-pw-form, .weather-controls')]
      .map(el => {
        const range = document.createRange();
        range.selectNodeContents(el);
        const r = el.matches('.inline-pw-form, .weather-controls') ? el.getBoundingClientRect() : range.getBoundingClientRect();
        return { x: r.left - 9, y: r.top - 6, w: r.width + 18, h: r.height + 12 };
      });
  }
  function particle(anywhere = false) {
    return { x: random(-100, width + 60), y: anywhere || mode === 'swarm' ? random(0, height) : random(-100, -12), phase: random(0, 6.28), weight: random(.6, 1.3), kind: mode };
  }
  function change() {
    index = (index + 1) % sequence.length;
    mode = sequence[index];
    remaining = mode === 'swarm' ? 90 : mode === 'clear' ? random(14, 24) : random(24, 45);
    eventIn = random(5, 12);
    updateLabel();
  }
  function paint(dt) {
    elapsed += dt;
    remaining -= dt;
    if (remaining <= 0) change();
    const target = fronts[mode];
    density += (target.density - density) * Math.min(1, dt * .5);
    wind += (target.wind - wind) * Math.min(1, dt * .4);
    const count = mode === 'swarm' ? Math.max(55, Math.min(150, Math.round(width * height / 6200))) : Math.min(240, Math.round(width * height / 5200 * density));
    while (drops.length < count) drops.push(particle());
    if (drops.length > count) drops.length = count;
    ctx.clearRect(0, 0, width, height);
    const flock = drops.filter(p => p.kind === 'swarm');
    for (const p of flock) {
      if (!Number.isFinite(p.vx)) { p.vx = Math.cos(p.phase) * 28; p.vy = Math.sin(p.phase) * 28; }
    }
    stepFlock(flock, width, height, dt);
    for (const p of drops) {
      const soft = ['snow', 'flurries', 'leaves', 'petals', 'swarm'].includes(p.kind);
      if (p.kind === 'swarm' && p.kind !== mode && Math.random() < dt * .65) {
        Object.assign(p, particle(true)); delete p.vx; delete p.vy;
      }
      const weather = fronts[p.kind];
      const drift = wind + Math.sin(elapsed * .8 + p.phase) * (soft ? 24 : 16);
      if (p.kind !== 'swarm') {
        p.x += drift * dt * p.weight;
        p.y += weather.speed * dt * p.weight;
      }
      if (p.x > width + 100) p.x = -80;
      if (p.x < -110) p.x = width + 70;
      if (p.kind !== 'swarm' && (p.y > height - 22 || p.y < -120)) {
        if (!soft && splashes.length < 45) splashes.push({ x: p.x, y: height - random(18, 26), life: .65 });
        Object.assign(p, particle());
      }
      let char = drift > 65 ? '/' : '|';
      let color = `rgba(72,100,120,${stronger ? .48 + p.weight * .16 : .23 + p.weight * .13})`;
      if (p.kind === 'drizzle') char = ':';
      if (p.kind === 'snow' || p.kind === 'flurries') { char = p.weight > 1 ? '*' : '.'; color = stronger ? '#526d87' : '#8296a6'; }
      if (p.kind === 'leaves') { char = ['~', ',', '`'][Math.floor((elapsed + p.phase) * 2) % 3]; color = stronger ? '#9b641e' : '#a48a66'; }
      if (p.kind === 'petals') { char = p.weight > 1 ? '*' : "'"; color = stronger ? '#bd3974' : '#b68c9c'; }
      if (p.kind === 'swarm') drawDitheredFly(ctx, p, elapsed);
      else {
        ctx.fillStyle = color;
        ctx.fillText(char, Math.round(p.x / 9) * 9, Math.round(p.y / 14) * 14);
      }
    }
    splashes = splashes.filter(s => (s.life -= dt) > 0);
    for (const s of splashes) {
      ctx.fillStyle = `rgba(72,100,120,${s.life * .45})`;
      ctx.fillText(s.life > .35 ? '._.' : '_ _', s.x, s.y);
    }
    eventIn -= dt;
    if (mode === 'storm' && eventIn <= 0) {
      // A small typographic lightning bolt, never a full-screen flash.
      bolt = { x: random(width * .55, width * .9), life: 1.5 };
      eventIn = random(10, 20);
    }
    if (bolt && (bolt.life -= dt) > 0) {
      ctx.fillStyle = `rgba(91,103,131,${Math.min(.5, bolt.life * .5)})`;
      ['   /', '  /', ' /__', '   /', '  /'].forEach((row, i) => ctx.fillText(row, bolt.x, 48 + i * 14));
    }
    for (const r of protectedAreas) ctx.clearRect(r.x, r.y, r.w, r.h);
  }
  function tick(now) {
    frame = 0;
    if (paused || document.hidden) return;
    if (!last) last = now;
    if (now - last >= 1000 / 24) {
      paint(Math.min((now - last) / 1000, .1));
      last = now;
    }
    frame = requestAnimationFrame(tick);
  }
  function sync() {
    cancelAnimationFrame(frame); frame = 0; last = 0;
    if (!paused && !document.hidden) frame = requestAnimationFrame(tick);
    if (paused) ctx.clearRect(0, 0, width, height);
    updateLabel();
  }
  pause.addEventListener('click', () => {
    paused = !paused;
    try { localStorage.setItem('index-weather-paused', String(paused)); } catch { /* Optional. */ }
    sync();
  });
  next.addEventListener('click', change);
  seasonPicker.addEventListener('change', () => {
    choice = seasonPicker.value;
    season = choice === 'auto' ? seasonAt() : choice;
    sequence = climates[season];
    index = choice === 'auto' ? 0 : sequence.indexOf(opening[season]);
    mode = sequence[index];
    remaining = mode === 'swarm' ? 90 : random(24, 36);
    density = fronts[mode].density;
    wind = fronts[mode].wind;
    splashes = []; bolt = null; eventIn = 9;
    drops = Array.from({ length: Math.min(240, Math.round(width * height / 5200 * density)) }, () => particle(true));
    try { localStorage.setItem('index-weather-season', choice); } catch { /* Optional. */ }
    updateLabel();
    measure();
    if (!paused) paint(0);
  });
  motion.addEventListener('change', () => { if (motion.matches) { paused = true; sync(); } });
  document.addEventListener('visibilitychange', sync);
  window.addEventListener('pagehide', () => { cancelAnimationFrame(frame); frame = 0; });
  window.addEventListener('pageshow', sync);
  window.addEventListener('resize', measure);
  window.addEventListener('scroll', measure, { passive: true });
  new ResizeObserver(measure).observe(document.querySelector('main') || root);
  root.hidden = false;
  measure();
  drops = Array.from({ length: Math.min(240, Math.round(width * height / 5200 * density)) }, () => particle(true));
  updateLabel();
  sync();
}

if (typeof document !== 'undefined') {
  document.querySelectorAll('[data-index-weather]').forEach(mountWeather);
}
