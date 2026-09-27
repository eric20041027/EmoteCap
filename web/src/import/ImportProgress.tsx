import type { ImportState } from './useVideoImport';
import './import.css';

interface ImportProgressProps {
  state: Exclude<ImportState, { phase: 'idle' }>;
  onCancel: () => void;
}

/** Dock while a video is converted: frames analysed, time left, Cancel. */
export function ImportProgress({ state, onCancel }: ImportProgressProps) {
  const converting = state.phase === 'converting';
  const elapsedSeconds = converting ? (performance.now() - state.startedAt) / 1000 : 0;
  const secondsLeft = converting && state.done > 0 ? (elapsedSeconds / state.done) * (state.total - state.done) : null;

  return (
    <div className="capture">
      <button type="button" className="btn btn--ghost" onClick={onCancel}>
        Cancel import
      </button>
      <div className="import-progress" role="status">
        <p className="capture__tip">
          {converting
            ? `Analysing frame ${state.done} / ${state.total}`
            : `Loading ${state.fileName} and the pose models…`}
          {secondsLeft !== null && ` · about ${Math.ceil(secondsLeft)} s left`}
        </p>
        <progress
          className="import-progress__bar"
          max={converting ? state.total : undefined}
          value={converting ? state.done : undefined}
        />
      </div>
    </div>
  );
}
