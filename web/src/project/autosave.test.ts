import { afterEach, expect, it, vi } from 'vitest';
import { IDBFactory, IDBObjectStore as FakeObjectStore } from 'fake-indexeddb';
import { ProjectAutosave, type SaveStatus } from './autosave';
import { renameProject, setTakeMedia } from './model';
import { openProjectStore, ProjectStorageError, type ProjectStore } from './store';
import { readyProject } from './testData';

afterEach(()=>{vi.useRealTimers();vi.restoreAllMocks();});
function deferred() {
  let resolve!:()=>void,reject!:(error:unknown)=>void;
  const promise=new Promise<void>((ok,no)=>{resolve=ok;reject=no;});
  return {promise,resolve,reject};
}

it('flushes the staged project into actual browser storage',async()=>{
  const store=await openProjectStore({factory:new IDBFactory(),name:'autosave'}), project=readyProject();
  const lane=new ProjectAutosave(store,project.id,null,()=>{});
  try {
    lane.stage(project);await lane.flush();
    expect(await store.load(project.id)).toEqual(project);
    expect(lane.getStatus()).toMatchObject({phase:'saved',revision:project.revision,savedRevision:project.revision});
    expect(lane.getPending()).toBeNull();
  } finally {lane.dispose();store.close();}
});

it('coalesces edits before the debounce expires',async()=>{
  vi.useFakeTimers();
  const save=vi.fn<ProjectStore['save']>().mockResolvedValue(undefined), project=readyProject();
  const lane=new ProjectAutosave({save},project.id,null,()=>{});
  const second=renameProject(project,'Second'), third=renameProject(second,'Third');
  lane.stage(project);lane.stage(second);lane.stage(third);
  await vi.advanceTimersByTimeAsync(749);expect(save).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);expect(save).toHaveBeenCalledTimes(1);
  expect(save.mock.calls[0][0]).toBe(third);expect(save.mock.calls[0][1]).toBeNull();
  expect(lane.getStatus()).toMatchObject({phase:'saved',revision:third.revision});lane.dispose();
});

it('flush also saves work staged by the completion notification',async()=>{
  const save=vi.fn<ProjectStore['save']>().mockResolvedValue(undefined), project=readyProject(), next=renameProject(project,'Next');
  const lane=new ProjectAutosave({save},project.id,null,s=>{if(s.phase==='saved' && s.revision===project.revision) lane.stage(next);});
  lane.stage(project);await lane.flush();
  expect(save).toHaveBeenCalledTimes(2);
  expect(lane.getStatus()).toMatchObject({phase:'saved',revision:next.revision});lane.dispose();
});

it('never labels an earlier completion Saved while a newer edit is pending',async()=>{
  const first=deferred(), second=deferred(), states:SaveStatus[]=[];
  const save=vi.fn<ProjectStore['save']>().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
  const project=readyProject(), next=renameProject(project,'Next');
  const lane=new ProjectAutosave({save},project.id,null,s=>states.push(s));
  lane.stage(project);const done=lane.flush();await Promise.resolve();
  lane.stage(next);expect(lane.getPending()).toBe(next);
  first.resolve();await Promise.resolve();await Promise.resolve();
  expect(save).toHaveBeenCalledTimes(2);expect(save.mock.calls[1][1]).toBe(project.revision);
  expect(states.some(s=>s.phase==='saved')).toBe(false);
  second.resolve();await done;
  expect(lane.getStatus()).toMatchObject({phase:'saved',revision:next.revision,savedRevision:next.revision});lane.dispose();
});

it('preserves latest work and chosen media after failure and retries only on request',async()=>{
  vi.useFakeTimers();const failure=new ProjectStorageError('quota','Disk full');
  const save=vi.fn<ProjectStore['save']>().mockRejectedValueOnce(failure).mockResolvedValue(undefined);
  const original=readyProject(), takeId=original.takes[0].id, video=new Blob(['source'],{type:'video/webm'});
  const project=setTakeMedia(original,takeId,{name:'source.webm',type:video.type,size:video.size});
  const lane=new ProjectAutosave({save},project.id,null,()=>{});
  lane.stage(project,new Map([[takeId,video]]));await expect(lane.flush()).rejects.toBe(failure);
  const next=renameProject(project,'Recovered edit');lane.stage(next);
  await vi.advanceTimersByTimeAsync(10000);expect(save).toHaveBeenCalledTimes(1);
  expect(lane.getStatus()).toMatchObject({phase:'error',revision:next.revision,savedRevision:null,error:failure});
  expect(lane.getPending()).toBe(next);
  await lane.retry();expect(save.mock.calls[1][0]).toBe(next);
  expect(save.mock.calls[1][2]?.get(takeId)).toBe(video);
  expect(lane.getPending()).toBeNull();lane.dispose();
});

