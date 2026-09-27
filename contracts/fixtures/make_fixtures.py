#!/usr/bin/env python3
"""Generate the shared fixture clips every lane tests against.

Run from the repo root: python3 contracts/fixtures/make_fixtures.py
"""
import json
import math
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONTRACT = json.loads((HERE.parent / "bones.json").read_text())
BONES = CONTRACT["driven"]
H0 = CONTRACT["hipsRestHeight"]
FPS = 30
IDENTITY = [0.0, 0.0, 0.0, 1.0]


def quat_about_z(degrees: float) -> list[float]:
    half = math.radians(degrees) / 2
    return [0.0, 0.0, math.sin(half), math.cos(half)]


def make_frame(t: float, overrides: dict[str, list[float]]) -> dict:
    r: list[float] = []
    for name in BONES:
        r.extend(overrides.get(name, IDENTITY))
    return {"t": round(t, 4), "h": [0.0, H0, 0.0], "r": [round(v, 6) for v in r]}


def make_clip(name: str, loop: bool, frame_count: int, pose_at) -> dict:
    frames = [make_frame(i / FPS, pose_at(i)) for i in range(frame_count)]
    return {"name": name, "loop": loop, "fps": FPS, "frames": frames}


def raise_right_arm(i: int) -> dict[str, list[float]]:
    """0-1 s: right arm rises from T-pose to straight up; 1-2 s: hold.

    The right arm points to -X in T-pose; rotating about +Z by -90 degrees turns -X into +Y.
    Forearm and hand carry the same world delta so the arm stays straight.
    """
    progress = min(i / FPS, 1.0)
    q = quat_about_z(-90.0 * progress)
    return {"RightUpperArm": q, "RightLowerArm": q, "RightHand": q}


def main() -> None:
    fixtures = {
        "tpose.clip.json": make_clip("TPose", True, FPS, lambda i: {}),
        "raise-right-arm.clip.json": make_clip("Raise_Right_Arm", False, 2 * FPS, raise_right_arm),
    }
    for filename, clip in fixtures.items():
        (HERE / filename).write_text(json.dumps(clip, separators=(",", ":")) + "\n")
        print(f"wrote {filename}: {len(clip['frames'])} frames")


if __name__ == "__main__":
    main()
