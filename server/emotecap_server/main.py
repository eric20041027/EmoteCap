"""EmoteCap server: FBX export (phase 1), Live Link relay (phase 2), Gemini slicing (phase 3)."""
import logging
import shutil
from typing import Annotated

from fastapi import FastAPI, File, Form, HTTPException, UploadFile, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import exporter, gemini, takes
from .config import load_settings
from .contract import ExportRequest, ExportResponse, TakeResponse
from .relay import LiveRelay

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s - %(message)s")
logger = logging.getLogger(__name__)

GEMINI_NOT_CONFIGURED = "Gemini is not configured: set GEMINI_API_KEY in .env"
MOTION_ENERGY_FALLBACK = "motion-energy"  # tells the web app to slice the take locally instead

settings = load_settings()
exports_dir = settings.data_dir / "exports"
exports_dir.mkdir(parents=True, exist_ok=True)  # StaticFiles refuses a missing directory
relay = LiveRelay()

app = FastAPI(title="EmoteCap")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict:
    return {
        "ok": True,
        "blender": shutil.which(settings.blender_path) is not None,
        "gemini": settings.gemini_api_key is not None,
    }


@app.post("/api/export")
def export(request: ExportRequest) -> ExportResponse:
    """Sync on purpose: FastAPI runs it in a threadpool while Blender works."""
    try:
        files = exporter.export_clips(request.clips, settings)
    except exporter.ExportError as exc:
        logger.error("Export failed: %s\n%s", exc.message, exc.stderr_tail)
        raise HTTPException(
            status_code=500, detail={"message": exc.message, "stderr": exc.stderr_tail}
        ) from exc
    return ExportResponse(files=files)


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
