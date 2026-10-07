import { useEffect,useMemo,useSyncExternalStore } from 'react';
import { ExportJobs } from './controller';
export function useExportJobs(){
  const controller=useMemo(()=>new ExportJobs(),[]);
  const state=useSyncExternalStore(controller.subscribe,controller.getSnapshot);
  useEffect(()=>{controller.start();return()=>controller.stop();},[controller]);
  return {controller,state};
}
