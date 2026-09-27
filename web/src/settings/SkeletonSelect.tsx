import type { SkeletonMode } from './skeleton';

interface SkeletonSelectProps {
  value: SkeletonMode;
  onChange: (mode: SkeletonMode) => void;
}

/** Bone count of the capture and export: body only skips the hand model (faster) and exports no finger bones. */
export function SkeletonSelect({ value, onChange }: SkeletonSelectProps) {
  return (
    <label className="camera-select" title="Body only skips hand tracking (higher fps) and exports FBX without finger bones.">
      <select aria-label="Skeleton" value={value} onChange={(event) => onChange(event.target.value as SkeletonMode)}>
        <option value="full">Body + fingers · 52 bones</option>
        <option value="body">Body only · 22 bones</option>
      </select>
    </label>
  );
}
