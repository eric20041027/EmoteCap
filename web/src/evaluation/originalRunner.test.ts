import {beforeEach,describe,expect,it,vi} from 'vitest';
import {NO_PERSON_MESSAGE} from '../import/convertVideo';
import {loadOriginalRunner,ORIGINAL_COMMIT,ORIGINAL_INDEX_SHA256,type OriginalManifest} from './originalRunner';

const imports=vi.hoisted(()=>({module:vi.fn()}));vi.mock('./originalModule',()=>({importOriginalModule:imports.module}));
const sha=async(bytes:Uint8Array<ArrayBuffer>)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
const encode=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value));
async function artifact(overrides:Partial<OriginalManifest>={}){
  const bundle=new TextEncoder().encode('owned synthetic module bytes');
  const manifest:OriginalManifest={schema:'emotecap-original-runner-v1',sourceCommit:ORIGINAL_COMMIT,sourceIndexSha256:ORIGINAL_INDEX_SHA256,
    consumedSources:['contracts/bones.json','web/src/import/convertVideo.ts','web/src/motion/index.ts','web/src/motion/solver.ts'],
    bundleSha256:await sha(bundle),bundleBytes:bundle.length,builderSha256:'a'.repeat(64),compilerLockSha256:'b'.repeat(64),
    viteVersion:'8.3.1',nodeVersion:'v24.19.0',qualification:'compiled-source',...overrides};
  const raw=encode(manifest);return{bundle,manifest,raw,id:await sha(raw)};
}
function module(){return{convertVideo:vi.fn(),createPoseSolver:vi.fn(),ImportError:class extends Error{},NO_PERSON_MESSAGE,
  compiledSource:{sourceCommit:ORIGINAL_COMMIT,sourceIndexSha256:ORIGINAL_INDEX_SHA256}};}
