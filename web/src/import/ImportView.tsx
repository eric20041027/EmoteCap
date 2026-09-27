import type { CSSProperties, RefObject } from 'react';
import '../capture/CameraView.css';
import './import.css';

interface ImportViewProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  /** Width / height of the video. */
  aspect: number;
  fileName: string;
}

/** The imported video as filmed (not mirrored) with the skeleton found in the frame being analysed. */
export function ImportView({ videoRef, overlayRef, aspect, fileName }: ImportViewProps) {
  const shape = { aspectRatio: String(aspect), '--aspect': aspect } as CSSProperties;

  return (
    <div className="camera" style={shape}>
      <video ref={videoRef} className="camera__media" muted playsInline />
      <canvas ref={overlayRef} className="camera__media" />
      <div className="rec-badge import-badge">Analysing {fileName}</div>
    </div>
  );
}
