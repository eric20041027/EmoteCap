import { useState } from 'react';
import { TIME_STEP_SECONDS } from './segmentList';

interface TimeFieldProps {
  /** Accessible name, e.g. "Clip 2 start (seconds)". */
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (seconds: number) => void;
}

/**
 * Compact seconds input with 0.05 s steps. While focused it shows exactly what the user types
 * (every parsable value is committed and clamped by the reducer); on blur it shows the committed value.
 */
export function TimeField({ label, value, min, max, onChange }: TimeFieldProps) {
  const [draft, setDraft] = useState<string | null>(null);

  return (
    <input
      type="number"
      className="time-field"
      aria-label={label}
      title={label}
      inputMode="decimal"
      step={TIME_STEP_SECONDS}
      min={Number(min.toFixed(2))}
      max={Number(max.toFixed(2))}
      value={draft ?? value.toFixed(2)}
      onChange={(e) => {
        const text = e.target.value;
        setDraft(text);
        const seconds = Number(text);
        if (text.trim() !== '' && Number.isFinite(seconds)) onChange(seconds);
      }}
      onBlur={() => setDraft(null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
    />
  );
}
