import type { SmoothingLevel } from '../motion/index';

interface SmoothingSelectProps {
  value: SmoothingLevel;
  onChange: (level: SmoothingLevel) => void;
}

/** Trade responsiveness for steadiness: high removes the most jitter but lags a little behind fast moves. */
export function SmoothingSelect({ value, onChange }: SmoothingSelectProps) {
  return (
    <label className="camera-select" title="Low: most responsive. High: steadiest limbs and fingers, slight lag on fast moves.">
      <select aria-label="Smoothing" value={value} onChange={(event) => onChange(event.target.value as SmoothingLevel)}>
        <option value="low">Smoothing: Low</option>
        <option value="medium">Smoothing: Medium</option>
        <option value="high">Smoothing: High</option>
      </select>
    </label>
  );
}
