import type { MediaDescriptor, ProjectDocument, ProjectSummary } from './types';
import { assertOriginalTransition, identity, integer, parseProject, parseSummary, ProjectDataError } from './validation';

const STORES=['projects','summaries','media'];
export class ProjectConflictError extends Error {
  constructor() { super('This project changed in another tab. Download your work, then reopen the project.');this.name='ProjectConflictError'; }
}
export class ProjectStorageError extends Error {
  constructor(readonly reason:'quota'|'blocked'|'unavailable'|'write',message:string,cause?:unknown) {
    super(message,{cause});this.name='ProjectStorageError';
  }
}
function storageFailure(error:unknown):Error {
  if(error instanceof ProjectDataError || error instanceof ProjectConflictError || error instanceof ProjectStorageError) return error;
  const name=error!==null && typeof error==='object' && 'name' in error ? error.name : '';
  return name==='QuotaExceededError'
    ? new ProjectStorageError('quota','Browser storage is full. Your unsaved work is still available to download.',error)
    : new ProjectStorageError('write','Could not save browser data. Keep this page open and download your work.',error);
}
export interface ProjectStore {
  list():Promise<ProjectSummary[]>;
  load(id:string):Promise<ProjectDocument|null>;
  readMedia(projectId:string,takeId:string):Promise<Blob|null>;
  save(project:ProjectDocument,expectedRevision:number|null,media?:ReadonlyMap<string,Blob>):Promise<void>;
  remove(id:string,expectedRevision:number):Promise<void>;
  close():void;
}

/** Only transaction completion confirms a write, including errors after request success. */
function transact<T>(db:IDBDatabase,stores:string[],mode:IDBTransactionMode,
  schedule:(tx:IDBTransaction,result:(value:T)=>void,safely:(action:()=>void)=>void)=>void):Promise<T> {
  return new Promise((resolve,reject)=>{
    let tx:IDBTransaction;
    try {tx=db.transaction(stores,mode,mode==='readwrite'?{durability:'strict'}:undefined);}
    catch(error) {reject(new ProjectStorageError('unavailable','Browser storage is unavailable. Download your work before reopening.',error));return;}
    let value:T, failure:unknown, aborting=false;
    tx.oncomplete=()=>resolve(value);
    tx.onabort=()=>reject(storageFailure(failure ?? tx.error));
    const safely=(action:()=>void)=>{
      if(aborting) return;
      try {action();} catch(error) {failure=error;aborting=true;tx.abort();}
    };
    safely(()=>schedule(tx,v=>{value=v;},safely));
  });
}
function checkBlob(blob:unknown,descriptor:MediaDescriptor):asserts blob is Blob {
  if(!(blob instanceof Blob) || blob.size!==descriptor.size || blob.type!==descriptor.type) {
    throw new ProjectDataError('Retained source media is missing or does not match its description.');
  }
}
function deleteOrphanMedia(store:IDBObjectStore,projectId:string,retained:Set<string>,safely:(action:()=>void)=>void):void {
  const cursor=store.index('projectId').openCursor(projectId);
  cursor.onsuccess=()=>safely(()=>{
    const row=cursor.result;
    if(!row) return;
    if(!retained.has(row.value.takeId)) row.delete();
    row.continue();
  });
}

