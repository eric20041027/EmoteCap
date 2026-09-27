"""Pydantic mirror of contracts/motion-v1.md."""
import json
from pathlib import Path
from typing import Annotated

from pydantic import BaseModel, Field

_BONES_PATH = Path(__file__).resolve().parents[2] / "contracts" / "bones.json"
BONES: list[str] = json.loads(_BONES_PATH.read_text())["driven"]
BONE_COUNT = len(BONES)
CLIP_NAME_PATTERN = r"^[A-Za-z0-9_]{1,24}$"
MAX_FPS = 120
MAX_CLIP_SECONDS = 180


class MotionFrame(BaseModel):
    t: float
    h: Annotated[list[float], Field(min_length=3, max_length=3)]
    r: Annotated[list[float], Field(min_length=BONE_COUNT * 4, max_length=BONE_COUNT * 4)]


class Clip(BaseModel):
    name: Annotated[str, Field(pattern=CLIP_NAME_PATTERN)]
    loop: bool
    fps: Annotated[int, Field(ge=1, le=MAX_FPS)]
    frames: Annotated[list[MotionFrame], Field(min_length=1, max_length=MAX_FPS * MAX_CLIP_SECONDS)]


class ExportRequest(BaseModel):
    clips: Annotated[list[Clip], Field(min_length=1, max_length=50)]


class ExportedFile(BaseModel):
    name: str
    url: str


class ExportResponse(BaseModel):
    files: list[ExportedFile]


class Segment(BaseModel):
    name: Annotated[str, Field(pattern=CLIP_NAME_PATTERN)]
    start: float
    end: float
    loop: bool
    description: str = ""


class TakeResponse(BaseModel):
    takeId: str  # wire name from contracts/motion-v1.md (POST /api/takes)
    segments: list[Segment]
