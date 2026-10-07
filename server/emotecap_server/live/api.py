"""Loopback browser pairing API. URL/header values never enter diagnostics."""
import asyncio
from urllib.parse import urlsplit
from fastapi import APIRouter,HTTPException,Request,Response
from .sessions import SessionCapacity,SessionMissing,SessionForbidden

LOOPBACK={'localhost','127.0.0.1','::1'}
router=APIRouter(prefix='/api/live-sessions')

def trusted(connection,*,native=False):
    try:
        url=connection.url
        if url.hostname not in LOOPBACK:return False
        origin=connection.headers.get('origin')
        if origin is None:return native
        parsed=urlsplit(origin)
        if parsed.scheme not in ('http','https') or parsed.hostname not in LOOPBACK or parsed.username or parsed.password:
            return False
        if parsed.path or parsed.query or parsed.fragment:return False
        if parsed.scheme=='http' and parsed.port==5173:return True
        scheme='https' if url.scheme in ('https','wss') else 'http'
        actual_port=url.port or (443 if scheme=='https' else 80)
        return parsed.scheme==scheme and parsed.hostname==url.hostname and (parsed.port or (443 if scheme=='https' else 80))==actual_port
    except (ValueError,AttributeError):return False

def relay_for(request):
    from .. import main
    if not trusted(request):raise HTTPException(403,detail='Pairing requires a trusted local browser origin')
    return main.relay

@router.post('',status_code=201)
async def issue(request:Request):
    relay=relay_for(request)
    try:
        async with asyncio.timeout(5):
            async for chunk in request.stream():
                if chunk:raise HTTPException(413,detail='Pairing creation has no request payload')
    except TimeoutError as exc:raise HTTPException(408,detail='Pairing request timed out') from exc
    await relay.prune()
    try:return relay.sessions.issue().public()
    except SessionCapacity as exc:raise HTTPException(409,detail=str(exc)) from exc

@router.delete('/{identifier}',status_code=204)
async def revoke(request:Request,identifier:str):
    relay=relay_for(request);header=request.headers.get('authorization','')
    token=header[7:] if header.startswith('Bearer ') else ''
    if len(token)!=43 or not token.isascii():raise HTTPException(403,detail='Source authorization is required')
    try:session=relay.sessions.revoke(identifier,token)
    except SessionMissing as exc:raise HTTPException(404,detail=str(exc)) from exc
    except SessionForbidden as exc:raise HTTPException(403,detail=str(exc)) from exc
    await relay.close_session(session)
    return Response(status_code=204)
