import test from 'node:test';
import assert from 'node:assert/strict';
import { checkedFetch } from './blob-store.mjs';

test('missing reads are allowed, missing writes cannot become a successful CAS acknowledgement', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(null, { status: 404 });
    for (const method of ['GET', 'HEAD', 'DELETE']) assert.equal((await checkedFetch('https://storage.invalid/key', { method })).status, 404);
    for (const method of ['PUT', 'POST']) await assert.rejects(checkedFetch('https://storage.invalid/key', { method }), { code: 'storage_unavailable', status: 503 });
    await assert.rejects(checkedFetch(new Request('https://storage.invalid/key', { method: 'PUT' })), { code: 'storage_unavailable' });
    globalThis.fetch = async () => new Response(null, { status: 412 });
    assert.equal((await checkedFetch('https://storage.invalid/key', { method: 'PUT' })).status, 412);
    globalThis.fetch = async () => new Response(null, { status: 500 });
    await assert.rejects(checkedFetch('https://storage.invalid/key'), { code: 'storage_unavailable' });
  } finally { globalThis.fetch = original; }
});
