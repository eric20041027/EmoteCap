import type { CSSProperties } from 'react';
import { formatSeconds, timelinePercent as percent } from '../ui/format';
import type { EditableSegment } from './segmentList';
import { segmentColor } from './segmentColors';

interface SegmentTimelineProps {
  duration: number;
  segments: readonly EditableSegment[];
  playhead: number | null;
  playingId: number | null;
  onPlay: (segment: EditableSegment) => void;
}

/** The whole take as a rail with one coloured band per clip; click a band to play it. */
export function SegmentTimeline({ duration, segments, playhead, playingId, onPlay }: SegmentTimelineProps) {
  return (
    <div className="seg-timeline">
      <div className="seg-timeline__rail">
        {segments.map((segment) => {
          const style = {
            left: percent(segment.start, duration),
            width: percent(segment.end - segment.start, duration),
            '--clip-color': segmentColor(segment.id),
          } as CSSProperties;
          return (
            <button
              key={segment.id}
              type="button"
              className={`seg-timeline__band${segment.id === playingId ? ' seg-timeline__band--playing' : ''}`}
              style={style}
              title={`${segment.name}: ${formatSeconds(segment.start)} – ${formatSeconds(segment.end)}`}
              aria-label={`Play ${segment.name}`}
              onClick={() => onPlay(segment)}
            >
              {segment.name}
            </button>
          );
        })}
        {playhead !== null && <div className="seg-timeline__playhead" style={{ left: percent(playhead, duration) }} />}
      </div>
      <div className="seg-timeline__scale" aria-hidden>
        <span>{formatSeconds(0)}</span>
        <span>{formatSeconds(duration)}</span>
      </div>
    </div>
  );
}
