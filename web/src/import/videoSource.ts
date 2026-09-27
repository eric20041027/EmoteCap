/** An imported video file in a <video> element, read one still frame at a time by seeking. */
import { MAX_TAKE_SECONDS } from '../take/takesApi';
import { ImportError } from './convertVideo';

const LOAD_TIMEOUT_MS = 20_000;
const SEEK_TIMEOUT_MS = 10_000;
/** Seeking this far makes a MediaRecorder WebM (duration = Infinity until scanned) report its real length. */
const PAST_THE_END_S = 1e9;
const VIDEO_EXTENSIONS = /\.(mp4|m4v|mov|webm|mkv)$/i;
const CANNOT_DECODE = 'This browser cannot read the video. Try an MP4 (H.264) file.';

/**
 * Resolve on the next `type` event. Reject on a media error, when nothing happens for `timeoutMs`, or at once
 * with the signal's reason when the import is cancelled.
 */
function waitFor(video: HTMLVideoElement, type: string, timeoutMs: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const cleanup = () => {
      clearTimeout(timer);
      video.removeEventListener(type, onEvent);
      video.removeEventListener('error', onError);
      signal?.removeEventListener('abort', onAbort);
    };
    const onEvent = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new ImportError(CANNOT_DECODE));
    };
    const onAbort = () => {
      cleanup();
      reject(signal?.reason);
    };
    const timer = setTimeout(onError, timeoutMs);
    video.addEventListener(type, onEvent);
    video.addEventListener('error', onError);
    signal?.addEventListener('abort', onAbort);
  });
}

/** Show the frame at time t (seconds); resolves once it can be read. */
export async function seekTo(video: HTMLVideoElement, t: number, signal?: AbortSignal): Promise<void> {
  if (video.currentTime !== t || video.seeking) {
    const seeked = waitFor(video, 'seeked', SEEK_TIMEOUT_MS, signal);
    video.currentTime = t;
    await seeked;
  }
  // A 'seeked' left over from an earlier seek can arrive first: wait for the one asked for.
  while (video.seeking) await waitFor(video, 'seeked', SEEK_TIMEOUT_MS, signal);
}

/** Load `file` into `video` (muted, paused on its first frame); resolves with its length in seconds. */
export async function openVideoFile(file: File, video: HTMLVideoElement, signal?: AbortSignal): Promise<number> {
  if (!file.type.startsWith('video/') && !VIDEO_EXTENSIONS.test(file.name)) {
    throw new ImportError(`"${file.name}" is not a video file.`);
  }
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  const loaded = waitFor(video, 'loadedmetadata', LOAD_TIMEOUT_MS, signal);
  video.src = URL.createObjectURL(file);
  await loaded;

  if (!Number.isFinite(video.duration)) {
    const measured = waitFor(video, 'durationchange', LOAD_TIMEOUT_MS, signal);
    video.currentTime = PAST_THE_END_S;
    await measured;
  }
  const { duration } = video;
  if (!Number.isFinite(duration) || duration <= 0 || video.videoWidth === 0) throw new ImportError(CANNOT_DECODE);
  if (duration > MAX_TAKE_SECONDS) {
    throw new ImportError(`The video is ${Math.round(duration)} s long. Trim it to ${MAX_TAKE_SECONDS / 60} minutes or less.`);
  }
  await seekTo(video, 0, signal);
  return duration;
}

/** Let go of the file (an imported take keeps its own reference for Gemini). */
export function closeVideoFile(video: HTMLVideoElement | null): void {
  if (!video?.src) return;
  URL.revokeObjectURL(video.src);
  video.removeAttribute('src');
  video.load();
}
