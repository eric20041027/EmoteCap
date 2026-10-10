import {afterEach,describe,expect,it,vi} from 'vitest';
import {startVideoFrameLoop} from './videoFrameLoop';

afterEach(()=>vi.unstubAllGlobals());
function rafQueue(){
  let next=1;const queue=new Map<number,FrameRequestCallback>();
  const cancel=vi.fn((id:number)=>queue.delete(id));
  vi.stubGlobal('requestAnimationFrame',(fn:FrameRequestCallback)=>{const id=next++;queue.set(id,fn);return id;});
  vi.stubGlobal('cancelAnimationFrame',cancel);
  return {queue,cancel,emit:()=>{const [id,fn]=queue.entries().next().value!;queue.delete(id);fn(1000);}};
}
function nativeVideo(){
  let next=1;const queue=new Map<number,VideoFrameRequestCallback>();
  const video={readyState:2,currentTime:0,
    requestVideoFrameCallback:(fn:VideoFrameRequestCallback)=>{const id=next++;queue.set(id,fn);return id;},
    cancelVideoFrameCallback:vi.fn((id:number)=>queue.delete(id))};
  const metadata=(id:number):VideoFrameCallbackMetadata=>({presentedFrames:id,mediaTime:video.currentTime,
    presentationTime:1000,expectedDisplayTime:1016,width:1280,height:720,processingDuration:.01});
  return {video,queue,metadata,emit:(id:number)=>{
    const entry=queue.entries().next().value;if(!entry)return;
    const [handle,fn]=entry;queue.delete(handle);video.currentTime+=.1;fn(1000,metadata(id));
  }};
}
describe('owned video-frame loop',()=>{
  it('keeps fallback tracking without inventing an input identity',()=>{
    const raf=rafQueue(),video={readyState:2,currentTime:0},seen:{time:number;id:number|null}[]=[];
    const stop=startVideoFrameLoop(video,(time,id)=>seen.push({time,id}));
    raf.emit();raf.emit();video.currentTime=.1;raf.emit();
    expect(seen).toEqual([{time:0,id:null},{time:.1,id:null}]);
    const late=raf.queue.values().next().value!;stop();stop();late(1000);
    expect(raf.queue.size).toBe(0);expect(seen).toHaveLength(2);expect(raf.cancel).toHaveBeenCalledTimes(1);
  });
  it('uses native input identities, deduplicates repeats and exposes counter resets',()=>{
    const raf=rafQueue(),source=nativeVideo(),seen:(number|null)[]=[];
    const stop=startVideoFrameLoop(source.video,(_time,id)=>seen.push(id));
    source.emit(8);source.emit(8);source.emit(9);source.emit(7);
    expect(seen).toEqual([8,9,7]);expect(raf.queue.size).toBe(0);
    const late=source.queue.values().next().value!;stop();stop();late(1000,source.metadata(10));
    expect(source.queue.size).toBe(0);expect(seen).toEqual([8,9,7]);
    expect(source.video.cancelVideoFrameCallback).toHaveBeenCalledTimes(1);
  });
  it.each([-1,.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1])('withholds malformed native identity %s',id=>{
    rafQueue();const source=nativeVideo(),seen:(number|null)[]=[];
    const stop=startVideoFrameLoop(source.video,(_time,input)=>seen.push(input));source.emit(id);
    expect(seen).toEqual([null]);stop();
  });
  it('skips a not-ready native frame and still accepts the first ready frame',()=>{
    rafQueue();const source=nativeVideo(),seen:(number|null)[]=[];
    source.video.readyState=1;const stop=startVideoFrameLoop(source.video,(_time,id)=>seen.push(id));
    source.emit(1);expect(seen).toEqual([]);source.video.readyState=2;source.emit(1);
    expect(seen).toEqual([1]);stop();
  });
  it('cancels the scheduled native successor when the handler stops synchronously',()=>{
    rafQueue();const source=nativeVideo(),seen:(number|null)[]=[];
    const stop=startVideoFrameLoop(source.video,(_time,id)=>{seen.push(id);stop();});source.emit(1);
    expect(source.queue.size).toBe(0);source.emit(2);expect(seen).toEqual([1]);
  });
  it('falls back without a complete native cancellation pair and skips not-ready input',()=>{
    const raf=rafQueue(),source=nativeVideo(),seen:(number|null)[]=[];
    const video={readyState:1,currentTime:0,requestVideoFrameCallback:source.video.requestVideoFrameCallback};
    const stop=startVideoFrameLoop(video,(_time,id)=>seen.push(id));raf.emit();expect(seen).toEqual([]);
    video.readyState=2;raf.emit();expect(seen).toEqual([null]);expect(source.queue.size).toBe(0);stop();
  });
});
