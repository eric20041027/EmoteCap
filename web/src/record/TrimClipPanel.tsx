import type { MotionFrame } from '../motion/index';
import { ExportForm } from './ExportForm';
import { TrimTimeline } from './TrimTimeline';
import type { Exporter } from './useExporter';
import type { Playback } from './usePlayback';

export interface TrimRange {
  start: number;
  end: number;
}

interface TrimClipPanelProps {
  frames: readonly MotionFrame[];
  duration: number;
  range: TrimRange;
  onRangeChange: (range: TrimRange) => void;
  playback: Playback;
  exporter: Exporter;
}

/** "Trim one clip": pick one range with the handles, replay it, name it and export it. */
export function TrimClipPanel({ frames, duration, range, onRangeChange, playback, exporter }: TrimClipPanelProps) {
  const { start, end } = range;
  const isPlaying = playback.playhead !== null;

  const changeStart = (value: number) => {
    onRangeChange({ start: value, end });
    playback.seek(value);
  };
  const changeEnd = (value: number) => {
    onRangeChange({ start, end: value });
    playback.seek(value);
  };

  return (
    <>
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
    </>
  );
}
