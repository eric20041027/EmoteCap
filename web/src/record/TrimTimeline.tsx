import type { CSSProperties } from 'react';
import { formatSeconds, timelinePercent as percent } from '../ui/format';

export const MIN_CLIP_SECONDS = 0.1;
const STEP_SECONDS = 0.01;

interface TrimTimelineProps {
  duration: number;
  start: number;
  end: number;
  playhead: number | null;
  onStartChange: (start: number) => void;
  onEndChange: (end: number) => void;
}

/** Dual-thumb range over the take: [start, end] is the clip that gets exported. */
export function TrimTimeline({ duration, start, end, playhead, onStartChange, onEndChange }: TrimTimelineProps) {
  const rangeStyle: CSSProperties = { left: percent(start, duration), width: percent(end - start, duration) };

  return (
    <div className="trim">
      <div className="trim__slider">
        <div className="trim__rail">
          <div className="trim__range" style={rangeStyle} />
          {playhead !== null && <div className="trim__playhead" style={{ left: percent(playhead, duration) }} />}
        </div>
        <input
          type="range"
          aria-label="Clip start"
          min={0}
          max={duration}
          step={STEP_SECONDS}
          value={start}
          onChange={(e) => onStartChange(Math.max(0, Math.min(Number(e.target.value), end - MIN_CLIP_SECONDS)))}
        />
        <input
          type="range"
          aria-label="Clip end"
          min={0}
          max={duration}
          step={STEP_SECONDS}
          value={end}
          onChange={(e) => onEndChange(Math.min(duration, Math.max(Number(e.target.value), start + MIN_CLIP_SECONDS)))}
        />
      </div>
      <div className="trim__labels">
        <span>
          Start <strong>{formatSeconds(start)}</strong>
        </span>
        <span>
          Clip length <strong>{formatSeconds(end - start)}</strong>
        </span>
        <span>
          End <strong>{formatSeconds(end)}</strong>
        </span>
      </div>
    </div>
  );
}