function options(){return{authorize:vi.fn(),signal:new AbortController().signal};}
function responses(data:Awaited<ReturnType<typeof artifact>>){
  return vi.fn().mockResolvedValueOnce(new Response(data.raw)).mockResolvedValueOnce(new Response(data.bundle));
}
describe('verified original byte import',()=>{
  beforeEach(()=>{vi.restoreAllMocks();vi.resetAllMocks();imports.module.mockResolvedValue(module());
    vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:owned-original');vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{});});
  it('hashes bounded received bytes before one owned Blob import and retains provenance',async()=>{
    const data=await artifact(),fetch=responses(data);vi.stubGlobal('fetch',fetch);
    const result=await loadOriginalRunner(data.id,options());
    expect(fetch.mock.calls.map(([url])=>url)).toEqual([`/.measurement-baseline/runners/${data.id}/manifest.json`,`/.measurement-baseline/runners/${data.id}/original.bin`]);
    expect(fetch.mock.calls.every(([,init])=>init.redirect==='error'&&init.cache==='no-store')).toBe(true);
    expect(imports.module).toHaveBeenCalledWith('blob:owned-original');expect(result.provenance).toEqual({buildId:data.id,manifest:data.manifest});
    const blob=vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(data.bundle);expect(blob.type).toBe('text/javascript');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:owned-original');
  });
  it('denial, invalid ID and pre-abort have no fetch/import effects',async()=>{
    const fetch=vi.fn();vi.stubGlobal('fetch',fetch);const denied=options();denied.authorize.mockImplementation(()=>{throw new Error('Denied');});
    await expect(loadOriginalRunner('a'.repeat(64),denied)).rejects.toThrow();
    await expect(loadOriginalRunner('../wrong',options())).rejects.toThrow();
    const cancelled=new AbortController();cancelled.abort();await expect(loadOriginalRunner('a'.repeat(64),{...options(),signal:cancelled.signal})).rejects.toThrow();
    expect(fetch).not.toHaveBeenCalled();expect(imports.module).not.toHaveBeenCalled();
  });
  for(const invalid of [{sourceCommit:'b'.repeat(40)},{sourceIndexSha256:'c'.repeat(64)},{bundleBytes:524289},
    {qualification:'accepted' as OriginalManifest['qualification']},{consumedSources:['web/scripts/fetch-mediapipe.mjs']}])
    it(`refuses wrong source/schema/size before module execution ${JSON.stringify(invalid)}`,async()=>{
      const data=await artifact(invalid);vi.stubGlobal('fetch',responses(data));await expect(loadOriginalRunner(data.id,options())).rejects.toThrow();
      expect(imports.module).not.toHaveBeenCalled();expect(URL.createObjectURL).not.toHaveBeenCalled();
    });
  it('refuses changed manifest bytes even if parsed identity is plausible',async()=>{
    const data=await artifact();vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(new TextEncoder().encode(JSON.stringify(data.manifest)+' '))));
    await expect(loadOriginalRunner(data.id,options())).rejects.toThrow();expect(imports.module).not.toHaveBeenCalled();
  });
  it('refuses changed bundle bytes before importing them',async()=>{
    const data=await artifact();vi.stubGlobal('fetch',vi.fn().mockResolvedValueOnce(new Response(data.raw)).mockResolvedValueOnce(new Response('different bytes')));
    await expect(loadOriginalRunner(data.id,options())).rejects.toThrow();expect(imports.module).not.toHaveBeenCalled();expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('bounds actual streamed body and cancels an oversized response',async()=>{
    const cancel=vi.fn(),stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(new Uint8Array(16385));},cancel});
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue(new Response(stream)));
    await expect(loadOriginalRunner('a'.repeat(64),options())).rejects.toThrow();expect(cancel).toHaveBeenCalledTimes(1);expect(imports.module).not.toHaveBeenCalled();
  });
  it('withdrawal while manifest settles prevents bundle fetch and import',async()=>{
    const data=await artifact(),opts=options();let resolve!:(value:Response)=>void;
    const fetch=vi.fn().mockReturnValue(new Promise<Response>(yes=>{resolve=yes;}));vi.stubGlobal('fetch',fetch);
    const running=loadOriginalRunner(data.id,opts);void running.catch(()=>{});await vi.waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
    opts.authorize.mockImplementation(()=>{throw new Error('Withdrawn');});resolve(new Response(data.raw));
    await expect(running).rejects.toThrow();expect(fetch).toHaveBeenCalledTimes(1);expect(imports.module).not.toHaveBeenCalled();
  });
  it('withdrawal after response arrival cancels the unread owned body',async()=>{
    const data=await artifact(),cancel=vi.fn(),opts=options();let resolve!:(value:Response)=>void;
    const stream=new ReadableStream<Uint8Array>({start(controller){controller.enqueue(data.raw);},cancel});
    const fetch=vi.fn().mockReturnValue(new Promise<Response>(yes=>{resolve=yes;}));vi.stubGlobal('fetch',fetch);
    const running=loadOriginalRunner(data.id,opts);void running.catch(()=>{});await vi.waitFor(()=>expect(fetch).toHaveBeenCalledTimes(1));
    opts.authorize.mockImplementation(()=>{throw new Error('Withdrawn');});resolve(new Response(stream));
    await expect(running).rejects.toThrow();expect(cancel).toHaveBeenCalledTimes(1);expect(imports.module).not.toHaveBeenCalled();
  });
  it('late import after abort releases its URL and rejects the stale runner',async()=>{
    const data=await artifact();vi.stubGlobal('fetch',responses(data));let resolve!:(value:unknown)=>void;
    imports.module.mockReturnValue(new Promise(yes=>{resolve=yes;}));const controller=new AbortController();
    const running=loadOriginalRunner(data.id,{...options(),signal:controller.signal});void running.catch(()=>{});await vi.waitFor(()=>expect(imports.module).toHaveBeenCalledTimes(1));
    controller.abort();resolve(module());await expect(running).rejects.toThrow();expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:owned-original');
  });
  it('rejects a mismatched compiled marker and releases the owned URL',async()=>{
    const data=await artifact();vi.stubGlobal('fetch',responses(data));imports.module.mockResolvedValue({...module(),compiledSource:{sourceCommit:'b'.repeat(40),sourceIndexSha256:ORIGINAL_INDEX_SHA256}});
    await expect(loadOriginalRunner(data.id,options())).rejects.toThrow();expect(URL.revokeObjectURL).toHaveBeenCalledTimes(1);
  });
});
