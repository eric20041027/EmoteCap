/** Band colours for auto-sliced clips (timeline band and list row share one colour). */
const SEGMENT_COLORS = ['#8b7bff', '#3dd6c6', '#ff8a3d', '#4f8dff', '#ff6fa8', '#3ddc97', '#ffb547'] as const;

export function segmentColor(id: number): string {
  return SEGMENT_COLORS[Math.abs(id) % SEGMENT_COLORS.length];
}
