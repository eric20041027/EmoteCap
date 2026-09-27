import { describe, expect, it } from 'vitest';
import { seekTo } from './videoSource';

/** Just enough of a <video> for seeking: events plus the two properties seekTo reads. */
class FakeVideo extends EventTarget {
  currentTime = 0;
  seeking = false;
}

const fakeVideo = () => new FakeVideo() as unknown as HTMLVideoElement;

describe('seekTo', () => {
  it('resolves once the video reports the seek', async () => {
    const video = fakeVideo();
    const seeked = seekTo(video, 1.5);

    expect(video.currentTime).toBe(1.5);
    video.dispatchEvent(new Event('seeked'));
    await expect(seeked).resolves.toBeUndefined();
  });

  it('does nothing when the video is already on that frame', async () => {
    await expect(seekTo(fakeVideo(), 0)).resolves.toBeUndefined();
  });

  it('stops waiting as soon as the import is cancelled', async () => {
    const controller = new AbortController();
    const seeked = seekTo(fakeVideo(), 1.5, controller.signal);

    controller.abort();
    await expect(seeked).rejects.toMatchObject({ name: 'AbortError' });
  });
});
