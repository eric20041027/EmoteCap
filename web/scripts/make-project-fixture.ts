import { readFile, writeFile } from 'node:fs/promises';
import type { MotionFrame } from '../src/motion/contract';
import type { ProjectDocument } from '../src/project/types';
import { encodeProject } from '../src/project/archive/codec';

const TAKE_ID='10000000-0000-4000-8000-000000000002';
export const sampleFixtureURL=new URL('../../contracts/fixtures/sample-project.emotecap',import.meta.url);
export async function generateSampleArchive():Promise<Uint8Array<ArrayBuffer>> {
  const source=JSON.parse(await readFile(new URL('../../contracts/fixtures/raise-right-arm.clip.json',import.meta.url),'utf8')) as {frames:MotionFrame[]};
  const timestamp=1767225600000;
  const project:ProjectDocument={format:'emotecap-project',schemaVersion:1,contractVersion:2,
    id:'10000000-0000-4000-8000-000000000001',revision:0,name:'EmoteCap sample',
    createdAt:timestamp,updatedAt:timestamp,activeTakeId:TAKE_ID,takes:[{
      id:TAKE_ID,name:'Synthetic right-arm raise',source:'sample',status:'complete',createdAt:timestamp,
      provenance:{appVersion:'0.1.0',contractVersion:2,trackerVersion:'synthetic-v2',quality:'fixture',
        skeleton:'full',smoothing:'low',calibration:{state:'synthetic',note:'Synthetic shared motion-contract fixture; no camera or model inference.'},models:[]},
      frames:source.frames,clips:[{id:'10000000-0000-4000-8000-000000000003',name:'RaiseRightArm',
        start:0,end:source.frames.at(-1)!.t,loop:false,description:'Shared synthetic right-arm direction sample.'}],
      clipRevision:0,undo:[],media:null,
    }]};
  return new Uint8Array(await (await encodeProject(project)).arrayBuffer());
}
export async function writeSampleArchive():Promise<void> {await writeFile(sampleFixtureURL,await generateSampleArchive());}
