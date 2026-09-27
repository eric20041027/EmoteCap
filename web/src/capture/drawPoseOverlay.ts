import { DrawingUtils, HandLandmarker, PoseLandmarker, type LandmarkData, type NormalizedLandmark } from '@mediapipe/tasks-vision';
import type { TrackedHands } from './hands';

// Same side colours as the 3D mannequin, so "raise your right hand" reads orange in both views.
const LEFT_COLOR = 'rgba(79, 141, 255, 0.95)';
const RIGHT_COLOR = 'rgba(255, 138, 61, 0.95)';
const CENTER_COLOR = 'rgba(232, 235, 242, 0.85)';
const HIDDEN = 'rgba(0, 0, 0, 0)';
const OUTLINE = 'rgba(10, 12, 17, 0.9)';
const MIN_VISIBILITY = 0.5;
const FACE_LEFT = new Set([1, 2, 3, 7, 9]);
const FACE_RIGHT = new Set([4, 5, 6, 8, 10]);
const FIRST_BODY_LANDMARK = 11;

const utilsByContext = new WeakMap<CanvasRenderingContext2D, DrawingUtils>();

function sideColor(index: number): string {
  if (index < FIRST_BODY_LANDMARK) {
    if (FACE_LEFT.has(index)) return LEFT_COLOR;
    return FACE_RIGHT.has(index) ? RIGHT_COLOR : CENTER_COLOR;
  }
  return index % 2 === 1 ? LEFT_COLOR : RIGHT_COLOR;
}

function isVisible(landmark: NormalizedLandmark | undefined): boolean {
  return (landmark?.visibility ?? 0) >= MIN_VISIBILITY;
}

function connectionColor(data: LandmarkData): string {
  if (!isVisible(data.from) || !isVisible(data.to)) return HIDDEN;
  const connection = PoseLandmarker.POSE_CONNECTIONS[data.index ?? -1];
  if (!connection) return CENTER_COLOR;
  const start = sideColor(connection.start);
  return start === sideColor(connection.end) ? start : CENTER_COLOR;
}

function landmarkFill(data: LandmarkData): string {
  return isVisible(data.from) ? sideColor(data.index ?? 0) : HIDDEN;
}

function landmarkOutline(data: LandmarkData): string {
  return isVisible(data.from) ? OUTLINE : HIDDEN;
}

/** Draw the pose (and hand) skeletons over the (unmirrored) tracked frame; the canvas is mirrored with CSS like the video. */
export function drawPoseOverlay(
  canvas: HTMLCanvasElement | null,
  frameSize: { width: number; height: number },
  landmarks: NormalizedLandmark[] | undefined,
  hands: TrackedHands['image'] = {},
): void {
  const ctx = canvas?.getContext('2d');
  if (!canvas || !ctx) return;
  // Match the (possibly cropped) frame the landmarks are normalized to.
  if (frameSize.width && (canvas.width !== frameSize.width || canvas.height !== frameSize.height)) {
    canvas.width = frameSize.width;
    canvas.height = frameSize.height;
  }
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  let utils = utilsByContext.get(ctx);
  if (!utils) {
    utils = new DrawingUtils(ctx);
    utilsByContext.set(ctx, utils);
  }
  if (landmarks) {
    utils.drawConnectors(landmarks, PoseLandmarker.POSE_CONNECTIONS, { color: connectionColor, lineWidth: 4 });
    utils.drawLandmarks(landmarks, { color: landmarkOutline, fillColor: landmarkFill, lineWidth: 2, radius: 5 });
  }
  for (const [hand, color] of [[hands.Left, LEFT_COLOR], [hands.Right, RIGHT_COLOR]] as const) {
    if (!hand) continue;
    utils.drawConnectors(hand, HandLandmarker.HAND_CONNECTIONS, { color, lineWidth: 2 });
    utils.drawLandmarks(hand, { color: OUTLINE, fillColor: color, lineWidth: 1, radius: 2.5 });
  }
}
