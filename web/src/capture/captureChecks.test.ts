import { describe, expect, it } from 'vitest';
import { CAMERA_DENIED_MESSAGE, describeCameraError, describeModelError, needsStepBack } from './captureChecks';

function landmarksWithAnkles(left: number, right: number): { visibility: number }[] {
  return Array.from({ length: 33 }, (_, i) => ({ visibility: i === 27 ? left : i === 28 ? right : 0.99 }));
}

describe('needsStepBack', () => {
  it('asks to step back when there is no pose', () => {
    expect(needsStepBack(undefined)).toBe(true);
    expect(needsStepBack([])).toBe(true);
  });

  it('asks to step back when both ankles are hidden', () => {
    expect(needsStepBack(landmarksWithAnkles(0.2, 0.4))).toBe(true);
  });

  it('is satisfied when at least one ankle is visible', () => {
    expect(needsStepBack(landmarksWithAnkles(0.9, 0.1))).toBe(false);
    expect(needsStepBack(landmarksWithAnkles(0.1, 0.5))).toBe(false);
  });
});

describe('describeCameraError', () => {
  it('explains a denied permission', () => {
    expect(describeCameraError(new DOMException('denied', 'NotAllowedError'))).toBe(CAMERA_DENIED_MESSAGE);
    expect(CAMERA_DENIED_MESSAGE).toBe('Camera permission denied. Allow camera access and reload.');
  });

  it('explains a busy or missing camera', () => {
    expect(describeCameraError(new DOMException('busy', 'NotReadableError'))).toMatch(/in use by another app/);
    expect(describeCameraError(new DOMException('none', 'NotFoundError'))).toMatch(/No camera found/);
  });

  it('falls back to the raw error text', () => {
    expect(describeCameraError(new Error('weird'))).toBe('Could not start the camera: weird');
  });
});

describe('describeModelError', () => {
  it('points at the asset fetch script', () => {
    expect(describeModelError(new Error('404'))).toMatch(/npm run fetch-assets/);
  });
});
