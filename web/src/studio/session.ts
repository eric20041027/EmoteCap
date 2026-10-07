import type { ArchiveMediaSource } from '../project/archive/codec';
import { ProjectAutosave, type SaveStatus } from '../project/autosave';
import { createProject, recoverProject, setTakeMedia } from '../project/model';
import { openProjectStore, ProjectStorageError, type ProjectStore } from '../project/store';
import { MAX_MEDIA_BYTES, MAX_PROJECT_MEDIA_BYTES, type ProjectDocument, type ProjectSummary } from '../project/types';
import { parseMedia, parseProject, ProjectDataError } from '../project/validation';

export interface StudioSnapshot {
  readonly project:ProjectDocument;
  readonly summaries:readonly ProjectSummary[];
  readonly storage:'loading'|'ready'|'error';
  readonly save:SaveStatus;
  readonly busy:boolean;
  readonly error:string|null;
  readonly mediaRevision:number;
}
interface Selection {read():string|null;write(id:string):void}
const unavailable=()=>new ProjectStorageError('unavailable','Browser storage is unavailable. Keep this page open and download your work.');

/** Owns a single project's save lane and bounded, explicitly disposable source cache. */
export class StudioSession {
  private snapshot:StudioSnapshot=Object.freeze<StudioSnapshot>({project:createProject(),summaries:[],storage:'loading',
    save:{phase:'dirty',revision:0,savedRevision:null},busy:false,error:null,mediaRevision:0});
  private readonly listeners=new Set<()=>void>();
  private store:ProjectStore|null=null;
  private lane:ProjectAutosave|null=null;
  private sources=new Map<string,ArchiveMediaSource>();
  private initializing:Promise<void>|null=null;
  private edited=false;
  private disposed=false;
  private laneGeneration=0;
  private listGeneration=0;
  private mounts=0;

