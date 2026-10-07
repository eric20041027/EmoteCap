import { CONTRACT_VERSION } from '../../motion/contract';
import { MAX_TAKES, PROJECT_SCHEMA, UUID_PATTERN } from '../types';
import { fields, identity } from '../validation';
import { ProjectArchiveError } from './limits';

export interface ArchiveManifest {
  readonly format:'emotecap-archive';readonly version:1;readonly project:'project.json';
  readonly projectSchema:typeof PROJECT_SCHEMA;readonly contractVersion:number;
  readonly media:readonly {readonly takeId:string;readonly path:string}[];
}
export function mediaPath(id:string):string {return `media/${identity(id,'Media take ID')}.source`;}
export function allowedPath(name:string):boolean {
  if(name==='manifest.json' || name==='project.json') return true;
  const match=/^media\/([^/]+)\.source$/.exec(name);
  return Boolean(match && UUID_PATTERN.test(match[1]));
}
export function parseManifest(value:unknown):ArchiveManifest {
  const m=fields(value,['format','version','project','projectSchema','contractVersion','media'],'Archive manifest');
  if(m.format!=='emotecap-archive' || m.version!==1 || m.project!=='project.json'
    || m.projectSchema!==PROJECT_SCHEMA || m.contractVersion!==CONTRACT_VERSION) {
    throw new ProjectArchiveError('invalid','Unsupported project archive format, version, or motion contract.');
  }
  if(!Array.isArray(m.media) || m.media.length>MAX_TAKES || Object.keys(m.media).length!==m.media.length) {
    throw new ProjectArchiveError('invalid','Archive media list is invalid.');
  }
  const ids=new Set<string>(),paths=new Set<string>();
  const media=m.media.map((raw,i)=>{
    if(!Object.hasOwn(m.media as unknown[],i)) throw new ProjectArchiveError('invalid','Archive media list cannot be sparse.');
    const row=fields(raw,['takeId','path'],'Archive media'), takeId=identity(row.takeId,'Media take ID');
    if(row.path!==mediaPath(takeId) || ids.has(takeId.toLowerCase()) || paths.has(String(row.path).toLowerCase())) {
      throw new ProjectArchiveError('invalid','Archive media references are invalid or duplicated.');
    }
    ids.add(takeId.toLowerCase());paths.add(row.path.toLowerCase());
    return Object.freeze({takeId,path:row.path});
  });
  return Object.freeze({format:'emotecap-archive',version:1,project:'project.json',projectSchema:PROJECT_SCHEMA,
    contractVersion:CONTRACT_VERSION,media:Object.freeze(media)});
}
