/** 4.8712 -> "4.87 s" */
export function formatSeconds(seconds: number): string {
  return `${seconds.toFixed(2)} s`;
}

/** 64.25 -> "1:04.2" (recording timer). */
export function formatClock(seconds: number): string {
  const safe = Math.max(seconds, 0);
  const minutes = Math.floor(safe / 60);
  const rest = safe - minutes * 60;
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`;
}

/** Position of time t on a timeline of `duration` seconds, as a CSS percentage. */
export function timelinePercent(t: number, duration: number): string {
  return `${duration > 0 ? (t / duration) * 100 : 0}%`;
}
