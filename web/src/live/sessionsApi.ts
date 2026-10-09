/** Bounded local pairing metadata; role secrets never enter URLs or error text. */
import type {FetchFn} from '../jobs/api';
import {httpJSON,HttpFailure} from '../cloud/transport';
export interface PairingSession {readonly id:string;readonly sourceToken:string;readonly pairingCode:string;readonly expiresAt:number}
interface Options {fetchFn?:FetchFn;signal?:AbortSignal;timeoutMs?:number}
export const canonicalId=(value:unknown):value is string=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const secret=(value:unknown):value is string=>typeof value==='string'&&/^[A-Za-z0-9_-]{43}$/.test(value);
export function parsePairing(value:unknown):PairingSession{
  if(!value||typeof value!=='object')throw new Error('Invalid pairing response');
  const s=value as Record<string,unknown>,code=typeof s.pairingCode==='string'?s.pairingCode.split('.'):[];
  if(Object.keys(s).sort().join(',')!=='expiresAt,id,pairingCode,sourceToken'||!canonicalId(s.id)||!secret(s.sourceToken)||code.length!==2
    ||code[0]!==s.id||!secret(code[1])||code[1]===s.sourceToken||!Number.isSafeInteger(s.expiresAt)||Number(s.expiresAt)<=Date.now())
    throw new Error('Invalid or expired pairing response');
  return Object.freeze({id:s.id,sourceToken:s.sourceToken,pairingCode:s.pairingCode as string,expiresAt:Number(s.expiresAt)});
}
export async function createSession(options:Options={}):Promise<PairingSession>{
  return parsePairing(await httpJSON('/api/live-sessions',{method:'POST'},{timeoutMs:5000,maxBytes:65536,...options}));
}
export async function revokeSession(session:PairingSession,options:Options={}):Promise<void>{
  if(!canonicalId(session.id)||!secret(session.sourceToken))throw new Error('Invalid pairing authorization');
  try{await httpJSON('/api/live-sessions/'+session.id,{method:'DELETE',headers:{Authorization:'Bearer '+session.sourceToken}},
    {timeoutMs:5000,maxBytes:65536,...options});}
  catch(error){if(!(error instanceof HttpFailure&&error.status===404))throw error;}
}
