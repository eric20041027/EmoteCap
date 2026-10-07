import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

export function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sameContents(sourcePath, destPath) {
  return existsSync(destPath) && digest(readFileSync(sourcePath)) === digest(readFileSync(destPath));
}

export async function ensureAsset({ url, dest, sha256 }, fetchFn = fetch) {
  if (existsSync(dest) && digest(readFileSync(dest)) === sha256) return 'cached';
  mkdirSync(dirname(dest), { recursive: true });
  const partial = `${dest}.${randomUUID()}.part`;
  try {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (digest(bytes) !== sha256) throw new Error(`SHA256 mismatch: ${basename(dest)}`);
    writeFileSync(partial, bytes, { flag: 'wx' });
    renameSync(partial, dest);
    return 'downloaded';
  } finally {
    rmSync(partial, { force: true });
  }
}
