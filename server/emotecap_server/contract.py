"""Pydantic mirror of contracts/motion-v1.md."""
import json
import math
from pathlib import Path
from typing import Annotated, Literal, Self

from pydantic import BaseModel, ConfigDict, Field, model_validator

_BONES_PATH = Path(__file__).resolve().parents[2] / "contracts" / "bones.json"
BONES: list[str] = json.loads(_BONES_PATH.read_text())["driven"]
BONE_COUNT = len(BONES)
CLIP_NAME_PATTERN = r"^[A-Za-z0-9_]{1,24}$"
MAX_FPS = 120
MAX_CLIP_SECONDS = 180


class MotionFrame(BaseModel):
    model_config = ConfigDict(allow_inf_nan=False)
    t: Annotated[float, Field(ge=0, le=MAX_CLIP_SECONDS)]
    h: Annotated[list[float], Field(min_length=3, max_length=3)]
    r: Annotated[list[float], Field(min_length=BONE_COUNT * 4, max_length=BONE_COUNT * 4)]

    @model_validator(mode="after")
    def validate_pose(self) -> Self:
        if abs(self.h[0]) > 0.000001 or abs(self.h[2]) > 0.000001:
            raise ValueError("in-place motion requires zero horizontal hips translation")
        for index in range(0, len(self.r), 4):
            norm = math.sqrt(sum(value * value for value in self.r[index:index + 4]))
            # Compare endpoints directly so 0.98 and 1.02 remain inclusive.
            if not 0.98 <= norm <= 1.02:
                raise ValueError(f"quaternion {index // 4} must have unit length within 0.02")
        return self


class Clip(BaseModel):
    name: Annotated[str, Field(pattern=CLIP_NAME_PATTERN)]
    loop: bool
    fps: Annotated[int, Field(ge=1, le=MAX_FPS)]
    frames: Annotated[
        list[MotionFrame], Field(min_length=1, max_length=MAX_FPS * MAX_CLIP_SECONDS + 1)
    ]
    # "full": 52 exported bones incl. fingers; "body": 22 bones, finger bones left out of the FBX.
    skeleton: Literal["full", "body"] = "full"

    @model_validator(mode="after")
    def validate_timeline(self) -> Self:
        if self.frames[0].t != 0:
            raise ValueError("clip must start at t=0")
        if any(right.t <= left.t for left, right in zip(self.frames, self.frames[1:])):
            raise ValueError("clip timestamps must be strictly increasing")
        return self


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
