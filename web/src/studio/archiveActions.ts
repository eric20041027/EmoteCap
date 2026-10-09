import type { StudioSession } from './session';
type DownloadSink=(blob:Blob,name:string)=>void|Promise<void>;
function browserDownload(blob:Blob,name:string):void {
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  try {link.href=url;link.download=name;link.hidden=true;document.body.append(link);link.click();}
  finally {link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
export async function downloadProject(session:StudioSession,includeMedia:boolean,signal?:AbortSignal,save:DownloadSink=browserDownload):Promise<void> {
  const project=session.getSnapshot().project;
  const {encodeProject}=await import('../project/archive/codec');
  const archive=await encodeProject(project,{includeMedia,signal,readMedia:async takeId=>{
    if(session.getSnapshot().project.id!==project.id) throw new Error('Project changed while preparing its backup.');
    const source=await session.readSource(takeId);
    if(session.getSnapshot().project.id!==project.id) throw new Error('Project changed while preparing its backup.');
    return source;
  }});
  signal?.throwIfAborted();
  const safeName=project.name.replace(/[<>:"/\\|?*\u0000-\u001f]/g,'_').replace(/[. ]+$/,'').slice(0,100)||'Project';
  await save(archive,`EmoteCap-${safeName}.emotecap`);
}
export async function importProject(session:StudioSession,blob:Blob,discardSources:boolean,signal?:AbortSignal):Promise<void> {
  const {decodeProject}=await import('../project/archive/codec');
  const decoded=await decodeProject(blob,{signal});signal?.throwIfAborted();
  await session.install(decoded.project,decoded.media,discardSources,signal);
}
