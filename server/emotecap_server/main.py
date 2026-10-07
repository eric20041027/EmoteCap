"""EmoteCap server: FBX export (phase 1), Live Link relay (phase 2), Gemini slicing (phase 3)."""
import logging
import shutil
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile, WebSocket
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from . import exporter, gemini, takes
from .config import load_settings
from .contract import ExportedFile, ExportResponse, TakeResponse
from .jobs.api import router as jobs_router,get_service,invoke,read_submission
from .jobs.service import JobService
from .relay import LiveRelay

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s - %(message)s")
logger = logging.getLogger(__name__)

GEMINI_NOT_CONFIGURED = "Gemini is not configured: set GEMINI_API_KEY in .env"
MOTION_ENERGY_FALLBACK = "motion-energy"  # tells the web app to slice the take locally instead

settings = load_settings()
exports_dir = settings.data_dir / "exports"
exports_dir.mkdir(parents=True, exist_ok=True)  # StaticFiles refuses a missing directory
relay = LiveRelay()

@asynccontextmanager
async def lifespan(application:FastAPI):
    service=JobService(settings)
    service.start();application.state.jobs=service
    try:yield
    finally:
        service.close()
        del application.state.jobs


app = FastAPI(title="EmoteCap",lifespan=lifespan)
app.include_router(jobs_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def invalid_request(_: Request, exc: RequestValidationError) -> JSONResponse:
    # Raw input/exception context can contain non-finite floats or the entire take.
    detail = [
        {"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": detail})


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "blender": shutil.which(settings.blender_path) is not None,
        "gemini": settings.gemini_api_key is not None,
        "exportJobs": 1,
    }


@app.post("/api/export")
async def export(request: Request) -> ExportResponse:
    """Compatibility adapter; every HTTP export runs through the same finite worker."""
    service=get_service(request);submission=await read_submission(request)
    job=await run_in_threadpool(invoke,lambda:service.submit(submission))
    result=await run_in_threadpool(invoke,lambda:service.wait(job.id,130))
    if result.state!='succeeded':
        error=result.error
        raise HTTPException(500 if result.state=='failed' else 409,detail={
            'message':error.message if error else result.phase,'stderr':error.details if error else ''})
    return ExportResponse(files=[ExportedFile(name=file.name,url=file.url) for file in result.files])


@app.post("/api/takes")
def create_take(
    video: Annotated[UploadFile, File(description="The recorded take (webm)")],
    duration: Annotated[float, Form(gt=0, allow_inf_nan=False, description="Take length in seconds")],
) -> TakeResponse:
    """Phase 3: store the take's video and let Gemini split it into named segments.

    Sync on purpose: FastAPI runs it in a threadpool while Gemini works (up to 30 s).
    """
    api_key = settings.gemini_api_key
    if api_key is None:
        raise HTTPException(status_code=503, detail=GEMINI_NOT_CONFIGURED)
    mime_type = gemini.video_mime_type(video.content_type)
    if mime_type is None:
        raise HTTPException(status_code=415, detail="The upload must be a video (video/webm)")
    if duration > takes.MAX_TAKE_SECONDS:
        raise HTTPException(
            status_code=413, detail=f"The take is longer than {takes.MAX_TAKE_SECONDS:g} s"
        )
    take_id = takes.new_take_id()
    try:
        video_path = takes.store_upload(video.file, settings.data_dir / "takes", take_id)
    except takes.TakeTooLargeError as exc:
        raise HTTPException(status_code=413, detail=str(exc)) from exc
    try:
        segments = gemini.slice_take(
            video_path, mime_type, duration, api_key=api_key, model=settings.gemini_model
        )
    except gemini.GeminiError as exc:
        logger.warning("Take %s: Gemini slicing failed, web app falls back: %s", take_id, exc)
        raise HTTPException(
            status_code=502, detail={"message": str(exc), "fallback": MOTION_ENERGY_FALLBACK}
        ) from exc
    return TakeResponse(takeId=take_id, segments=segments)


@app.websocket("/ws/live")
async def live_link(websocket: WebSocket, role: str | None = None) -> None:
    """Phase 2 Live Link: ?role=source (browser) or ?role=sink (Unity)."""
    await relay.serve(websocket, role)


app.mount("/files", StaticFiles(directory=exports_dir), name="files")
