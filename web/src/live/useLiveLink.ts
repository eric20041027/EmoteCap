import { useCallback, useEffect, useMemo, useState } from 'react';
import type { MotionFrame } from '../motion/index';
import { defaultLiveLinkUrl, LiveLinkSender, type LiveLinkStatus } from './liveLink';

export interface LiveLink {
  enabled: boolean;
  status: LiveLinkStatus;
  toggle(): void;
  /** Stream one frame; a no-op while Live Link is off or reconnecting. */
  send(frame: MotionFrame): void;
}

export function useLiveLink(): LiveLink {
  const [enabled, setEnabled] = useState(false);
  const [status, setStatus] = useState<LiveLinkStatus>('off');
  const sender = useMemo(() => new LiveLinkSender({ url: defaultLiveLinkUrl() }, setStatus), []);

  useEffect(() => {
    if (enabled) sender.start();
    return () => sender.stop();
  }, [enabled, sender]);

  const toggle = useCallback(() => setEnabled((value) => !value), []);
  const send = useCallback((frame: MotionFrame) => void sender.send(frame), [sender]);
  return { enabled, status, toggle, send };
}
