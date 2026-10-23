import type {CaptureProfile} from './skeleton';
import {activeDrivenBones} from '../motion/captureProfile';
const profiles=[
  {value:'full',region:'full-body',skeleton:'full',label:'Full body + fingers'},
  {value:'body',region:'full-body',skeleton:'body',label:'Full body'},
  {value:'upper-full',region:'upper-body',skeleton:'full',label:'Upper body + fingers'},
  {value:'upper-body',region:'upper-body',skeleton:'body',label:'Upper body'},
] as const;
export function SkeletonSelect({value,onChange}:{value:CaptureProfile;onChange:(profile:CaptureProfile)=>void}) {
  const selected=profiles.find(p=>p.region===value.region&&p.skeleton===value.skeleton)!;
  return <label className="camera-select" title="Choose the capture region and finger detail. Upper body keeps a fixed pelvis; export uses a complete Humanoid rig.">
    <select aria-label="Skeleton" value={selected.value} onChange={event=>{
      const next=profiles.find(p=>p.value===event.target.value);if(next)onChange({region:next.region,skeleton:next.skeleton});
    }}>
      {profiles.map(p=><option key={p.value} value={p.value}>{p.label} · {activeDrivenBones(p.region,p.skeleton==='full').length} driven / {p.skeleton==='full'?52:22} rig bones</option>)}
    </select>
  </label>;
}
