import { expect, it, vi } from 'vitest';
import assets from '../../scripts/mediapipe-assets.json';
import { checkModels } from './diagnostics';
it('checks only local HEAD metadata and reports all selected model files',async()=>{
  const request=vi.fn<typeof fetch>(async()=>new Response(null,{headers:{'content-length':'2000000','content-type':'application/octet-stream'}}));
  const result=await checkModels(request);
  expect(result.map(r=>r.file)).toEqual(assets.map(a=>a.file));expect(result.every(r=>r.available)).toBe(true);
  expect(request.mock.calls.map(call=>call[0])).toEqual(assets.map(a=>`/models/${a.file}`));
  expect(request.mock.calls.every(call=>call[1]?.method==='HEAD')).toBe(true);
});
it('rejects missing, empty and HTML fallback responses as unavailable models',async()=>{
  let n=0;const request=vi.fn<typeof fetch>(async()=>[++n===1?new Response(null,{status:404}):n===2?new Response(null,{headers:{'content-length':'0','content-type':'application/octet-stream'}}):new Response(null,{headers:{'content-length':'2000','content-type':'text/html'}})][0]);
  const result=await checkModels(request);expect(result).toHaveLength(3);expect(result.every(r=>!r.available)).toBe(true);
});
it('a cancelled check does not start requests or contact a camera/provider',async()=>{
  const controller=new AbortController();controller.abort();const request=vi.fn<typeof fetch>(async()=>new Response());
  await expect(checkModels(request,controller.signal)).rejects.toThrow();expect(request).not.toHaveBeenCalled();
});
