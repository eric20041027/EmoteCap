import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { beforeAll, expect, it } from 'vitest';
import { decodeProject } from './codec';
import { generateSampleArchive, writeSampleArchive } from '../../../scripts/make-project-fixture';

const fixtureURL=new URL('../../../../contracts/fixtures/sample-project.emotecap',import.meta.url);
const motionURL=new URL('../../../../contracts/fixtures/raise-right-arm.clip.json',import.meta.url);

beforeAll(async()=>{if(process.env.EMOTECAP_GENERATE_FIXTURE==='1') await writeSampleArchive();});

it('opens the committed synthetic sample with the shared right-arm motion',async()=>{
  const bytes=Uint8Array.from(await readFile(fixtureURL));
  const sample=await decodeProject(new Blob([bytes]));
  const motion=JSON.parse(await readFile(motionURL,'utf8')) as {frames:unknown[]};
  expect(sample.project).toMatchObject({schemaVersion:1,contractVersion:2,name:'EmoteCap sample'});
  expect(sample.project.takes[0]).toMatchObject({id:'10000000-0000-4000-8000-000000000002',source:'sample',
    status:'complete',provenance:{quality:'fixture',models:[],calibration:{state:'synthetic'}},media:null});
  expect(sample.project.takes[0].frames).toEqual(motion.frames);
  expect(sample.project.takes[0].clips[0]).toMatchObject({id:'10000000-0000-4000-8000-000000000003',name:'RaiseRightArm'});
  expect(sample.media.size).toBe(0);
});

it('generates the same portable fixture bytes twice on the pinned runtime',async()=>{
  const first=await generateSampleArchive(),second=await generateSampleArchive();
  expect(createHash('sha256').update(first).digest('hex')).toBe(createHash('sha256').update(second).digest('hex'));
});
