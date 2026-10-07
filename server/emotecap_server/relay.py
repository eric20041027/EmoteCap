"""Paired local relay with strict ownership; delivery is a separate bounded concern."""
import asyncio
import json
import time
from uuid import uuid4
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from .contract import BONES
from .live.api import trusted
from .live.protocol import PolicyViolation,parse_hello,validate_frame
from .live.sessions import SessionRegistry,MAX_SINKS
SOURCE='source'
SINK='sink'

class LiveRelay:
    def __init__(self,clock=time.monotonic,wall_clock=time.time,send_timeout=.5,hello_timeout=5):
        self.sessions=SessionRegistry(clock,wall_clock);self.send_timeout=send_timeout;self.hello_timeout=hello_timeout
    @property
    def sink_count(self):return sum(len(s.sinks) for s in self.sessions._sessions.values())
    def acknowledgement(self,session,role):
        return json.dumps({'type':'hello','version':2,'bones':BONES,'sessionId':session.id,'role':role,
                           'streamId':session.stream_id,'expiresAt':session.expires_at},separators=(',',':'))
    async def _send(self,socket,text):
        await asyncio.wait_for(socket.send_text(text),self.send_timeout)
    async def _close(self,socket,code=1000,reason=''):
        try:await asyncio.wait_for(socket.close(code=code,reason=reason),self.send_timeout)
        except Exception:pass
    async def _read(self,socket,timeout):
        message=await asyncio.wait_for(socket.receive(),max(.001,timeout))
        if message['type']=='websocket.disconnect':raise WebSocketDisconnect(message.get('code',1000))
        if message.get('text') is None:raise PolicyViolation('Text messages are required')
        return message['text']
    async def serve(self,websocket:WebSocket,role):
        await websocket.accept()
        try:
            if role not in (SOURCE,SINK):raise PolicyViolation('Role must be source or sink')
            if not trusted(websocket,native=role==SINK):raise PolicyViolation('A trusted local origin is required')
            hello=parse_hello(await self._read(websocket,self.hello_timeout),role)
            session=self.sessions.authenticate(hello.session_id,hello.token,role)
            if role==SOURCE:await self._serve_source(websocket,session)
            else:await self._serve_sink(websocket,session)
        except PolicyViolation as exc:await self._close(websocket,1008,str(exc))
        except TimeoutError:await self._close(websocket,1008,'Hello timed out or pairing expired')
        except (WebSocketDisconnect,ConnectionError,RuntimeError):pass
        finally:await self._close(websocket)
    async def broadcast(self,session,text):
        async def send(sink):
            try:await self._send(sink,text)
            except Exception:
                session.sinks.discard(sink);await self._close(sink,1011,'Receiver could not keep up')
        await asyncio.gather(*(send(sink) for sink in tuple(session.sinks)))
    async def _announce(self,session):
        await self.broadcast(session,self.acknowledgement(session,SINK))
    async def _serve_source(self,source,session):
        if session.source is not None:raise PolicyViolation('This pairing already has a source')
        session.source=source;session.stream_id=str(uuid4());last_t=None
        try:
            await self._send(source,self.acknowledgement(session,SOURCE));await self._announce(session)
            while self.sessions.live(session):
                text=await self._read(source,session.deadline-self.sessions.clock())
                if not self.sessions.live(session):raise PolicyViolation('Pairing expired')
                last_t=validate_frame(text,last_t);await self.broadcast(session,text)
            raise PolicyViolation('Pairing expired')
        finally:
            if session.source is source:
                session.source=None;session.stream_id=None
                if self.sessions.live(session):await self._announce(session)
    async def _serve_sink(self,sink,session):
        if len(session.sinks)>=MAX_SINKS:raise PolicyViolation('This pairing already has four receivers')
        session.sinks.add(sink)
        try:
            await self._send(sink,self.acknowledgement(session,SINK))
            while self.sessions.live(session):
                await self._read(sink,session.deadline-self.sessions.clock())
                raise PolicyViolation('Receivers are listen-only')
            raise PolicyViolation('Pairing expired')
        finally:session.sinks.discard(sink)
    async def close_session(self,session):
        sockets=list(session.sinks)+([session.source] if session.source else [])
        session.sinks.clear();session.source=None
        await asyncio.gather(*(self._close(socket,1008,'Pairing stopped or expired') for socket in sockets))
    async def prune(self):
        await asyncio.gather(*(self.close_session(session) for session in self.sessions.prune()))
    async def aclose(self):
        await asyncio.gather(*(self.close_session(session) for session in self.sessions.drain()))
