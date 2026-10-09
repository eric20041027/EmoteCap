import { BlobReader, Reader, ZipReader, ZipWriter, configure, type CreateReadableOptions, type FileEntry } from '@zip.js/zip.js';
import { MAX_MEDIA_BYTES, MAX_PROJECT_MEDIA_BYTES } from '../types';
import { allowedPath } from './manifest';
import { INPUT_CHUNK, ProjectArchiveError, archiveLimits, checkSize, type ArchiveLimits } from './limits';
import { abortable } from './operation';

configure({chunkSize:INPUT_CHUNK,useWebWorkers:false,useCompressionStream:true});
const FIXED_DATE=new Date('2026-01-01T00:00:00Z');
function nativeCodec():void {
  try {
    new CompressionStream('deflate-raw');new DecompressionStream('deflate-raw');
  } catch(error) {
    throw new ProjectArchiveError('unsupported','Use an up-to-date desktop Chrome or Edge to open project files.',error);
  }
}

/** Bounds metadata allocation as well as payload reads; BlobReader's native stream shortcut is bypassed. */
class BoundedReader extends BlobReader {
  constructor(private readonly archiveBlob:Blob,private readonly limit:number,private readonly signal:AbortSignal) {super(archiveBlob);}
  override async readUint8Array(index:number,length:number):Promise<Uint8Array<ArrayBuffer>> {
    this.signal.throwIfAborted();
    if(!Number.isSafeInteger(index) || !Number.isSafeInteger(length) || index<0 || length<0
      || index+length>this.archiveBlob.size || length>this.limit) {
      throw new ProjectArchiveError('limit','Archive metadata or input read exceeds its safe limit.');
    }
    const bytes=new Uint8Array(await this.archiveBlob.slice(index,index+length).arrayBuffer());
    this.signal.throwIfAborted();return bytes;
  }
  override createReadable(options:CreateReadableOptions={}):ReadableStream<Uint8Array> {
    return Reader.prototype.createReadable.call(this,{...options,chunkSize:INPUT_CHUNK});
  }
}
function entryCap(name:string,limits:Readonly<ArchiveLimits>):number {
  return name==='manifest.json'?limits.manifestBytes:name==='project.json'?limits.jsonBytes:MAX_MEDIA_BYTES;
}
interface Counters {total:number;media:number}

async function extract(entry:FileEntry,limits:Readonly<ArchiveLimits>,count:Counters,signal:AbortSignal):Promise<Blob> {
  const cap=entryCap(entry.filename,limits),parts:Uint8Array<ArrayBuffer>[]=[];let size=0;
  const target=new WritableStream<Uint8Array>({
    write(chunk) {
      signal.throwIfAborted();
      const next=size+chunk.byteLength;checkSize(next,Math.min(cap,entry.uncompressedSize),'Decoded entry');
      checkSize(count.total+chunk.byteLength,limits.decodedBytes,'Decoded archive');
      if(entry.filename.startsWith('media/')) checkSize(count.media+chunk.byteLength,MAX_PROJECT_MEDIA_BYTES,'Decoded source media');
      size=next;count.total+=chunk.byteLength;
      if(entry.filename.startsWith('media/')) count.media+=chunk.byteLength;
      parts.push(Uint8Array.from(chunk));
    },
  });
  await abortable(entry.getData(target,{signal,useWebWorkers:false,useCompressionStream:true,strictness:'strict',
    checkCrc32:true,checkLocalFilename:true,checkLocalDirectory:true,checkOverlappingEntry:true}),signal);
  if(size!==entry.uncompressedSize) throw new ProjectArchiveError('corrupt','Decoded entry size does not match its header.');
  return new Blob(parts);
}

