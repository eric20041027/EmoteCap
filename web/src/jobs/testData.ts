export const ID='a91b8760-4e75-4e11-b237-7f9eb79dd455';
export const NEXT='604e37e2-814a-40f8-9c0a-6dc702c73dbb';
export function submission(){return {clips:[{name:'Wave',fps:30,loop:false,frames:[{t:0,h:[0,1,0] as [number,number,number],r:Array.from({length:192},(_,i)=>i%4===3?1:0)}]}],snapshot:{projectId:ID,takeId:NEXT,clipRevision:7}};}
export function job(patch:Record<string,unknown>={}){return {id:ID,schemaVersion:1,state:'queued',phase:'Waiting for Blender',progress:0,snapshot:submission().snapshot,
  inputSha256:'a'.repeat(64),createdAt:1,updatedAt:2,retryOf:null,cancelRequested:false,files:[],error:null,warning:null,...patch};}
