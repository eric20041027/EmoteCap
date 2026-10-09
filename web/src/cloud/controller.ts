/** Frozen suggestions are distinct from applying them to a matching Studio revision. */
import type { StudioSession } from '../studio/session';
import { CloudFailure,sendVideo,type CloudSource,type CloudOptions,type CloudReply,type CloudCleanup } from './api';
import { refineSegments,type Segment } from '../motion/index';
import { replaceClips } from '../project/model';
interface Target {projectId:string;takeId:string;clipRevision:number}
export interface CloudSnapshot {readonly consent:boolean;readonly result:CloudReply|null;readonly busy:boolean;readonly error:string|null;
  readonly cleanup:CloudCleanup|null;readonly message:string|null;readonly available:boolean;readonly sourceName:string|null;readonly sourceBytes:number;
  readonly target:Target|null;readonly needsReplace:boolean}
export class CloudSlice {
  private state:CloudSnapshot=Object.freeze({consent:false,result:null,busy:false,error:null,cleanup:null,message:null,available:false,sourceName:null,sourceBytes:0,target:null,needsReplace:false});
  private listeners=new Set<()=>void>();private detach:(()=>void)|null=null;private selection='';private mediaRevision=-1;private probe=0;private generation=0;
  private operation:{id:number;abort:AbortController;sent:boolean}|null=null;
  constructor(private session:StudioSession,private sendRequest:(source:CloudSource,allowed:boolean,options:CloudOptions)=>Promise<CloudReply>=sendVideo){}
  getSnapshot=()=>this.state;subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
  private publish(patch:Partial<CloudSnapshot>){this.state=Object.freeze({...this.state,...patch});for(const fn of this.listeners)fn();}
  reportError(error:unknown){this.publish({error:error instanceof Error?error.message:'Cloud action could not finish'});}
  start(){if(this.detach)return;this.selection='';this.mediaRevision=-1;this.detach=this.session.subscribe(()=>this.changed());this.changed();}
  stop(){this.detach?.();this.detach=null;this.probe++;this.cancel();}
  private changed(){
    const snapshot=this.session.getSnapshot(),take=snapshot.project.takes.find(t=>t.id===snapshot.project.activeTakeId),selection=`${snapshot.project.id}:${take?.id??''}`;
    const changed=selection!==this.selection;this.selection=selection;
    const target=this.state.target,needsReplace=!!target&&target.projectId===snapshot.project.id&&target.takeId===take?.id&&target.clipRevision!==take.clipRevision;
    if(changed)this.publish({consent:false,available:false,sourceName:null,sourceBytes:0});
    if(needsReplace!==this.state.needsReplace)this.publish({needsReplace});
    if(changed||snapshot.mediaRevision!==this.mediaRevision){this.mediaRevision=snapshot.mediaRevision;const probe=++this.probe;
      if(take)void this.session.readSource(take.id).then(source=>{if(probe===this.probe)this.publish({available:!!source,sourceName:source?.name??null,sourceBytes:source?.blob.size??0});},error=>{
        if(probe===this.probe)this.publish({available:false,error:error instanceof Error?error.message:'Source could not be loaded'});});}
  }
  setConsent(value:boolean){this.publish({consent:value===true});}
  async send():Promise<void>{
    if(this.state.busy)throw new CloudFailure('A selected video is already being sent');
    if(!this.state.consent)throw new CloudFailure('Confirm permission before sending the selected video');
    const p=this.session.getSnapshot().project,take=p.takes.find(t=>t.id===p.activeTakeId);
    if(!take||!take.frames.length)throw new CloudFailure('Choose a take with captured motion');
    const target={projectId:p.id,takeId:take.id,clipRevision:take.clipRevision},operation={id:++this.generation,abort:new AbortController(),sent:false};this.operation=operation;
    this.publish({busy:true,consent:false,error:null,message:'Preparing the selected video…',result:null,cleanup:null,target,needsReplace:false});
    try{
      const source=await this.session.readSource(take.id);if(!source)throw new CloudFailure('Source video is not available. Find pauses still works locally.');
      if(operation.id!==this.generation)return;
      const current=this.session.getSnapshot().project;if(current.id!==target.projectId)throw new CloudFailure('The selected project changed before sending');
      const result=await this.sendRequest({takeId:take.id,video:source.blob,duration:take.frames.at(-1)!.t},true,{signal:operation.abort.signal,onSending:()=>{
        operation.sent=true;if(operation.id===this.generation)this.publish({message:'Sending the selected video to Gemini…'});}});
      if(operation.id!==this.generation)return;
      const segments:Segment[]=refineSegments(result.segments,take.frames);if(!segments.length)throw new CloudFailure('No usable suggestions. Use local Find pauses.',result.cleanup);
      this.publish({result:{...result,segments},cleanup:result.cleanup,message:'Review suggestions before applying them.'});this.changed();
    }catch(error){if(operation.id===this.generation)this.publish({error:error instanceof Error?error.message:String(error),cleanup:error instanceof CloudFailure?error.cleanup:null,message:null});}
    finally{if(operation.id===this.generation){this.operation=null;this.publish({busy:false});}}
  }
  cancel(){const operation=this.operation;if(!operation)return;this.generation++;operation.abort.abort(new DOMException('Stopped waiting','AbortError'));this.operation=null;
    this.publish({busy:false,result:null,consent:false,message:operation.sent?'Stopped waiting. Already sent video may still finish processing and cleanup on the server.':'Stopped before sending the video.'});}
  apply(replace=false){
    const result=this.state.result,target=this.state.target;if(!result||!target)throw new CloudFailure('No suggestions to apply');
    const p=this.session.getSnapshot().project,take=p.takes.find(t=>t.id===p.activeTakeId);
    if(p.id!==target.projectId||take?.id!==target.takeId)throw new CloudFailure('Return to the original project and take before applying these suggestions');
    if(take.clipRevision!==target.clipRevision&&!replace)throw new CloudFailure('Clips changed during processing. Confirm replacement or keep your edits.');
    this.session.update(project=>replaceClips(project,take.id,result.segments.map(segment=>({...segment,id:crypto.randomUUID()}))));
    this.publish({result:null,target:null,needsReplace:false,message:'Suggested clips applied. Undo clip edit restores the previous clips.'});
  }
}
