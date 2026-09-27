import type { MotionFrame } from '../motion/index';
import type { Exporter } from '../record/useExporter';
import type { Playback } from '../record/usePlayback';
import { ClipList } from './ClipList';
import { SliceIntro, SliceProgress } from './SliceStart';
import type { AutoSlice } from './useAutoSlice';
import type { TakeVideo } from './useTakeVideo';
import './take.css';

interface SlicePanelProps {
  frames: readonly MotionFrame[];
  video: TakeVideo;
  slicer: AutoSlice;
  playback: Playback;
  exporter: Exporter;
  onTrimInstead: () => void;
}

/** One-take auto-slicing: ask Gemini (or split at pauses), edit the clips, export them all. */
export function SlicePanel({ frames, video, slicer, playback, exporter, onTrimInstead }: SlicePanelProps) {
  const { status } = slicer;
  if (status.phase === 'idle') return <SliceIntro video={video} onStart={slicer.run} />;
  if (status.phase === 'slicing') return <SliceProgress startedAt={status.startedAt} onSkip={slicer.skip} />;
  return (
    <ClipList
      frames={frames}
      result={status.result}
      slicer={slicer}
      playback={playback}
      exporter={exporter}
      onTrimInstead={onTrimInstead}
    />
  );
}
