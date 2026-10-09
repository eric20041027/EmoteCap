"""Runtime settings, loaded from the repo-root .env."""
import os
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[2]
SERVER_DIR = REPO_ROOT / "server"
DEFAULT_GEMINI_MODEL = "gemini-3.8-flash"

load_dotenv(Path(os.getenv('EMOTECAP_ENV_FILE') or str(REPO_ROOT/'.env')))


@dataclass(frozen=True)
class Settings:
    port: int
    blender_path: str
    unity_export_dir: Path | None
    gemini_api_key: str | None
    gemini_model: str
    data_dir: Path
    bones_path: Path


def load_settings() -> Settings:
    unity_dir = os.getenv("UNITY_EXPORT_DIR", "").strip()
    return Settings(
        port=int(os.getenv("PORT", "8787")),
        blender_path=os.getenv("BLENDER_PATH", "/Applications/Blender.app/Contents/MacOS/Blender"),
        unity_export_dir=Path(unity_dir) if unity_dir else None,
        gemini_api_key=os.getenv("GEMINI_API_KEY") or None,
        gemini_model=os.getenv("GEMINI_MODEL", "").strip() or DEFAULT_GEMINI_MODEL,
        data_dir=Path(os.environ['EMOTECAP_DATA_DIR']).resolve() if os.getenv('EMOTECAP_DATA_DIR') else SERVER_DIR/'data',
        bones_path=REPO_ROOT / "contracts" / "bones.json",
    )
