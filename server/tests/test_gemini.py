"""Gemini slicing tests with a fake genai client: no network, no real API key."""
import base64
import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Self

import httpx
import pytest
from google import genai
from google.genai import _transformers, types
from google.genai import errors as genai_errors

from emotecap_server import gemini
from emotecap_server.contract import Segment
from emotecap_server.gemini import (
    GeminiError,
    GeminiTimeoutError,
    request_segments,
    slice_take,
)

API_KEY = "test-key-not-a-real-key"
MODEL = "gemini-test-model"
DURATION = 12.0
VIDEO_BYTES = b"\x1a\x45\xdf\xa3 not really a webm"
FILE_NAME = "files/take-123"
FILE_URI = "https://generativelanguage.googleapis.com/v1beta/files/take-123"
WAVE = {"name": "Wave_Right", "start": 1.0, "end": 2.5, "loop": False, "description": "Waves."}


def answer(
    text: str | None, finish_reason: types.FinishReason = types.FinishReason.STOP
) -> types.GenerateContentResponse:
    parts = None if text is None else [types.Part(text=text)]
    candidate = types.Candidate(content=types.Content(role="model", parts=parts), finish_reason=finish_reason)
    return types.GenerateContentResponse(candidates=[candidate])


@dataclass
class GenerateCall:
    model: str
    contents: list[types.Content]
    config: types.GenerateContentConfig


@dataclass
class FakeGenai:
    """Stands in for genai.Client: records calls, answers `response`, raises `error` if set."""

    response: types.GenerateContentResponse = field(default_factory=lambda: answer(json.dumps([WAVE])))
    error: Exception | None = None
    errors_by_model: dict[str, Exception] = field(default_factory=dict)
    file_states: list[types.FileState] = field(default_factory=lambda: [types.FileState.ACTIVE])
    api_keys: list[str] = field(default_factory=list)
    generate_calls: list[GenerateCall] = field(default_factory=list)
    uploads: list[tuple[Any, types.UploadFileConfig]] = field(default_factory=list)
    gets: list[str] = field(default_factory=list)
    deletes: list[str] = field(default_factory=list)
    delete_error: Exception | None = None
    closed: bool = False

    def make_client(self, api_key: str) -> Self:
        self.api_keys.append(api_key)
        return self

    # Client surface: context manager + .models + .files
    def __enter__(self) -> Self:
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.closed = True

    @property
    def models(self) -> Self:
        return self

    @property
    def files(self) -> Self:
        return self

    def generate_content(
        self, *, model: str, contents: list[types.Content], config: types.GenerateContentConfig
    ) -> types.GenerateContentResponse:
        self.generate_calls.append(GenerateCall(model, contents, config))
        error = self.errors_by_model.get(model, self.error)
        if error is not None:
            raise error
        return self.response

    def upload(self, *, file: Any, config: types.UploadFileConfig) -> types.File:
        self.uploads.append((file, config))
        return self._file(0)

    def get(self, *, name: str, config: types.GetFileConfig) -> types.File:
        self.gets.append(name)
        return self._file(len(self.gets))

    def delete(self, *, name: str, config: types.DeleteFileConfig) -> None:
        self.deletes.append(name)
        if self.delete_error:raise self.delete_error

    def _file(self, poll: int) -> types.File:
        state = self.file_states[min(poll, len(self.file_states) - 1)]
        error = types.FileStatus(message="unsupported codec") if state == types.FileState.FAILED else None
        return types.File(name=FILE_NAME, uri=FILE_URI, mime_type="video/webm", state=state, error=error)


@pytest.fixture
def fake(monkeypatch: pytest.MonkeyPatch) -> FakeGenai:
    fake_genai = FakeGenai()
    monkeypatch.setattr(gemini, "make_client", fake_genai.make_client)
    monkeypatch.setattr(gemini, "FILE_POLL_INTERVAL_S", 0.001)
    return fake_genai


@pytest.fixture
def video(tmp_path: Path) -> Path:
    path = tmp_path / "take.webm"
    path.write_bytes(VIDEO_BYTES)
    return path


