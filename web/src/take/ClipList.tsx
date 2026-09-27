import { useMemo, useState } from 'react';
import type { MotionFrame } from '../motion/index';
import { ExportErrorAlert } from '../record/ExportErrorAlert';
import type { Exporter } from '../record/useExporter';
import type { Playback } from '../record/usePlayback';
import { findNameIssues, segmentsToClips, type EditableSegment } from './segmentList';
import { SegmentRow } from './SegmentRow';
import { SegmentTimeline } from './SegmentTimeline';
import { canRetryGemini, type SliceResult } from './sliceTake';
import type { AutoSlice } from './useAutoSlice';

interface ClipListProps {
  frames: readonly MotionFrame[];
  result: SliceResult;
  slicer: AutoSlice;
  playback: Playback;
  exporter: Exporter;
  onTrimInstead: () => void;
}

const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

function SliceBadge({ result, count }: { result: SliceResult; count: number }) {
  if (result.source === 'gemini') {
    return (
      <span className="chip chip--ok">
        <span className="chip__dot" aria-hidden />✦ Sliced by Gemini · {plural(count, 'clip')}
      </span>
    );
  }
  return (
    <span className="chip chip--warn" title={result.details || undefined}>
      <span className="chip__dot" aria-hidden />
      Split at pauses — Gemini unavailable ({result.reason})
    </span>
  );
}

/** After slicing: source badge, coloured timeline, editable clip rows and Export all. */
export function ClipList({ frames, result, slicer, playback, exporter, onTrimInstead }: ClipListProps) {
  const { list, edit } = slicer;
  const [activeId, setActiveId] = useState<number | null>(null);
  const [exportedCount, setExportedCount] = useState<number | null>(null);
  const issues = useMemo(() => findNameIssues(list.segments), [list.segments]);
  const playingId = playback.playhead !== null ? activeId : null;
  const count = list.segments.length;

  const togglePlay = (segment: EditableSegment) => {
    if (playingId === segment.id) {
      playback.stop();
      return;
    }
    setActiveId(segment.id);
    playback.play(segment.start, segment.end, segment.loop);
  };

  const remove = (segment: EditableSegment) => {
    if (playingId === segment.id) playback.stop();
    edit({ type: 'remove', id: segment.id });
  };

  const exportAll = async () => {
    const segments = list.segments;
    setExportedCount(null);
    if (await exporter.exportClips(() => segmentsToClips(frames, segments))) setExportedCount(segments.length);
  };

  return (
    <div className="slices">
      <div className="slices__bar">
        <SliceBadge result={result} count={count} />
        {canRetryGemini(result) && (
          <button type="button" className="btn btn--secondary" onClick={slicer.run}>
            Try Gemini again
          </button>
        )}
      </div>

      {count > 0 ? (
        <>
          <SegmentTimeline
            duration={list.duration}
            segments={list.segments}
            playhead={playback.playhead}
            playingId={playingId}
            onPlay={togglePlay}
          />
          <div className="clip-list__head" aria-hidden>
            <span />
            <span>Clip name</span>
            <span>Start (s)</span>
            <span>End (s)</span>
            <span>Length</span>
          </div>
          <ol className="clip-list">
            {list.segments.map((segment, index) => (
              <SegmentRow
                key={segment.id}
                segment={segment}
                index={index}
                duration={list.duration}
                issue={issues.get(segment.id)}
                isPlaying={playingId === segment.id}
                onTogglePlay={() => togglePlay(segment)}
                onEdit={edit}
                onSeek={playback.seek}
                onDelete={() => remove(segment)}
              />
            ))}
          </ol>
        </>
      ) : (
        <div className="slices__empty">
          <p>No clips in this take — nothing moved long enough to cut.</p>
          <button type="button" className="btn btn--secondary" onClick={onTrimInstead}>
            Trim one clip instead
          </button>
        </div>
      )}

      <div className="slices__footer">
        <button
          type="button"
          className="btn btn--primary btn--large"
          disabled={count === 0 || issues.size > 0 || exporter.busy}
          onClick={() => void exportAll()}
        >
          {exporter.busy ? 'Exporting…' : `Export all (${count})`}
        </button>
        {issues.size > 0 && <span className="slices__hint slices__hint--bad">Fix the highlighted clip names to export.</span>}
        {exportedCount !== null && !exporter.busy && (
          <span className="slices__hint slices__hint--ok">
            ✓ Exported {plural(exportedCount, 'FBX clip')} — download below.
          </span>
        )}
        <ExportErrorAlert error={exporter.error} />
      </div>
    </div>
  );
}
