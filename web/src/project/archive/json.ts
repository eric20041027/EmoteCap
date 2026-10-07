import { ProjectArchiveError, checkSize } from './limits';
import { abortable } from './operation';

/** Bound object construction before JSON.parse; every allowed schema1 shape fits these structural caps. */
async function preflight(text:string,signal:AbortSignal):Promise<void> {
  const stack:{object:boolean;fields:number}[]=[];
  let quoted=false,escaped=false,stringLength=0,values=0;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) {
      if(++stringLength>4096) throw new ProjectArchiveError('limit','Project metadata contains an oversized string.');
      if(escaped) escaped=false;
      else if(c==='\\') escaped=true;
      else if(c==='"') quoted=false;
    } else if(c==='"') {quoted=true;stringLength=0;}
    else if(c==='{' || c==='[') {
      stack.push({object:c==='{',fields:0});values++;
      if(stack.length>8) throw new ProjectArchiveError('limit','Project metadata is too deeply nested.');
    } else if(c==='}' || c===']') {
      const previous=stack.pop();
      if(!previous || previous.object!==(c==='}')) throw new ProjectArchiveError('invalid','Project metadata has invalid JSON structure.');
    } else if(c===':') {
      const object=stack.at(-1);
      if(object?.object && ++object.fields>16) throw new ProjectArchiveError('limit','Project metadata contains too many object fields.');
    } else if(c===',') values++;
    if(values>10000000) throw new ProjectArchiveError('limit','Project metadata contains too many values.');
    if(i>0 && i%1048576===0) {
      await new Promise<void>(resolve=>setTimeout(resolve,0));signal.throwIfAborted();
    }
  }
  if(quoted || stack.length) throw new ProjectArchiveError('invalid','Project metadata has incomplete JSON structure.');
  signal.throwIfAborted();
}
export async function parseArchiveJSON(blob:Blob,cap:number,signal:AbortSignal):Promise<unknown> {
  checkSize(blob.size,cap,'Project metadata');
  let text:string;
  try {text=new TextDecoder('utf-8',{fatal:true}).decode(await abortable(blob.arrayBuffer(),signal));}
  catch(error) {
    if(signal.aborted) throw signal.reason;
    throw new ProjectArchiveError('invalid','Project metadata must use valid UTF-8.',error);
  }
  await preflight(text,signal);
  try {return JSON.parse(text) as unknown;}
  catch(error) {throw new ProjectArchiveError('invalid','Project metadata must be valid JSON.',error);}
}
