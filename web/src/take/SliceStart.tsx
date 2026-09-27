import { useEffect, useState } from 'react';
import type { TakeVideo } from './useTakeVideo';

const TICK_MS = 250;

/** Before slicing: the primary "Auto-slice with Gemini" action. */
export function SliceIntro({ video, onStart }: { video: TakeVideo; onStart: () => void }) {
  const isPreparing = video.status === 'recording' || video.status === 'finishing';
  const hasNoVideo = video.status === 'failed' || video.status === 'none';

  return (
    <div className="slice-intro">
      <button type="button" className="btn btn--gemini btn--large" disabled={isPreparing} onClick={onStart}>
        {isPreparing ? 'Preparing video…' : hasNoVideo ? 'Split at pauses' : '✦ Auto-slice with Gemini'}
      </button>
      <div className="slice-intro__text">
        <p>
          Gemini watches your take and cuts it into named clips, one per move. Fine-tune them, then export them all at
          once.
        </p>
        {video.status === 'failed' && (
          <p className="capture__note capture__note--warn">
            No video was recorded ({video.reason}), so this take will be split at your pauses instead.
          </p>
        )}
      </div>
    </div>
  );
}

/** While Gemini works: elapsed seconds and a way out. */
export function SliceProgress({ startedAt, onSkip }: { startedAt: number; onSkip: () => void }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setSeconds(Math.floor((performance.now() - startedAt) / 1000)), TICK_MS);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  return (
    <div className="slice-wait" role="status">
      <span className="slice-wait__spinner" aria-hidden />
      <p className="slice-wait__text">
        Gemini is watching your take… <strong aria-hidden>{seconds}s</strong>
      </p>
      <button type="button" className="btn btn--secondary" onClick={onSkip}>
        Split at pauses instead
      </button>
    </div>
  );
}
