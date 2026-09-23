import test from 'node:test';
import assert from 'node:assert/strict';
import { checkedFetch, stateStore } from './blob-store.mjs';

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

test('Blob SDK bounds GET, CAS, and throttled retries safely', async () => {
  const original = globalThis.fetch;
  let calls = [];
  try {
    globalThis.fetch = async (_url, options) => {
      calls.push(options.method);
      return new Response(null, { status: 500 });
    };
    const store = stateStore({ name: 'retry-test', siteID: 'site', token: 'token', edgeURL: 'https://storage.invalid', uncachedEdgeURL: 'https://storage.invalid' });
    const started = Date.now();
    await assert.rejects(store.getWithMetadata('state-v1', { type: 'json' }), { code: 'storage_unavailable' });
    assert.deepEqual(calls, ['get', 'get']);
    assert.ok(Date.now() - started >= 250, 'GET retry should wait about 300ms');

    calls = [];
    await assert.rejects(store.setJSON('state-v1', { value: 1 }), { code: 'storage_unavailable' });
    assert.deepEqual(calls, ['put']);

    calls = [];
    globalThis.fetch = async (_url, options) => {
      calls.push(options.method);
      return calls.length === 1 ? new Response(null, { status: 500 }) : new Response(null, { status: 412 });
    };
    assert.deepEqual(await store.setJSON('state-v1', { value: 1 }, { onlyIfMatch: 'etag-1' }), { modified: false });
    assert.deepEqual(calls, ['put', 'put']);

    calls = [];
    globalThis.fetch = async (_url, options) => {
      calls.push(options.method);
      return new Response(null, { status: 412 });
    };
    assert.deepEqual(await store.setJSON('state-v1', { value: 1 }, { onlyIfMatch: 'etag-1' }), { modified: false });
    assert.deepEqual(calls, ['put']);

    calls = [];
    globalThis.fetch = async (_url, options) => {
      calls.push(options.method);
      return new Response(null, { status: 429, headers: { 'X-RateLimit-Reset': String(Math.ceil((Date.now() + 60000) / 1000)) } });
    };
    await assert.rejects(store.getWithMetadata('state-v1', { type: 'json' }), { code: 'storage_unavailable', upstreamStatus: 429 });
    assert.deepEqual(calls, ['get']);
  } finally { globalThis.fetch = original; }
});
