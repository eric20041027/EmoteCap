interface CalibrationGuideProps {
  secondsLeft: number;
}

/** One T-pose figure (viewBox 100 x 100, arm span ≈ height), drawn once as a faint fill and once as an outline. */
function TPoseFigure() {
  return (
    <>
      <circle cx="50" cy="11.5" r="6.3" />
      <rect x="47.3" y="16.5" width="5.4" height="6" rx="1.5" />
      <path d="M38.5 21.5 H61.5 Q63 21.5 63 23 L60.5 44 L61.5 53 H38.5 L39.5 44 L37 23 Q37 21.5 38.5 21.5 Z" />
      <line x1="40" y1="24.5" x2="6" y2="24.5" strokeWidth="5.2" />
      <line x1="60" y1="24.5" x2="94" y2="24.5" strokeWidth="5.2" />
      <line x1="44.5" y1="51" x2="44" y2="94.5" strokeWidth="7" />
      <line x1="55.5" y1="51" x2="56" y2="94.5" strokeWidth="7" />
    </>
  );
}

/**
 * Shown on the camera view during the calibration countdown: a T-pose outline to stand inside (it fits the
 * frame like a person filling it head to toe), a caption, and the seconds left in large type.
 */
export function CalibrationGuide({ secondsLeft }: CalibrationGuideProps) {
  return (
    <>
      <svg className="camera__guide" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid meet" aria-hidden>
        <defs>
          {/* Outline of the whole figure: grow its shape a little and keep only the rim. */}
          <filter id="tpose-outline" x="-5%" y="-5%" width="110%" height="110%">
            <feMorphology in="SourceAlpha" operator="dilate" radius="0.6" result="grown" />
            <feComposite in="grown" in2="SourceAlpha" operator="out" result="rim" />
            <feFlood floodColor="#ffb547" />
            <feComposite in2="rim" operator="in" />
          </filter>
        </defs>
        <g className="camera__guide-fill" fill="#fff" stroke="#fff" strokeLinecap="round">
          <TPoseFigure />
        </g>
        <g filter="url(#tpose-outline)" fill="#fff" stroke="#fff" strokeLinecap="round">
          <TPoseFigure />
        </g>
      </svg>
      <div className="camera__guide-caption" role="status">
        Stand inside the outline and hold a T-pose
      </div>
      <span key={secondsLeft} className="camera__guide-count" role="timer" aria-live="assertive">
        {secondsLeft}
      </span>
    </>
  );
}
