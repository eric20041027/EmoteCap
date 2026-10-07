import { afterEach, expect, it, vi } from 'vitest';
import { BlobReader, BlobWriter, ZipWriter } from '@zip.js/zip.js';
import { IDBFactory } from 'fake-indexeddb';
import { addTake, appendTakeFrames, createProject, setTakeMedia } from '../model';
import { provenance, readyProject } from '../testData';
import { openProjectStore } from '../store';
import { tposeFrame } from '../../motion/contract';
import { decodeProject, encodeProject, ProjectArchiveError } from './codec';
import { archiveLimits, HARD_LIMITS } from './limits';

afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals();});
const json=(value:unknown)=>new Blob([JSON.stringify(value)],{type:'application/json'});
const manifest=()=>({format:'emotecap-archive',version:1,project:'project.json',projectSchema:1,contractVersion:2,media:[]});
async function zipped(entries:readonly [string,Blob][],level=0,zip64=false,password?:string) {
  const writer=new ZipWriter(new BlobWriter(),{useWebWorkers:false,useCompressionStream:true,zip64});
  for(const [name,data] of entries) await writer.add(name,new BlobReader(data),{
    level,lastModDate:new Date('2026-01-01T00:00:00Z'),dataDescriptor:false,
    bufferedWrite:true,password,zipCrypto:Boolean(password),zip64});
  return writer.close();
}
async function ordinary(project:unknown=readyProject(),header:unknown=manifest(),extra:readonly [string,Blob][]=[]){
  return zipped([['manifest.json',json(header)],['project.json',json(project)],...extra]);
}
function central(bytes:Uint8Array,name:string) {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),decoder=new TextDecoder();
  for(let i=0;i+46<=bytes.length;i++) if(view.getUint32(i,true)===0x02014b50) {
    const length=view.getUint16(i+28,true);
    if(decoder.decode(bytes.subarray(i+46,i+46+length))===name) return {view,offset:i,local:view.getUint32(i+42,true)};
  }
  throw new Error('Fixture entry not found.');
}

it('roundtrips an independently identifiable motion-only project', async () => {
  const source = readyProject();
  const archive = await encodeProject(source);
  const restored = await decodeProject(archive);
  expect(restored.project.name).toBe(source.name);
  expect(restored.project.id).not.toBe(source.id);
  expect(restored.project.takes).toEqual(source.takes);
  expect(restored.media.size).toBe(0);
});

it.each([0,6])('decodes actual stored/deflated ZIP entries (level %i)',async(level)=>{
  const source=readyProject(), archive=await zipped([['manifest.json',json(manifest())],['project.json',json(source)]],level);
  expect((await decodeProject(archive)).project.takes).toEqual(source.takes);
});

it('accepts bounded ZIP64 entries',async()=>{
  const source=readyProject(), archive=await zipped([['manifest.json',json(manifest())],['project.json',json(source)]],0,true);
  expect((await decodeProject(archive)).project.name).toBe(source.name);
});

it('does not read or include a source without the inclusion choice',async()=>{
  const original=readyProject(), video=new Blob(['source'],{type:'video/webm'}), id=original.takes[0].id;
  const source=setTakeMedia(original,id,{name:'source.webm',type:video.type,size:video.size});
  const loader=vi.fn().mockResolvedValue({name:'source.webm',blob:video});
  const decoded=await decodeProject(await encodeProject(source,{readMedia:loader}));
  expect(loader).not.toHaveBeenCalled();expect(decoded.media.size).toBe(0);
  expect(decoded.project.takes[0].media).toBeNull();expect(source.takes[0].media?.size).toBe(video.size);
});

it('backs up an in-memory source with retention off and imports it without implicit retention',async()=>{
  const source=readyProject(), id=source.takes[0].id, video=new Blob(['source'],{type:'video/webm'});
  const decoded=await decodeProject(await encodeProject(source,{includeMedia:true,readMedia:async()=>({name:'原片.webm',blob:video})}));
  expect(await decoded.media.get(id)?.blob.text()).toBe('source');
  expect(decoded.media.get(id)?.name).toBe('原片.webm');expect(decoded.media.get(id)?.blob.type).toBe('video/webm');
  expect(decoded.project.takes[0].media).toBeNull();expect(source.takes[0].media).toBeNull();
});

it('requires a retained source to exist when inclusion is requested',async()=>{
  const original=readyProject(),video=new Blob(['source'],{type:'video/webm'});
  const source=setTakeMedia(original,original.takes[0].id,{name:'source.webm',type:video.type,size:video.size});
  await expect(encodeProject(source,{includeMedia:true,readMedia:async()=>null})).rejects.toMatchObject({kind:'missing-media'});
});

