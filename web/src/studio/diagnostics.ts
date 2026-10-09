import assets from '../../scripts/mediapipe-assets.json';
export interface ModelAvailability {file:string;available:boolean;message:string}
export async function checkModels(request:typeof fetch=fetch,signal?:AbortSignal):Promise<ModelAvailability[]> {
  signal?.throwIfAborted();const controller=new AbortController(),forward=()=>controller.abort();
  signal?.addEventListener('abort',forward,{once:true});const timer=setTimeout(forward,10000);
  try {return await Promise.all(assets.map(async asset=>{
    try {
      const response=await request(`/models/${asset.file}`,{method:'HEAD',cache:'no-store',signal:controller.signal});
      controller.signal.throwIfAborted();
      const bytes=Number(response.headers.get('content-length')),type=response.headers.get('content-type')?.split(';')[0];
      const available=response.ok && Number.isSafeInteger(bytes) && bytes>1024 && type==='application/octet-stream';
      return {file:asset.file,available,message:available?'Available':'Model file is missing or incomplete.'};
    } catch(error) {controller.signal.throwIfAborted();return {file:asset.file,available:false,message:error instanceof Error?'Model file could not be reached.':'Model check failed.'};}
  }));} finally {clearTimeout(timer);signal?.removeEventListener('abort',forward);}
}
