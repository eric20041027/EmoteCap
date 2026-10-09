import { useEffect, useState, useSyncExternalStore } from 'react';
import { openProjectStore } from '../project/store';
import { StudioSession } from './session';
const LAST_PROJECT_KEY='emotecap.studio.last-project';
export function useStudioSession() {
  const [session]=useState(()=>new StudioSession(openProjectStore,{
    read:()=>localStorage.getItem(LAST_PROJECT_KEY),write:id=>localStorage.setItem(LAST_PROJECT_KEY,id),
  }));
  const state=useSyncExternalStore(session.subscribe,session.getSnapshot,session.getSnapshot);
  useEffect(()=>{const detach=session.attach();void session.initialize();return detach;},[session]);
  return {session,state};
}