it('recovers a recording checkpoint in a new namespace with exact original motion',async()=>{
  const empty=addTake(createProject(),{name:'Camera',source:'camera',provenance:provenance()});
  const source=appendTakeFrames(empty,empty.takes[0].id,[tposeFrame(0),tposeFrame(0.5)]);
  const decoded=await decodeProject(await encodeProject(source));
  expect(decoded.project.id).not.toBe(source.id);expect(decoded.project.activeTakeId).toBe(source.activeTakeId);
  expect(decoded.project.takes[0]).toMatchObject({id:source.takes[0].id,status:'interrupted',frames:source.takes[0].frames});
  expect(source.takes[0].status).toBe('recording');expect(decoded.project.takes[0].clips).toHaveLength(1);
});

const badManifests:[string,(header:ReturnType<typeof manifest>)=>void][]=[
  ['unsupported version',h=>{h.version=2;}],['unsupported schema',h=>{h.projectSchema=2;}],
  ['unsupported contract',h=>{h.contractVersion=1;}],['unknown credentials',h=>{Object.assign(h,{apiKey:'not-accepted'});}],
  ['wrong project path',h=>{h.project='../project.json';}],
];
it.each(badManifests)('rejects %s in the manifest',async(_name,change)=>{
  const header=manifest();change(header);await expect(decodeProject(await ordinary(undefined,header))).rejects.toBeInstanceOf(ProjectArchiveError);
});

it('rejects invalid project data and never modifies an existing repository project',async()=>{
  const store=await openProjectStore({factory:new IDBFactory(),name:'unchanged'}),source=readyProject();await store.save(source,null);
  try {
    const invalid={...source,apiKey:'not-accepted'};
    await expect(decodeProject(await ordinary(invalid))).rejects.toBeInstanceOf(ProjectArchiveError);
    expect(await store.load(source.id)).toEqual(source);
  } finally {store.close();}
});

it.each(['../private','/absolute','media/../../private','project.JSON','unknown.txt','folder/'])('rejects forbidden ZIP path %s',async(name)=>{
  await expect(decodeProject(await ordinary(undefined,undefined,[[name,new Blob(['x'])]]))).rejects.toBeInstanceOf(ProjectArchiveError);
});

it('rejects duplicate physical ZIP filenames',async()=>{
  const archive=await ordinary(undefined,undefined,[['project.jsoN',json(readyProject())]]), bytes=new Uint8Array(await archive.arrayBuffer());
  const row=central(bytes,'project.jsoN'), value=new TextEncoder().encode('project.json');
  bytes.set(value,row.offset+46);bytes.set(value,row.local+30);
  await expect(decodeProject(new Blob([bytes]))).rejects.toBeInstanceOf(ProjectArchiveError);
});

it('rejects missing metadata and invalid UTF-8 before publishing a project',async()=>{
  await expect(decodeProject(await zipped([['project.json',json(readyProject())]]))).rejects.toBeInstanceOf(ProjectArchiveError);
  await expect(decodeProject(await zipped([['manifest.json',new Blob([new Uint8Array([0xff,0xfe])])],['project.json',json(readyProject())]]))).rejects.toBeInstanceOf(ProjectArchiveError);
});

it('rejects unknown, missing and mismatching media references',async()=>{
  const source=readyProject(),video=new Blob(['source'],{type:'video/webm'}),id=source.takes[0].id,path=`media/${id}.source`;
  const retained=setTakeMedia(source,id,{name:'source.webm',type:video.type,size:video.size});
  const header={...manifest(),media:[{takeId:id,path}]};
  await expect(decodeProject(await ordinary(retained,header))).rejects.toBeInstanceOf(ProjectArchiveError);
  await expect(decodeProject(await ordinary(retained,header,[[path,new Blob(['wrong size'])]]))).rejects.toBeInstanceOf(ProjectArchiveError);
  await expect(decodeProject(await ordinary(source,header,[[path,video]]))).rejects.toBeInstanceOf(ProjectArchiveError);
  await expect(decodeProject(await ordinary(retained,{...header,media:[...header.media,...header.media]},[[path,video]]))).rejects.toBeInstanceOf(ProjectArchiveError);
});

it('rejects CRC corruption and mismatching local filename',async()=>{
  const archive=await ordinary(), bytes=new Uint8Array(await archive.arrayBuffer()), row=central(bytes,'project.json');
  const payload=row.local+30+row.view.getUint16(row.local+26,true)+row.view.getUint16(row.local+28,true);
  bytes[payload+10]^=1;await expect(decodeProject(new Blob([bytes]))).rejects.toBeInstanceOf(ProjectArchiveError);
  const names=new Uint8Array(await archive.arrayBuffer()),local=central(names,'project.json').local;
  names[local+30]=120;await expect(decodeProject(new Blob([names]))).rejects.toBeInstanceOf(ProjectArchiveError);
});

