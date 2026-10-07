import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {prepareBaseline} from './baseline-snapshot.mjs';
import {buildOriginalRunner,OriginalRunnerError} from './original-runner.mjs';

const fixtures=fileURLToPath(new URL('../../.superpowers/sdd/2026-10-07-original-runner/fixtures/',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function git(root,...args){return execFileSync('git',args,{cwd:root,timeout:10000,maxBuffer:3*1024*1024});}
function fixture(extra='',large=false){
  const root=path.join(fixtures,randomUUID());fs.mkdirSync(path.join(root,'web'),{recursive:true});git(root,'init','--quiet');
  const source={
    'contracts/bones.json':'{"height":1.7}',
    'web/src/import/convertVideo.ts':`import type {LegacyHands} from '../capture/hands';
      export class ImportError extends Error {}
      export const NO_PERSON_MESSAGE=${JSON.stringify(large?'a'.repeat(600000):'No person found')};
      export async function convertVideo(duration:number,steps:any){await steps.seek(0);
        const frame=steps.createSolver().solve(steps.detect(0).world,0);steps.onProgress?.({done:1,total:1,frame});
        return{frames:frame?[frame]:[],calibratedAt:null};}`,
    'web/src/motion/index.ts':`import config from '../../../contracts/bones.json';${extra}
      export function createPoseSolver(){return{solve:(world:unknown,t:number)=>({t,h:[0,Number(import.meta.env.VITE_PRIVATE_SENTINEL??config.height),0],r:[0,0,0,1]}),
        calibrate(){},relaxFingers(){},setSmoothing(){},reset(){}};}`,
  };
  for(const [relative,raw] of Object.entries(source)){const target=path.join(root,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,raw,{flag:'wx'});}
  git(root,'add','--',...Object.keys(source));git(root,'-c','user.name=Original fixture','-c','user.email=original@example.invalid','-c','commit.gpgSign=false','commit','--quiet','-m','Owned original source');
  const sourceCommit=git(root,'rev-parse','HEAD').toString().trim();
  const index={schema:'emotecap-baseline-index-v1',sourceCommit,files:Object.entries(source).sort(([a],[b])=>a.localeCompare(b)).map(([relative,raw])=>({
    path:relative,blob:git(root,'rev-parse',`${sourceCommit}:${relative}`).toString().trim(),bytes:Buffer.byteLength(raw),sha256:hash(raw),
  }))};
  return{root,index};
}
async function load(output){const raw=fs.readFileSync(path.join(output.directory,'original.bin'));return import(`data:text/javascript;base64,${raw.toString('base64')}`);}

test('compiles actual pinned source into one self-contained module and binds its manifest',async()=>{
  const input=fixture(),output=await buildOriginalRunner(input.root,input.index),runner=await load(output);
  assert.equal(runner.compiledSource.sourceCommit,input.index.sourceCommit);
  const result=await runner.convertVideo(.1,{seek:async()=>{},detect:()=>({world:[]}),createSolver:runner.createPoseSolver});
  assert.deepEqual(result.frames,[{t:0,h:[0,1.7,0],r:[0,0,0,1]}]);
  const raw=fs.readFileSync(path.join(output.directory,'original.bin')),manifest=fs.readFileSync(path.join(output.directory,'manifest.json'));
  assert.equal(hash(manifest),output.buildId);assert.equal(hash(raw),output.manifest.bundleSha256);
  assert.equal(raw.length,output.manifest.bundleBytes);assert.equal(output.manifest.qualification,'compiled-source');
  assert.equal(output.manifest.consumedSources.length,3);assert.deepEqual(fs.readdirSync(output.directory).sort(),['manifest.json','original.bin']);
});
test('identical rebuild verifies immutable existing artifacts and preserves timestamps',async()=>{
  const input=fixture(),first=await buildOriginalRunner(input.root,input.index),target=path.join(first.directory,'manifest.json');
  const mtime=fs.statSync(target).mtimeMs,bytes=fs.readFileSync(target),second=await buildOriginalRunner(input.root,input.index);
  assert.equal(second.buildId,first.buildId);assert.equal(second.reused,true);assert.equal(fs.statSync(target).mtimeMs,mtime);assert.deepEqual(fs.readFileSync(target),bytes);
});
test('does not load project config, dotenv or copy public files',async()=>{
  const input=fixture();fs.writeFileSync(path.join(input.root,'web/vite.config.ts'),'throw new Error("Owned configuration must remain inert")');
  fs.writeFileSync(path.join(input.root,'web/.env'),'VITE_PRIVATE_SENTINEL=987654321\n');
  fs.mkdirSync(path.join(input.root,'web/public'));fs.writeFileSync(path.join(input.root,'web/public/unrelated.bin'),'owned public data');
  const output=await buildOriginalRunner(input.root,input.index),runner=await load(output);
  assert.equal(runner.createPoseSolver().solve([],0).h[1],1.7);assert.equal(fs.readdirSync(output.directory).length,2);
});
test('rejects source snapshot tamper before producing completed runner artifacts',async()=>{
  const input=fixture(),snapshot=prepareBaseline(input.root,input.index);
  fs.writeFileSync(path.join(snapshot.directory,'web/src/motion/index.ts'),'tampered');
  await assert.rejects(buildOriginalRunner(input.root,input.index),OriginalRunnerError);
  assert.equal(fs.existsSync(path.join(input.root,'web/.measurement-baseline/runners')),false);
});
for(const extra of ["import 'node:fs';", "import '../unlisted.ts';", "import '../../scripts/fetch-mediapipe.mjs';"])
  test(`rejects an unapproved runtime dependency ${extra}`,async()=>{
    const input=fixture(extra);await assert.rejects(buildOriginalRunner(input.root,input.index),OriginalRunnerError);
    assert.equal(fs.existsSync(path.join(input.root,'web/.measurement-baseline/runners')),false);
  });
for(const mutation of ['bundle','manifest','extra','hardlink','incomplete'])test(`refuses ${mutation} existing runner without repairing or overwriting it`,async()=>{
  const input=fixture(),output=await buildOriginalRunner(input.root,input.index),target=path.join(output.directory,'original.bin');
  if(mutation==='bundle')fs.writeFileSync(target,'changed owned bundle');
  if(mutation==='manifest')fs.writeFileSync(path.join(output.directory,'manifest.json'),'{}');
  if(mutation==='extra')fs.writeFileSync(path.join(output.directory,'extra.txt'),'owned',{flag:'wx'});
  if(mutation==='hardlink')fs.linkSync(target,path.join(input.root,'owned-hardlink.mjs'));
  if(mutation==='incomplete')fs.unlinkSync(path.join(output.directory,'manifest.json'));
  const before=fs.existsSync(path.join(output.directory,'manifest.json'))?fs.readFileSync(path.join(output.directory,'manifest.json')):null;
  await assert.rejects(buildOriginalRunner(input.root,input.index),OriginalRunnerError);
  assert.deepEqual(fs.existsSync(path.join(output.directory,'manifest.json'))?fs.readFileSync(path.join(output.directory,'manifest.json')):null,before);
});
test('rejects an output parent junction without writing the foreign directory',async()=>{
  const input=fixture();prepareBaseline(input.root,input.index);const foreign=path.join(fixtures,`foreign-${randomUUID()}`);fs.mkdirSync(foreign);
  fs.symlinkSync(foreign,path.join(input.root,'web/.measurement-baseline/runners'),'junction');
  await assert.rejects(buildOriginalRunner(input.root,input.index),OriginalRunnerError);assert.deepEqual(fs.readdirSync(foreign),[]);
});
test('rejects an actual emitted module exceeding512KiB before completion',async()=>{
  const input=fixture('',true);await assert.rejects(buildOriginalRunner(input.root,input.index),OriginalRunnerError);
  assert.equal(fs.existsSync(path.join(input.root,'web/.measurement-baseline/runners')),false);
});
