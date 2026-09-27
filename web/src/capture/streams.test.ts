import { describe, expect, it } from 'vitest';
import { detachStream } from './streams';

const fakeStream = () => ({}) as MediaStream;

describe('detachStream', () => {
  it('detaches the stream this session attached', () => {
    const mine = fakeStream();
    const video = { srcObject: mine as MediaProvider | null };
    detachStream(video, mine);
    expect(video.srcObject).toBeNull();
  });

  it("leaves the newer session's camera on the video", () => {
    const stale = fakeStream();
    const current = fakeStream();
    const video = { srcObject: current as MediaProvider | null };
    detachStream(video, stale);
    expect(video.srcObject).toBe(current);
  });

  it('does nothing for a session that never got a stream', () => {
    const current = fakeStream();
    const video = { srcObject: current as MediaProvider | null };
    detachStream(video, undefined);
    expect(video.srcObject).toBe(current);
  });
});
