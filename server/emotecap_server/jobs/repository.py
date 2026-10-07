"""SQLite metadata and immutable fsynced inputs, bounded by the owning service."""
import hashlib
import json
import os
import shutil
import sqlite3
import time
import uuid
from contextlib import closing
from pathlib import Path

from ..exporter import _linked
from .models import JobStatus,JobSubmission,MAX_INPUT_BYTES


def identity(value)->str:
    parsed=uuid.UUID(str(value))
    if parsed.version!=4:raise ValueError('Invalid job identity')
    return str(parsed)


def ordinary(path:Path)->None:
    if _linked(path) or any(_linked(parent) for parent in path.parents):
        raise OSError('Job storage must use ordinary directories')


class WorkerLock:
    def __init__(self,path:Path):self.path=path;self.stream=None
    def acquire(self)->None:
        ordinary(self.path)
        stream=self.path.open('a+b')
        try:
            if stream.seek(0,2)==0:stream.write(b'0');stream.flush()
            stream.seek(0)
            if os.name=='nt':
                import msvcrt
                msvcrt.locking(stream.fileno(),msvcrt.LK_NBLCK,1)
            else:
                import fcntl
                fcntl.flock(stream.fileno(),fcntl.LOCK_EX|fcntl.LOCK_NB)
        except OSError:
            stream.close();raise
        self.stream=stream
    def release(self)->None:
        if self.stream is not None:
            self.stream.close();self.stream=None


class Repository:
    def __init__(self,root:Path):
        self.root=root;ordinary(root)
        self.jobs=root/'jobs';self.jobs.mkdir(parents=True,exist_ok=True);ordinary(self.jobs)
        self.database=self.jobs/'jobs.sqlite3';ordinary(self.database)
        with closing(self._connect()) as db,db:
            db.execute('CREATE TABLE IF NOT EXISTS jobs (id TEXT PRIMARY KEY, status TEXT NOT NULL)')

    def _connect(self):
        db=sqlite3.connect(self.database,timeout=5)
        db.execute('PRAGMA synchronous=FULL')
        return db

    def path(self,job_id)->Path:
        path=self.jobs/identity(job_id);ordinary(path)
        if not path.resolve().is_relative_to(self.jobs.resolve()):raise ValueError('Job path escapes storage')
        return path

    def create(self,submission:JobSubmission,retry_of=None)->JobStatus:
        data=json.dumps(submission.model_dump(mode='json'),sort_keys=True,separators=(',',':'),allow_nan=False).encode('utf-8')
        if len(data)>MAX_INPUT_BYTES:raise ValueError('Export input exceeds byte limit')
        job_id=str(uuid.uuid4());directory=self.path(job_id);directory.mkdir()
        try:
            with (directory/'input.json').open('xb') as output:
                output.write(data);output.flush();os.fsync(output.fileno())
            now=int(time.time()*1000)
            status=JobStatus(id=job_id,snapshot=submission.snapshot,inputSha256=hashlib.sha256(data).hexdigest(),
                             createdAt=now,updatedAt=now,retryOf=retry_of)
            with closing(self._connect()) as db,db:
                db.execute('INSERT INTO jobs(id,status) VALUES (?,?)',(job_id,status.model_dump_json()))
        except Exception as exc:
            try:self._remove_directory(directory,self.jobs)
            except (OSError,ValueError) as cleanup:
                raise OSError(f'Export acceptance failed: {exc}; unpublished input cleanup failed: {cleanup}') from exc
            raise
        return status

    def get(self,job_id)->JobStatus:
        with closing(self._connect()) as db:
            row=db.execute('SELECT status FROM jobs WHERE id=?',(identity(job_id),)).fetchone()
        if row is None:raise KeyError(str(job_id))
        return JobStatus.model_validate_json(row[0])

    def list(self)->list[JobStatus]:
        with closing(self._connect()) as db:
            rows=db.execute('SELECT status FROM jobs ORDER BY rowid').fetchall()
        return [JobStatus.model_validate_json(row[0]) for row in rows]

    def save(self,status:JobStatus)->None:
        with closing(self._connect()) as db,db:
            cursor=db.execute('UPDATE jobs SET status=? WHERE id=?',(status.model_dump_json(),str(status.id)))
            if cursor.rowcount!=1:raise KeyError(str(status.id))

    def read_input(self,status:JobStatus)->JobSubmission:
        path=self.path(status.id)/'input.json';ordinary(path)
        with path.open('rb') as source:data=source.read(MAX_INPUT_BYTES+1)
        if len(data)>MAX_INPUT_BYTES:raise ValueError('Persisted export input exceeds byte limit')
        if hashlib.sha256(data).hexdigest()!=status.inputSha256:raise ValueError('Export input digest changed')
        submission=JobSubmission.model_validate_json(data)
        if submission.snapshot!=status.snapshot:raise ValueError('Export input snapshot changed')
        return submission

    def remove(self,status:JobStatus)->None:
        # UUID + resolved containment and link checks precede each recursive removal.
        for base in (self.jobs,self.root/'exports'):
            self._remove_directory(base/identity(status.id),base)
        with closing(self._connect()) as db,db:
            db.execute('DELETE FROM jobs WHERE id=?',(str(status.id),))

    @staticmethod
    def _remove_directory(path:Path,base:Path)->None:
        ordinary(path)
        if not path.resolve().is_relative_to(base.resolve()):raise ValueError('Job deletion escapes storage')
        if path.exists():shutil.rmtree(path)
