import { ProjectDataError } from '../validation';
import { ProjectArchiveError } from './limits';

export function abortable<T>(promise:Promise<T>,signal:AbortSignal):Promise<T> {
  if(signal.aborted) {
    // A loader may have cancelled synchronously; observe its now-abandoned rejection as well.
    void promise.catch(()=>{});
    return Promise.reject(signal.reason);
  }
  return new Promise((resolve,reject)=>{
    const abort=()=>reject(signal.reason);
    signal.addEventListener('abort',abort,{once:true});
    promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',abort));
  });
}
export async function archiveOperation<T>(caller:AbortSignal|undefined,work:(signal:AbortSignal)=>Promise<T>):Promise<T> {
  const controller=new AbortController();
  const cancel=()=>controller.abort(new ProjectArchiveError('cancelled','Project file operation was cancelled.'));
  caller?.addEventListener('abort',cancel,{once:true});if(caller?.aborted) cancel();
  const timer=setTimeout(()=>controller.abort(new ProjectArchiveError('cancelled','Project file operation timed out. Try a smaller project.')),30000);
  try {
    controller.signal.throwIfAborted();
    const result=await abortable(work(controller.signal),controller.signal);
    controller.signal.throwIfAborted();return result;
  } catch(error) {
    if(controller.signal.aborted) throw controller.signal.reason;
    if(error instanceof ProjectArchiveError) throw error;
    if(error instanceof ProjectDataError) throw new ProjectArchiveError('invalid',error.message,error);
    throw new ProjectArchiveError('corrupt','The project file is corrupt or unsupported.',error);
  } finally {clearTimeout(timer);caller?.removeEventListener('abort',cancel);}
}
