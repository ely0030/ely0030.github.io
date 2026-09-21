// Read-only instrument. Measures the CPU cost of one state.mjs transact() cycle
// against synthetic state blobs of varying size. No network, no production data.
// Usage: node docs/netlify-cost/bench-transact.mjs
import {openState} from '../../filmmaand-server/state.mjs';

const ISO = n => new Date(Date.now() - n * 60000).toISOString();

function synthState({people = 12, items = 40, seen = 400, intents = 200, receipts = 500, options = 45, rateLimits = 300, authReceipts = 400}) {
  const participants = Array.from({length: people}, (_, i) => ({
    id: 'u' + i, email: 'p' + i + '@example.test', created_at: ISO(10000), profile_revision: 3,
    onboarded: 1, name: 'Persoon ' + i, avatar_id: i + 1, animal: 'kat', age: 30, food: 'pasta',
    genre: 'drama', film: 'iets', updated_at: ISO(900)
  }));
  const sessions = Array.from({length: people * 3}, (_, i) => ({
    token_hash: 'h'.repeat(60) + i, participant_id: 'u' + (i % people), created_at: ISO(5000),
    expires_at: ISO(-50000), last_seen_at: ISO(i), revoked_at: null, client: 'web'
  }));
  // Per-request tables: these grow with traffic, so hydration cost grows with traffic.
  const rate_limits = Array.from({length: rateLimits}, (_, i) => ({key: 'rl:' + 'k'.repeat(30) + i, window_start: 1758000000 + i, count: 3}));
  const authReceiptRows = Array.from({length: authReceipts}, (_, i) => ({
    scope: 'plan:home-picker-lab', request_key: 'q'.repeat(40) + i, fingerprint: 'f'.repeat(64),
    result: JSON.stringify({ok: true, id: 'o' + i}), created_at: ISO(i * 5)
  }));
  const accountItems = Array.from({length: items}, (_, i) => ({
    id: 'i' + i, groupKey: 'g' + i, type: 'film-suggested',
    text: 'Een tamelijk normale notificatietekst over een film ' + i + '.',
    href: '/filmmaand/films/?film=o' + i,
    actor: {name: 'Persoon ' + (i % people), avatarId: 'a1'},
    subjects: [{id: 'o' + i, title: 'Film ' + i, poster: 'https://m.media-amazon.com/images/M/' + 'x'.repeat(40) + '.jpg'}],
    count: 1, createdAt: ISO(i * 10), updatedAt: ISO(i * 10), readAt: null
  }));
  const planOptions = Array.from({length: options}, (_, i) => ({
    id: 'o' + i, title: 'Een Filmtitel Nummer ' + i, owner: 'p_u' + (i % people),
    movie: {id: 'tt' + String(1000000 + i), poster: 'https://m.media-amazon.com/images/M/' + 'y'.repeat(40) + '.jpg',
            year: 1990 + (i % 30), genres: ['Drama', 'Comedy'], directors: ['Regisseur ' + i]}
  }));
  return {
    format: 2, resetGeneration: '0',
    auth: {participants, sessions, login_codes: [], rate_limits, claims: [], receipts: authReceiptRows,
           password_credentials: [], email_ownership: [], session_security: [], auth_invites: []},
    plans: {'home-picker-lab': {version: 918, data: {
      version: 918, options: planOptions,
      likes: Object.fromEntries(participants.map(p => ['p_' + p.id, planOptions.slice(0, 20).map(o => o.id)])),
      coordinationEvents: Array.from({length: 30}, (_, i) => ({id: 'e' + i, planId: 'home-picker-lab', eventId: 'ev' + i,
        type: 'date-confirmed', occurredAt: ISO(i * 100), scheduledDate: '2026-09-18'}))
    }}},
    images: {owners: {}}, outbox: {},
    mailUsage: {'2026-09-21': 3, '2026-09': 41},
    accountNotifications: {
      accounts: Object.fromEntries(participants.map(p => [p.id, {items: accountItems, importantActivityEmail: true}])),
      baselines: {}, recommendations: {},
      mailIntents: Object.fromEntries(Array.from({length: intents}, (_, i) => ['m' + i,
        {id: 'm' + i, type: 'round-opened', planId: 'home-picker-lab', eventId: 'r' + i, occurredAt: ISO(i * 30),
         scheduledDate: '2026-09-18', title: 'Een nieuwe stemronde is open. Kies je film.', href: '/filmmaand/stemmen/', programmeId: null}]))
    },
    eventNotifications: {
      outbox: {},
      seen: Object.fromEntries(Array.from({length: seen}, (_, i) => ['k' + 'z'.repeat(60) + i,
        {at: ISO(i * 20), eventId: 'ev' + i, type: 'date-confirmed'}])),
      receipts: Array.from({length: receipts}, (_, i) => ({id: 'r' + 'w'.repeat(60) + i, acceptedAt: ISO(i * 15), providerId: 'pid-' + i}))
    }
  };
}

// Reproduces exactly what state.mjs transact() does per attempt, minus the network.
function cycle(raw) {
  const t0 = performance.now();
  const parsed = JSON.parse(raw);                 // blob body -> object (type:'json')
  const t1 = performance.now();
  const c = openState(parsed);                    // structuredClone + in-memory SQLite + row-by-row INSERT
  const t2 = performance.now();
  const next = c.export();                        // SELECT * from all 10 tables
  const t3 = performance.now();
  const same = JSON.stringify(next) === JSON.stringify(parsed); // the idle-diff, twice over the whole state
  const t4 = performance.now();
  c.close();
  return {parse: t1 - t0, open: t2 - t1, export: t3 - t2, diff: t4 - t3, total: t4 - t0, same};
}

const SCENARIOS = [
  ['small   (12 people, light history)', {people: 12, items: 10, seen: 50, intents: 20, receipts: 50, options: 20, rateLimits: 40, authReceipts: 50}],
  ['medium  (12 people, 3 months use)',  {people: 12, items: 40, seen: 400, intents: 200, receipts: 500, options: 45}],
  ['large   (retention caps reached)',   {people: 20, items: 120, seen: 2000, intents: 2000, receipts: 2000, options: 80, rateLimits: 2000, authReceipts: 2000}],
];

console.log('node', process.version, '\n');
console.log('scenario'.padEnd(36), 'blobKB'.padStart(8), 'parse'.padStart(8), 'open'.padStart(8), 'export'.padStart(8), 'diff'.padStart(8), 'TOTAL'.padStart(9));
for (const [label, opts] of SCENARIOS) {
  const raw = JSON.stringify(synthState(opts));
  cycle(raw); cycle(raw);                          // warm JIT
  const runs = Array.from({length: 12}, () => cycle(raw));
  const med = k => runs.map(r => r[k]).sort((a, b) => a - b)[Math.floor(runs.length / 2)];
  console.log(label.padEnd(36), (raw.length / 1024).toFixed(0).padStart(8),
    med('parse').toFixed(1).padStart(8), med('open').toFixed(1).padStart(8),
    med('export').toFixed(1).padStart(8), med('diff').toFixed(1).padStart(8),
    med('total').toFixed(1).padStart(9), runs[0].same ? '(idle: no write)' : '(MUTATED)');
}