export async function readZip(blob:Blob,requestedLimits:Readonly<ArchiveLimits>,signal:AbortSignal=new AbortController().signal):Promise<ReadonlyMap<string,Blob>> {
  const limits=archiveLimits(requestedLimits);
  signal.throwIfAborted();checkSize(blob.size,limits.fileBytes,'Project file');nativeCodec();
  const reader=new ZipReader(new BoundedReader(blob,limits.readBytes,signal),{strictness:'strict',useWebWorkers:false,useCompressionStream:true});
  const entries:FileEntry[]=[],seen=new Set<string>();let declared=0,mediaDeclared=0;
  try {
    for await(const entry of reader.getEntriesGenerator({strictness:'strict'})) {
      signal.throwIfAborted();
      if(entries.length>=limits.entries) throw new ProjectArchiveError('limit','Archive has too many entries.');
      if(seen.has(entry.filename.toLowerCase())) throw new ProjectArchiveError('invalid','Archive has duplicate entry names.');
      seen.add(entry.filename.toLowerCase());
      if(entry.directory || !allowedPath(entry.filename) || entry.encrypted || ![0,8].includes(entry.compressionMethod)) {
        throw new ProjectArchiveError('invalid','Archive contains an unsupported path, directory, encryption, or compression method.');
      }
      checkSize(entry.compressedSize,limits.fileBytes,'Compressed entry');
      checkSize(entry.uncompressedSize,entryCap(entry.filename,limits),'Declared entry');
      declared+=entry.uncompressedSize;checkSize(declared,limits.decodedBytes,'Declared archive');
      if(entry.filename.startsWith('media/')) {mediaDeclared+=entry.uncompressedSize;checkSize(mediaDeclared,MAX_PROJECT_MEDIA_BYTES,'Declared source media');}
      entries.push(entry);
    }
    if(!seen.has('manifest.json') || !seen.has('project.json')) throw new ProjectArchiveError('invalid','Project archive metadata is missing.');
    const result=new Map<string,Blob>(), count:Counters={total:0,media:0};
    for(const entry of entries) {signal.throwIfAborted();result.set(entry.filename,await extract(entry,limits,count,signal));}
    return result;
  } finally {await reader.close();}
}

export async function writeZip(entries:ReadonlyMap<string,Blob>,requestedLimits:Readonly<ArchiveLimits>,signal:AbortSignal=new AbortController().signal):Promise<Blob> {
  const limits=archiveLimits(requestedLimits);
  signal.throwIfAborted();nativeCodec();
  if(entries.size>limits.entries) throw new ProjectArchiveError('limit','Archive has too many entries.');
  let total=0,sourceBytes=0;
  for(const [name,blob] of entries) {
    if(!allowedPath(name)) throw new ProjectArchiveError('invalid','Unsupported archive entry path.');
    checkSize(blob.size,entryCap(name,limits),'Archive entry');total+=blob.size;
    if(name.startsWith('media/')) sourceBytes+=blob.size;
  }
  checkSize(total,limits.decodedBytes,'Archive data');checkSize(sourceBytes,MAX_PROJECT_MEDIA_BYTES,'Archive source media');
  const parts:Uint8Array<ArrayBuffer>[]=[];let bytes=0;
  const output=new WritableStream<Uint8Array>({write(chunk){
    signal.throwIfAborted();checkSize(bytes+chunk.byteLength,limits.fileBytes,'Project file');bytes+=chunk.byteLength;parts.push(Uint8Array.from(chunk));
  }});
  const writer=new ZipWriter(output,{useWebWorkers:false,useCompressionStream:true,zip64:false,bufferedWrite:true,dataDescriptor:false});
  try {
    for(const [name,blob] of entries) {
      signal.throwIfAborted();
      await abortable(writer.add(name,new BlobReader(blob),{level:name.startsWith('media/')?0:6,
        lastModDate:FIXED_DATE,extendedTimestamp:false,signal}),signal);
    }
    await abortable(writer.close(),signal);signal.throwIfAborted();
    return new Blob(parts,{type:'application/x-emotecap'});
  } catch(error) {
    // All writer output is still private; no partial Blob is returned.
    throw error;
  }
}
