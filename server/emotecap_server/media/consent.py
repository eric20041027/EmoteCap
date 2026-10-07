"""Bounded one-use permissions; configuration is never upload authorization."""
from contextlib import contextmanager
import secrets
import re
import threading
import time
from typing import Annotated,Literal
from pydantic import BaseModel,ConfigDict,Field,UUID4,field_validator,model_validator
from ..gemini import GEMINI_VIDEO_TYPES,video_mime_type

MAX_VIDEO_BYTES=100*1024*1024
GRANT_SECONDS=60
MAX_GRANTS=32
TOKEN=re.compile(r'^[A-Za-z0-9_-]{43}$')

class ConsentRequired(Exception):
    """No valid unused permission exists."""
class ConsentCapacity(Exception):
    """Too many live permissions."""
class CloudBusy(Exception):
    """Another cloud operation owns the source-processing slot."""

class ConsentPayload(BaseModel):
    model_config=ConfigDict(extra='forbid',frozen=True,allow_inf_nan=False)
    provider:Literal['gemini']
    policyVersion:Literal[1]
    allowUpload:Literal[True]
    takeId:UUID4
    size:Annotated[int,Field(strict=True,ge=1,le=MAX_VIDEO_BYTES)]
    duration:Annotated[float,Field(gt=0,le=180)]
    mimeType:str

    @model_validator(mode='before')
    @classmethod
    def explicit_permission(cls,value):
        if isinstance(value,dict):
            if value.get('allowUpload') is not True or type(value.get('policyVersion')) is not int:
                raise ValueError('Current explicit upload permission is required')
            if isinstance(value.get('duration'),bool):raise ValueError('Duration must be numeric seconds')
        return value

    @field_validator('mimeType')
    @classmethod
    def known_video(cls,value):
        base=value.split(';')[0].strip().lower()
        if base not in GEMINI_VIDEO_TYPES|{'video/quicktime','video/x-matroska'}:
            raise ValueError('Unsupported video MIME type')
        return video_mime_type(base)

class IssuedGrant(BaseModel):
    model_config=ConfigDict(frozen=True)
    token:str
    expiresAt:int

class ConsentGrants:
    def __init__(self,clock=time.monotonic):
        self.clock=clock;self._lock=threading.Lock();self._slot=threading.BoundedSemaphore(1)
        self._grants:dict[str,tuple[float,ConsentPayload]]={}
    def _prune(self):
        now=self.clock();self._grants={token:entry for token,entry in self._grants.items() if entry[0]>now}
    def issue(self,payload)->IssuedGrant:
        source=ConsentPayload.model_validate(payload)
        with self._lock:
            self._prune()
            if len(self._grants)>=MAX_GRANTS:raise ConsentCapacity('Too many pending cloud permissions. Wait one minute.')
            token=secrets.token_urlsafe(32)
            self._grants[token]=(self.clock()+GRANT_SECONDS,source)
            return IssuedGrant(token=token,expiresAt=int((time.time()+GRANT_SECONDS)*1000))
    def consume(self,token:str)->ConsentPayload:
        with self._lock:
            self._prune()
            entry=self._grants.pop(token,None) if isinstance(token,str) and TOKEN.fullmatch(token) else None
            if entry is None:raise ConsentRequired('Confirm sending this selected video to Gemini before uploading. Permission may have expired or already been used.')
            return entry[1]
    @contextmanager
    def enter(self):
        if not self._slot.acquire(blocking=False):raise CloudBusy('Another cloud request is running. Wait before sending another video.')
        try:yield
        finally:self._slot.release()
