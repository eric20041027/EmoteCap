import type { ReactNode } from 'react';
import type { PoseStatus } from '../capture/usePose';
import type { ServerHealth } from './useServerHealth';
import './StatusBar.css';

type Tone = 'ok' | 'warn' | 'bad' | 'idle';

interface StatusBarProps {
  cameraStatus: PoseStatus;
  fps: number;
  hasPose: boolean;
  server: ServerHealth;
}

const SERVER_LABELS: Record<ServerHealth, [Tone, string]> = {
  checking: ['idle', 'Export server…'],
  online: ['ok', 'Export server online'],
  'no-blender': ['warn', 'Server up, Blender missing'],
  offline: ['bad', 'Export server offline'],
};

function Chip({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={`chip chip--${tone}`}>
      <span className="chip__dot" aria-hidden />
      {children}
    </span>
  );
}

/** Tracking fps, pose detection and export-server health. */
export function StatusBar({ cameraStatus, fps, hasPose, server }: StatusBarProps) {
  const [serverTone, serverLabel] = SERVER_LABELS[server];
  const cameraReady = cameraStatus === 'ready';

  return (
    <div className="status-bar" role="status" aria-live="polite">
      <Chip tone={cameraReady ? (fps >= 20 ? 'ok' : 'warn') : cameraStatus === 'error' ? 'bad' : 'idle'}>
        {cameraReady ? `${fps} fps` : cameraStatus === 'error' ? 'Camera error' : 'Starting…'}
      </Chip>
      <Chip tone={cameraReady && hasPose ? 'ok' : 'idle'}>{hasPose ? 'Pose detected' : 'No pose'}</Chip>
      <Chip tone={serverTone}>{serverLabel}</Chip>
    </div>
  );
}
