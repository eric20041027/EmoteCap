import { useEffect, useState, type RefObject } from 'react';
import type { MotionFrame } from '../motion/index';
import { formatSeconds } from '../ui/format';
import { ExportForm } from './ExportForm';
import { TrimTimeline } from './TrimTimeline';
import { takeDuration } from './take';
import type { Exporter } from './useExporter';
import { usePlayback } from './usePlayback';

interface ReviewPanelProps {
  frames: readonly MotionFrame[];
  frameRef: RefObject<MotionFrame | null>;
  exporter: Exporter;
  onDiscard: () => void;
}

/** After a take: trim, replay the selection on the mannequin, name it and export. */
export function ReviewPanel({ frames, frameRef, exporter, onDiscard }: ReviewPanelProps) {
  const duration = takeDuration(frames);
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(duration);
  const playback = usePlayback(frames, frameRef);
  const isPlaying = playback.playhead !== null;
  const { seek } = playback;

  // Show the first frame of the take as soon as review starts.
  useEffect(() => seek(0), [seek]);

  const changeStart = (value: number) => {
    setStart(value);
    seek(value);
  };
  const changeEnd = (value: number) => {
    setEnd(value);
    seek(value);
  };

  return (
    <div className="review">
      <div className="review__head">
        <div>
          <h2 className="dock__title">Review take</h2>
          <p className="dock__meta">
            {formatSeconds(duration)} · {frames.length} frames · drag the handles to trim
          </p>
        </div>
        <button type="button" className="btn btn--ghost" onClick={onDiscard}>
          Discard take
        </button>
      </div>

      <div className="review__timeline">
        <button
          type="button"
          className="btn btn--icon"
          aria-label={isPlaying ? 'Pause' : 'Play selection'}
          onClick={() => (isPlaying ? playback.stop() : playback.play(start, end, exporter.loop))}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <TrimTimeline
          duration={duration}
          start={start}
          end={end}
          playhead={playback.playhead}
          onStartChange={changeStart}
          onEndChange={changeEnd}
        />
      </div>

      <ExportForm exporter={exporter} onExport={() => void exporter.exportRange(frames, start, end)} />
    </div>
  );
}
