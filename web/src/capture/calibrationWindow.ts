import type {HandLandmarks,PoseLandmark} from '../motion/index';
import {LANDMARK_COUNT,LM} from '../motion/landmarks';
import {isTPose} from '../import/tpose';
import {upperBodyLandmarks,type CaptureRegion} from '../motion/captureProfile';

interface Observation {world?:PoseLandmark[];image?:readonly PoseLandmark[];hands?:HandLandmarks;aspect:number;arrivedMs:number}
interface Sample {world:PoseLandmark[];hands:HandLandmarks;arrivedMs:number}
type Decision={ok:true;sample:Sample}|{ok:false;reason:string};
const REQUIRED=Object.values(LM);
const finite=(p:PoseLandmark)=>[p.x,p.y,p.z,p.visibility??1].every(Number.isFinite);
const copy=(points:PoseLandmark[])=>points.map(p=>({...p}));

/** Bounded consecutive observations; timestamps are host arrival time, not reusable video time. */
export class CalibrationWindow {
  constructor(private readonly region:CaptureRegion='full-body'){}
  private samples:Sample[]=[];
  private lastArrival:number|null=null;
  private reason='No fresh pose detected. Step into frame and try again.';
  get sampleCount(){return this.samples.length;}
  reset(){this.samples=[];this.lastArrival=null;this.reason='No fresh pose detected. Step into frame and try again.';}
  private reject(reason:string){this.samples=[];this.reason=reason;}
  observe(input:Observation) {
    const {image,arrivedMs,aspect}=input;
    const world=input.world?.length===LANDMARK_COUNT&&this.region==='upper-body'?upperBodyLandmarks(input.world):input.world;
    const required=REQUIRED.filter(i=>this.region==='full-body'||i<LM.leftHip);
    if(!Number.isFinite(arrivedMs)||(this.lastArrival!==null&&arrivedMs<=this.lastArrival)) {
      this.reject('Hold the T-pose while fresh camera frames arrive.');return;
    }
    if(this.lastArrival!==null&&arrivedMs-this.lastArrival>150)this.samples=[];
    this.lastArrival=arrivedMs;
    if(!world||world.length!==LANDMARK_COUNT||!world.every(finite)||required.some(i=>(world[i].visibility??1)<0.5)) {
      this.reject('Keep the required joints clearly visible; calibration confidence is too low.');return;
    }
    if(!Number.isFinite(aspect)||aspect<=0||!image||!image.filter((_,i)=>this.region==='full-body'||i<LM.leftHip).every(finite)||!isTPose(image,aspect,this.region)) {
      this.reject('Face the camera with both arms straight out in a T-pose.');return;
    }
    this.reason='Hold the T-pose steadily for a moment, then try again.';
    const first=this.samples[0];
    if(first&&required.some(i=>Math.hypot(world[i].x-first.world[i].x,world[i].y-first.world[i].y,world[i].z-first.world[i].z)>0.035)) {
      this.samples=[];this.reason='Hold still: the calibration pose was moving.';
    }
    const hands:HandLandmarks={};
    for(const side of ['Left','Right'] as const) {
      const points=input.hands?.[side];if(points?.length===21&&points.every(finite))hands[side]=copy(points);
    }
    this.samples.push({world:copy(world),hands,arrivedMs});
    while(this.samples.length>60||this.samples.length>1&&arrivedMs-this.samples[0].arrivedMs>1000)this.samples.shift();
  }
  read(nowMs:number):Decision {
    if(!Number.isFinite(nowMs)||this.lastArrival!==null&&(nowMs<this.lastArrival||nowMs-this.lastArrival>200))
      return {ok:false,reason:'The pose is stale. Keep the camera moving and try calibration again.'};
    if(this.samples.length<8||this.samples.at(-1)!.arrivedMs-this.samples[0].arrivedMs<350)
      return {ok:false,reason:this.reason};
    return {ok:true,sample:this.samples[Math.floor(this.samples.length/2)]};
  }
}
