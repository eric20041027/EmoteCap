export interface VideoFrameSource {
  readyState:number;currentTime:number;
  requestVideoFrameCallback?:(callback:VideoFrameRequestCallback)=>number;
  cancelVideoFrameCallback?:(handle:number)=>void;
}

/** Own the callbacks for one capture loop; a media clock is never a frame identity. */
export function startVideoFrameLoop(video:VideoFrameSource,onFrame:(inputTimeS:number,inputFrame:number|null)=>void):()=>void {
  let stopped=false,handle:number|null=null,lastTime=-1,lastInputFrame:number|null=null;
  if(typeof video.requestVideoFrameCallback==='function'&&typeof video.cancelVideoFrameCallback==='function'){
    const request=video.requestVideoFrameCallback.bind(video),cancel=video.cancelVideoFrameCallback.bind(video);
    const tick:VideoFrameRequestCallback=(_now,metadata)=>{
      if(stopped)return;
      handle=request(tick);
      if(video.readyState<2)return;
      const value=metadata.presentedFrames;
      const inputFrame=Number.isSafeInteger(value)&&value>=0?value:null;
      if(inputFrame!==null&&inputFrame===lastInputFrame)return;
      lastInputFrame=inputFrame;onFrame(video.currentTime,inputFrame);
    };
    handle=request(tick);
    return()=>{if(stopped)return;stopped=true;if(handle!==null)cancel(handle);};
  }
  const tick=()=>{
    if(stopped)return;
    handle=requestAnimationFrame(tick);
    if(video.readyState<2||video.currentTime===lastTime)return;
    lastTime=video.currentTime;onFrame(lastTime,null);
  };
  handle=requestAnimationFrame(tick);
  return()=>{if(stopped)return;stopped=true;if(handle!==null)cancelAnimationFrame(handle);};
}
