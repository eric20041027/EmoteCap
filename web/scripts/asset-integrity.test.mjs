import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureAsset, sameContents } from './asset-integrity.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'emotecap-assets-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from('model');
  return { root, bytes, asset: {
    url: 'https://example.invalid/model.task', dest: join(root, 'model.task'),
    sha256: '9372c470eeadd5ecd9c3c74c2b3cb633f8e2f2fad799250a0f70d652b6b825e4',
  } };
}

test('downloads valid content and then reuses it offline', async (t) => {
  const { asset, bytes } = fixture(t);
  assert.equal(await ensureAsset(asset, async () => new Response(bytes)), 'downloaded');
  assert.equal(await ensureAsset(asset, async () => { throw new Error('offline'); }), 'cached');
  assert.deepEqual(readFileSync(asset.dest), bytes);
});

test('repairs a same-size corrupt cache', async (t) => {
  const { asset, bytes } = fixture(t);
  writeFileSync(asset.dest, 'xxxxx');
  assert.equal(await ensureAsset(asset, async () => new Response(bytes)), 'downloaded');
  assert.deepEqual(readFileSync(asset.dest), bytes);
});

test('wrong digest never publishes a replacement or partial file', async (t) => {
  const { root, asset } = fixture(t);
  writeFileSync(asset.dest, 'old');
  await assert.rejects(ensureAsset(asset, async () => new Response('wrong')), /SHA256/);
  assert.equal(readFileSync(asset.dest, 'utf8'), 'old');
  assert.deepEqual(readdirSync(root), ['model.task']);
});

test('network failure fails clearly and leaves no model file', async (t) => {
  const { root, asset } = fixture(t);
  await assert.rejects(ensureAsset(asset, async () => { throw new Error('offline'); }), /offline/);
  assert.deepEqual(readdirSync(root), []);
});

test('HTTP failures and interrupted response bodies are not cached', async (t) => {
  const { root, asset } = fixture(t);
  await assert.rejects(ensureAsset(asset, async () => new Response('', { status: 503 })), /503/);
  await assert.rejects(ensureAsset(asset, async () => ({
    ok: true, arrayBuffer: async () => { throw new Error('interrupted'); },
  })), /interrupted/);
  assert.deepEqual(readdirSync(root), []);
});

test('WASM equality compares content, including same-size changes', (t) => {
  const { root } = fixture(t);
  const a = join(root, 'a.wasm');
  const b = join(root, 'b.wasm');
  writeFileSync(a, 'aaaa');
  assert.equal(sameContents(a, b), false);
  writeFileSync(b, 'bbbb');
  assert.equal(sameContents(a, b), false);
  writeFileSync(b, 'aaaa');
  assert.equal(sameContents(a, b), true);
});
