import type { LiveLinkStatus } from './liveLink';
import './LiveLinkToggle.css';

const LABELS: Record<LiveLinkStatus, string> = {
  off: 'Live Link off',
  connecting: 'Live Link connecting…',
  live: 'Live Link streaming',
};

const TONES: Record<LiveLinkStatus, string> = {
  off: '',
  connecting: 'chip--warn',
  live: 'chip--ok',
};

interface LiveLinkToggleProps {
  enabled: boolean;
  status: LiveLinkStatus;
  onToggle: () => void;
}

export function LiveLinkToggle({ enabled, status, onToggle }: LiveLinkToggleProps) {
  return (
    <button
      type="button"
      className={`chip chip-button ${TONES[status]}`}
      aria-pressed={enabled}
      onClick={onToggle}
      title="Stream your pose to Unity: add the EmoteCapLiveLink component to a Humanoid character and press Play."
    >
      <span className="chip__dot" aria-hidden />
      {LABELS[status]}
    </button>
  );
}

interface ChipToggleProps {
  label: string;
  pressed: boolean;
  onToggle: () => void;
  title?: string;
}

export function ChipToggle({ label, pressed, onToggle, title }: ChipToggleProps) {
  return (
    <button type="button" className={`chip chip-button ${pressed ? 'chip--ok' : ''}`} aria-pressed={pressed} onClick={onToggle} title={title}>
      <span className="chip__dot" aria-hidden />
      {label}
    </button>
  );
}
