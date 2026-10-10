import type {CameraReceipt} from './cameraMeasurements';

export function CameraCounterEvidence({progress}:{progress:NonNullable<CameraReceipt['summary']>['inputCounterProgress']}){
  return <p role="status" aria-label="Input counter evidence">Measured input counter: {progress}.
    {progress!=='advancing'&&' This receipt cannot establish fresh-camera throughput. Output and response observations are retained; repeat with a working frame counter.'}</p>;
}
