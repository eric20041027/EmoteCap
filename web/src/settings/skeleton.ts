import { useSyncExternalStore } from 'react';

/** full: body + fingers (52 exported bones, hand tracking on). body: body only (22 bones, no hand model). */
export type SkeletonMode = 'full' | 'body';

const STORAGE_KEY = 'emotecap.skeleton';
const listeners = new Set<() => void>();

function readSaved(): SkeletonMode {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'body' ? 'body' : 'full';
  } catch {
    return 'full';
  }
}

let current: SkeletonMode = readSaved();

export const currentSkeleton = (): SkeletonMode => current;

export function setSkeleton(mode: SkeletonMode): void {
  current = mode;
  try {
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSkeleton(): SkeletonMode {
  return useSyncExternalStore(subscribe, currentSkeleton);
}
