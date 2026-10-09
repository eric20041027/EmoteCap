/** Stable UI state and serial polling; service work outlives the browser. */
import { JobFailure,jobAction,requestJobs,submitJob,type FetchFn,type JobStatus,type JobSubmission } from './api';
export interface JobsSnapshot {readonly jobs:readonly JobStatus[];readonly busy:boolean;readonly error:string|null;readonly loading:boolean}
export class ExportJobs {
  private state:JobsSnapshot=Object.freeze({jobs:[],busy:false,error:null,loading:false});
  private listeners=new Set<()=>void>();
  private active=false;private generation=0;private epoch=0;private mutation=false;
  private timer:ReturnType<typeof setTimeout>|undefined;private poll:Promise<void>|null=null;private abort:AbortController|null=null;
  constructor(private fetchFn:FetchFn=fetch){}
  getSnapshot=()=>this.state;
  subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>this.listeners.delete(fn);};
  private publish(patch:Partial<JobsSnapshot>){this.state=Object.freeze({...this.state,...patch});for(const fn of this.listeners)fn();}
  start(){if(this.active)return;this.active=true;this.generation++;this.publish({busy:this.mutation});void this.refresh().catch(()=>{});}
  stop(){this.active=false;this.generation++;if(this.timer)clearTimeout(this.timer);this.timer=undefined;this.abort?.abort();this.abort=null;this.poll=null;this.publish({busy:false,loading:false});}
  refresh():Promise<void>{
    if(this.poll)return this.poll;if(this.timer)clearTimeout(this.timer);
    const generation=this.generation,epoch=this.epoch,abort=new AbortController();this.abort=abort;this.publish({loading:true});
    const work=(async()=>{try{const jobs=await requestJobs(this.fetchFn,abort.signal);if(generation===this.generation&&epoch===this.epoch)this.publish({jobs,error:null});}
      catch(error){if(generation===this.generation)this.publish({error:error instanceof Error?error.message:String(error)});throw error;}
      finally{if(generation===this.generation){this.poll=null;this.abort=null;this.publish({loading:false});
        if(this.active)this.timer=setTimeout(()=>{void this.refresh().catch(()=>{});},1000);}}})();
    this.poll=work;return work;
  }
  private async action<T>(run:()=>Promise<T>,apply:(value:T)=>void):Promise<T>{
    if(this.mutation)throw new JobFailure('Another export action is in progress');
    this.mutation=true;this.epoch++;const generation=this.generation;this.publish({busy:true,error:null});
    try{const value=await run();if(generation===this.generation)apply(value);return value;}
    catch(error){if(generation===this.generation)this.publish({error:error instanceof Error?error.message:String(error)});throw error;}
    finally{this.epoch++;this.mutation=false;if(generation===this.generation||this.active)this.publish({busy:false});}
  }
  private upsert(job:JobStatus){this.publish({jobs:Object.freeze([job,...this.state.jobs.filter(old=>old.id!==job.id)].slice(0,128))});}
  submit(input:JobSubmission):Promise<JobStatus>{return this.action(()=>submitJob(input,this.fetchFn),job=>this.upsert(job));}
  cancel(id:string){return this.action(()=>jobAction(id,'cancel',this.fetchFn),job=>{if(job)this.upsert(job);});}
  retry(id:string){return this.action(()=>jobAction(id,'retry',this.fetchFn),job=>{if(job)this.upsert(job);});}
  delete(id:string){return this.action(()=>jobAction(id,'delete',this.fetchFn),()=>this.publish({jobs:Object.freeze(this.state.jobs.filter(job=>job.id!==id))}));}
}
