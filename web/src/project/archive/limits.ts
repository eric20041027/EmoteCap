export class ProjectArchiveError extends Error {
  constructor(readonly kind:'invalid'|'corrupt'|'limit'|'cancelled'|'missing-media'|'unsupported',message:string,cause?:unknown) {
    super(message,{cause});this.name='ProjectArchiveError';
  }
}
export interface ArchiveLimits {
  fileBytes:number;jsonBytes:number;manifestBytes:number;decodedBytes:number;entries:number;readBytes:number;
}
export const HARD_LIMITS:Readonly<ArchiveLimits>=Object.freeze({fileBytes:512*1024*1024,jsonBytes:256*1024*1024,
  manifestBytes:64*1024,decodedBytes:512*1024*1024,entries:22,readBytes:128*1024});
export const INPUT_CHUNK=64*1024;
export function archiveLimits(overrides:Partial<ArchiveLimits>={}):Readonly<ArchiveLimits> {
  if(Object.keys(overrides).some(k=>!Object.hasOwn(HARD_LIMITS,k))) throw new ProjectArchiveError('invalid','Unknown archive limit.');
  const limits={...HARD_LIMITS,...overrides};
  for(const key of Object.keys(HARD_LIMITS) as (keyof ArchiveLimits)[]) {
    if(!Number.isSafeInteger(limits[key]) || limits[key]<1 || limits[key]>HARD_LIMITS[key]) {
      throw new ProjectArchiveError('limit','Archive limits must be positive integers and cannot exceed the hard limits.');
    }
  }
  return Object.freeze(limits);
}
export function checkSize(size:number,cap:number,label:string):void {
  if(!Number.isSafeInteger(size) || size<0 || size>cap) throw new ProjectArchiveError('limit',`${label} exceeds its size limit.`);
}
