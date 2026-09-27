"""POST /api/takes tests. Gemini is always faked: no network, no real API key."""
import copy
import dataclasses
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import httpx
import pytest
from fastapi.testclient import TestClient

from emotecap_server import gemini, main, takes
from emotecap_server.gemini import GeminiError, GeminiTimeoutError

API_KEY = "test-key-not-a-real-key"
MODEL = "gemini-test-model"
VIDEO = b"\x1a\x45\xdf\xa3 fake webm bytes"
FALLBACK = "motion-energy"
GOOD_ANSWER = [
    {"description": "Breathes calmly.", "start": 1.0, "end": 4.5, "name": "Idle_Breathing", "loop": True},
    {"description": "Waves the right hand.", "start": 5.0, "end": 7.2, "name": "Wave_Right", "loop": False},
]
GOOD_SEGMENTS = [
    {"name": "Idle_Breathing", "start": 1.0, "end": 4.5, "loop": True, "description": "Breathes calmly."},
    {"name": "Wave_Right", "start": 5.0, "end": 7.2, "loop": False, "description": "Waves the right hand."},
]


@dataclass(frozen=True)
class GeminiCall:
    video: Path
    video_bytes: bytes
    mime_type: str
    duration: float
    api_key: str
    model: str


@dataclass
class FakeGemini:
    """Replaces gemini.request_segments: returns `answer`, or raises it if it is an exception."""

    answer: Any = field(default_factory=lambda: copy.deepcopy(GOOD_ANSWER))
    calls: list[GeminiCall] = field(default_factory=list)

    def request_segments(
        self, video: Path, mime_type: str, duration: float, *, api_key: str, model: str
    ) -> object:
        self.calls.append(GeminiCall(video, video.read_bytes(), mime_type, duration, api_key, model))
        if isinstance(self.answer, Exception):
            raise self.answer
        return self.answer


