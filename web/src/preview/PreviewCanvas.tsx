import { useEffect, useRef, useState, type RefObject } from 'react';
import type { MotionFrame } from '../motion/index';
import './PreviewCanvas.css';
import { createPreviewScene, type PreviewScene } from './previewScene';
import {observeCamera,type CameraDiagnostics} from '../capture/diagnostics';

interface PreviewCanvasProps {
  /** Latest frame to show; read every animation frame, so writing it never re-renders React. */
  frameRef: RefObject<MotionFrame | null>;
  /** Flip horizontally so the preview behaves like a mirror, matching the mirrored camera view. */
  mirrored?: boolean;
  diagnostics?:CameraDiagnostics;
}

export function PreviewCanvas({ frameRef, mirrored = false,diagnostics }: PreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let preview: PreviewScene;
    try {
      preview = createPreviewScene(container);
    } catch (err) {
      observeCamera(diagnostics,sink=>sink.previewReady(false));
      console.error('3D preview failed to start:', err);
      setError('3D preview unavailable: WebGL could not start in this browser.');
      return;
    }
    observeCamera(diagnostics,sink=>sink.previewReady(true));
    const canvas=container.querySelector('canvas');
    let contextLost=false;
    const lost=()=>{contextLost=true;observeCamera(diagnostics,sink=>sink.previewReady(false));
      setError('3D preview unavailable: WebGL context was lost. Camera capture can continue.');};
    const restored=()=>{contextLost=false;setError(null);};
    canvas?.addEventListener('webglcontextlost',lost);
    canvas?.addEventListener('webglcontextrestored',restored);

    let rafId = 0;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      if(contextLost)return;
      // Apply every tick (cheap): works even if the solver mutates one frame object in place.
      const frame = frameRef.current;
      try {
        if (frame) preview.mannequin.applyFrame(frame);
        preview.render();
      } catch(err) {observeCamera(diagnostics,sink=>sink.previewReady(false));throw err;}
      observeCamera(diagnostics,sink=>sink.previewReady(true));
      if(frame)observeCamera(diagnostics,sink=>{if(sink.active)sink.rendered(frame,performance.now());});
    };

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) preview.resize(width, height);
    });
    observer.observe(container);
    tick();

    return () => {
      observeCamera(diagnostics,sink=>sink.previewReady(false));
      cancelAnimationFrame(rafId);
      canvas?.removeEventListener('webglcontextlost',lost);
      canvas?.removeEventListener('webglcontextrestored',restored);
      observer.disconnect();
      preview.dispose();
    };
  }, [frameRef,diagnostics]);

  return (
    <div ref={containerRef} className={mirrored ? 'preview preview--mirrored' : 'preview'}>
      {error && <p className="preview__error">{error}</p>}
    </div>
  );
}
