import { useEffect,useState,useSyncExternalStore } from 'react';
import type { StudioSession } from '../studio/session';
import { CloudSlice } from './controller';
export function useCloudSlice(session:StudioSession){
  const [controller]=useState(()=>new CloudSlice(session));
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  useEffect(()=>{controller.start();return()=>controller.stop();},[controller]);
  return {controller,state};
}
