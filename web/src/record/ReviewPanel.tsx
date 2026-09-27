import { useEffect, useState, type RefObject } from 'react';
import type { MotionFrame } from '../motion/index';
import { SlicePanel } from '../take/SlicePanel';
import { useAutoSlice } from '../take/useAutoSlice';
import type { TakeVideo } from '../take/useTakeVideo';
import { formatSeconds } from '../ui/format';
import { takeDuration } from './take';
import { TrimClipPanel, type TrimRange } from './TrimClipPanel';
import type { Exporter } from './useExporter';
import { usePlayback } from './usePlayback';

type ReviewMode = 'auto' | 'trim';

const MODES: [ReviewMode, string][] = [
  ['auto', '✦ Auto-slice'],
  ['trim', 'Trim one clip'],
];

interface ReviewPanelProps {
  frames: readonly MotionFrame[];
  /** Raw camera video of this take, for Gemini. */
  video: TakeVideo;
  frameRef: RefObject<MotionFrame | null>;
  exporter: Exporter;
  onDiscard: () => void;
}

/** After a take: auto-slice it into clips with Gemini (default), or trim one clip by hand. */
export function ReviewPanel({ frames, video, frameRef, exporter, onDiscard }: ReviewPanelProps) {
  const duration = takeDuration(frames);
  const [mode, setMode] = useState<ReviewMode>('auto');
  const [range, setRange] = useState<TrimRange>({ start: 0, end: duration });
  const playback = usePlayback(frames, frameRef);
  const slicer = useAutoSlice(frames, video);
  const { seek, stop } = playback;

  // Show the first frame of the take as soon as review starts.
  useEffect(() => seek(0), [seek]);

  const switchMode = (next: ReviewMode) => {
    stop();
    setMode(next);
  };

  return (
    <div className="review">
      <div className="review__head">
        <div>
          <h2 className="dock__title">Review take</h2>
          <p className="dock__meta">
            {formatSeconds(duration)} · {frames.length} frames
            {mode === 'trim' && ' · drag the handles to trim'}
          </p>
        </div>
        <div className="review__actions">
          <div className="mode-switch" role="group" aria-label="How to cut this take">
            {MODES.map(([value, label]) => (
              <button
                key={value}
                type="button"
                className="mode-switch__option"
                aria-pressed={mode === value}
                onClick={() => switchMode(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn--ghost" onClick={onDiscard}>
            Discard take
          </button>
        </div>
      </div>

      {mode === 'auto' ? (
        <SlicePanel
          frames={frames}
          video={video}
          slicer={slicer}
          playback={playback}
          exporter={exporter}
          onTrimInstead={() => switchMode('trim')}
        />
      ) : (
        <TrimClipPanel
          frames={frames}
          duration={duration}
          range={range}
          onRangeChange={setRange}
          playback={playback}
          exporter={exporter}
        />
      )}
    </div>
  );
}
