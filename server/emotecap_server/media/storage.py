"""Owned raw temporaries and explicit recognized legacy deletion."""
from dataclasses import dataclass
import json
import os
from pathlib import Path
import re
import threading
import time
import uuid
from typing import Literal
from pydantic import BaseModel,ConfigDict,UUID4
from ..jobs.repository import ordinary,identity
from .consent import ConsentPayload

MAX_TEMP_BYTES=200*1024*1024
CHUNK_BYTES=1024*1024
LEGACY=re.compile(r'^legacy-([0-9a-f]{32})$')

class MediaStorageError(Exception):
    """Raw data cannot be copied or deleted safely."""

@dataclass(frozen=True)
class TemporaryMedia:
    id:str
    path:Path

class CleanupResult(BaseModel):
    localVideo:Literal['deleted','failed']
    warning:str|None=None

class CleanupItem(BaseModel):
    id:str
    kind:Literal['temporary','legacy']
    size:int
    active:bool=False

class Owner(BaseModel):
    model_config=ConfigDict(extra='forbid',frozen=True)
    kind:Literal['emotecap-cloud-temp']='emotecap-cloud-temp'
    schemaVersion:Literal[1]=1
    sourceTakeId:UUID4
    createdAt:int

class MediaStorage:
    def __init__(self,root:Path,max_bytes=MAX_TEMP_BYTES):
        if not 1<=max_bytes<=MAX_TEMP_BYTES:raise ValueError('Invalid temporary raw budget')
        self.root=root;self.directory=root/'cloud-tmp';self.max_bytes=max_bytes
        ordinary(self.directory);self.directory.mkdir(parents=True,exist_ok=True)
        self._lock=threading.RLock();self._active:set[str]=set()

    def _path(self,id:str)->Path:
        try:canonical=identity(id)
        except (ValueError,TypeError,AttributeError) as exc:raise MediaStorageError('Unknown temporary media identity') from exc
        if canonical!=id:raise MediaStorageError('Unknown temporary media identity')
        path=self.directory/id
        try:ordinary(path)
        except OSError as exc:raise MediaStorageError(str(exc)) from exc
        if not path.resolve().is_relative_to(self.directory.resolve()):raise MediaStorageError('Media path escapes storage')
        return path

    def _owned(self,directory:Path)->Owner|None:
        ordinary(directory)
        manifest=directory/'owner.json';ordinary(manifest)
        if not manifest.exists() and not any(directory.iterdir()):return None
        with manifest.open('rb') as source:data=source.read(4097)
        if len(data)>4096:raise MediaStorageError('Temporary ownership metadata is too large')
        return Owner.model_validate_json(data)

    def _temporary_items(self)->list[CleanupItem]:
        result=[]
        for directory in self.directory.iterdir():
            try:
                known=self._path(directory.name);self._owned(known)
                if any(path.name not in {'owner.json','video.webm'} for path in known.iterdir()):raise MediaStorageError('Unknown file in temporary media')
                video=known/'video.webm';ordinary(video)
                result.append(CleanupItem(id=directory.name,kind='temporary',size=video.stat().st_size if video.exists() else 0,active=directory.name in self._active))
            except (OSError,ValueError,MediaStorageError) as exc:
                raise MediaStorageError(f'Cannot inventory temporary media safely: {exc}') from exc
        return result

    def check_budget(self,size:int,copies:int=2)->None:
        with self._lock:
            if sum(item.size for item in self._temporary_items())+size*copies>self.max_bytes:
                raise MediaStorageError('Temporary raw video budget is full. Retry cleanup before sending another video.')

    def begin(self,grant:ConsentPayload,upload)->TemporaryMedia:
        with self._lock:
            if sum(item.size for item in self._temporary_items())+grant.size>self.max_bytes:
                raise MediaStorageError('Temporary raw video budget is full. Retry cleanup before sending another video.')
            id=str(uuid.uuid4());directory=self._path(id);directory.mkdir()
            media=TemporaryMedia(id=id,path=directory/'video.webm')
            try:
                owner=Owner(sourceTakeId=grant.takeId,createdAt=int(time.time()*1000))
                with (directory/'owner.json').open('xb') as output:
                    output.write(owner.model_dump_json().encode());output.flush();os.fsync(output.fileno())
                with media.path.open('xb') as output:
                    copied=0
                    while chunk:=upload.read(CHUNK_BYTES):
                        copied+=len(chunk)
                        if copied>grant.size:raise MediaStorageError('Uploaded bytes differ from consent')
                        output.write(chunk)
                    if copied!=grant.size:raise MediaStorageError('Uploaded bytes differ from consent')
                    output.flush();os.fsync(output.fileno())
            except Exception as exc:
                try:self._remove(media,require_owner=False)
                except Exception as cleanup:raise MediaStorageError(f'Could not copy source: {exc}; cleanup failed: {cleanup}') from exc
                if isinstance(exc,MediaStorageError):raise
                raise MediaStorageError(f'Could not copy source: {exc}') from exc
            self._active.add(id);return media

    def _remove(self,media:TemporaryMedia,require_owner=True)->None:
        directory=self._path(media.id)
        if media.path!=directory/'video.webm':raise MediaStorageError('Media path does not match its identity')
        if not directory.exists():return
        if require_owner:self._owned(directory)
        files=list(directory.iterdir())
        if any(path.name not in {'owner.json','video.webm'} for path in files):raise MediaStorageError('Unknown files prevent temporary cleanup')
        for path in files:
            ordinary(path)
            if not path.is_file():raise MediaStorageError('Temporary cleanup requires ordinary files')
        # Keep ownership metadata if video removal fails, so explicit retry stays possible.
        media.path.unlink(missing_ok=True)
        (directory/'owner.json').unlink(missing_ok=True)
        directory.rmdir()

    def cleanup(self,media:TemporaryMedia)->CleanupResult:
        with self._lock:
            try:self._remove(media);return CleanupResult(localVideo='deleted')
            except Exception:return CleanupResult(localVideo='failed',warning='Local temporary video could not be removed. Retry cleanup after closing programs using the file.')
            finally:self._active.discard(media.id)

    def inventory(self)->list[CleanupItem]:
        with self._lock:
            result=self._temporary_items();legacy=self.root/'takes';ordinary(legacy)
            if legacy.exists():
                for file in legacy.iterdir():
                    if re.fullmatch(r'[0-9a-f]{32}\.webm',file.name):
                        ordinary(file)
                        if file.is_file():result.append(CleanupItem(id='legacy-'+file.stem,kind='legacy',size=file.stat().st_size))
            return result

    def delete(self,id:str)->None:
        with self._lock:
            if id in self._active:raise MediaStorageError('This source is active in a cloud request')
            known=next((item for item in self.inventory() if item.id==id),None)
            if known is None:raise MediaStorageError('Unknown media cleanup identity')
            try:
                match=LEGACY.fullmatch(id)
                if match:
                    path=self.root/'takes'/f'{match[1]}.webm';ordinary(path)
                    if not path.resolve().is_relative_to((self.root/'takes').resolve()):raise MediaStorageError('Legacy path escapes storage')
                    path.unlink()
                else:self._remove(TemporaryMedia(id=id,path=self._path(id)/'video.webm'))
            except OSError as exc:raise MediaStorageError('Local video could not be removed. Close programs using it, then retry.') from exc
