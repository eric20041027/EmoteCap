/** Build only pinned pure motion/import source; never execute the old app or SDK factory. */
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {BASELINE_INDEX,prepareBaseline} from './baseline-snapshot.mjs';

export class OriginalRunnerError extends Error {}
const MAX_BUNDLE=512*1024,MAX_MANIFEST=16*1024,PREFIX='/__emotecap_frozen__/';
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=()=>{throw new OriginalRunnerError('Original runner incomplete; source and artifacts retained.');};
function stat(target){try{return fs.lstatSync(target);}catch(error){if(error.code==='ENOENT')return null;throw error;}}
function parents(target){let current=path.resolve(target);for(;;){const info=stat(current);
  if(!info||info.isSymbolicLink()||!info.isDirectory())fail();const parent=path.dirname(current);if(parent===current)break;current=parent;}}
function read(target,limit){
  parents(path.dirname(target));const info=stat(target);
  if(!info||info.isSymbolicLink()||!info.isFile()||info.nlink!==1||info.size>limit)fail();
  const descriptor=fs.openSync(target,'r');
  try{
    const actual=fs.fstatSync(descriptor);if(!actual.isFile()||actual.nlink!==1||actual.ino!==info.ino||actual.dev!==info.dev)fail();
    const buffer=Buffer.alloc(limit+1);let used=0;
    while(used<buffer.length){const count=fs.readSync(descriptor,buffer,used,buffer.length-used,null);if(!count)break;used+=count;}
    if(used>limit)fail();return buffer.subarray(0,used);
  }finally{fs.closeSync(descriptor);}
}
function verifyArtifact(directory,manifestBytes,bundle){
  parents(directory);if(JSON.stringify(fs.readdirSync(directory).sort())!==JSON.stringify(['manifest.json','original.bin']))fail();
  if(!read(path.join(directory,'manifest.json'),MAX_MANIFEST).equals(manifestBytes)||
    !read(path.join(directory,'original.bin'),MAX_BUNDLE).equals(bundle))fail();
}
function runtimePath(relative){return relative==='contracts/bones.json'||/^web\/src\/(motion|import)\/[A-Za-z]+\.ts$/.test(relative);}

export async function buildOriginalRunner(repository,value=BASELINE_INDEX){
  try{
    const index=structuredClone(value),snapshot=prepareBaseline(repository,index),root=path.resolve(repository);
    const sources=new Map();
    for(const file of index.files){
      const raw=read(path.join(snapshot.directory,file.path),2*1024*1024);
      if(raw.length!==file.bytes||hash(raw)!==file.sha256)fail();
      if(runtimePath(file.path))sources.set(file.path,raw.toString('utf8'));
    }
    const compiledSource={sourceCommit:index.sourceCommit,sourceIndexSha256:snapshot.receipt.indexSha256};
    const entry=`export {ImportError,NO_PERSON_MESSAGE,convertVideo} from '${PREFIX}web/src/import/convertVideo.ts';
      export {createPoseSolver} from '${PREFIX}web/src/motion/index.ts';
      export const compiledSource=${JSON.stringify(compiledSource)};`;
    const entryId=PREFIX+'entry.ts',consumed=new Set();
    const plugin={name:'verified-original-memory',enforce:'pre',
      resolveId(source,importer){
        source=source.replace(/\\/g,'/').replace(/^[A-Za-z]:/,'');
        if(source===entryId)return entryId;
        let relative;
        if(source.startsWith(PREFIX))relative=source.slice(PREFIX.length);
        else if(importer?.startsWith(PREFIX)&&source.startsWith('.'))relative=path.posix.normalize(path.posix.join(path.posix.dirname(importer.slice(PREFIX.length)),source));
        else throw new OriginalRunnerError(`Unapproved runtime resolution ${JSON.stringify({source,importer})}`);
        const resolved=[relative,relative+'.ts',relative+'.json'].find(candidate=>sources.has(candidate));
        if(!resolved)fail();return PREFIX+resolved;
      },
      load(id){if(id===entryId)return entry;if(!id.startsWith(PREFIX))fail();const relative=id.slice(PREFIX.length);
        if(!sources.has(relative))fail();consumed.add(relative);return sources.get(relative);},
    };
    const lock=read(fileURLToPath(new URL('../package-lock.json',import.meta.url)),2*1024*1024);
    const vitePackage=JSON.parse(read(fileURLToPath(new URL('../node_modules/vite/package.json',import.meta.url)),65536).toString());
    if(JSON.parse(lock.toString()).packages['node_modules/vite'].version!==vitePackage.version)fail();
    const {build}=await import('vite');
    const result=await build({root:path.join(root,'web'),configFile:false,envDir:false,publicDir:false,logLevel:'silent',plugins:[plugin],
      define:{'import.meta.env':'{}','process.env':'{}'},
      build:{write:false,emptyOutDir:false,copyPublicDir:false,minify:false,sourcemap:false,
        lib:{entry:entryId,formats:['es'],fileName:'original'},rolldownOptions:{output:{codeSplitting:false}}}});
    const outputs=Array.isArray(result)?result:[result];
    if(outputs.length!==1||!outputs[0].output||outputs[0].output.length!==1)fail();const chunk=outputs[0].output[0];
    const expected=['ImportError','NO_PERSON_MESSAGE','compiledSource','convertVideo','createPoseSolver'];
    if(chunk.type!=='chunk'||chunk.imports.length||chunk.dynamicImports.length||
      JSON.stringify([...chunk.exports].sort())!==JSON.stringify(expected.sort()))fail();
    const bundle=Buffer.from(chunk.code);if(!bundle.length||bundle.length>MAX_BUNDLE)fail();
    const manifest={schema:'emotecap-original-runner-v1',...compiledSource,consumedSources:[...consumed].sort(),
      bundleSha256:hash(bundle),bundleBytes:bundle.length,builderSha256:hash(read(fileURLToPath(import.meta.url),2*1024*1024)),
      compilerLockSha256:hash(lock),viteVersion:vitePackage.version,nodeVersion:process.version,qualification:'compiled-source'};
    const manifestBytes=Buffer.from(JSON.stringify(manifest));if(manifestBytes.length>MAX_MANIFEST)fail();
    const buildId=hash(manifestBytes),parent=path.join(root,'web','.measurement-baseline','runners'),directory=path.join(parent,buildId);
    parents(path.dirname(parent));if(stat(parent))parents(parent);
    if(stat(directory)){verifyArtifact(directory,manifestBytes,bundle);return{buildId,directory,manifest,reused:true};}
    if(!stat(parent))fs.mkdirSync(parent);parents(parent);fs.mkdirSync(directory);parents(directory);
    fs.writeFileSync(path.join(directory,'original.bin'),bundle,{flag:'wx'});
    if(!read(path.join(directory,'original.bin'),MAX_BUNDLE).equals(bundle))fail();
    fs.writeFileSync(path.join(directory,'manifest.json'),manifestBytes,{flag:'wx'});verifyArtifact(directory,manifestBytes,bundle);
    return{buildId,directory,manifest,reused:false};
  }catch(error){if(error instanceof OriginalRunnerError)throw error;
    throw new OriginalRunnerError('Original runner incomplete; source and artifacts retained.',{cause:error});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{if(process.argv.length!==2)fail();const result=await buildOriginalRunner(fileURLToPath(new URL('../..',import.meta.url)));
    process.stdout.write(JSON.stringify({status:result.reused?'runner-verified':'runner-built',...result})+'\n');}
  catch{process.stderr.write('Original runner incomplete; source and artifacts retained.\n');process.exitCode=2;}
}
