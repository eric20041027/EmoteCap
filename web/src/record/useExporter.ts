import { useCallback, useState } from 'react';
import { CLIP_NAME_PATTERN, makeClip, type MotionFrame } from '../motion/index';
import { ExportFailure, postExport, type ExportedFile } from './exportApi';
import { DEFAULT_CLIP_NAME, nextClipName } from './take';

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
}

function toFailure(error: unknown): ExportFailure {
  if (error instanceof ExportFailure) return error;
  return new ExportFailure(error instanceof Error ? error.message : String(error));
}

/** Clip name / loop settings and the export request; lives across takes so names keep counting up. */
export function useExporter(): Exporter {
  const [name, setName] = useState(DEFAULT_CLIP_NAME);
  const [loop, setLoop] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ExportFailure | null>(null);
  const [files, setFiles] = useState<ExportedFile[]>([]);

  const exportRange = useCallback(
    async (frames: readonly MotionFrame[], start: number, end: number) => {
      setBusy(true);
      setError(null);
      try {
        const clip = makeClip([...frames], { start, end, name, loop });
        const exported = await postExport(clip);
        setFiles((previous) => [...exported, ...previous]);
        setName(nextClipName(name));
      } catch (err) {
        console.error('Export failed:', err);
        setError(toFailure(err));
      } finally {
        setBusy(false);
      }
    },
    [name, loop],
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
  };
}
