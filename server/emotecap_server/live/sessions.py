"""Bounded ephemeral pairing identities; secrets never enter disk or repr."""
import secrets
import time
from dataclasses import dataclass,field
from uuid import uuid4
from .protocol import PolicyViolation

SESSION_SECONDS=3600
MAX_SESSIONS=4
MAX_SINKS=4

class SessionCapacity(ValueError):pass
class SessionMissing(ValueError):pass
class SessionForbidden(ValueError):pass

@dataclass(eq=False)
class Session:
    id:str
    source_token:str=field(repr=False)
    sink_token:str=field(repr=False)
    deadline:float
    expires_at:int
    source:object|None=None
    sinks:set=field(default_factory=set)
    stream_id:str|None=None
    active:bool=True
    def public(self):
        return {'id':self.id,'sourceToken':self.source_token,'pairingCode':self.id+'.'+self.sink_token,'expiresAt':self.expires_at}

class SessionRegistry:
    def __init__(self,clock=time.monotonic,wall_clock=time.time):
        self.clock=clock;self.wall_clock=wall_clock;self._sessions={}
    def live(self,session):
        return session.active and self._sessions.get(session.id) is session and self.clock()<session.deadline
    def prune(self):
        expired=[s for s in self._sessions.values() if not self.live(s)]
        for session in expired:self._sessions.pop(session.id,None);session.active=False
        return expired
    def issue(self):
        if len(self._sessions)>=MAX_SESSIONS:raise SessionCapacity('Four pairing sessions are already active; stop one or wait for expiry')
        session=Session(str(uuid4()),secrets.token_urlsafe(32),secrets.token_urlsafe(32),self.clock()+SESSION_SECONDS,
                        int((self.wall_clock()+SESSION_SECONDS)*1000))
        self._sessions[session.id]=session;return session
    def authenticate(self,identifier,token,role):
        session=self._sessions.get(identifier)
        if session is None or not self.live(session):raise PolicyViolation('Pairing is invalid or expired')
        expected=session.source_token if role=='source' else session.sink_token
        if not secrets.compare_digest(expected,token):raise PolicyViolation('Pairing secret does not match')
        return session
    def revoke(self,identifier,token):
        session=self._sessions.get(identifier)
        if session is None or not self.live(session):raise SessionMissing('Pairing session does not exist or expired')
        if not secrets.compare_digest(session.source_token,token):raise SessionForbidden('Source authorization is required')
        self._sessions.pop(identifier);session.active=False;return session
    def drain(self):
        sessions=list(self._sessions.values());self._sessions.clear()
        for session in sessions:session.active=False
        return sessions
