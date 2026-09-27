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

/** MediaPipe labels handedness as if the image were mirrored; our camera feed is not, so swap. */
const sideFromLabel = (labels: Category[] | undefined): Side | null => {
  const name = labels?.[0]?.categoryName;
  if (name === 'Left') return 'Right';
  if (name === 'Right') return 'Left';
  return null;
};

/**
 * Decide which detected hand is the actor's left and right. With a pose, each hand goes to the nearest
 * pose wrist (robust to label flips and to other people's hands); without one, use the swapped labels.
 */
export function assignHands(result: HandDetections, poseImage: NormalizedLandmark[] | undefined): TrackedHands {
  const world: TrackedHands['world'] = {};
  const image: TrackedHands['image'] = {};
  const take = (hand: number, side: Side) => {
    world[side] = result.worldLandmarks[hand];
    image[side] = result.landmarks[hand];
  };

  if (!poseImage) {
    result.landmarks.forEach((_, hand) => {
      const side = sideFromLabel(result.handedness[hand]);
      if (side && !world[side]) take(hand, side);
    });
    return { world, image };
  }

  const pairs = result.landmarks
    .flatMap((landmarks, hand) =>
      (['Left', 'Right'] as Side[]).map((side) => ({ hand, side, d: distance(landmarks[0], poseImage[POSE_WRIST[side]]) })),
    )
    .filter((pair) => pair.d <= MAX_WRIST_DISTANCE)
    .sort((a, b) => a.d - b.d);
  const usedHands = new Set<number>();
  for (const { hand, side } of pairs) {
    if (usedHands.has(hand) || world[side]) continue;
    usedHands.add(hand);
    take(hand, side);
  }
  return { world, image };
}
