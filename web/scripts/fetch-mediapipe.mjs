#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureAsset, sameContents } from './asset-integrity.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSource = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDest = join(root, 'public', 'mediapipe', 'wasm');
const assets = JSON.parse(readFileSync(new URL('./mediapipe-assets.json', import.meta.url), 'utf8'));

try {
  if (!existsSync(wasmSource)) throw new Error('MediaPipe WASM is missing. Run npm ci first.');
  mkdirSync(wasmDest, { recursive: true });
  for (const entry of readdirSync(wasmSource, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const source = join(wasmSource, entry.name);
    const dest = join(wasmDest, entry.name);
    if (!sameContents(source, dest)) copyFileSync(source, dest);
  }
  for (const asset of assets) {
    if (basename(asset.file) !== asset.file) throw new Error('Asset filename must be a basename');
    const outcome = await ensureAsset({ ...asset, dest: join(root, 'public', 'models', asset.file) });
    console.log(`[mediapipe] ${asset.file}: ${outcome}, SHA256 verified`);
  }
} catch (error) {
  console.error(`[mediapipe] ${error instanceof Error ? error.message : String(error)}`);
  console.error('Check your network/proxy and run npm run fetch-assets. Keep TLS verification enabled.');
  process.exitCode = 1;
}
