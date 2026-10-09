import { useEffect, useState, type RefObject } from 'react';
import { tposeFrame, type Clip, type MotionFrame } from '../motion/index';
import type { ProjectTake } from '../project/types';
import { usePlayback } from '../record/usePlayback';
import { projectClip } from './clips';

type SourceIdentity={takeId:string;originalFrames:readonly MotionFrame[]};
type ReviewRequest=(SourceIdentity&{kind:'original'})|
  (SourceIdentity&{kind:'clip';clipRevision:number;clip:Clip});

/** Derive only on an explicit Play action; discard requests when their source changes. */
export function useReviewPlayback(take:ProjectTake,frameRef:RefObject<MotionFrame|null>) {
  const [request,setRequest]=useState<ReviewRequest|null>(null);
  const current=request?.takeId===take.id&&request.originalFrames===take.frames&&
    (request.kind==='original'||request.clipRevision===take.clipRevision)?request:null;
  const frames=current?.kind==='clip'?current.clip.frames:take.frames;
  const {play,stop,seek}=usePlayback(frames,frameRef);

  useEffect(()=>{
    if(current?.kind==='clip') {
      seek(0);play(0,current.clip.frames.at(-1)?.t??0,current.clip.loop);
    } else if(current?.kind==='original'&&take.frames.length) {
      seek(take.frames[0].t);play(take.frames[0].t,take.frames.at(-1)!.t,false);
    } else if(take.frames.length) seek(take.frames[0].t);
    else {stop();frameRef.current=tposeFrame();}
  },[current,play,seek,stop,take.frames,frameRef]);

  useEffect(()=>{if(request&&!current) setRequest(null);},[request,current]);

  return {
    stop,
    playClip:(clipId:string)=>{
      const clip=projectClip(take,clipId);
      setRequest({kind:'clip',takeId:take.id,originalFrames:take.frames,clipRevision:take.clipRevision,clip});
    },
    playOriginal:()=>{
      if(take.frames.length) setRequest({kind:'original',takeId:take.id,originalFrames:take.frames});
    },
    sourceLabel:current?.kind==='clip'?`Export clip preview: ${current.clip.name}`:'Original take preview',
  };
}
