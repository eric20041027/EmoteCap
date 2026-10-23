import {afterEach,beforeEach,expect,it,vi} from 'vitest';
let values:Map<string,string>,write:ReturnType<typeof vi.fn>;
beforeEach(()=>{
  vi.resetModules();values=new Map();write=vi.fn((key:string,value:string)=>{values.set(key,value);});
  vi.stubGlobal('window',{localStorage:{getItem:(key:string)=>values.get(key)??null,setItem:write}});
});
afterEach(()=>vi.unstubAllGlobals());
it('reads legacy finger preferences as full-body without inventing new capture metadata',async()=>{
  values.set('emotecap.skeleton','body');const settings=await import('./skeleton');
  expect(settings.currentProfile()).toEqual({region:'full-body',skeleton:'body'});
});
it('persists the complete preset in one atomic preference write and restores it',async()=>{
  const settings=await import('./skeleton'),profile={region:'upper-body' as const,skeleton:'body' as const};
  settings.setCaptureProfile(profile);expect(write).toHaveBeenCalledTimes(1);
  vi.resetModules();expect((await import('./skeleton')).currentProfile()).toEqual(profile);
});
it('retains an in-memory choice when storage is blocked',async()=>{
  write.mockImplementation(()=>{throw new Error('Storage blocked');});const settings=await import('./skeleton');
  expect(()=>settings.setCaptureProfile({region:'upper-body',skeleton:'full'})).not.toThrow();
  expect(settings.currentProfile()).toEqual({region:'upper-body',skeleton:'full'});
});
