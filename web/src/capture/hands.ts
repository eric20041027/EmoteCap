import {
  HandLandmarker,
  type Category,
  type FilesetResolver,
  type Landmark,
  type NormalizedLandmark,
} from '@mediapipe/tasks-vision';

type WasmFileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>;

export const HAND_MODEL_PATH = '/models/hand_landmarker.task';

type Side = 'Left' | 'Right';

export interface TrackedHands {
  /** Hand world landmarks (21 each, meters), keyed by the actor's own side — solver input. */
  world: Partial<Record<Side, Landmark[]>>;
  /** Normalized image landmarks, keyed the same way — overlay input. */
  image: Partial<Record<Side, NormalizedLandmark[]>>;
}

export const NO_HANDS: TrackedHands = { world: {}, image: {} };

const POSE_WRIST: Record<Side, number> = { Left: 15, Right: 16 };
/** A hand whose wrist is farther than this (normalized image units) from both pose wrists is someone else's. */
const MAX_WRIST_DISTANCE = 0.2;
/**
 * The pose wrist drifts when hands are raised by the face, so a hand it cannot place still counts when
 * MediaPipe's own label is at least this confident and the hand is within LABEL_MAX_WRIST_DISTANCE of that wrist.
 */
const LABEL_MIN_SCORE = 0.9;
const LABEL_MAX_WRIST_DISTANCE = 0.4;
/** Knuckles (index to little finger) closer than this many pixels: too small to read the fingers reliably. */
export const MIN_HAND_SPAN_PX = 28;

interface HandDetections {
  landmarks: NormalizedLandmark[][];
  worldLandmarks: Landmark[][];
  handedness: Category[][];
}

export async function createHandLandmarker(fileset: WasmFileset): Promise<HandLandmarker> {
  const options = (delegate: 'GPU' | 'CPU') => ({
    baseOptions: { modelAssetPath: HAND_MODEL_PATH, delegate },
    runningMode: 'VIDEO' as const,
    numHands: 2,
  });
  try {
    return await HandLandmarker.createFromOptions(fileset, options('GPU'));
  } catch (gpuError) {
    console.warn('HandLandmarker GPU delegate failed, retrying on CPU:', gpuError);
    return HandLandmarker.createFromOptions(fileset, options('CPU'));
  }
}

const distance = (a: NormalizedLandmark, b: NormalizedLandmark) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * MediaPipe's handedness label. On our un-mirrored camera it names the actor's own side: it agreed with the
 * pose wrists in 88% of the frames of a recorded take.
 */
const sideFromLabel = (labels: Category[] | undefined): Side | null => {
  const name = labels?.[0]?.categoryName;
  return name === 'Left' || name === 'Right' ? name : null;
};

function knuckleSpanPx(landmarks: NormalizedLandmark[], frame: { width: number; height: number }): number {
  const index = landmarks[5];
  const little = landmarks[17];
  return Math.hypot((index.x - little.x) * frame.width, (index.y - little.y) * frame.height);
}

/**
 * Decide which detected hand is the actor's left and right. With a pose, each hand goes to the nearest
 * pose wrist (robust to label flips and to other people's hands), and a confidently labelled hand near its
 * wrist is kept when the wrists alone cannot place it; without a pose, the labels decide.
 * With `frame` (pixel size of the tracked image), hands too small to read are left out.
 */
export function assignHands(
  result: HandDetections,
  poseImage: NormalizedLandmark[] | undefined,
  frame?: { width: number; height: number },
): TrackedHands {
  const world: TrackedHands['world'] = {};
  const image: TrackedHands['image'] = {};
  const take = (hand: number, side: Side) => {
    world[side] = result.worldLandmarks[hand];
    image[side] = result.landmarks[hand];
  };
  const readable = result.landmarks.map((landmarks) => !frame || knuckleSpanPx(landmarks, frame) >= MIN_HAND_SPAN_PX);

  if (!poseImage) {
    result.landmarks.forEach((_, hand) => {
      const side = sideFromLabel(result.handedness[hand]);
      if (readable[hand] && side && !world[side]) take(hand, side);
    });
    return { world, image };
  }

  const pairs = result.landmarks
    .flatMap((landmarks, hand) =>
      (['Left', 'Right'] as Side[]).map((side) => ({ hand, side, d: distance(landmarks[0], poseImage[POSE_WRIST[side]]) })),
    )
    .filter((pair) => readable[pair.hand] && pair.d <= MAX_WRIST_DISTANCE)
    .sort((a, b) => a.d - b.d);
  const usedHands = new Set<number>();
  for (const { hand, side } of pairs) {
    if (usedHands.has(hand) || world[side]) continue;
    usedHands.add(hand);
    take(hand, side);
  }

  result.landmarks.forEach((landmarks, hand) => {
    const side = sideFromLabel(result.handedness[hand]);
    const score = result.handedness[hand]?.[0]?.score ?? 0;
    if (usedHands.has(hand) || !readable[hand] || !side || world[side] || score < LABEL_MIN_SCORE) return;
    if (distance(landmarks[0], poseImage[POSE_WRIST[side]]) > LABEL_MAX_WRIST_DISTANCE) return;
    usedHands.add(hand);
    take(hand, side);
  });
  return { world, image };
}
