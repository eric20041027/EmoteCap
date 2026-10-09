import { NO_HANDS, assignHands } from '../capture/hands';
import type { Landmarkers } from '../capture/landmarkers';
import type { FrameDetection } from './convertVideo';
import { ProcessingConsentError, type SdkAuthorization } from '../privacy/processingConsent';

export type FrameDetector = (video: HTMLVideoElement, timestampMs: number) => FrameDetection;

/**
 * Pose and (for the Body + Fingers skeleton) hands on every frame. If the hand model fails once, the rest of
 * the import continues body-only.
 */
export function createFrameDetector(landmarkers: Landmarkers, trackHands: boolean, authorize: SdkAuthorization,
  reportTracking = false): FrameDetector {
  let handTracker = trackHands ? landmarkers.hands : undefined;
  let handFailed = false;
  return (video, timestampMs) => {
    authorize();
    const pose = landmarkers.pose.detectForVideo(video, timestampMs);
    authorize();
    let hands = NO_HANDS;
    if (handTracker) {
      try {
        const frame = { width: video.videoWidth, height: video.videoHeight };
        hands = assignHands(handTracker.detectForVideo(video, timestampMs), pose.landmarks[0], frame);
      } catch (error) {
        authorize();
        if(error instanceof ProcessingConsentError)throw error;
        console.warn('Hand tracking stopped for this import (body tracking continues):', error);
        handTracker = undefined;
        handFailed = true;
      }
    }
    authorize();
    return { world: pose.worldLandmarks[0], image: pose.landmarks[0], hands,
      ...(reportTracking ? {handTracking:handFailed?'failed' as const:handTracker?'active' as const:'disabled' as const} : {}) };
  };
}
