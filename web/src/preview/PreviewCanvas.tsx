import { useEffect, useRef, useState, type RefObject } from 'react';
import type { MotionFrame } from '../motion/index';
import './PreviewCanvas.css';
import { createPreviewScene, type PreviewScene } from './previewScene';

interface PreviewCanvasProps {
  /** Latest frame to show; read every animation frame, so writing it never re-renders React. */
  frameRef: RefObject<MotionFrame | null>;
  /** Flip horizontally so the preview behaves like a mirror, matching the mirrored camera view. */
  mirrored?: boolean;
}

export function PreviewCanvas({ frameRef, mirrored = false }: PreviewCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let preview: PreviewScene;
    try {
      preview = createPreviewScene(container);
    } catch (err) {
      console.error('3D preview failed to start:', err);
      setError('3D preview unavailable: WebGL could not start in this browser.');
      return;
    }

    let rafId = 0;
    const tick = () => {
      rafId = requestAnimationFrame(tick);
      // Apply every tick (cheap): works even if the solver mutates one frame object in place.
      const frame = frameRef.current;
      if (frame) preview.mannequin.applyFrame(frame);
      preview.render();
    };

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) preview.resize(width, height);
    });
    observer.observe(container);
    tick();

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
      preview.dispose();
    };
  }, [frameRef]);

  return (
    <div ref={containerRef} className={mirrored ? 'preview preview--mirrored' : 'preview'}>
      {error && <p className="preview__error">{error}</p>}
    </div>
  );
}
