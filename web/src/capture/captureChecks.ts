const LEFT_ANKLE = 27;
const RIGHT_ANKLE = 28;
const MIN_VISIBILITY = 0.5;

export const CAMERA_DENIED_MESSAGE = 'Camera permission denied. Allow camera access and reload.';
export const INSECURE_CONTEXT_MESSAGE =
  'The camera needs a secure page. Open http://localhost:5173 on this computer (not a network IP).';

const CAMERA_MESSAGES: Record<string, string> = {
  NotAllowedError: CAMERA_DENIED_MESSAGE,
  SecurityError: CAMERA_DENIED_MESSAGE,
  NotFoundError: 'No camera found. Connect a webcam, then retry.',
  OverconstrainedError: 'No camera found that supports video capture. Connect a webcam, then retry.',
  NotReadableError: 'The camera is in use by another app (Zoom, FaceTime, OBS…). Close it, then retry.',
  AbortError: 'The camera failed to start. Reconnect the webcam, then retry.',
};

function errorName(error: unknown): string {
  return typeof error === 'object' && error !== null && 'name' in error ? String(error.name) : '';
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** True when there is no pose, or both ankles are hidden: the actor should step back. */
export function needsStepBack(landmarks: readonly { visibility?: number }[] | undefined): boolean {
  if (!landmarks || landmarks.length <= RIGHT_ANKLE) return true;
  const left = landmarks[LEFT_ANKLE].visibility ?? 0;
  const right = landmarks[RIGHT_ANKLE].visibility ?? 0;
  return left < MIN_VISIBILITY && right < MIN_VISIBILITY;
}

/** Readable message for a getUserMedia failure. */
export function describeCameraError(error: unknown): string {
  return CAMERA_MESSAGES[errorName(error)] ?? `Could not start the camera: ${errorText(error)}`;
}

/** Readable message for a PoseLandmarker / WASM loading failure. */
export function describeModelError(error: unknown): string {
  return `Could not load the pose model (${errorText(error)}). Run "npm run fetch-assets" in web/, then retry.`;
}
