import { useCallback, useState } from 'react';
import { CLIP_NAME_PATTERN, makeClip, type Clip, type MotionFrame } from '../motion/index';
import { ExportFailure, postClips, type ExportedFile } from './exportApi';
import { DEFAULT_CLIP_NAME, nextClipName } from './take';
import type { ExportJobs } from '../jobs/controller';
import type { JobSnapshot } from '../jobs/api';

export interface Exporter {
  name: string;
  setName: (name: string) => void;
  nameIsValid: boolean;
  loop: boolean;
  setLoop: (loop: boolean) => void;
  busy: boolean;
  error: ExportFailure | null;
  /** Everything exported this session, newest first. */
  files: ExportedFile[];
  exportRange: (frames: readonly MotionFrame[], start: number, end: number) => Promise<void>;
  /** Export several clips in one request (auto-sliced take); resolves true on success. */
  exportClips: (buildClips: () => Clip[], snapshot?:JobSnapshot) => Promise<boolean>;
}

function toFailure(error: unknown): ExportFailure {
  if (error instanceof ExportFailure) return error;
  return new ExportFailure(error instanceof Error ? error.message : String(error));
}

/** Clip name / loop settings and the export request; lives across takes so names keep counting up. */
export function useExporter(jobs?:ExportJobs): Exporter {
  const [name, setName] = useState(DEFAULT_CLIP_NAME);
  const [loop, setLoop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ExportFailure | null>(null);
  const [files, setFiles] = useState<ExportedFile[]>([]);

  // Building the clips happens inside the try so a makeClip error is shown like a server error.
  const exportClips = useCallback(async (buildClips: () => Clip[], snapshot?:JobSnapshot): Promise<boolean> => {
    setBusy(true);
    setError(null);
    try {
      const clips=buildClips();
      if(jobs) await jobs.submit({clips,snapshot:snapshot??null});
      else {const exported=await postClips(clips);setFiles((previous)=>[...exported,...previous]);}
      return true;
    } catch (err) {
      console.error('Export failed:', err);
      setError(toFailure(err));
      return false;
    } finally {
      setBusy(false);
    }
  }, [jobs]);

  const exportRange = useCallback(
    async (frames: readonly MotionFrame[], start: number, end: number) => {
      const exported = await exportClips(() => [makeClip(frames, { start, end, name, loop })]);
      if (exported) setName(nextClipName(name));
    },
    [exportClips, name, loop],
  );

  return {
    name,
    setName,
    nameIsValid: CLIP_NAME_PATTERN.test(name),
    loop,
    setLoop,
    busy,
    error,
    files,
    exportRange,
    exportClips,
  };
}