it('shows background failure through status with no unhandled rejection or retry loop',async()=>{
  vi.useFakeTimers();const failure=new ProjectStorageError('quota','Disk full');
  const save=vi.fn<ProjectStore['save']>().mockRejectedValue(failure), project=readyProject();
  const lane=new ProjectAutosave({save},project.id,null,()=>{});
  lane.stage(project);await vi.advanceTimersByTimeAsync(750);
  expect(lane.getStatus()).toMatchObject({phase:'error',error:failure});
  expect(lane.getPending()).toBe(project);
  await vi.advanceTimersByTimeAsync(10000);expect(save).toHaveBeenCalledTimes(1);lane.dispose();
});

it('does not retain pending video after its retention choice is removed',async()=>{
  const first=deferred(), save=vi.fn<ProjectStore['save']>().mockReturnValueOnce(first.promise).mockResolvedValue(undefined);
  const original=readyProject(), takeId=original.takes[0].id, video=new Blob(['source'],{type:'video/webm'});
  const project=setTakeMedia(original,takeId,{name:'source.webm',type:video.type,size:video.size});
  const lane=new ProjectAutosave({save},project.id,null,()=>{});
  lane.stage(project,new Map([[takeId,video]]));const done=lane.flush();await Promise.resolve();
  lane.stage(setTakeMedia(project,takeId,null));first.resolve();await done;
  expect(save.mock.calls[1][2]?.size).toBe(0);lane.dispose();
});

it('rejects another project, older edits and different content reusing one revision',()=>{
  const save=vi.fn<ProjectStore['save']>(), project=readyProject(), next=renameProject(project,'Next');
  const lane=new ProjectAutosave({save},project.id,null,()=>{});
  lane.stage(next);
  expect(()=>lane.stage(readyProject())).toThrow(/project/i);
  expect(()=>lane.stage(project)).toThrow(/revision/i);
  expect(()=>lane.stage({...next,name:'Lost revision'})).toThrow(/revision/i);
  expect(lane.getPending()).toBe(next);lane.dispose();
});

it('dispose cancels an unstarted debounce while preserving the downloadable snapshot',async()=>{
  vi.useFakeTimers();const save=vi.fn<ProjectStore['save']>(), project=readyProject();
  const lane=new ProjectAutosave({save},project.id,null,()=>{});
  lane.stage(project);lane.dispose();await vi.advanceTimersByTimeAsync(1000);
  expect(save).not.toHaveBeenCalled();expect(lane.getPending()).toBe(project);
  expect(()=>lane.stage(project)).toThrow(/closed/i);
});

it('dispose lets the current transaction finish but does not start a newer queued save',async()=>{
  const first=deferred(), save=vi.fn<ProjectStore['save']>().mockReturnValueOnce(first.promise), status=vi.fn();
  const project=readyProject(), next=renameProject(project,'Next'), lane=new ProjectAutosave({save},project.id,null,status);
  lane.stage(project);const done=lane.flush();await Promise.resolve();lane.stage(next);lane.dispose();
  const delivered=status.mock.calls.length;first.resolve();await done;
  expect(save).toHaveBeenCalledTimes(1);expect(status).toHaveBeenCalledTimes(delivered);
  expect(lane.getPending()).toBe(next);expect(lane.getStatus()).toMatchObject({phase:'dirty',savedRevision:project.revision});
});

it('can retry real atomic storage after a quota abort without losing the source',async()=>{
  const store=await openProjectStore({factory:new IDBFactory(),name:'quota-retry'}), original=readyProject();
  const video=new Blob(['source'],{type:'video/webm'}), takeId=original.takes[0].id;
  const project=setTakeMedia(original,takeId,{name:'source.webm',type:video.type,size:video.size});
  const lane=new ProjectAutosave(store,project.id,null,()=>{}), originalPut=FakeObjectStore.prototype.put;
  const fault=vi.spyOn(FakeObjectStore.prototype,'put').mockImplementation(function(this:IDBObjectStore,value:unknown,key?:IDBValidKey){
    if(this.name==='summaries') throw new DOMException('Disk full','QuotaExceededError');
    return originalPut.call(this,value,key);
  });
  try {
    lane.stage(project,new Map([[takeId,video]]));await expect(lane.flush()).rejects.toMatchObject({reason:'quota'});
    expect(await store.load(project.id)).toBeNull();fault.mockRestore();
    const next=renameProject(project,'After retry');lane.stage(next);await lane.retry();
    expect(await store.load(project.id)).toEqual(next);
    expect(await (await store.readMedia(project.id,takeId))?.text()).toBe('source');
  } finally {fault.mockRestore();lane.dispose();store.close();}
});
