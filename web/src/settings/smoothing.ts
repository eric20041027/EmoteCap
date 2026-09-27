import { useSyncExternalStore } from 'react';
import type { SmoothingLevel } from '../motion/index';

const STORAGE_KEY = 'emotecap.smoothing';
const LEVELS: readonly SmoothingLevel[] = ['low', 'medium', 'high'];
const listeners = new Set<() => void>();

function readSaved(): SmoothingLevel {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return LEVELS.includes(saved as SmoothingLevel) ? (saved as SmoothingLevel) : 'medium';
  } catch {
    return 'medium';
  }
}

let current: SmoothingLevel = readSaved();

export const currentSmoothing = (): SmoothingLevel => current;

export function setSmoothing(level: SmoothingLevel): void {
  current = level;
  try {
    window.localStorage.setItem(STORAGE_KEY, level);
  } catch {
    // Storage blocked: the choice lasts for this page only.
  }
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useSmoothing(): SmoothingLevel {
  return useSyncExternalStore(subscribe, currentSmoothing);
}
