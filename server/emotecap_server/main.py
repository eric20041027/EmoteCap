"""EmoteCap server: FBX export (phase 1), Live Link relay (phase 2), Gemini slicing (phase 3)."""
import logging
import shutil

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import exporter
from .config import load_settings
from .contract import ExportRequest, ExportResponse

logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s - %(message)s")
logger = logging.getLogger(__name__)

settings = load_settings()
exports_dir = settings.data_dir / "exports"
exports_dir.mkdir(parents=True, exist_ok=True)  # StaticFiles refuses a missing directory

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


app.mount("/files", StaticFiles(directory=exports_dir), name="files")