function repository(db:IDBDatabase):ProjectStore {
  let closed=false;
  function available():void {
    if(closed) throw new ProjectStorageError('unavailable','Browser storage was closed. Download unsaved work, then reopen the project.');
  }
  const store:ProjectStore={
    async list() {
      available();
      const values=await transact<unknown[]>(db,['summaries'],'readonly',(tx,result,safely)=>{
        const r=tx.objectStore('summaries').getAll();r.onsuccess=()=>safely(()=>result(r.result));
      });
      return values.map(parseSummary).sort((a,b)=>b.updatedAt-a.updatedAt || a.id.localeCompare(b.id));
    },
    async load(id) {
      available();identity(id,'Project ID');
      const value=await transact<unknown>(db,['projects'],'readonly',(tx,result,safely)=>{
        const r=tx.objectStore('projects').get(id);r.onsuccess=()=>safely(()=>result(r.result));
      });
      return value===undefined ? null : parseProject(value);
    },
    async readMedia(projectId,takeId) {
      available();identity(projectId,'Project ID');identity(takeId,'Take ID');
      const value=await transact<unknown>(db,['media'],'readonly',(tx,result,safely)=>{
        const r=tx.objectStore('media').get([projectId,takeId]);r.onsuccess=()=>safely(()=>result(r.result));
      });
      if(value===undefined) return null;
      if(!value || typeof value!=='object' || !('blob' in value) || !(value.blob instanceof Blob)) {
        throw new ProjectDataError('Stored source media is corrupt.');
      }
      return value.blob;
    },
    async save(project,expectedRevision,media=new Map()) {
      available();const document=parseProject(project), supplied=new Map(media);
      if(expectedRevision!==null) integer(expectedRevision,'Expected revision');
      for(const [takeId,video] of supplied) {
        const descriptor=document.takes.find(t=>t.id===takeId)?.media;
        if(!descriptor) throw new ProjectDataError('Source media was supplied without a retention choice.');
        checkBlob(video,descriptor);
      }
      await transact<void>(db,STORES,'readwrite',(tx,_result,safely)=>{
        const projects=tx.objectStore('projects'), summaries=tx.objectStore('summaries'), mediaStore=tx.objectStore('media');
        const current=projects.get(document.id);
        current.onsuccess=()=>safely(()=>{
          if(current.result===undefined) {
            if(expectedRevision!==null) throw new ProjectConflictError();
          } else {
            if(expectedRevision===null || current.result.revision!==expectedRevision) throw new ProjectConflictError();
            assertOriginalTransition(parseProject(current.result),document);
          }
          projects.put(document);
          summaries.put({id:document.id,name:document.name,revision:document.revision,updatedAt:document.updatedAt,takeCount:document.takes.length});
          const retained=new Set<string>();
          for(const take of document.takes) {
            const descriptor=take.media;if(!descriptor) continue;retained.add(take.id);
            const video=supplied.get(take.id);
            if(video) mediaStore.put({projectId:document.id,takeId:take.id,blob:video});
            else {
              const old=mediaStore.get([document.id,take.id]);
              old.onsuccess=()=>safely(()=>checkBlob(old.result?.blob,descriptor));
            }
          }
          deleteOrphanMedia(mediaStore,document.id,retained,safely);
        });
      });
    },
    async remove(id,expectedRevision) {
      available();identity(id,'Project ID');integer(expectedRevision,'Expected revision');
      await transact<void>(db,STORES,'readwrite',(tx,_result,safely)=>{
        const projects=tx.objectStore('projects'), current=projects.get(id);
        current.onsuccess=()=>safely(()=>{
          if(current.result===undefined || current.result.revision!==expectedRevision) throw new ProjectConflictError();
          projects.delete(id);tx.objectStore('summaries').delete(id);
          deleteOrphanMedia(tx.objectStore('media'),id,new Set(),safely);
        });
      });
    },
    close() {if(!closed) {closed=true;db.close();}},
  };
  db.onversionchange=()=>store.close();db.onclose=()=>{closed=true;};
  return store;
}

function compatible(db:IDBDatabase):boolean {
  if(db.objectStoreNames.length!==STORES.length || !STORES.every(s=>db.objectStoreNames.contains(s))) return false;
  const tx=db.transaction(STORES,'readonly'), media=tx.objectStore('media');
  return tx.objectStore('projects').keyPath==='id' && !tx.objectStore('projects').autoIncrement
    && tx.objectStore('summaries').keyPath==='id' && !tx.objectStore('summaries').autoIncrement
    && JSON.stringify(media.keyPath)===JSON.stringify(['projectId','takeId']) && !media.autoIncrement
    && media.indexNames.contains('projectId') && media.index('projectId').keyPath==='projectId'
    && !media.index('projectId').unique && !media.index('projectId').multiEntry;
}
export function openProjectStore(options:{factory?:IDBFactory;name?:string}={}):Promise<ProjectStore> {
  const factory=options.factory ?? globalThis.indexedDB;
  if(!factory) return Promise.reject(new ProjectStorageError('unavailable','Browser storage is unavailable. You can still download your project.'));
  return new Promise((resolve,reject)=>{
    let request:IDBOpenDBRequest, settled=false;
    const fail=(error:ProjectStorageError)=>{if(!settled) {settled=true;reject(error);}};
    try {request=factory.open(options.name ?? 'emotecap-studio',1);}
    catch(error) {fail(new ProjectStorageError('unavailable','Browser storage could not be opened.',error));return;}
    request.onblocked=()=>fail(new ProjectStorageError('blocked','Close other EmoteCap tabs, then retry opening browser storage.'));
    request.onerror=()=>fail(new ProjectStorageError('unavailable','Browser storage could not be opened. Its format may require a newer EmoteCap version.',request.error));
    request.onupgradeneeded=()=>{
      const db=request.result;
      if(!db.objectStoreNames.contains('projects')) db.createObjectStore('projects',{keyPath:'id'});
      if(!db.objectStoreNames.contains('summaries')) db.createObjectStore('summaries',{keyPath:'id'});
      if(!db.objectStoreNames.contains('media')) {
        const media=db.createObjectStore('media',{keyPath:['projectId','takeId']});media.createIndex('projectId','projectId');
      }
    };
    request.onsuccess=()=>{
      const db=request.result;
      if(settled) {db.close();return;}
      try {
        if(!compatible(db)) throw new ProjectDataError('Browser storage has an incompatible structure.');
        settled=true;resolve(repository(db));
      } catch(error) {db.close();fail(new ProjectStorageError('unavailable','Browser storage has an incompatible structure. Your existing data was preserved.',error));}
    };
  });
}
