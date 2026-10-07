import { FilesetResolver, PoseLandmarker, type HandLandmarker } from '@mediapipe/tasks-vision';
import { describeModelError } from './captureChecks';
import { createHandLandmarker } from './hands';
import { ProcessingConsentError, type SdkAuthorization } from '../privacy/processingConsent';

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
export async function createLandmarkers(quality: CaptureQuality, authorize: SdkAuthorization): Promise<Landmarkers> {
  let pose: PoseLandmarker | undefined;
  let hands: HandLandmarker | undefined;
  try {
    authorize();
    const fileset = await FilesetResolver.forVisionTasks(WASM_PATH);
    authorize();
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: { modelAssetPath: POSE_MODEL_PATH[quality], delegate },
      runningMode: 'VIDEO' as const,
      numPoses: 1,
    });
    try {
      authorize();
      pose = await PoseLandmarker.createFromOptions(fileset, options('GPU'));
    } catch (gpuError) {
      authorize();
      console.warn('PoseLandmarker GPU delegate failed, retrying on CPU:', gpuError);
      pose = await PoseLandmarker.createFromOptions(fileset, options('CPU'));
    }
    authorize();
    try {
      hands = await createHandLandmarker(fileset,authorize);
    } catch (handError) {
      authorize();
      if(handError instanceof ProcessingConsentError)throw handError;
      console.warn('Hand tracking unavailable; continuing with body only:', handError);
    }
    authorize();
    return { pose, hands };
  } catch (error) {
    pose?.close();
    hands?.close();
    if(error instanceof ProcessingConsentError)throw error;
    throw new CaptureError(describeModelError(error));
  }
}

export function closeLandmarkers(landmarkers: Landmarkers | undefined): void {
  landmarkers?.pose.close();
  landmarkers?.hands?.close();
}
