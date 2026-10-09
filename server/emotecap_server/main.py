"""EmoteCap server: FBX export (phase 1), Live Link relay (phase 2), Gemini slicing (phase 3)."""
import logging
import shutil
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, WebSocket
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.concurrency import run_in_threadpool

from .config import load_settings
from .contract import ExportedFile, ExportResponse
from .jobs.api import router as jobs_router,get_service,invoke,read_submission
from .jobs.service import JobService,ServiceUnavailable
from .jobs.runner import TIMEOUT_SECONDS
from .media.api import MediaService,router as media_router
from .relay import LiveRelay
from .live.api import router as live_router

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
    try:
        application.state.media=MediaService(settings)
        yield
    finally:
        await relay.aclose()
        service.close()
        del application.state.jobs
        if hasattr(application.state,'media'):del application.state.media


app = FastAPI(title="EmoteCap",lifespan=lifespan)
app.include_router(jobs_router)
app.include_router(media_router)
app.include_router(live_router)
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
    # The last admitted job may wait behind four healthy120second runs.
    wait_budget=(service.max_waiting+1)*(TIMEOUT_SECONDS+10)
    try:result=await run_in_threadpool(service.wait,job.id,wait_budget)
    except ServiceUnavailable as exc:
        raise HTTPException(503,detail={'message':str(exc)[:512],'jobId':job.id,
                                       'statusUrl':f'/api/export-jobs/{job.id}'}) from exc
    if result.state!='succeeded':
        error=result.error
        raise HTTPException(500 if result.state=='failed' else 409,detail={
            'message':error.message if error else result.phase,'stderr':error.details if error else ''})
    return ExportResponse(files=[ExportedFile(name=file.name,url=file.url) for file in result.files])


@app.websocket("/ws/live")
async def live_link(websocket: WebSocket, role: str | None = None) -> None:
    """Local Live Link requires a role-specific paired v2 hello before frames."""
    await relay.serve(websocket, role)


app.mount("/files", StaticFiles(directory=exports_dir), name="files")
