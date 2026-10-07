/** Source preparation only: never run historical app, install dependencies or fetch assets. */
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const MAX_FILE=2*1024*1024,MAX_TOTAL=8*1024*1024;
export const BASELINE_INDEX=JSON.parse(fs.readFileSync(new URL('./baseline-sources.json',import.meta.url),'utf8'));
export class BaselineError extends Error {}
const fail=()=>{throw new BaselineError('Baseline source incomplete; prior files remain unchanged.');};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const hex=(value,length)=>typeof value==='string'&&new RegExp(`^[0-9a-f]{${length}}$`).test(value);
function fields(value,keys){return value&&typeof value==='object'&&!Array.isArray(value)&&
  [Object.prototype,null].includes(Object.getPrototypeOf(value))&&Object.keys(value).length===keys.length&&
  keys.every(key=>Object.hasOwn(value,key));}
function safePath(value){
  if(typeof value!=='string'||value.length>240||!/^(web|contracts)\/[A-Za-z0-9_./-]+$/.test(value))return false;
  const parts=value.split('/');
  return parts.length<=16&&parts.every(part=>part&&part!=='.'&&part!=='..'&&!part.endsWith('.')&&
    !/^(con|prn|aux|nul|com[0-9]|lpt[0-9]|conin\$|conout\$)(\.|$)/i.test(part));
}
function validateIndex(value){
  const index=structuredClone(value);
  if(!fields(index,['schema','sourceCommit','files'])||index.schema!=='emotecap-baseline-index-v1'||
    !hex(index.sourceCommit,40)||!Array.isArray(index.files)||index.files.length<1||index.files.length>64)fail();
  let total=0,previous='';const seen=new Set(),components=new Map();
  for(const file of index.files){
    if(!fields(file,['path','blob','bytes','sha256'])||!safePath(file.path)||!hex(file.blob,40)||!hex(file.sha256,64)||
      !Number.isSafeInteger(file.bytes)||file.bytes<0||file.bytes>MAX_FILE||file.path<=previous)fail();
    previous=file.path;total+=file.bytes;if(total>MAX_TOTAL)fail();
    const lower=file.path.toLowerCase();if(seen.has(lower))fail();seen.add(lower);
    const parts=file.path.split('/');
    for(let n=1;n<=parts.length;n++){
      const item=parts.slice(0,n).join('/'),key=item.toLowerCase();
      if(components.has(key)&&components.get(key)!==item)fail();components.set(key,item);
    }
  }
  return index;
}
function stat(target){try{return fs.lstatSync(target);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
function parents(target){
  const paths=[];let current=path.resolve(target);
  for(;;){paths.unshift(current);const parent=path.dirname(current);if(parent===current)break;current=parent;}
  for(const item of paths){const info=stat(item);if(!info||info.isSymbolicLink()||!info.isDirectory())fail();}
}
function regular(target){
  parents(path.dirname(target));const info=stat(target);
  if(!info||info.isSymbolicLink()||!info.isFile()||info.nlink!==1)fail();return info;
}
function readBounded(target,limit){
  const before=regular(target);if(before.size>limit)fail();
  const descriptor=fs.openSync(target,'r');
  try{
    const actual=fs.fstatSync(descriptor);if(!actual.isFile()||actual.nlink!==1||actual.dev!==before.dev||actual.ino!==before.ino)fail();
    const buffer=Buffer.alloc(limit+1);let used=0;
    while(used<buffer.length){const count=fs.readSync(descriptor,buffer,used,buffer.length-used,null);if(!count)break;used+=count;}
    if(used>limit)fail();return buffer.subarray(0,used);
  }finally{fs.closeSync(descriptor);}
}
function git(repository,args,maxBuffer=MAX_FILE+1){
  try{return execFileSync('git',['--no-replace-objects',...args],{cwd:repository,timeout:10000,maxBuffer,
    env:{...process.env,GIT_NO_REPLACE_OBJECTS:'1',GIT_OPTIONAL_LOCKS:'0'},stdio:['ignore','pipe','pipe']});}
  catch{fail();}
}
function context(repository,value){
  const index=validateIndex(value),root=path.resolve(repository);parents(root);parents(path.join(root,'web'));
  const actual=path.resolve(git(root,['rev-parse','--show-toplevel'],4096).toString().trim());
  if(actual!==root)fail();
  const parent=path.join(root,'web','.measurement-baseline'),directory=path.join(parent,index.sourceCommit);
  if(path.relative(root,directory).startsWith('..')||path.isAbsolute(path.relative(root,directory)))fail();
  if(stat(parent))parents(parent);
  const canonical={schema:index.schema,sourceCommit:index.sourceCommit,files:index.files.map(file=>({
    path:file.path,blob:file.blob,bytes:file.bytes,sha256:file.sha256,
  }))};
  const receipt={schema:'emotecap-baseline-source-v1',sourceCommit:index.sourceCommit,
    indexSha256:digest(JSON.stringify(canonical)),fileCount:index.files.length,
    sourceBytes:index.files.reduce((sum,file)=>sum+file.bytes,0),qualification:'source-only'};
  return{root,parent,directory,index,receipt};
}
function inventory(directory,index,withReceipt){
  parents(directory);const expected=new Set(index.files.map(file=>file.path));if(withReceipt)expected.add('snapshot.json');
  const expectedDirs=new Set(['']);for(const relative of expected){const parts=relative.split('/');
    for(let n=1;n<parts.length;n++)expectedDirs.add(parts.slice(0,n).join('/'));}
  const actual=new Set();let entries=0;
  const visit=(relative)=>{
    const target=path.join(directory,relative);parents(target);
    for(const name of fs.readdirSync(target)){
      if(++entries>1024)fail();const child=relative?`${relative}/${name}`:name,item=path.join(directory,child),info=stat(item);
      if(!info||info.isSymbolicLink())fail();
      if(info.isDirectory()){if(!expectedDirs.has(child))fail();visit(child);}
      else{if(!expected.has(child))fail();regular(item);actual.add(child);}
    }
  };
  visit('');if(actual.size!==expected.size)fail();
  for(const file of index.files){const bytes=readBounded(path.join(directory,file.path),MAX_FILE);
    if(bytes.length!==file.bytes||digest(bytes)!==file.sha256)fail();}
}
const receiptBytes=receipt=>Buffer.from(JSON.stringify(receipt,null,2)+'\n');
function verify(context){
  const {directory,index,receipt}=context;inventory(directory,index,true);
  if(!readBounded(path.join(directory,'snapshot.json'),4096).equals(receiptBytes(receipt)))fail();
  return{directory,receipt,reused:true};
}
function guarded(operation){try{return operation();}catch(error){if(error instanceof BaselineError)throw error;fail();}}
export function verifyBaseline(repository,index=BASELINE_INDEX){return guarded(()=>verify(context(repository,index)));}
export function prepareBaseline(repository,value=BASELINE_INDEX){return guarded(()=>{
  const owned=context(repository,value);if(stat(owned.directory))return verify(owned);
  const {root,parent,directory,index,receipt}=owned;
  if(git(root,['rev-parse','--verify',`${index.sourceCommit}^{commit}`],4096).toString().trim()!==index.sourceCommit)fail();
  const sources=index.files.map(file=>{
    const entry=git(root,['ls-tree','-z',index.sourceCommit,'--',file.path],4096).toString();
    if(entry!==`100644 blob ${file.blob}\t${file.path}\0`)fail();
    const bytes=git(root,['cat-file','blob',file.blob]);if(bytes.length!==file.bytes||digest(bytes)!==file.sha256)fail();
    return{file,bytes};
  });
  if(!stat(parent))fs.mkdirSync(parent);parents(parent);fs.mkdirSync(directory);parents(directory);
  for(const {file,bytes} of sources){
    const parts=file.path.split('/');let current=directory;
    for(const part of parts.slice(0,-1)){current=path.join(current,part);if(!stat(current))fs.mkdirSync(current);parents(current);}
    fs.writeFileSync(path.join(directory,file.path),bytes,{flag:'wx'});
  }
  inventory(directory,index,false);fs.writeFileSync(path.join(directory,'snapshot.json'),receiptBytes(receipt),{flag:'wx'});
  return{...verify(owned),reused:false};
});}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{
    if(process.argv.length!==2)fail();
    const result=prepareBaseline(fileURLToPath(new URL('../..',import.meta.url)));
    process.stdout.write(JSON.stringify({status:result.reused?'source-verified':'source-prepared',...result})+'\n');
  }catch{process.stderr.write('Baseline source incomplete; prior files retained. No runtime executed.\n');process.exitCode=2;}
}
