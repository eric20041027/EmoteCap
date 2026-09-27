import { useEffect, useState } from 'react';

export type ServerHealth = 'checking' | 'online' | 'no-blender' | 'offline';

const HEALTH_URL = '/api/health';
const POLL_MS = 10_000;

function parseHealth(body: unknown): ServerHealth {
  if (typeof body !== 'object' || body === null || !('ok' in body) || body.ok !== true) return 'offline';
  return 'blender' in body && body.blender === true ? 'online' : 'no-blender';
}

/** Polls GET /api/health so the UI can warn before an export fails. */
export function useServerHealth(): ServerHealth {
  const [health, setHealth] = useState<ServerHealth>('checking');

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      let next: ServerHealth;
      try {
        const response = await fetch(HEALTH_URL);
        next = response.ok ? parseHealth(await response.json()) : 'offline';
      } catch {
        next = 'offline'; // Unreachable server is an expected state, shown in the status bar.
      }
      if (!cancelled) setHealth(next);
    };
    void check();
    const timer = window.setInterval(check, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, []);

  return health;
}
