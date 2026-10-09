"""One durable, finite Blender lane; cancellation serializes with publication."""
import logging
import json
import sqlite3
import threading
import time

from ..config import Settings
from ..exporter import publish_job,unique_names
from .models import JobError,JobFile,JobStatus,JobSubmission,TERMINAL
from .repository import Repository,WorkerLock
from .runner import JobCancelled,run_job

logger=logging.getLogger(__name__)

class QueueFull(Exception):
    """The bounded queue or retained history is full."""
class InvalidAction(Exception):
    """The job's state does not allow this action."""
class ServiceUnavailable(Exception):
    """The worker/storage cannot safely accept an operation."""


class JobService:
    def __init__(self,settings:Settings,runner=run_job,max_waiting:int=4,max_records:int=128):
        if not 1<=max_waiting<=4 or not 1<=max_records<=128:raise ValueError('Invalid export queue bounds')
        self.settings=settings;self.runner=runner;self.max_waiting=max_waiting;self.max_records=max_records
        self.repository=Repository(settings.data_dir)
        self._ownership=WorkerLock(self.repository.jobs/'worker.lock')
        self._condition=threading.Condition(threading.RLock())
        self._thread=None;self._started=False;self._closing=False;self._fatal=None
        self._cancel:dict[str,threading.Event]={}

    def start(self)->None:
        with self._condition:
            if self._started:raise ServiceUnavailable('Export manager already started')
            try:self._ownership.acquire()
            except OSError as exc:raise ServiceUnavailable(f'Export worker already owns this data directory: {exc}') from exc
            try:
                for job in self.repository.list():
                    if job.state not in TERMINAL:
                        self._save(job,state='interrupted',phase='Interrupted by service restart',files=[],
                                   error=JobError(message='Service stopped before this export completed. Retry the saved input.'))
                self._started=True
                self._thread=threading.Thread(target=self._work,name='emotecap-export-worker',daemon=False)
                self._thread.start()
            except Exception:
                self._ownership.release();raise

    def close(self)->None:
        with self._condition:
            if not self._started:return
            self._closing=True
            for cancel in self._cancel.values():cancel.set()
            self._condition.notify_all()
        if self._thread is not None:self._thread.join(timeout=8)
        with self._condition:
            if self._thread is not None and self._thread.is_alive():
                raise ServiceUnavailable('Owned export worker has not stopped; its storage lock is retained')
            self._ownership.release();self._started=False

    def _active(self)->None:
        if not self._started or self._closing or self._fatal:
            raise ServiceUnavailable(self._fatal or 'Export service is not running')

    def _save(self,job:JobStatus,**changes)->JobStatus:
        result=job.model_copy(update={**changes,'updatedAt':int(time.time()*1000)})
        self.repository.save(result);self._condition.notify_all();return result

    def _admit(self,submission:JobSubmission,retry_of=None)->JobStatus:
        self._active();jobs=self.repository.list()
        if len(jobs)>=self.max_records:raise QueueFull('Export history is full. Delete completed jobs before exporting again.')
        waiting=sum(job.state=='queued' for job in jobs)
        # One slot belongs to the worker even before it picks up the first queued record.
        capacity=self.max_waiting+(0 if any(job.state=='running' for job in jobs) else 1)
        if waiting>=capacity:raise QueueFull('Export queue is full. Wait or cancel a queued job.')
        try:job=self.repository.create(submission,retry_of=retry_of)
        except (OSError,sqlite3.Error) as exc:raise ServiceUnavailable(f'Could not save export input: {exc}') from exc
        self._condition.notify_all();return job

    def submit(self,submission:JobSubmission)->JobStatus:
        owned=JobSubmission.model_validate(submission.model_dump(mode='json'))
        with self._condition:return self._admit(owned)

    def get(self,job_id)->JobStatus:
        with self._condition:self._active();return self.repository.get(job_id)

    def list(self)->list[JobStatus]:
        with self._condition:self._active();return list(reversed(self.repository.list()))

    def cancel(self,job_id)->JobStatus:
        with self._condition:
            self._active();job=self.repository.get(job_id)
            if job.state in TERMINAL:return job
            if job.state=='queued':return self._save(job,state='cancelled',phase='Cancelled',cancelRequested=True)
            result=self._save(job,phase='Cancelling',cancelRequested=True)
            self._cancel[job.id].set();return result

    def retry(self,job_id)->JobStatus:
        with self._condition:
            self._active();job=self.repository.get(job_id)
            if job.state not in {'failed','cancelled','interrupted'}:raise InvalidAction('Only failed, cancelled or interrupted jobs can be retried')
            try:original=self.repository.read_input(job)
            except (OSError,ValueError) as exc:raise InvalidAction(f'Original export input is unavailable: {exc}') from exc
            return self._admit(original,retry_of=job.id)

    def delete(self,job_id)->None:
        with self._condition:
            self._active();job=self.repository.get(job_id)
            if job.state not in TERMINAL:raise InvalidAction('Cancel the active job before deleting it')
            self.repository.remove(job)

    def wait(self,job_id,timeout:float)->JobStatus:
        deadline=time.monotonic()+timeout
        with self._condition:
            while True:
                self._active();job=self.repository.get(job_id)
                if job.state in TERMINAL:return job
                remaining=deadline-time.monotonic()
                if remaining<=0:raise ServiceUnavailable('Export is still running; check its job status')
                self._condition.wait(min(remaining,.25))

    def _progress(self,job_id:str,value:int)->None:
        with self._condition:
            job=self.repository.get(job_id)
            if job.state=='running' and not job.cancelRequested:
                self._save(job,progress=min(99,max(job.progress,value)),phase='Exporting animation')

    def _work(self)->None:
        try:
            while True:
                with self._condition:
                    if self._closing:return
                    queued=next((job for job in self.repository.list() if job.state=='queued'),None)
                    if queued is None:self._condition.wait();continue
                    job=self._save(queued,state='running',phase='Starting Blender')
                    cancel=threading.Event();self._cancel[job.id]=cancel
                self._execute(job,cancel)
        except Exception as exc:
            logger.exception('Export worker/storage stopped')
            with self._condition:
                self._fatal=f'Export worker stopped: {str(exc)[:512]}'
                for cancel in self._cancel.values():cancel.set()
                self._condition.notify_all()

    def _execute(self,job:JobStatus,cancel:threading.Event)->None:
        try:
            submission=self.repository.read_input(job)
            names=unique_names([clip.name for clip in submission.clips])
            clips=[clip.model_copy(update={'name':name}) for clip,name in zip(submission.clips,names,strict=True)]
            directory=self.repository.path(job.id)
            # The immutable input is separate from Blender's derived command input.
            json_path=directory/'clips.json'
            json_path.write_text(json.dumps({'clips':[clip.model_dump() for clip in clips]},allow_nan=False),encoding='utf-8')
            self.runner(self.settings,json_path,directory/'out',cancel,lambda value:self._progress(job.id,value))
            with self._condition:
                current=self.repository.get(job.id)
                if cancel.is_set() or current.cancelRequested:raise JobCancelled('Export cancelled')
                files,warning=publish_job(directory/'out',self.settings,job.id,names)
                downloads=[JobFile(name=file.name,url=file.url,sidecar=file.url.removesuffix('.fbx')+'.emotecap.json') for file in files]
                self._save(current,state='succeeded',phase='Ready to download',progress=100,files=downloads,warning=warning[:512] if warning else None)
        except JobCancelled:
            with self._condition:self._save(self.repository.get(job.id),state='cancelled',phase='Cancelled',files=[])
        except Exception as exc:
            with self._condition:
                current=self.repository.get(job.id)
                state='cancelled' if cancel.is_set() or current.cancelRequested else 'failed'
                error=JobError(message=str(exc)[:512],details=getattr(exc,'stderr_tail','')[-65536:])
                self._save(current,state=state,phase='Cancelled' if state=='cancelled' else 'Export failed',files=[],error=error)
        finally:
            with self._condition:self._cancel.pop(job.id,None);self._condition.notify_all()