@pytest.fixture(autouse=True)
def no_real_gemini_client(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(api_key: str) -> None:
        raise AssertionError("tests must never build a real Gemini client")

    monkeypatch.setattr(gemini, "make_client", refuse)


@pytest.fixture
def data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Gemini configured with a fake key; uploads land in tmp_path."""
    settings = dataclasses.replace(
        main.settings, gemini_api_key=API_KEY, gemini_model=MODEL, data_dir=tmp_path / "data"
    )
    monkeypatch.setattr(main, "settings", settings)
    return settings.data_dir


@pytest.fixture
def fake_gemini(monkeypatch: pytest.MonkeyPatch) -> FakeGemini:
    fake = FakeGemini()
    monkeypatch.setattr(gemini, "request_segments", fake.request_segments)
    return fake


@pytest.fixture
def client() -> TestClient:
    return TestClient(main.app)


def post_take(
    client: TestClient,
    *,
    video: bytes | None = VIDEO,
    content_type: str = "video/webm",
    duration: str | None = "12.5",
) -> httpx.Response:
    files = None if video is None else {"video": ("take.webm", video, content_type)}
    data = None if duration is None else {"duration": duration}
    return client.post("/api/takes", files=files, data=data)


def stored_takes(data_dir: Path) -> list[Path]:
    takes_dir = data_dir / "takes"
    return sorted(takes_dir.iterdir()) if takes_dir.exists() else []


# --- success -------------------------------------------------------------------


def test_take_is_stored_and_sliced_by_gemini(
    client: TestClient, data_dir: Path, fake_gemini: FakeGemini
) -> None:
    res = post_take(client)

    assert res.status_code == 200, res.text
    body = res.json()
    assert set(body) == {"takeId", "segments"}
    assert re.fullmatch(r"[0-9a-f]{32}", body["takeId"])
    assert body["segments"] == GOOD_SEGMENTS
    stored = data_dir / "takes" / f"{body['takeId']}.webm"
    assert stored_takes(data_dir) == [stored]
    assert fake_gemini.calls == [GeminiCall(stored, VIDEO, "video/webm", 12.5, API_KEY, MODEL)]


def test_codec_parameters_are_stripped_before_gemini(
    client: TestClient, data_dir: Path, fake_gemini: FakeGemini
) -> None:
    res = post_take(client, content_type="video/webm;codecs=vp9,opus")

    assert res.status_code == 200, res.text
    assert fake_gemini.calls[0].mime_type == "video/webm"


def test_malformed_gemini_output_is_cleaned(
    client: TestClient, data_dir: Path, fake_gemini: FakeGemini
) -> None:
    fake_gemini.answer = [
        {"name": "wave right!", "start": "5.0", "end": 7.4, "loop": "false", "description": " Waves. "},
        "not a segment",
        {"name": "Idle Breathing", "start": -3, "end": 5.2, "loop": True},
        {"name": "Wave_Right", "start": 9.0, "end": 99.0, "loop": False, "description": "Again."},
        {"name": "Blink", "start": 10.0, "end": 10.1},
        {"start": 1.0},
    ]

    res = post_take(client)

    assert res.status_code == 200, res.text
    assert res.json()["segments"] == [
        {"name": "Idle_Breathing", "start": 0.0, "end": 5.1, "loop": True, "description": ""},
        {"name": "Wave_Right", "start": 5.1, "end": 7.4, "loop": False, "description": "Waves."},
        {"name": "Wave_Right_2", "start": 9.0, "end": 12.5, "loop": False, "description": "Again."},
    ]


# --- errors --------------------------------------------------------------------


def test_without_api_key_returns_503_and_stores_nothing(
    client: TestClient, data_dir: Path, fake_gemini: FakeGemini, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(main, "settings", dataclasses.replace(main.settings, gemini_api_key=None))

    res = post_take(client)

    assert res.status_code == 503
    assert res.json() == {"detail": "Gemini is not configured: set GEMINI_API_KEY in .env"}
    assert fake_gemini.calls == []
    assert stored_takes(data_dir) == []


@pytest.mark.parametrize("content_type", ["text/plain", "application/octet-stream", "image/png"])
def test_non_video_upload_returns_415(
    client: TestClient, data_dir: Path, fake_gemini: FakeGemini, content_type: str
) -> None:
    res = post_take(client, content_type=content_type)

    assert res.status_code == 415
    assert fake_gemini.calls == []
    assert stored_takes(data_dir) == []


def test_upload_over_the_size_limit_returns_413_and_leaves_no_file(
    client: TestClient, data_dir: Path, fake_gemini: FakeGemini, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(takes, "MAX_UPLOAD_BYTES", len(VIDEO) - 1)

    res = post_take(client)

    assert res.status_code == 413
    assert "MB" in res.json()["detail"]
    assert fake_gemini.calls == []
    assert stored_takes(data_dir) == []


def test_upload_exactly_at_the_size_limit_is_accepted(
    client: TestClient, data_dir: Path, fake_gemini: FakeGemini, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(takes, "MAX_UPLOAD_BYTES", len(VIDEO))

    assert post_take(client).status_code == 200


def test_default_limits_are_100_mb_and_3_minutes() -> None:
    assert takes.MAX_UPLOAD_BYTES == 100 * 1024 * 1024
    assert takes.MAX_TAKE_SECONDS == 180


@pytest.mark.parametrize(("duration", "status"), [("180", 200), ("180.1", 413), ("600", 413)])
def test_take_longer_than_3_minutes_returns_413(
    client: TestClient, data_dir: Path, fake_gemini: FakeGemini, duration: str, status: int
) -> None:
    res = post_take(client, duration=duration)

    assert res.status_code == status, res.text
    if status == 413:
        assert fake_gemini.calls == []
        assert stored_takes(data_dir) == []


@pytest.mark.parametrize(
    "error",
    [
        GeminiError("Gemini request failed: 503 UNAVAILABLE: The model is overloaded."),
        GeminiTimeoutError("Gemini did not answer within 30 s"),
    ],
)
def test_gemini_failure_returns_502_with_fallback_hint(
    client: TestClient, data_dir: Path, fake_gemini: FakeGemini, error: GeminiError
) -> None:
    fake_gemini.answer = error

    res = post_take(client)

    assert res.status_code == 502
    assert res.json() == {"detail": {"message": str(error), "fallback": FALLBACK}}
    assert len(stored_takes(data_dir)) == 1  # the upload is kept for debugging


@pytest.mark.parametrize("answer", [[], [{"name": "Wave"}], {"note": "nothing here"}, "nonsense"])
def test_gemini_answer_without_usable_segments_returns_502(
    client: TestClient, data_dir: Path, fake_gemini: FakeGemini, answer: object
) -> None:
    fake_gemini.answer = answer

    res = post_take(client)

    assert res.status_code == 502
    assert res.json()["detail"] == {
        "message": "Gemini found no usable segments in this take",
        "fallback": FALLBACK,
    }


@pytest.mark.parametrize(
    "form",
    [
        {"duration": None},
        {"duration": "abc"},
        {"duration": "0"},
        {"duration": "-3"},
        {"duration": "nan"},
        {"duration": "inf"},
        {"video": None},
    ],
)
def test_invalid_form_returns_422(
    client: TestClient, data_dir: Path, fake_gemini: FakeGemini, form: dict[str, Any]
) -> None:
    res = post_take(client, **form)

    assert res.status_code == 422
    assert fake_gemini.calls == []