  constructor(private readonly openStore:()=>Promise<ProjectStore>=openProjectStore,private readonly selection?:Selection) {}
  readonly getSnapshot=():StudioSnapshot=>this.snapshot;
  readonly subscribe=(listener:()=>void):(()=>void)=>{this.listeners.add(listener);return ()=>this.listeners.delete(listener);};
  /** React effect replay releases/reacquires before this microtask, so it never destroys a live owner. */
  attach():()=>void {
    this.alive();this.mounts++;
    return ()=>{this.mounts--;queueMicrotask(()=>{if(this.mounts===0) this.dispose();});};
  }
  private alive():void {if(this.disposed) throw new ProjectDataError('Studio is closed.');}
  private publish(patch:Partial<StudioSnapshot>):void {
    if(this.disposed) return;
    this.snapshot=Object.freeze({...this.snapshot,...patch});this.listeners.forEach(listener=>listener());
  }
  reportError(error:unknown):void {this.publish({error:error instanceof Error?error.message:'Studio could not complete this action.'});}
  private remember(id:string):void {
    // This is a convenience preference. Project durability is confirmed by IndexedDB, not localStorage.
    try {this.selection?.write(id);} catch { /* Reopen through the project list if preferences are blocked. */ }
  }
  async initialize():Promise<void> {
    this.alive();if(this.store) return;if(this.initializing) return this.initializing;
    this.publish({storage:'loading',busy:true,error:null});
    this.initializing=this.connect().finally(()=>{this.initializing=null;if(!this.disposed) this.publish({busy:false});});
    return this.initializing;
  }
  private async connect():Promise<void> {
    let opened:ProjectStore|null=null;
    try {
      opened=await this.openStore();if(this.disposed) {opened.close();return;}
      const summaries=await opened.list();if(this.disposed) {opened.close();return;}
      let selected:string|null=null;try {selected=this.selection?.read()??null;} catch { /* Advisory preference only. */ }
      const id=summaries.find(s=>s.id===selected)?.id??summaries[0]?.id;
      const loaded=!this.edited && id?await opened.load(id):null;
      if(this.disposed) {opened.close();return;}
      this.store=opened;this.snapshot=Object.freeze({...this.snapshot,summaries});
      // Edits made while opening always win over an older saved document.
      if(!this.edited && loaded) this.context(recoverProject(loaded),loaded.revision);
      else this.context(this.snapshot.project,null,this.sources);
    } catch(error) {
      opened?.close();this.store=null;
      const failure=error instanceof Error?error:unavailable();
      this.publish({storage:'error',save:{phase:'error',revision:this.snapshot.project.revision,savedRevision:null,error:failure},error:failure.message});
    }
  }
  private context(project:ProjectDocument,savedRevision:number|null,sources:ReadonlyMap<string,ArchiveMediaSource>=new Map()):void {
    this.alive();
    this.lane?.dispose();this.lane=null;const generation=++this.laneGeneration;
    this.sources=new Map(sources);this.edited=savedRevision===null;
    this.snapshot=Object.freeze({...this.snapshot,project,error:null,mediaRevision:this.snapshot.mediaRevision+1});
    this.remember(project.id);
    if(!this.store) {
      const error=unavailable();
      this.publish({storage:'error',save:{phase:'error',revision:project.revision,savedRevision:null,error},error:error.message});return;
    }
    this.lane=new ProjectAutosave(this.store,project.id,savedRevision,status=>{
      if(generation!==this.laneGeneration || this.disposed) return;
      const previous=this.snapshot.save;
      const error=status.phase==='error'?status.error.message
        :previous.phase==='error' && this.snapshot.error===previous.error.message?null:this.snapshot.error;
      this.publish({save:status,error});
      if(status.phase==='saved') void this.refreshList();
    });
    this.snapshot=Object.freeze({...this.snapshot,storage:'ready',save:this.lane.getStatus()});
    if(savedRevision===null || project.revision>savedRevision) this.lane.stage(project,this.retainedSources(project));
    else this.publish({});
  }
  private async refreshList():Promise<void> {
    const store=this.store,generation=++this.listGeneration;if(!store) return;
    try {const summaries=await store.list();if(generation===this.listGeneration && store===this.store) this.publish({summaries});}
    catch(error) {if(generation===this.listGeneration && store===this.store) this.reportError(error);}
  }
  private retainedSources(project:ProjectDocument):ReadonlyMap<string,Blob> {
    return new Map(project.takes.flatMap(t=>t.media && this.sources.has(t.id)?[[t.id,this.sources.get(t.id)!.blob] as const]:[]));
  }
  /** Callers use the validated immutable domain mutations; external documents enter through install. */
  update(edit:(project:ProjectDocument)=>ProjectDocument):void {
    this.alive();if(this.snapshot.busy && this.snapshot.storage!=='loading') throw new ProjectDataError('Wait for the current Studio action to finish.');
    this.change(edit);
  }
  private change(edit:(project:ProjectDocument)=>ProjectDocument):void {
    const before=this.snapshot.project,project=edit(before);if(project===before) return;
    if(project.id!==before.id || project.revision<=before.revision) throw new ProjectDataError('An edit must advance the current project revision.');
    this.edited=true;
    this.sources=new Map([...this.sources].filter(([id])=>project.takes.some(t=>t.id===id)));
    this.snapshot=Object.freeze({...this.snapshot,project});
    if(this.lane) this.lane.stage(project,this.retainedSources(project));
    else {
      const error=unavailable();this.publish({save:{phase:'error',revision:project.revision,savedRevision:null,error},error:error.message});
    }
  }
  private validateSource(project:ProjectDocument,takeId:string,source:ArchiveMediaSource,sources:ReadonlyMap<string,ArchiveMediaSource>):void {
    const take=project.takes.find(t=>t.id===takeId);if(!take) throw new ProjectDataError('Source take does not exist.');
    if(!(source.blob instanceof Blob)) throw new ProjectDataError('Source video must be a Blob.');
    if(source.blob.size>MAX_MEDIA_BYTES) throw new ProjectDataError('Source video exceeds the 100 MiB take limit.');
    const descriptor=parseMedia({name:source.name,size:source.blob.size,type:source.blob.type})!;
    const total=project.takes.reduce((sum,t)=>sum+(t.id===takeId?descriptor.size:sources.get(t.id)?.blob.size??t.media?.size??0),0);
    if(total>MAX_PROJECT_MEDIA_BYTES) throw new ProjectDataError('Source videos exceed the 200 MiB project limit.');
    if(take.media && (take.media.name!==descriptor.name || take.media.size!==descriptor.size || take.media.type!==descriptor.type)) {
      throw new ProjectDataError('Source video does not match its retained description.');
    }
  }
  attachSource(takeId:string,source:ArchiveMediaSource):void {
    this.alive();if(this.snapshot.busy) throw new ProjectDataError('Wait for the current Studio action to finish.');
    this.validateSource(this.snapshot.project,takeId,source,this.sources);
    const previous=this.sources.get(takeId);
    if(previous) {
      if(previous.blob===source.blob && previous.name===source.name) return;
      throw new ProjectDataError('The original source video cannot be replaced.');
    }
    this.sources.set(takeId,Object.freeze({...source}));this.publish({mediaRevision:this.snapshot.mediaRevision+1});
  }
  async readSource(takeId:string):Promise<ArchiveMediaSource|null> {
    this.alive();const project=this.snapshot.project,take=project.takes.find(t=>t.id===takeId);
    if(!take) throw new ProjectDataError('Source take does not exist.');
    const source=this.sources.get(takeId);if(source) return source;
    if(!take.media) return null;
    if(!this.store) throw unavailable();
    const blob=await this.store.readMedia(project.id,takeId);
    this.alive();if(this.snapshot.project.id!==project.id || !this.snapshot.project.takes.some(t=>t.id===takeId)) {
      throw new ProjectDataError('The selected project changed while its source was loading.');
    }
    if(!blob) throw new ProjectDataError('Retained source video is missing. Download motion and retry opening storage.');
    const result={name:take.media.name,blob};this.validateSource(project,takeId,result,this.sources);return result;
  }
  hasVolatileSources():boolean {
    return [...this.sources.keys()].some(id=>this.snapshot.project.takes.some(t=>t.id===id && !t.media));
  }
  async keepSource(takeId:string,keep:boolean):Promise<void> {
    return this.perform(async()=>{
      const source=keep?await this.readSource(takeId):null;
      if(keep && !source) throw new ProjectDataError('No source video is available for this take.');
      if(source && !this.sources.has(takeId)) this.sources.set(takeId,Object.freeze(source));
      this.change(p=>setTakeMedia(p,takeId,source?{name:source.name,size:source.blob.size,type:source.blob.type}:null));
    });
  }
  async flush():Promise<void> {this.alive();if(!this.lane) throw unavailable();await this.lane.flush();}
  async retry():Promise<void> {
    this.alive();if(!this.store) await this.initialize();
    if(!this.lane) throw unavailable();await this.lane.retry();
  }
  private async leave(discardSources:boolean):Promise<void> {
    if(this.hasVolatileSources() && !discardSources) throw new ProjectDataError('Source video is only in memory. Keep it or download it before leaving, or explicitly discard it.');
    if(!this.store && this.snapshot.project.revision===0 && this.snapshot.project.takes.length===0) return;
    await this.flush();
  }
  private async perform(action:()=>Promise<void>):Promise<void> {
    this.alive();if(this.snapshot.busy) throw new ProjectDataError('Wait for the current Studio action to finish.');
    this.publish({busy:true,error:null});
    try {await action();} catch(error) {this.reportError(error);throw error;}
    finally {this.publish({busy:false});}
  }
  async create(discardSources=false):Promise<void> {
    return this.perform(async()=>{await this.leave(discardSources);this.context(createProject(),null);});
  }
  async open(id:string,discardSources=false):Promise<void> {
    if(id===this.snapshot.project.id) return;
    return this.perform(async()=>{
      await this.leave(discardSources);if(!this.store) throw unavailable();
      const project=await this.store.load(id);this.alive();if(!project) throw new ProjectDataError('Project does not exist.');
      this.context(recoverProject(project),project.revision);
    });
  }
  async install(project:ProjectDocument,media:ReadonlyMap<string,ArchiveMediaSource>,discardSources=false,signal?:AbortSignal):Promise<void> {
    signal?.throwIfAborted();
    const parsed=parseProject(project),sources=new Map(media);
    if(parsed.id===this.snapshot.project.id) throw new ProjectDataError('Import must use a different project identity.');
    if(parsed.takes.some(t=>t.media)) throw new ProjectDataError('Imported source video needs a separate retention choice.');
    for(const [id,source] of sources) this.validateSource(parsed,id,source,sources);
    return this.perform(async()=>{
      await this.leave(discardSources);signal?.throwIfAborted();
      if(this.store && await this.store.load(parsed.id)) throw new ProjectDataError('Imported project identity already exists.');
      this.alive();signal?.throwIfAborted();this.context(recoverProject(parsed),null,sources);
    });
  }
  async removeCurrent():Promise<void> {
    return this.perform(async()=>{
      await this.flush();if(!this.store) throw unavailable();
      const project=this.snapshot.project;await this.store.remove(project.id,project.revision);this.alive();
      this.context(createProject(),null);await this.refreshList();
    });
  }
  async reopenSaved(discardPending:boolean):Promise<void> {
    if(!discardPending) throw new ProjectDataError('Explicitly discard pending changes before reopening the saved copy.');
    return this.perform(async()=>{
      if(!this.store) throw unavailable();const project=await this.store.load(this.snapshot.project.id);this.alive();
      if(!project) throw new ProjectDataError('Saved project does not exist. Download this tab\'s work.');
      this.context(recoverProject(project),project.revision);
    });
  }
  dispose():void {
    if(this.disposed) return;this.disposed=true;this.laneGeneration++;this.listGeneration++;
    this.lane?.dispose();this.store?.close();this.listeners.clear();
  }
}
