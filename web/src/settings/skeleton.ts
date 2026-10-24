import {useSyncExternalStore} from 'react';
import type {CaptureRegion} from '../motion/captureProfile';
export type SkeletonMode='full'|'body';
export interface CaptureProfile {region:CaptureRegion;skeleton:SkeletonMode}
const listeners=new Set<()=>void>();
function readSaved():CaptureProfile {
  try {
    const saved=JSON.parse(window.localStorage.getItem('emotecap.capture-profile')??'null') as Partial<CaptureProfile>|null;
    if(saved&&['full-body','upper-body'].includes(saved.region??'')&&['full','body'].includes(saved.skeleton??''))return {region:saved.region!,skeleton:saved.skeleton!};
    return {region:'full-body',skeleton:window.localStorage.getItem('emotecap.skeleton')==='body'?'body':'full'};
  }
  catch{return {region:'full-body',skeleton:'full'};}
}
let current=readSaved();
export const currentProfile=():CaptureProfile=>current;
export const currentSkeleton=():SkeletonMode=>current.skeleton;
export function setCaptureProfile(profile:CaptureProfile):void {
  current={...profile};
  try {window.localStorage.setItem('emotecap.capture-profile',JSON.stringify(current));}
  catch {/* Storage blocked: this page retains the choice. */}
  listeners.forEach(listener=>listener());
}
export function setSkeleton(skeleton:SkeletonMode):void {setCaptureProfile({...current,skeleton});}
function subscribe(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener);};}
export function useSkeleton():SkeletonMode{return useSyncExternalStore(subscribe,currentSkeleton);}
export function useCaptureProfile():CaptureProfile{return useSyncExternalStore(subscribe,currentProfile);}
