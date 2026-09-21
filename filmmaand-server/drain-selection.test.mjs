// The drain hint is an optimisation. Its only hard invariant is directional: a wrong hint may cost a
// wasted read, but must never be able to skip a drain and strand a queued send. Exercised directly
// because the gating in coordinationScheduled needs live Blobs and is otherwise untestable.
import test from 'node:test';
import assert from 'node:assert/strict';
import {drainSelection} from './handler.mjs';

const ALL={events:true,mail:true,tonight:true};

test('an absent, null or non-object hint drains everything', () => {
 for (const hint of [undefined, null, false, 0, '', 'mail', 42, []]) {
  assert.deepEqual(drainSelection(hint), ALL, `hint ${JSON.stringify(hint)} must drain everything`);
 }
});

test('a hint missing a key drains that key — a partial hint cannot strand a send', () => {
 assert.deepEqual(drainSelection({events:false, tonight:false}), {events:false, mail:true, tonight:false});
 assert.deepEqual(drainSelection({}), ALL);
 assert.deepEqual(drainSelection({unrecognised:false}), ALL);
});

test('only an explicit false skips a drain; every other falsy value still drains', () => {
 for (const value of [undefined, null, 0, '', NaN]) {
  assert.equal(drainSelection({mail:value}).mail, true, `mail:${String(value)} must still drain`);
 }
 assert.equal(drainSelection({mail:false}).mail, false);
});

test('an all-false hint skips all three — the idle case this exists for', () => {
 assert.deepEqual(drainSelection({events:false,mail:false,tonight:false}),
  {events:false,mail:false,tonight:false});
});
