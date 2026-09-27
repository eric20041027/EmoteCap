import type { CSSProperties } from 'react';
import { formatSeconds } from '../ui/format';
import { MIN_SEGMENT_SECONDS, type EditableSegment, type NameIssue, type SegmentListAction } from './segmentList';
import { segmentColor } from './segmentColors';
import { TimeField } from './TimeField';

const ISSUE_TEXT: Record<NameIssue, string> = {
  invalid: 'Use 1–24 letters, digits or underscores.',
  duplicate: 'Another clip has this name.',
};

interface SegmentRowProps {
  segment: EditableSegment;
  index: number;
  duration: number;
  issue: NameIssue | undefined;
  isPlaying: boolean;
  onTogglePlay: () => void;
  onEdit: (action: SegmentListAction) => void;
  /** Show the pose at time t in the preview (after a start/end edit). */
  onSeek: (t: number) => void;
  onDelete: () => void;
}

/** One auto-sliced clip: play, name, start/end, loop, Gemini's description, delete. */
export function SegmentRow(props: SegmentRowProps) {
  const { segment, index, duration, issue, isPlaying, onEdit, onSeek } = props;
  const { id } = segment;
  const label = `Clip ${index + 1}`;
  const style = { '--clip-color': segmentColor(id) } as CSSProperties;

  return (
    <li className={`clip-row${isPlaying ? ' clip-row--playing' : ''}`} style={style}>
      <button
        type="button"
        className="clip-row__play"
        aria-label={isPlaying ? `Stop ${label}` : `Play ${label} on the 3D preview`}
        onClick={props.onTogglePlay}
      >
        {isPlaying ? '❚❚' : '▶'}
      </button>
      <div className="clip-row__main">
        <input
          className={`clip-row__name${issue ? ' clip-row__name--invalid' : ''}`}
          value={segment.name}
          maxLength={24}
          spellCheck={false}
          aria-label={`${label} name`}
          aria-invalid={issue !== undefined}
          onChange={(e) => onEdit({ type: 'rename', id, name: e.target.value })}
        />
        {issue && <span className="field__error">{ISSUE_TEXT[issue]}</span>}
        {segment.description && (
          <p className="clip-row__desc" title={segment.description}>
            {segment.description}
          </p>
        )}
      </div>
      <TimeField
        label={`${label} start (seconds)`}
        value={segment.start}
        min={0}
        max={Math.max(0, segment.end - MIN_SEGMENT_SECONDS)}
        onChange={(start) => {
          onEdit({ type: 'setStart', id, start });
          onSeek(start);
        }}
      />
      <TimeField
        label={`${label} end (seconds)`}
        value={segment.end}
        min={Math.min(segment.start + MIN_SEGMENT_SECONDS, duration)}
        max={duration}
        onChange={(end) => {
          onEdit({ type: 'setEnd', id, end });
          onSeek(end);
        }}
      />
      <span className="clip-row__length" title="Clip length">
        {formatSeconds(segment.end - segment.start)}
      </span>
      <label className="checkbox clip-row__loop">
        <input
          type="checkbox"
          checked={segment.loop}
          onChange={(e) => onEdit({ type: 'setLoop', id, loop: e.target.checked })}
        />
        <span>Loop</span>
      </label>
      <button type="button" className="btn btn--ghost clip-row__delete" aria-label={`Delete ${label}`} onClick={props.onDelete}>
        ✕
      </button>
    </li>
  );
}
