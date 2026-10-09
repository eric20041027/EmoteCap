import {afterEach,expect,it,vi} from 'vitest';
import {createSession,revokeSession,type PairingSession} from './sessionsApi';
const id='10000000-0000-4000-8000-000000000001';
const session=():PairingSession=>({id,sourceToken:'s'.repeat(43),pairingCode:id+'.'+'p'.repeat(43),expiresAt:Date.now()+3600000});
afterEach(()=>vi.useRealTimers());
it('creates only a local body-free session and validates role-separated metadata',async()=>{
  const value=session(),fetchFn=vi.fn(async()=>new Response(JSON.stringify(value)));
  expect(await createSession({fetchFn})).toEqual(value);
  const [url,init]=fetchFn.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('/api/live-sessions');expect(init.method).toBe('POST');expect(init.body).toBeUndefined();
  expect(url).not.toContain(value.sourceToken);expect(url).not.toContain(value.pairingCode);
});
it.each([{id:'bad'},{sourceToken:'short'},{pairingCode:id+'.'+'s'.repeat(43)},{pairingCode:'bad'},
  {expiresAt:0},{expiresAt:Infinity},{expiresAt:'soon'},{token:'unexpected'}])('rejects incompatible pairing metadata %j',async change=>{
  await expect(createSession({fetchFn:async()=>new Response(JSON.stringify({...session(),...change}))})).rejects.toThrow(/pairing/i);
});
it('uses the source header for deletion and treats already-expired sessions as invalidated',async()=>{
  const value=session(),fetchFn=vi.fn(async()=>new Response(null,{status:204}));
  await revokeSession(value,{fetchFn});const [url,init]=fetchFn.mock.calls[0] as unknown as [string,RequestInit];
  expect(url).toBe('/api/live-sessions/'+id);expect(url).not.toContain(value.sourceToken);
  expect(new Headers(init.headers).get('Authorization')).toBe('Bearer '+value.sourceToken);expect(init.method).toBe('DELETE');
  await expect(revokeSession(value,{fetchFn:async()=>new Response('',{status:404})})).resolves.toBeUndefined();
});
it('rejects a response exceeding64KiB without exposing token-bearing server errors',async()=>{
  await expect(createSession({fetchFn:async()=>new Response('x'.repeat(65537))})).rejects.toThrow(/large/i);
  const value=session();await expect(revokeSession(value,{fetchFn:async()=>new Response(value.sourceToken,{status:403})})).rejects.toThrow(/HTTP 403/);
});
it('settles a non-cooperating transport at the local deadline',async()=>{
  vi.useFakeTimers();const pending=createSession({fetchFn:()=>new Promise(()=>{}),timeoutMs:10});
  const rejected=expect(pending).rejects.toThrow(/timed out/i);await vi.advanceTimersByTimeAsync(11);await rejected;
});
