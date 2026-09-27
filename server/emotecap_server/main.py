"""EmoteCap server: FBX export (phase 1), Live Link relay (phase 2), Gemini slicing (phase 3)."""
import shutil

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import load_settings

settings = load_settings()
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
