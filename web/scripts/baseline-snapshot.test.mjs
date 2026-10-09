import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {test,mock} from 'node:test';
import {BASELINE_INDEX,BaselineError,prepareBaseline,verifyBaseline} from './baseline-snapshot.mjs';

const root=fileURLToPath(new URL('../../.superpowers/sdd/2026-10-07-baseline-source/fixtures/',import.meta.url));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function git(repository,...args){return execFileSync('git',args,{cwd:repository,timeout:10000,maxBuffer:4*1024*1024});}
function commit(repository){git(repository,'-c','user.name=Source fixture','-c','user.email=source@example.invalid',
  '-c','commit.gpgSign=false','commit','--quiet','-m','Owned baseline fixture');return git(repository,'rev-parse','HEAD').toString().trim();}
function fixture(large=false){
  const repository=path.join(root,randomUUID());fs.mkdirSync(path.join(repository,'web'),{recursive:true});
  git(repository,'init','--quiet');
  const files=[['contracts/bones.json',Buffer.from('{"owned":true}\n')],
    ['web/src/source.ts',large?Buffer.alloc(3*1024*1024,65):Buffer.from('export const owned=1;\n')]];
  for(const [relative,bytes] of files){const target=path.join(repository,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,bytes,{flag:'wx'});}
  git(repository,'add','--',...files.map(([relative])=>relative));const sourceCommit=commit(repository);
  const index={schema:'emotecap-baseline-index-v1',sourceCommit,files:files.map(([relative,bytes])=>({
    path:relative,blob:git(repository,'rev-parse',`${sourceCommit}:${relative}`).toString().trim(),bytes:bytes.length,sha256:hash(bytes),
  })).sort((a,b)=>a.path.localeCompare(b.path))};
  const directory=path.join(repository,'web','.measurement-baseline',sourceCommit);
  return{repository,index,directory,files};
}
function rejected(input){assert.throws(()=>prepareBaseline(input.repository,input.index),BaselineError);assert.equal(fs.existsSync(input.directory),false);}

