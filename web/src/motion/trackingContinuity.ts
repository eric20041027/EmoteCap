import {BODY_BONE_COUNT,DRIVEN_BONES,SKELETON,type DrivenBone,type Quat} from './contract';
import {IDENTITY,quatConjugate,quatMultiply,quatSlerp} from './math';
import type {Rotations} from './solver';
const byName=new Map(SKELETON.map(b=>[b.name,b]));
const parents=Object.fromEntries(DRIVEN_BONES.map(bone=>{
  let parent=byName.get(bone)?.parent??null;
  while(parent&&!DRIVEN_BONES.includes(parent as DrivenBone))parent=byName.get(parent)?.parent??null;
  return [bone,parent];
})) as Record<DrivenBone,DrivenBone|null>;
/** Hidden bones hold a local pose briefly, then follow their current parent instead of freezing in world space. */
export class TrackingContinuity {
  private relative:Partial<Rotations>={};
  private seen:Partial<Record<DrivenBone,number>>={};
  private time:number|null=null;
  apply(raw:Rotations,tracked:Partial<Record<DrivenBone,boolean>>,t:number):Rotations {
    const out={...raw},dt=this.time===null?0:Math.max(0,t-this.time);this.time=t;
    for(const bone of DRIVEN_BONES.slice(0,BODY_BONE_COUNT)) {
      const parent=parents[bone],parentDelta=parent?out[parent]:IDENTITY;
      if(tracked[bone])this.seen[bone]=t;
      else {
        const missing=t-(this.seen[bone]??Number.NEGATIVE_INFINITY);
        const relative=this.relative[bone]??IDENTITY;
        const relaxTime=Math.min(dt,Math.max(0,missing-0.4));
        const amount=1-Math.exp(-relaxTime/0.25);
        out[bone]=quatMultiply(parentDelta,quatSlerp(relative,IDENTITY,amount));
      }
      this.relative[bone]=quatMultiply(quatConjugate(parentDelta),out[bone]);
    }
    // Finger policy already holds/relaxes its own local curl; carry it with a fallback hand.
    for(const side of ['Left','Right'] as const)if(!tracked[`${side}Hand`]) {
      const change=quatMultiply(out[`${side}Hand`],quatConjugate(raw[`${side}Hand`]));
      for(const bone of DRIVEN_BONES.slice(BODY_BONE_COUNT))if(bone.startsWith(side))out[bone]=quatMultiply(change,raw[bone]);
    }
    return out;
  }
}
