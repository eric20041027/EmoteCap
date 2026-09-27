/** Raw take video: records the camera MediaStream (never the mirrored display) with MediaRecorder. */

/** VP8 first: much cheaper to encode than VP9, so recording does not steal frames from pose tracking. */
export const PREFERRED_VIDEO_TYPES = ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm'] as const;
/** ~1.5 Mbps keeps a 45 s take near 8 MB, far below the server's 100 MB limit. */
export const VIDEO_BITS_PER_SECOND = 1_500_000;
/** Flush a chunk every second so a crash mid-take still leaves most of the video. */
const TIMESLICE_MS = 1000;

/** First supported WebM type, or undefined to let the browser pick its default. */
export function pickVideoMimeType(isTypeSupported: (type: string) => boolean): string | undefined {
  return PREFERRED_VIDEO_TYPES.find((type) => isTypeSupported(type));
}

export interface TakeVideoSession {
  /** Stop recording; resolves with the whole video once the recorder has flushed. */
  stop: () => Promise<Blob>;
}

/** Start recording `stream` right away. Throws when the browser cannot record video. */
export function startTakeVideo(stream: MediaProvider | null | undefined): TakeVideoSession {
  if (!(stream instanceof MediaStream) || stream.getVideoTracks().length === 0) {
    throw new Error('camera stream is not available');
  }
  if (typeof MediaRecorder === 'undefined') throw new Error('this browser cannot record video');

  const mimeType = pickVideoMimeType((type) => MediaRecorder.isTypeSupported(type));
  const recorder = new MediaRecorder(stream, {
    ...(mimeType ? { mimeType } : {}),
    videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
  });
  const chunks: Blob[] = [];
  let failure: unknown = null;

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) chunks.push(event.data);
  });
  recorder.addEventListener('error', (event) => {
    failure = (event as ErrorEvent).error ?? new Error('video recorder failed');
  });
  const finished = new Promise<Blob>((resolve, reject) => {
    recorder.addEventListener(
      'stop',
      () => {
        if (chunks.length === 0) reject(failure ?? new Error('no video data was recorded'));
        else resolve(new Blob(chunks, { type: recorder.mimeType || mimeType || 'video/webm' }));
      },
      { once: true },
    );
  });

  recorder.start(TIMESLICE_MS);
  return {
    stop: () => {
      if (recorder.state !== 'inactive') recorder.stop();
      return finished;
    },
  };
}