test('committed original index pins nineteen bounded source files, not media/model binaries',()=>{
  assert.equal(BASELINE_INDEX.sourceCommit,'713d349df05aa26b6b95a1b7974f7f3d8e574149');assert.equal(BASELINE_INDEX.files.length,19);
  assert.ok(BASELINE_INDEX.files.every(file=>file.bytes<=2*1024*1024&&/\.(ts|mjs|json)$/.test(file.path)));
  assert.ok(BASELINE_INDEX.files.some(file=>file.path==='web/scripts/fetch-mediapipe.mjs'));
});
test('writes exact Git bytes despite changed checkout and completes receipt last',()=>{
  const input=fixture();fs.writeFileSync(path.join(input.repository,'web/src/source.ts'),'changed working copy');
  const output=prepareBaseline(input.repository,input.index);assert.equal(output.reused,false);
  for(const [relative,bytes] of input.files)assert.deepEqual(fs.readFileSync(path.join(output.directory,relative)),bytes);
  assert.equal(output.receipt.qualification,'source-only');assert.equal(output.receipt.fileCount,2);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(output.directory,'snapshot.json'),'utf8')),output.receipt);
});
test('exact repeated prepare and explicit verification reuse without changing files',()=>{
  const input=fixture(),first=prepareBaseline(input.repository,input.index);
  const receipt=fs.readFileSync(path.join(first.directory,'snapshot.json')),mtime=fs.statSync(path.join(first.directory,'snapshot.json')).mtimeMs;
  assert.equal(prepareBaseline(input.repository,input.index).reused,true);assert.equal(verifyBaseline(input.repository,input.index).reused,true);
  assert.deepEqual(fs.readFileSync(path.join(first.directory,'snapshot.json')),receipt);assert.equal(fs.statSync(path.join(first.directory,'snapshot.json')).mtimeMs,mtime);
});
for(const mutation of ['tampered','missing','extra','receipt-only','hardlink','receipt-tampered'])test(`refuses ${mutation} existing snapshot without rewriting it`,()=>{
  const input=fixture();prepareBaseline(input.repository,input.index);const target=path.join(input.directory,'web/src/source.ts');
  if(mutation==='tampered')fs.writeFileSync(target,'tampered owned bytes');
  if(mutation==='missing'||mutation==='receipt-only')fs.unlinkSync(target);
  if(mutation==='extra')fs.writeFileSync(path.join(input.directory,'extra.json'),'{}',{flag:'wx'});
  if(mutation==='hardlink')fs.linkSync(target,path.join(input.repository,'owned-hardlink'));
  if(mutation==='receipt-tampered')fs.writeFileSync(path.join(input.directory,'snapshot.json'),'{"qualification":"accepted"}');
  const before=fs.readFileSync(path.join(input.directory,'snapshot.json'));
  assert.throws(()=>prepareBaseline(input.repository,input.index),BaselineError);assert.throws(()=>verifyBaseline(input.repository,input.index),BaselineError);
  assert.deepEqual(fs.readFileSync(path.join(input.directory,'snapshot.json')),before);
});
test('does not follow a junction at its snapshot parent',()=>{
  const input=fixture(),foreign=path.join(root,`foreign-${randomUUID()}`);fs.mkdirSync(foreign);
  fs.symlinkSync(foreign,path.dirname(input.directory),'junction');
  assert.throws(()=>prepareBaseline(input.repository,input.index),BaselineError);assert.deepEqual(fs.readdirSync(foreign),[]);
});
test('does not follow an ancestor junction inside an existing snapshot',()=>{
  const input=fixture();prepareBaseline(input.repository,input.index);const foreign=path.join(root,`foreign-${randomUUID()}`);fs.mkdirSync(foreign);
  // Replace an empty owned leaf directory; the source bytes remain preserved elsewhere.
  const saved=path.join(input.repository,'preserved-source.ts');fs.renameSync(path.join(input.directory,'web/src/source.ts'),saved);
  fs.rmdirSync(path.join(input.directory,'web/src'));fs.symlinkSync(foreign,path.join(input.directory,'web/src'),'junction');
  assert.throws(()=>prepareBaseline(input.repository,input.index),BaselineError);assert.deepEqual(fs.readdirSync(foreign),[]);
});
test('ignores Git replacement objects and retains the actual original commit bytes',()=>{
  const input=fixture();fs.writeFileSync(path.join(input.repository,'web/src/source.ts'),'replacement');git(input.repository,'add','--','web/src/source.ts');
  const other=commit(input.repository);git(input.repository,'replace',input.index.sourceCommit,other);
  const output=prepareBaseline(input.repository,input.index);assert.deepEqual(fs.readFileSync(path.join(output.directory,'web/src/source.ts')),input.files[1][1]);
});
test('missing promised blobs fail locally without lazy fetching or completing a snapshot',()=>{
  const input=fixture();git(input.repository,'config','uploadpack.allowFilter','true');
  const repository=path.join(root,`promisor-${randomUUID()}`);
  // The owned local-file remote exercises lazy fetching without external networking.
  git(input.repository,'clone','--quiet','--no-local','--filter=blob:none','--no-checkout',input.repository,repository);
  fs.mkdirSync(path.join(repository,'web'));
  assert.equal(git(repository,'config','remote.origin.promisor').toString().trim(),'true');
  assert.throws(()=>git(repository,'--no-lazy-fetch','cat-file','-e',input.index.files[0].blob));
  const pack=path.join(repository,'.git/objects/pack'),before=fs.readdirSync(pack).sort();
  const inherited=process.env.GIT_NO_LAZY_FETCH;process.env.GIT_NO_LAZY_FETCH='0';
  try{assert.throws(()=>prepareBaseline(repository,input.index),BaselineError);}
  finally{if(inherited===undefined)delete process.env.GIT_NO_LAZY_FETCH;else process.env.GIT_NO_LAZY_FETCH=inherited;}
  assert.deepEqual(fs.readdirSync(pack).sort(),before);
  assert.equal(fs.existsSync(path.join(repository,'web/.measurement-baseline',input.index.sourceCommit)),false);
});
test('refuses an unavailable commit before creating snapshot output',()=>{const input=fixture();input.index.sourceCommit='a'.repeat(40);input.directory=path.join(path.dirname(input.directory),input.index.sourceCommit);rejected(input);});
test('refuses a nonregular Git tree mode even when its blob matches the index',()=>{
  const input=fixture();git(input.repository,'update-index','--cacheinfo',`120000,${input.index.files[1].blob},web/src/source.ts`);
  input.index.sourceCommit=commit(input.repository);input.directory=path.join(path.dirname(input.directory),input.index.sourceCommit);rejected(input);
});
for(const relative of ['../foreign.ts','C:/foreign.ts','web/../foreign.ts','web\\foreign.ts','snapshot.json','web/CON.ts','web/file.ts:stream'])test(`refuses unsafe index path ${relative}`,()=>{
  const input=fixture();input.index.files[1].path=relative;rejected(input);
});
test('refuses duplicate index paths before output',()=>{const input=fixture();input.index.files.push({...input.index.files[0]});rejected(input);});
test('refuses wrong source digest and declared length before output',()=>{
  for(const key of ['sha256','bytes','blob']){const input=fixture();input.index.files[0][key]=key==='bytes'?1:'f'.repeat(key==='blob'?40:64);rejected(input);}
});
test('refuses declared source size above per-file budget',()=>{const input=fixture();input.index.files[1].bytes=2*1024*1024+1;rejected(input);});
test('bounds an actual oversized Git blob despite its understated index size',()=>{const input=fixture(true);input.index.files[1].bytes=1;rejected(input);});
test('retains interrupted partial output with no completion receipt',()=>{
  const input=fixture(),write=fs.writeFileSync;
  mock.method(fs,'writeFileSync',(target,...args)=>{
    if(String(target)===path.join(input.directory,'web/src/source.ts'))throw new Error('Owned interrupted write');
    return write(target,...args);
  });
  try{assert.throws(()=>prepareBaseline(input.repository,input.index),BaselineError);}
  finally{mock.restoreAll();}
  assert.ok(fs.existsSync(path.join(input.directory,'contracts/bones.json')));assert.equal(fs.existsSync(path.join(input.directory,'snapshot.json')),false);
  assert.throws(()=>prepareBaseline(input.repository,input.index),BaselineError);
});
