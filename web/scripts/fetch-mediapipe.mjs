#!/usr/bin/env node
/**
 * Serve MediaPipe from localhost so the demo never depends on venue Wi-Fi:
 *  - copies the tasks-vision WASM runtime into public/mediapipe/wasm/ (when missing or changed)
 *  - downloads the pose model into public/models/ (only when missing)
 * Runs automatically before `npm run dev` and `npm run build`.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const WASM_SRC = join(WEB_ROOT, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const WASM_DEST = join(WEB_ROOT, 'public', 'mediapipe', 'wasm');
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task';
const MODEL_DEST = join(WEB_ROOT, 'public', 'models', 'pose_landmarker_heavy.task');

function sameSize(a, b) {
  return existsSync(b) && statSync(a).size === statSync(b).size;
}

function copyWasm() {
  if (!existsSync(WASM_SRC)) {
    throw new Error(`MediaPipe WASM not found at ${WASM_SRC}. Run "npm install" first.`);
  }
  mkdirSync(WASM_DEST, { recursive: true });
  let copied = 0;
  for (const file of readdirSync(WASM_SRC)) {
    const src = join(WASM_SRC, file);
    const dest = join(WASM_DEST, file);
    if (sameSize(src, dest)) continue;
    copyFileSync(src, dest);
    copied += 1;
  }
  console.log(`[mediapipe] WASM runtime: ${copied ? `copied ${copied} file(s)` : 'up to date'}`);
}

async function downloadModel() {
  if (existsSync(MODEL_DEST)) {
    console.log('[mediapipe] Pose model: present');
    return;
  }
  console.log(`[mediapipe] Downloading pose model (~30 MB)\n  from ${MODEL_URL}`);
  const response = await fetch(MODEL_URL);
  if (!response.ok) {
    throw new Error(`Model download failed: HTTP ${response.status} ${response.statusText}`);
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  mkdirSync(dirname(MODEL_DEST), { recursive: true });
  // Write to a temp name first so an interrupted download never looks like a valid model.
  const partial = `${MODEL_DEST}.part`;
  writeFileSync(partial, bytes);
  renameSync(partial, MODEL_DEST);
  console.log(`[mediapipe] Pose model: saved ${(bytes.length / 1e6).toFixed(1)} MB`);
}

try {
  copyWasm();
  await downloadModel();
} catch (error) {
  console.error(`\n[mediapipe] ERROR: ${error instanceof Error ? error.message : String(error)}`);
  console.error('[mediapipe] The pose model is required. Connect to the internet and run "npm run fetch-assets".\n');
  process.exit(1);
}
