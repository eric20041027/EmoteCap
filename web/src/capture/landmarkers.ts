import { FilesetResolver, PoseLandmarker, type HandLandmarker } from '@mediapipe/tasks-vision';
import { describeModelError } from './captureChecks';
import { createHandLandmarker } from './hands';

const WASM_PATH = '/mediapipe/wasm';

/** fast: Pose Full + hands every other frame (smooth Live Link). accurate: Pose Heavy + hands every frame. */
export type CaptureQuality = 'fast' | 'accurate';

const POSE_MODEL_PATH: Record<CaptureQuality, string> = {
  fast: '/models/pose_landmarker_full.task',
  accurate: '/models/pose_landmarker_heavy.task',
};

/** Error whose message is already user-facing. */
export class CaptureError extends Error {}

export interface Landmarkers {
  pose: PoseLandmarker;
  /** Optional: body tracking keeps working if the hand model fails to load. */
  hands: HandLandmarker | undefined;
}

/** Pose (GPU, falling back to CPU) and hand landmarkers in VIDEO mode, shared by the camera and video import. */
export async function createLandmarkers(quality: CaptureQuality): Promise<Landmarkers> {
  try {
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: POSE_MODEL_PATH[quality], delegate },
      runningMode: 'VIDEO' as const,
      numPoses: 1,
    });
    let pose: PoseLandmarker;
    try {
      pose = await PoseLandmarker.createFromOptions(fileset, options('GPU'));
    } catch (gpuError) {
      console.warn('PoseLandmarker GPU delegate failed, retrying on CPU:', gpuError);
      pose = await PoseLandmarker.createFromOptions(fileset, options('CPU'));
    }
    let hands: HandLandmarker | undefined;
    try {
      hands = await createHandLandmarker(fileset);
    } catch (handError) {
      console.warn('Hand tracking unavailable; continuing with body only:', handError);
    }
    return { pose, hands };
  } catch (error) {
    throw new CaptureError(describeModelError(error));
  }
}

export function closeLandmarkers(landmarkers: Landmarkers | undefined): void {
  landmarkers?.pose.close();
  landmarkers?.hands?.close();
}