it('rejects encrypted and unsupported-compression entries before decoding them',async()=>{
  const encrypted=await zipped([['manifest.json',json(manifest())],['project.json',json(readyProject())]],0,false,'fixture-only');
  await expect(decodeProject(encrypted)).rejects.toBeInstanceOf(ProjectArchiveError);
  const archive=await ordinary(),bytes=new Uint8Array(await archive.arrayBuffer()),row=central(bytes,'project.json');
  row.view.setUint16(row.offset+10,99,true);row.view.setUint16(row.local+8,99,true);
  await expect(decodeProject(new Blob([bytes]))).rejects.toBeInstanceOf(ProjectArchiveError);
});

it('enforces input, JSON, decoded-total, entry-count and metadata-read bounds',async()=>{
  const archive=await ordinary();
  for(const limits of [{fileBytes:10},{jsonBytes:10},{decodedBytes:10},{entries:1},{readBytes:10},{manifestBytes:10}]) {
    await expect(decodeProject(archive,{limits})).rejects.toMatchObject({kind:'limit'});
  }
  expect(()=>archiveLimits({fileBytes:HARD_LIMITS.fileBytes+1})).toThrow(/limit/i);
  expect(()=>archiveLimits({entries:NaN})).toThrow(/limit/i);
});

it('rejects a forged compressed size before publishing decoded payload',async()=>{
  const archive=await zipped([['manifest.json',json(manifest())],['project.json',new Blob([' '.repeat(250000)])]],6);
  const bytes=new Uint8Array(await archive.arrayBuffer()),row=central(bytes,'project.json');
  row.view.setUint32(row.offset+24,1,true);row.view.setUint32(row.local+22,1,true);
  await expect(decodeProject(new Blob([bytes]),{limits:{jsonBytes:1000}})).rejects.toMatchObject({kind:'corrupt'});
});

it('streams a source larger than the maximum metadata request',async()=>{
  const project=readyProject(),video=new Blob([new Uint8Array(200*1024).fill(97)],{type:'video/webm'}),id=project.takes[0].id;
  const restored=await decodeProject(await encodeProject(project,{includeMedia:true,readMedia:async()=>({name:'source.webm',blob:video})}));
  expect(restored.media.get(id)?.blob.size).toBe(video.size);expect(await restored.media.get(id)?.blob.text()).toBe(await video.text());
});

it('cancels pre-aborted operations and an uncooperative source loader',async()=>{
  const project=readyProject(),pre=new AbortController();pre.abort();
  await expect(encodeProject(project,{signal:pre.signal})).rejects.toMatchObject({kind:'cancelled'});
  await expect(decodeProject(new Blob(),{signal:pre.signal})).rejects.toMatchObject({kind:'cancelled'});
  const controller=new AbortController();let entered!:()=>void;
  const started=new Promise<void>(r=>{entered=r;});
  const waiting=encodeProject(project,{includeMedia:true,signal:controller.signal,readMedia:()=>{entered();return new Promise(()=>{});}});
  await started;controller.abort();await expect(waiting).rejects.toMatchObject({kind:'cancelled'});
});

it('times out a stalled source without publishing a partial archive',async()=>{
  vi.useFakeTimers();
  const waiting=encodeProject(readyProject(),{includeMedia:true,readMedia:()=>new Promise(()=>{})});
  const rejection=expect(waiting).rejects.toMatchObject({kind:'cancelled'});
  await vi.advanceTimersByTimeAsync(30000);await rejection;
});

it('consumes a source rejection when that source cancels synchronously',async()=>{
  const controller=new AbortController();
  await expect(encodeProject(readyProject(),{includeMedia:true,signal:controller.signal,
    readMedia:()=>{controller.abort();return Promise.reject(new Error('Source cancelled'));}})).rejects.toMatchObject({kind:'cancelled'});
});

it('encodes and decodes compressed data offline without a worker or codec fetch',async()=>{
  const fetch=vi.fn(()=>Promise.reject(new Error('Network must not be used')));vi.stubGlobal('fetch',fetch);
  const source=readyProject();expect((await decodeProject(await encodeProject(source))).project.takes).toEqual(source.takes);
  expect(fetch).not.toHaveBeenCalled();
});

it.each([
  ['nesting',()=>`{"nested":${'['.repeat(100)}0${']'.repeat(100)}}`],
  ['wide objects',()=>JSON.stringify(Object.fromEntries(Array.from({length:30},(_,i)=>[`key_${i}`,i])))],
  ['oversized strings',()=>JSON.stringify({name:'x'.repeat(5000)})],
] as const)('rejects excessive JSON %s before constructing unbounded data',async(_label,body)=>{
  const archive=await zipped([['manifest.json',json(manifest())],['project.json',new Blob([body()])]]);
  await expect(decodeProject(archive)).rejects.toMatchObject({kind:'limit'});
});