def request(video: Path, **overrides: Any) -> object:
    return request_segments(video, "video/webm", DURATION, api_key=API_KEY, model=MODEL, **overrides)


# --- request shape -------------------------------------------------------------


def test_small_video_is_sent_inline_at_5_fps_with_a_json_schema(fake: FakeGenai, video: Path) -> None:
    raw = request(video)

    assert raw == [WAVE]
    [call] = fake.generate_calls
    assert call.model == MODEL
    [content] = call.contents
    video_part, text_part = content.parts
    assert video_part.inline_data == types.Blob(data=VIDEO_BYTES, mime_type="video/webm")
    assert video_part.file_data is None
    assert video_part.video_metadata == types.VideoMetadata(fps=5)
    assert "12.0 seconds" in text_part.text
    assert call.config.response_mime_type == "application/json"
    assert call.config.response_schema == gemini.RESPONSE_SCHEMA
    assert 0 < call.config.http_options.timeout <= 30_000
    assert call.config.automatic_function_calling.disable is True
    assert fake.api_keys == [API_KEY]
    assert fake.uploads == []
    assert fake.closed


def test_large_video_goes_through_the_files_api_and_is_deleted_after(
    fake: FakeGenai, video: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(gemini, "INLINE_MAX_BYTES", len(VIDEO_BYTES) - 1)
    fake.file_states = [types.FileState.PROCESSING, types.FileState.PROCESSING, types.FileState.ACTIVE]

    assert request(video) == [WAVE]

    [(uploaded, upload_config)] = fake.uploads
    assert Path(uploaded) == video
    assert upload_config.mime_type == "video/webm"
    assert fake.gets == [FILE_NAME, FILE_NAME]  # polled until ACTIVE
    [call] = fake.generate_calls
    video_part = call.contents[0].parts[0]
    assert video_part.file_data == types.FileData(file_uri=FILE_URI, mime_type="video/webm")
    assert video_part.inline_data is None
    assert video_part.video_metadata == types.VideoMetadata(fps=5)
    assert fake.deletes == [FILE_NAME]


def test_response_schema_is_an_array_of_segments_the_sdk_accepts() -> None:
    schema = _transformers.t_schema(None, gemini.RESPONSE_SCHEMA)

    assert schema.type == types.Type.ARRAY
    assert set(schema.items.required) == {"name", "start", "end", "loop", "description"}
    assert schema.items.property_ordering[-2:] == ["name", "loop"]  # name after description + times


def test_system_prompt_covers_the_slicing_rules() -> None:
    prompt = gemini.SYSTEM_PROMPT

    for phrase in ["ONE continuous", "walking back", "PascalCase_With_Underscores", "24 characters",
                   "Idle_Breathing", "one decimal", "loop", "not overlap", "actor's own"]:
        assert phrase in prompt, phrase


# --- failures ------------------------------------------------------------------


def test_failed_file_processing_raises_and_still_deletes_the_upload(
    fake: FakeGenai, video: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(gemini, "INLINE_MAX_BYTES", 0)
    fake.file_states = [types.FileState.PROCESSING, types.FileState.FAILED]

    with pytest.raises(GeminiError, match="unsupported codec"):
        request(video)

    assert fake.generate_calls == []
    assert fake.deletes == [FILE_NAME]


def test_file_still_processing_when_the_budget_runs_out_times_out(
    fake: FakeGenai, video: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(gemini, "INLINE_MAX_BYTES", 0)
    fake.file_states = [types.FileState.PROCESSING]

    with pytest.raises(GeminiTimeoutError, match="did not answer within 0.05 s"):
        request(video, timeout_s=0.05)

    assert fake.generate_calls == []


def test_sdk_api_error_becomes_gemini_error_with_code_and_message(fake: FakeGenai, video: Path) -> None:
    fake.error = genai_errors.ServerError(
        503, {"error": {"code": 503, "message": "The model is overloaded.", "status": "UNAVAILABLE"}}
    )

    with pytest.raises(GeminiError, match=r"^Gemini request failed: 503 UNAVAILABLE: The model is overloaded\.$"):
        request(video)


OVERLOADED = genai_errors.ServerError(
    503, {"error": {"code": 503, "message": "This model is currently experiencing high demand.", "status": "UNAVAILABLE"}}
)


def test_overloaded_model_falls_back_to_the_next_model(fake: FakeGenai, video: Path) -> None:
    fake.errors_by_model[MODEL] = OVERLOADED

    assert request(video) == [WAVE]
    assert [call.model for call in fake.generate_calls] == [MODEL, gemini.FALLBACK_MODELS[0]]


def test_other_errors_do_not_fall_back(fake: FakeGenai, video: Path) -> None:
    fake.errors_by_model[MODEL] = genai_errors.ClientError(
        400, {"error": {"code": 400, "message": "Bad video.", "status": "INVALID_ARGUMENT"}}
    )

    with pytest.raises(GeminiError, match="400 INVALID_ARGUMENT"):
        request(video)
    assert [call.model for call in fake.generate_calls] == [MODEL]


def test_fallback_skips_the_configured_model_and_uploads_a_large_video_once(
    fake: FakeGenai, video: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(gemini, "INLINE_MAX_BYTES", 1)
    first, second = gemini.FALLBACK_MODELS[0], gemini.FALLBACK_MODELS[1]
    fake.errors_by_model[first] = OVERLOADED

    assert request_segments(video, "video/webm", DURATION, api_key=API_KEY, model=first) == [WAVE]
    assert [call.model for call in fake.generate_calls] == [first, second]
    assert len(fake.uploads) == 1
    assert fake.deletes == [FILE_NAME]


def test_error_messages_never_contain_the_api_key(fake: FakeGenai, video: Path) -> None:
    fake.error = RuntimeError(f"bad header x-goog-api-key: {API_KEY}")

    with pytest.raises(GeminiError) as raised:
        request(video)

    assert API_KEY not in str(raised.value)
    assert "RuntimeError" in str(raised.value)


@pytest.mark.parametrize(
    "error",
    [
        httpx.ReadTimeout("The read operation timed out"),
        genai_errors.ServerError(504, {"error": {"code": 504, "message": "Deadline", "status": "DEADLINE_EXCEEDED"}}),
    ],
)
def test_http_timeouts_become_gemini_timeout(fake: FakeGenai, video: Path, error: Exception) -> None:
    fake.error = error

    with pytest.raises(GeminiTimeoutError, match="did not answer within 30 s"):
        request(video)


@pytest.mark.parametrize(
    ("response", "message"),
    [
        (answer("Here are your clips!"), "not valid JSON"),
        (answer(None, types.FinishReason.SAFETY), "no answer .*SAFETY"),
        (answer('[{"name": "Wave", "start": 1.0, "end"'), "not valid JSON"),
    ],
)
def test_unusable_answer_raises(
    fake: FakeGenai, video: Path, response: types.GenerateContentResponse, message: str
) -> None:
    fake.response = response

    with pytest.raises(GeminiError, match=message):
        request(video)


def test_code_fenced_json_is_accepted(fake: FakeGenai, video: Path) -> None:
    fake.response = answer(f"```json\n{json.dumps([WAVE])}\n```")

    assert request(video) == [WAVE]


# --- slice_take ----------------------------------------------------------------


def test_slice_take_returns_cleaned_segments(fake: FakeGenai, video: Path) -> None:
    fake.response = answer(json.dumps([
        {"name": "jump in place", "start": 5.0, "end": 7.2, "loop": False, "description": "Jumps."},
        {"name": "Idle Breathing", "start": -1.0, "end": 5.4, "loop": True, "description": "Breathes."},
        {"name": "Oops", "start": 11.0, "end": 11.1, "loop": False, "description": "Too short."},
    ]))

    segments = slice_take(video, "video/webm", DURATION, api_key=API_KEY, model=MODEL)

    assert segments == [
        Segment(name="Idle_Breathing", start=0.0, end=5.2, loop=True, description="Breathes."),
        Segment(name="Jump_In_Place", start=5.2, end=7.2, loop=False, description="Jumps."),
    ]


@pytest.mark.parametrize("text", ["[]", '[{"name": "Wave"}]', '{"note": "no actions"}'])
def test_slice_take_without_usable_segments_raises(fake: FakeGenai, video: Path, text: str) -> None:
    fake.response = answer(text)

    with pytest.raises(GeminiError, match="no usable segments"):
        slice_take(video, "video/webm", DURATION, api_key=API_KEY, model=MODEL)


# --- video_mime_type -----------------------------------------------------------


@pytest.mark.parametrize(
    ("content_type", "expected"),
    [
        ("video/webm", "video/webm"),
        ("video/webm;codecs=vp9,opus", "video/webm"),
        ("VIDEO/MP4", "video/mp4"),
        ("video/quicktime", "video/mov"),
        ("video/x-matroska;codecs=avc1", "video/webm"),
        ("text/plain", None),
        ("application/octet-stream", None),
        ("video/", None),
        ("", None),
        (None, None),
    ],
)
def test_video_mime_type(content_type: str | None, expected: str | None) -> None:
    assert gemini.video_mime_type(content_type) == expected


# --- the real SDK against an offline transport -----------------------------------


API_ROOT = "https://generativelanguage.googleapis.com"
GENERATE_PATH = f"/v1beta/models/{MODEL}:generateContent"
UPLOAD_URL = f"{API_ROOT}/upload/v1beta/files?upload_id=u1&upload_protocol=resumable"
REMOTE_FILE = {"name": FILE_NAME, "uri": FILE_URI, "mimeType": "video/webm"}


def fake_gemini_api(request: httpx.Request) -> httpx.Response:
    """Just enough of the Gemini REST API (generateContent + resumable Files API) for the SDK."""
    path, url = request.url.path, str(request.url)
    if path == GENERATE_PATH:
        text = json.dumps([WAVE])
        candidate = {"content": {"role": "model", "parts": [{"text": text}]}, "finishReason": "STOP"}
        return httpx.Response(200, json={"candidates": [candidate]})
    if path == "/upload/v1beta/files":
        if "upload_id" not in url:
            return httpx.Response(200, headers={"x-goog-upload-url": UPLOAD_URL}, json={})
        file = {**REMOTE_FILE, "state": "PROCESSING"}
        return httpx.Response(200, headers={"x-goog-upload-status": "final"}, json={"file": file})
    if path == f"/v1beta/{FILE_NAME}" and request.method == "GET":
        return httpx.Response(200, json={**REMOTE_FILE, "state": "ACTIVE"})
    if path == f"/v1beta/{FILE_NAME}" and request.method == "DELETE":
        return httpx.Response(200, json={})
    return httpx.Response(404, json={"error": {"code": 404, "message": path, "status": "NOT_FOUND"}})


@pytest.fixture
def sent(monkeypatch: pytest.MonkeyPatch) -> list[httpx.Request]:
    """Build real genai.Clients whose HTTP goes to fake_gemini_api; collect every request."""
    requests: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return fake_gemini_api(request)

    def make_offline_client(api_key: str) -> genai.Client:
        transport = httpx.Client(transport=httpx.MockTransport(handler))
        return genai.Client(api_key=api_key, http_options=types.HttpOptions(httpx_client=transport))

    monkeypatch.setattr(gemini, "make_client", make_offline_client)
    monkeypatch.setattr(gemini, "FILE_POLL_INTERVAL_S", 0.001)
    return requests


def test_sdk_sends_inline_video_with_metadata_schema_and_key_header(
    sent: list[httpx.Request], video: Path
) -> None:
    assert request(video) == [WAVE]

    [generate] = sent
    assert generate.url.path == GENERATE_PATH
    assert generate.headers["x-goog-api-key"] == API_KEY
    assert API_KEY not in str(generate.url) and API_KEY.encode() not in generate.content
    assert 0 < int(generate.headers["x-server-timeout"]) <= 30
    body = json.loads(generate.content)
    video_part, text_part = body["contents"][0]["parts"]
    assert base64.urlsafe_b64decode(video_part["inlineData"]["data"]) == VIDEO_BYTES
    assert video_part["videoMetadata"] == {"fps": 5}
    assert "12.0 seconds" in text_part["text"]
    assert body["systemInstruction"]["parts"][0]["text"] == gemini.SYSTEM_PROMPT
    assert body["generationConfig"]["responseMimeType"] == "application/json"
    assert body["generationConfig"]["responseSchema"]["type"] == "ARRAY"


def test_sdk_uploads_polls_generates_and_deletes_for_a_large_video(
    sent: list[httpx.Request], video: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(gemini, "INLINE_MAX_BYTES", 0)

    assert request(video) == [WAVE]

    assert [(r.method, r.url.path) for r in sent] == [
        ("POST", "/upload/v1beta/files"),  # start the resumable upload
        ("POST", "/upload/v1beta/files"),  # send the bytes and finalize
        ("GET", f"/v1beta/{FILE_NAME}"),  # poll until ACTIVE
        ("POST", GENERATE_PATH),
        ("DELETE", f"/v1beta/{FILE_NAME}"),
    ]
    assert sent[1].content == VIDEO_BYTES
    generate_body = json.loads(sent[3].content)
    assert FILE_URI in json.dumps(generate_body["contents"][0]["parts"][0])
    assert generate_body["contents"][0]["parts"][0]["videoMetadata"] == {"fps": 5}


def test_remote_delete_failure_preserves_result_and_is_visible(fake,video,monkeypatch):
    monkeypatch.setattr(gemini,'INLINE_MAX_BYTES',0);fake.delete_error=OSError('delete failed '+API_KEY)
    report=gemini.CleanupReport()
    assert gemini.slice_take(video,'video/webm',DURATION,api_key=API_KEY,model=MODEL,cleanup=report)
    assert report.remoteFiles=='failed' and report.warning and API_KEY not in report.warning
    assert fake.deletes==[FILE_NAME]


def test_generation_and_delete_failure_preserve_the_original_error(fake,video,monkeypatch):
    monkeypatch.setattr(gemini,'INLINE_MAX_BYTES',0);fake.error=ValueError('original provider failure');fake.delete_error=OSError('cleanup failure')
    report=gemini.CleanupReport()
    with pytest.raises(GeminiError,match='original provider failure'):
        gemini.slice_take(video,'video/webm',DURATION,api_key=API_KEY,model=MODEL,cleanup=report)
    assert report.remoteFiles=='failed' and report.warning


def test_unconfirmed_upload_is_unknown_and_never_deletes_unrelated_files(fake,video,monkeypatch):
    monkeypatch.setattr(gemini,'INLINE_MAX_BYTES',0)
    def fail(**kwargs):raise TimeoutError('upload confirmation lost')
    monkeypatch.setattr(fake,'upload',fail);report=gemini.CleanupReport()
    with pytest.raises(GeminiError):gemini.slice_take(video,'video/webm',DURATION,api_key=API_KEY,model=MODEL,cleanup=report)
    assert report.remoteFiles=='unknown' and report.warning and fake.deletes==[]


def test_inline_report_does_not_claim_remote_file_deletion(fake,video):
    report=gemini.CleanupReport();gemini.slice_take(video,'video/webm',DURATION,api_key=API_KEY,model=MODEL,cleanup=report)
    assert report.remoteFiles=='not-used' and report.model==MODEL and report.warning is None


def test_debug_failure_logs_do_not_expose_the_key(fake,video,caplog):
    import logging
    fake.error=ValueError('provider echoed '+API_KEY)
    with caplog.at_level(logging.DEBUG,logger=gemini.__name__),pytest.raises(GeminiError):request(video)
    assert API_KEY not in caplog.text
