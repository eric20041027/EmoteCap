import type { ProjectDocument } from './types';
import type { ProjectStore } from './store';
import { identity, integer, ProjectDataError } from './validation';

export type SaveStatus=
  | {readonly phase:'saved';readonly revision:number|null;readonly savedRevision:number|null}
  | {readonly phase:'dirty'|'saving';readonly revision:number;readonly savedRevision:number|null}
  | {readonly phase:'error';readonly revision:number;readonly savedRevision:number|null;readonly error:Error};

/** One project per lane. Failed work remains available until explicitly retried or downloaded. */
export class ProjectAutosave {
  private pending:ProjectDocument|null=null;
  private inFlight:ProjectDocument|null=null;
  private latest:ProjectDocument|null=null;
  private media=new Map<string,Blob>();
  private failure:Error|null=null;
  private running:Promise<void>|null=null;
  private timer:ReturnType<typeof setTimeout>|null=null;
  private disposed=false;
  private status:SaveStatus;

  constructor(private readonly store:Pick<ProjectStore,'save'>,private readonly projectId:string,
    private savedRevision:number|null,private readonly onStatus:(status:SaveStatus)=>void,private readonly delayMs=750) {
    identity(projectId,'Autosave project ID');
    if(savedRevision!==null) integer(savedRevision,'Saved revision');
    integer(delayMs,'Autosave delay',60000);
    this.status=Object.freeze({phase:'saved',revision:savedRevision,savedRevision});
  }
  getPending():ProjectDocument|null {return this.pending ?? this.inFlight;}
  getStatus():SaveStatus {return this.status;}

  stage(project:ProjectDocument,supplied:ReadonlyMap<string,Blob>=new Map()):void {
    if(this.disposed) throw new ProjectDataError('Autosave is closed.');
    if(project.id!==this.projectId) throw new ProjectDataError('This autosave lane belongs to another project.');
    if(this.latest===project && supplied.size===0) return;
    const previousRevision=this.latest?.revision ?? this.savedRevision ?? -1;
    integer(project.revision,'Project revision');
    if(project.revision<previousRevision || (project.revision===previousRevision && this.latest!==project)
      || (this.savedRevision!==null && project.revision<=this.savedRevision)) {
      throw new ProjectDataError('Project revision must advance; an older or different snapshot cannot reuse a revision.');
    }
    const selected=new Map(project.takes.filter(t=>t.media!==null).map(t=>[t.id,t.media!]));
    const videos=new Map(this.media);
    for(const [id,video] of supplied) {
      const descriptor=selected.get(id);
      if(!descriptor || !(video instanceof Blob) || descriptor.size!==video.size || descriptor.type!==video.type) {
        throw new ProjectDataError('Pending source media must match a retained take.');
      }
      videos.set(id,video);
    }
    this.media=new Map([...videos].filter(([id,video])=>{
      const descriptor=selected.get(id);return descriptor?.size===video.size && descriptor.type===video.type;
    }));
    this.latest=project;
    if(this.inFlight!==project) this.pending=project;
    if(this.failure) this.publish({phase:'error',revision:project.revision,savedRevision:this.savedRevision,error:this.failure});
    else if(this.running || this.inFlight) this.publish({phase:'saving',revision:project.revision,savedRevision:this.savedRevision});
    else {this.publish({phase:'dirty',revision:project.revision,savedRevision:this.savedRevision});this.armTimer();}
  }

  async flush():Promise<void> {
    if(this.disposed) throw new ProjectDataError('Autosave is closed.');
    this.cancelTimer();
    if(this.failure) throw this.failure;
    while(this.pending || this.running) {
      this.cancelTimer();
      if(!this.running) {
        // Start after assigning running, so notification callbacks cannot open a second lane.
        this.running=Promise.resolve().then(()=>this.drain()).finally(()=>{
          this.running=null;
          if(this.pending && !this.failure && !this.disposed) {
            this.publish({phase:'dirty',revision:this.pending.revision,savedRevision:this.savedRevision});this.armTimer();
          }
        });
      }
      await this.running;
      if(this.disposed) return; // The current atomic save finished; newer pending work is still retained.
    }
  }
  async retry():Promise<void> {
    if(this.disposed) throw new ProjectDataError('Autosave is closed.');
    this.failure=null;
    await this.flush();
  }
  dispose():void {this.disposed=true;this.cancelTimer();}

  private publish(status:SaveStatus):void {
    this.status=Object.freeze(status);
    if(!this.disposed) this.onStatus(this.status);
  }
  private cancelTimer():void {
    if(this.timer!==null) {clearTimeout(this.timer);this.timer=null;}
  }
  private armTimer():void {
    this.cancelTimer();
    this.timer=setTimeout(()=>{
      this.timer=null;
      // Background errors are reported through status/getPending; explicit flush/retry still reject.
      void this.flush().catch(()=>{});
    },this.delayMs);
  }
  private async drain():Promise<void> {
    while(this.pending && !this.disposed) {
      const snapshot=this.pending, videos=new Map(this.media);
      this.pending=null;this.inFlight=snapshot;
      try {
        this.publish({phase:'saving',revision:this.latest!.revision,savedRevision:this.savedRevision});
        await this.store.save(snapshot,this.savedRevision,videos);
        this.savedRevision=snapshot.revision;this.inFlight=null;
      } catch(error) {
        this.failure=error instanceof Error?error:new Error('Autosave failed.',{cause:error});
        this.pending ??= snapshot;this.inFlight=null;
        this.publish({phase:'error',revision:this.pending.revision,savedRevision:this.savedRevision,error:this.failure});
        throw this.failure;
      }
    }
    if(this.pending) this.publish({phase:'dirty',revision:this.pending.revision,savedRevision:this.savedRevision});
    else {
      this.media.clear();
      this.publish({phase:'saved',revision:this.savedRevision,savedRevision:this.savedRevision});
    }
  }
}
