import { expect, it } from 'vitest';
import assets from '../../scripts/mediapipe-assets.json';
import lock from '../../package-lock.json';
import { captureProvenance, TRACKER_VERSION } from './provenance';
it('records selected pinned model hashes and the actual known calibration state',()=>{
  const p=captureProvenance({quality:'fast',skeleton:'full',smoothing:'low',calibrated:false});
  expect(p.models.map(m=>m.file)).toEqual(['pose_landmarker_full.task','hand_landmarker.task']);
  expect(p.models.every(m=>assets.some(a=>a.file===m.file && a.sha256===m.sha256))).toBe(true);
  expect(p).toMatchObject({contractVersion:2,quality:'fast',skeleton:'full',smoothing:'low',calibration:{state:'not-captured'}});
  expect(TRACKER_VERSION).toBe(lock.packages['node_modules/@mediapipe/tasks-vision'].version);
});
it('records video imports as Accurate with their actual calibration note',()=>{
  const p=captureProvenance({quality:'accurate',skeleton:'body',smoothing:'medium',calibrated:true,note:'Auto-calibrated at 1.2 s.'});
  expect(p.models.map(m=>m.file)).toEqual(['pose_landmarker_heavy.task']);
  expect(p.calibration).toEqual({state:'captured',note:'Auto-calibrated at 1.2 s.'});
  expect(Object.isFrozen(p)).toBe(true);
});
