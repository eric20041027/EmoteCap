import './CountdownOverlay.css';

interface CountdownOverlayProps {
  value: number;
  caption: string;
}

/** Full-screen 3-2-1, readable from across the room. */
export function CountdownOverlay({ value, caption }: CountdownOverlayProps) {
  return (
    <div className="countdown" role="timer" aria-live="assertive">
      <p className="countdown__caption">{caption}</p>
      <span key={value} className="countdown__value">
        {value}
      </span>
    </div>
  );
}
