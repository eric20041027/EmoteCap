"""Bounded JSON ingress and explicit export-job actions."""
import asyncio
import sqlite3
from fastapi import APIRouter,HTTPException,Request,Response
from fastapi.exceptions import RequestValidationError
from pydantic import UUID4,ValidationError
from starlette.concurrency import run_in_threadpool

from .models import JobSubmission,MAX_INPUT_BYTES
from .service import JobService,QueueFull,InvalidAction,ServiceUnavailable

MAX_REQUEST_BYTES=MAX_INPUT_BYTES
router=APIRouter(prefix='/api/export-jobs')


def get_service(request:Request)->JobService:
    service=getattr(request.app.state,'jobs',None)
    if service is None:raise HTTPException(503,detail='Export service is not running')
    return service


def invoke(action):
    try:return action()
    except KeyError as exc:raise HTTPException(404,detail='Export job not found') from exc
    except QueueFull as exc:raise HTTPException(429,detail=str(exc)) from exc
    except InvalidAction as exc:raise HTTPException(409,detail=str(exc)) from exc
    except (ServiceUnavailable,OSError,sqlite3.Error,ValueError) as exc:
        raise HTTPException(503,detail=str(exc)[:512]) from exc


async def read_submission(request:Request)->JobSubmission:
    if request.headers.get('content-type','').split(';')[0].strip().lower()!='application/json':
        raise HTTPException(415,detail='Export input must be application/json')
    declared=request.headers.get('content-length')
    if declared is not None:
        try:length=int(declared)
        except ValueError as exc:raise HTTPException(400,detail='Invalid Content-Length') from exc
        if length<0:raise HTTPException(400,detail='Invalid Content-Length')
        if length>MAX_REQUEST_BYTES:raise HTTPException(413,detail='Export input exceeds byte limit')
    data=bytearray()
    try:
        async with asyncio.timeout(30):
            async for chunk in request.stream():
                if len(data)+len(chunk)>MAX_REQUEST_BYTES:raise HTTPException(413,detail='Export input exceeds byte limit')
                data.extend(chunk)
    except TimeoutError as exc:raise HTTPException(408,detail='Export input timed out') from exc
    try:return await run_in_threadpool(JobSubmission.model_validate_json,bytes(data))
    except ValidationError as exc:raise RequestValidationError(exc.errors()) from exc


@router.post('',status_code=202)
async def submit(request:Request):
    service=get_service(request);submission=await read_submission(request)
    return await run_in_threadpool(invoke,lambda:service.submit(submission))


@router.get('')
def list_jobs(request:Request):
    return {'jobs':invoke(get_service(request).list)}


@router.get('/{job_id}')
def get_job(job_id:UUID4,request:Request):
    return invoke(lambda:get_service(request).get(str(job_id)))


@router.post('/{job_id}/cancel')
def cancel_job(job_id:UUID4,request:Request):
    return invoke(lambda:get_service(request).cancel(str(job_id)))


@router.post('/{job_id}/retry',status_code=202)
def retry_job(job_id:UUID4,request:Request):
    return invoke(lambda:get_service(request).retry(str(job_id)))


@router.delete('/{job_id}',status_code=204)
def delete_job(job_id:UUID4,request:Request):
    invoke(lambda:get_service(request).delete(str(job_id)))
    return Response(status_code=204)
