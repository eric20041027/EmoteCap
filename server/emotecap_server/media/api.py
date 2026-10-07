"""Permission precedes parsing; raw copies and provider work are explicitly bounded."""
import asyncio
from contextlib import asynccontextmanager
from typing import Annotated
from fastapi import APIRouter,HTTPException,Request,Response
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel,ConfigDict,Field,UUID4,ValidationError
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException,MultiPartParser

from .. import gemini
from ..config import Settings
from .consent import ConsentGrants,ConsentRequired,ConsentCapacity,CloudBusy,MAX_VIDEO_BYTES
from .storage import MediaStorage,MediaStorageError

MAX_MULTIPART_BYTES=102*1024*1024
INGRESS_SECONDS=30
router=APIRouter(prefix='/api')

class UploadMetadata(BaseModel):
    model_config=ConfigDict(extra='forbid',allow_inf_nan=False)
    takeId:UUID4
    duration:Annotated[float,Field(gt=0)]

class MediaService:
    def __init__(self,settings:Settings):
        self.settings=settings;self.grants=ConsentGrants();self.storage=MediaStorage(settings.data_dir)

def service_for(request:Request)->MediaService:
    service=getattr(request.app.state,'media',None)
    if service is None:raise HTTPException(503,detail='Local media service is not running')
    return service

def safe_action(action):
    try:return action()
    except ConsentRequired as exc:raise HTTPException(403,detail=str(exc)) from exc
    except (ConsentCapacity,CloudBusy) as exc:raise HTTPException(429,detail=str(exc)) from exc
    except MediaStorageError as exc:raise HTTPException(503,detail=str(exc)[:512]) from exc
    except OSError as exc:raise HTTPException(503,detail='Local temporary storage is unavailable') from exc
    except ValidationError as exc:raise RequestValidationError(exc.errors()) from exc

async def permission_body(request:Request):
    if request.headers.get('content-type','').split(';')[0].strip().lower()!='application/json':
        raise HTTPException(415,detail='Consent metadata must be application/json')
    data=bytearray()
    try:
        async with asyncio.timeout(INGRESS_SECONDS):
            async for chunk in request.stream():
                if len(data)+len(chunk)>4096:raise HTTPException(413,detail='Consent metadata is too large')
                data.extend(chunk)
    except TimeoutError as exc:raise HTTPException(408,detail='Consent request timed out') from exc
    from .consent import ConsentPayload
    try:return ConsentPayload.model_validate_json(bytes(data))
    except ValidationError as exc:raise RequestValidationError(exc.errors()) from exc

@router.post('/cloud-consent')
async def issue_permission(request:Request):
    service=service_for(request)
    if not service.settings.gemini_api_key:raise HTTPException(503,detail='Gemini is not configured on the local service')
    payload=await permission_body(request)
    return safe_action(lambda:service.grants.issue(payload))

class GrantedMultipartParser(MultiPartParser):
    """A single file's streamed byte budget, before spool writes."""
    def __init__(self,*args,grant_size:int,**kwargs):
        super().__init__(*args,**kwargs);self.grant_size=grant_size;self.file_bytes=0
    def on_part_data(self,data,start,end):
        # Verified against the pinned Starlette parser; callbacks run before file writes.
        if self._current_part.file is not None:
            self.file_bytes+=end-start
            if self.file_bytes>MAX_VIDEO_BYTES:raise HTTPException(413,detail='Video exceeds100MiB')
            if self.file_bytes>self.grant_size:raise HTTPException(403,detail='Video bytes do not match the selected-source permission')
        super().on_part_data(data,start,end)

@asynccontextmanager
async def upload_form(request:Request,grant_size:int):
    try:
        declared=request.headers.get('content-length')
        if declared is not None and int(declared)>MAX_MULTIPART_BYTES:raise HTTPException(413,detail='Multipart upload is too large')
    except ValueError as exc:raise HTTPException(400,detail='Invalid Content-Length') from exc
    async def limited_stream():
        copied=0
        async for chunk in request.stream():
            copied+=len(chunk)
            if copied>MAX_MULTIPART_BYTES:raise HTTPException(413,detail='Multipart upload is too large')
            yield chunk
    parser=GrantedMultipartParser(request.headers,limited_stream(),max_files=1,max_fields=2,max_part_size=512,grant_size=grant_size)
    try:
        async with asyncio.timeout(INGRESS_SECONDS):form=await parser.parse()
    except TimeoutError as exc:raise HTTPException(408,detail='Video upload timed out') from exc
    except (MultiPartException,KeyError) as exc:raise HTTPException(422,detail='Invalid multipart video upload') from exc
    try:yield form
    finally:await form.close()

def process_video(service:MediaService,grant,video:UploadFile):
    media=service.storage.begin(grant,video.file)
    # The independent multipart spool is no longer needed before provider processing.
    video.file.close()
    error=None;segments=[]
    try:
        segments=gemini.slice_take(media.path,grant.mimeType,grant.duration,
            api_key=service.settings.gemini_api_key,model=service.settings.gemini_model)
    except gemini.GeminiError as exc:error=exc
    finally:cleanup=service.storage.cleanup(media)
    if error:
        message=str(error).replace(service.settings.gemini_api_key or '\0','***')[:300]
        raise HTTPException(502,detail={'message':message,'fallback':'motion-energy','cleanup':cleanup.model_dump()}) from error
    return {'takeId':str(grant.takeId),'segments':[segment.model_dump() for segment in segments],'cleanup':cleanup.model_dump()}

@router.post('/takes')
async def create_take(request:Request):
    service=service_for(request)
    grant=safe_action(lambda:service.grants.consume(request.headers.get('X-EmoteCap-Consent','')))
    if not service.settings.gemini_api_key:raise HTTPException(503,detail='Gemini is not configured on the local service')
    try:
        with service.grants.enter():
            safe_action(lambda:service.storage.check_budget(grant.size,copies=2))
            async with upload_form(request,grant.size) as form:
                pairs=form.multi_items()
                if sorted(key for key,_ in pairs)!=['duration','takeId','video']:raise HTTPException(422,detail='Provide exactly one video, duration and takeId')
                video=form.get('video')
                if not isinstance(video,UploadFile):raise HTTPException(422,detail='A video file is required')
                try:metadata=UploadMetadata.model_validate({'takeId':form.get('takeId'),'duration':form.get('duration')})
                except ValidationError as exc:raise RequestValidationError(exc.errors()) from exc
                if metadata.duration>180:raise HTTPException(413,detail='The take is longer than180seconds')
                base=(video.content_type or '').split(';')[0].strip().lower()
                if base not in gemini.GEMINI_VIDEO_TYPES|{'video/quicktime','video/x-matroska'}:raise HTTPException(415,detail='Unsupported video type')
                if metadata.takeId!=grant.takeId or abs(metadata.duration-grant.duration)>.001 or gemini.video_mime_type(base)!=grant.mimeType or video.size!=grant.size:
                    raise HTTPException(403,detail='Upload does not match the selected-source permission')
                return await run_in_threadpool(safe_action,lambda:process_video(service,grant,video))
    except CloudBusy as exc:raise HTTPException(429,detail=str(exc)) from exc

@router.get('/media-cleanup')
def cleanup_inventory(request:Request):
    return {'items':safe_action(service_for(request).storage.inventory)}

@router.delete('/media-cleanup/{media_id}',status_code=204)
def cleanup_item(media_id:str,request:Request):
    service=service_for(request)
    try:
        with service.grants.enter():safe_action(lambda:service.storage.delete(media_id))
    except CloudBusy as exc:raise HTTPException(429,detail=str(exc)) from exc
    return Response(status_code=204)
