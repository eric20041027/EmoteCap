import { NO_HANDS, assignHands } from '../capture/hands';
import type { Landmarkers } from '../capture/landmarkers';
import type { FrameDetection } from './convertVideo';

export type FrameDetector = (video: HTMLVideoElement, timestampMs: number) => FrameDetection;

/**
 * Pose and (for the Body + Fingers skeleton) hands on every frame. If the hand model fails once, the rest of
 * the import continues body-only.
 */
export function createFrameDetector(landmarkers: Landmarkers, trackHands: boolean): FrameDetector {
  let handTracker = trackHands ? landmarkers.hands : undefined;
  return (video, timestampMs) => {
    const pose = landmarkers.pose.detectForVideo(video, timestampMs);
    let hands = NO_HANDS;
    if (handTracker) {
      try {
        const frame = { width: video.videoWidth, height: video.videoHeight };
        hands = assignHands(handTracker.detectForVideo(video, timestampMs), pose.landmarks[0], frame);
      } catch (error) {
        console.warn('Hand tracking stopped for this import (body tracking continues):', error);
        handTracker = undefined;
      }
    }
    return { world: pose.worldLandmarks[0], image: pose.landmarks[0], hands };
  };
}
