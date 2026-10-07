import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import type { MotionFrame } from '../motion/index';
import { defaultLiveLinkUrl, LiveLinkSender, type LiveLinkSnapshot } from './liveLink';

export interface LiveLink extends LiveLinkSnapshot {
  enabled: boolean;
  toggle(): void;
  /** Stream one frame; a no-op while Live Link is off or reconnecting. */
  send(frame: MotionFrame): void;
  retryCleanup():void;
}

export function useLiveLink(): LiveLink {
  const [enabled, setEnabled] = useState(false);
  const sender = useMemo(() => new LiveLinkSender({ url: defaultLiveLinkUrl() }), []);
  const state=useSyncExternalStore(sender.subscribe,sender.getSnapshot,sender.getSnapshot);

  useEffect(() => {
    if (enabled) sender.start();
    return () => sender.stop();
  }, [enabled, sender]);

  const toggle = useCallback(() => setEnabled((value) => !value), []);
  const send = useCallback((frame: MotionFrame) => void sender.send(frame), [sender]);
  return { ...state,enabled,toggle,send,retryCleanup:sender.retryCleanup };
}
