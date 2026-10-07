# EmoteCap Release Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓現有 EmoteCap 在三個桌面作業系統上具有可重現的測試／Web build、正確的 v2 協定邊界與可驗證的模型資產，完成產品路線圖 M1。

**Architecture:** 保留既有 Web、motion-core、FastAPI、Blender 與 Unity 邊界。只修正測試替身、輸入驗證、協定文件與安裝／CI 基礎；現有動作演算法與有效輸入的 wire 格式保持。真實攝影機、Blender 與 Unity 驗收屬後續獨立流程。

**Tech Stack:** 現有 React / TypeScript / Vitest / Vite、Python / FastAPI / Pydantic / pytest；Node 內建 `node:test`、`crypto`、`fs`；GitHub Actions。不新增產品 runtime dependency。

**Spec:** `docs/superpowers/specs/2026-10-06-release-foundation-design.md`。較大產品方向見 `docs/superpowers/specs/2026-10-06-open-source-product-design.md`；本計畫只實作 M1。

## Global Constraints

- 基準 commit 為 `713d349df05aa26b6b95a1b7974f7f3d8e574149`；保留現有功能資料夾與既有 solver 行為。
- 工具基線固定為 Node `24.19.0`、npm `11.21.0`、Python `3.12.14`、uv `0.12.6`；沿用已提交的 `web/package-lock.json` 與 `server/uv.lock`。
- 動作協定保持 version `2`、`48` driven bones、`192` rotation values、`52` full export bones、`22` body export bones；骨骼順序、座標轉換與 wire 欄位名稱不變。
- API clip 名稱仍符合 `^[A-Za-z0-9_]{1,24}$`；`fps` 為 `1..120`；最大時長 `180` 秒；一個 request 最多 `50` clips。
- 所有動作數值必須有限；每段 clip 的首幀 `t=0`、之後嚴格遞增且末幀 `t<=180`；每根 quaternion 的長度與 `1` 相差不得超過 `0.02`；`abs(h.x)` 與 `abs(h.z)` 不得超過 `0.000001`。
- 完整 `180` 秒、`120` fps 且同時包含首尾兩幀的 clip 可含 `21601` frames；仍須通過時序與數值驗證。
- 模型檔必須通過已記錄的 SHA256；正常快取可離線重用，損毀快取不能當作成功；保持 TLS 驗證。
- unit／Web build CI 涵蓋 Windows、macOS、Linux，不使用 Gemini key、攝影機、Blender 或 Unity；真實工具驗收分開報告。
- 本階段不新增帳號、雲端部署、資料庫、套件搬家或動作演算法；不更改授權、不發布、不改寫 Git 歷史。

## Review Focus

1. Blender 程序失敗或逾時，路徑含空白／中文：仍能回報原始原因與最後 20 行，而不是 Windows 啟動 shell 失敗；Task 1。
2. 文檔或 C# 骨頭順序與 TS/Python 漂移：測試須指出不一致，不把靜態檢查當成 Unity 播放成功；Task 2。
3. 非有限值、零 quaternion、時間逆序或 180 秒邊界：壞資料在 Blender 啟動前回 422，合法首尾幀不被誤拒；Task 3。
4. 已存在但同尺寸損毀的模型／WASM、下載中斷：不假報成功，沒有半成品成為正式快取；Task 4。
5. 沒有雲端憑證與沒有下載網路的快取情境：unit 測試及有效模型快取可用，fresh 模型缺失要明確失敗；Task 4、Task 5。

---

## 開工與檔案責任

已依使用者選擇採 Native 執行，五個本機實作任務已完成，正在進行獨立審查。勾選代表本機步驟完成；三平台遠端 CI 尚未執行，M1 出口仍待該證據。執行差異與完整結果見 [交付記錄](../reports/2026-10-06-release-foundation.md)。原始步驟與範例保留供對照；有衝突時以交付記錄中的裁定及目前原始碼為準。下列步驟以 repository root 為基準；標示 `web/` 或 `server/` 的命令要在該目錄執行。每個 step 是一次可驗證的編輯或執行動作。

| Task | 寫入範圍 | 可獨立審查的成果 |
|---|---|---|
| 1 | `server/tests/test_exporter.py` | 真實子程序的跨平台測試，不改 production exporter |
| 2 | `contracts/motion-v1.md`、`server/tests/test_contract_parity.py`、`web/src/motion/contract.test.ts` | v2 一致性基準，不更動骨架 |
| 3 | `server/emotecap_server/contract.py`、`main.py`、兩個 validation/API 測試檔 | 不合法 motion 於 API 邊界被拒 |
| 4 | `web/scripts/` 內指定四個檔案、`web/package.json` | 有驗證且可離線重用的模型與 WASM 快取 |
| 5 | 工具版本檔、CI、`web/package.json`／lock metadata、開發文件 | locked install → tests → Web build 的一致入口 |

先執行 `git status --short --branch` 與 `git rev-parse HEAD`。若程式已被其他工作修改，保留並對照差異；不得重設別人的變更。既有基線是前端 225 passed；後端 352 passed、2 failed、2 deselected。後端失敗應正好是 Task 1 的兩個 shell 替身測試；不同失敗需先查清原因。

### Task 1: 跨平台 Blender 失敗與逾時測試

**Files:**
- Modify: `server/tests/test_exporter.py` 的 `write_fake_blender` 與兩個 `test_run_blender_*` 測試。
- Production reference: `server/emotecap_server/exporter.py` 的 `run_blender`；不修改它。

**Interfaces:**
- Consumes: `run_blender(settings: Settings, job_json: Path, out_dir: Path) -> None`、`ExportError.stderr_tail`。
- Produces: 測試輔助 `write_fake_blender(tmp_path: Path, python_body: str, monkeypatch: pytest.MonkeyPatch) -> str`；只作用於目前測試。

- [x] **Step 1: 重現紅燈。** 在 `server/` 執行：

```text
uv run --frozen --python 3.12.14 pytest tests/test_exporter.py -q
```

Windows 預期兩個失敗訊息包含 `WinError 193`。其他系統原測試可能通過；仍須保留下一步的空白／中文路徑案例。

- [x] **Step 2: 先把兩個行為測試改成 Python 程序輸入。** 用下列函式取代同名測試；舊 helper 尚不接受第三個參數，先得到明確失敗。

```python
def test_run_blender_raises_with_last_20_output_lines_on_nonzero_exit(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    blender = write_fake_blender(
        tmp_path,
        "import sys\n"
        "print('Blender test')\n"
        "for i in range(1, 31): print(f'err {i}', file=sys.stderr)\n"
        "sys.exit(3)\n",
        monkeypatch,
    )
    with pytest.raises(ExportError, match="code 3") as excinfo:
        run_blender(make_settings(tmp_path, blender_path=blender),
                    tmp_path / "clips.json", tmp_path / "out")
    assert excinfo.value.stderr_tail.splitlines() == [f"err {i}" for i in range(11, 31)]


def test_run_blender_raises_export_error_on_timeout(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(exporter, "BLENDER_TIMEOUT_S", 2.0)
    blender = write_fake_blender(
        tmp_path, "import time\nprint('started', flush=True)\ntime.sleep(5)\n", monkeypatch
    )
    with pytest.raises(ExportError, match="timed out") as excinfo:
        run_blender(make_settings(tmp_path, blender_path=blender),
                    tmp_path / "clips.json", tmp_path / "out")
    assert "started" in excinfo.value.stderr_tail
```

- [x] **Step 3: 再跑 Step 1 命令。** 預期 `write_fake_blender` 的參數不合；避免新測試意外沒被收集。

- [x] **Step 4: 替換 helper，增加 `import subprocess` 與 `import sys`。** 保存真實 `subprocess.run` 再 patch，確保仍實際啟動與終止子程序。

```python
def write_fake_blender(
    tmp_path: Path, python_body: str, monkeypatch: pytest.MonkeyPatch
) -> str:
    directory = tmp_path / "測試 with spaces"
    directory.mkdir()
    script = directory / "fake_blender.py"
    script.write_text(python_body, encoding="utf-8")
    real_run = subprocess.run

    def run_python(command: list[str], **kwargs: object):
        assert command[0] == str(script)
        assert command[1:3] == ["-b", "--factory-startup"]
        assert kwargs["cwd"] == REPO_ROOT
        assert kwargs.get("shell", False) is False
        return real_run([sys.executable, str(script), *command[1:]], **kwargs)

    monkeypatch.setattr(exporter.subprocess, "run", run_python)
    return str(script)
```

- [x] **Step 5: 跑聚焦測試及後端完整非實機測試。**

```text
uv run --frozen --python 3.12.14 pytest tests/test_exporter.py -q
uv run --frozen --python 3.12.14 pytest -q -m "not slow"
```

在未新增其他測試時預期 `354 passed, 2 deselected`；不是把兩項 failure 改成 skip。

- [x] **Step 6: 檢查只改測試後提交。**

```text
git add server/tests/test_exporter.py
git commit -m "test: make Blender failure tests portable"
```

### Task 2: 凍結現行 v2 的跨元件基準

**Files:**
- Create: `server/tests/test_contract_parity.py`
- Modify: `web/src/motion/contract.test.ts`
- Modify: `contracts/motion-v1.md`

**Interfaces:**
- Consumes: `contracts/bones.json` 的 `version`、`driven`、`skeleton`、`hipsRestHeight`；TS `CONTRACT_VERSION`、`DRIVEN_BONES`、`SKELETON`；C# `EmoteCapContract.Version`、`DrivenBones`。
- Produces: 無新 runtime API；新增對現行公開資料格式的 drift guard。

- [x] **Step 1: 新增跨語言／文件一致性測試。** 完整建立：

```python
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def test_v2_contract_matches_unity_and_documentation():
    bones = json.loads((ROOT / "contracts/bones.json").read_text(encoding="utf-8"))
    source = (ROOT / "unity/com.emotecap.mocap/Runtime/EmoteCapContract.cs").read_text(
        encoding="utf-8"
    )
    version = re.search(r"public const int Version\s*=\s*(\d+)", source)
    assert version is not None
    assert int(version.group(1)) == bones["version"] == 2
    assert re.findall(r"HumanBodyBones\.(\w+)", source) == bones["driven"]
    assert len(bones["driven"]) == 48
    assert len(bones["skeleton"]) == 52
    assert bones["hipsRestHeight"] == 0.95
    doc = (ROOT / "contracts/motion-v1.md").read_text(encoding="utf-8")
    assert doc.startswith("# EmoteCap motion contract v2\n")
    assert "48 driven bones" in doc
    assert "192" in doc
```

- [x] **Step 2: 執行紅燈測試。** `server/`：

```text
uv run --frozen --python 3.12.14 pytest tests/test_contract_parity.py -q
```

預期在文件標題失敗；這證明本次修正對應既有 drift。

- [x] **Step 3: 在既有 TS 測試加入版本／fixture 保護。** 原有 imports 加入 `CONTRACT_VERSION`；另加入兩個 JSON import，再把下列測試放進現有 `describe('contract', ...)`。

```typescript
import tposeClip from '../../../contracts/fixtures/tpose.clip.json';
import raiseClip from '../../../contracts/fixtures/raise-right-arm.clip.json';

it('keeps v2 fixtures readable without changing the wire shape', () => {
  expect(CONTRACT_VERSION).toBe(2);
  expect(SKELETON).toHaveLength(52);
  for (const clip of [tposeClip, raiseClip]) {
    expect(clip.frames[0].t).toBe(0);
    for (const frame of clip.frames) {
      expect(frame.h).toHaveLength(3);
      expect(frame.r).toHaveLength(192);
      expect([...frame.h, ...frame.r, frame.t].every(Number.isFinite)).toBe(true);
    }
  }
});
```

- [x] **Step 4: 以以下完整內容更新 `contracts/motion-v1.md`。** 保留檔名，不改 JSON 骨架或 fixture。

````markdown
# EmoteCap motion contract v2

Current contract for web, server, Blender export, and Unity. This historical
filename remains stable for existing links. `bones.json` is the machine-readable
source of truth. Coordinate or bone-order changes require a new contract version
and a coordinated migration across all consumers.

## Coordinates

Canonical space is right-handed, +Y up, character facing +Z, in meters.
MediaPipe positions become `(x, -y, -z)`. Unity positions become `(-x, y, z)`
and quaternions become `(x, -y, -z, w)`. Blender positions become `(x, -z, y)`
and its w-first quaternion is `(w, x, -z, y)`.
Detection inputs are not mirrored; mirroring is a preview-only operation.

## Bones

Version 2 has 48 driven bones: 18 body bones followed by 30 finger bones.
The full export skeleton has 52 bones. Body-only export has 22 bones, but its
input frames still carry all 192 rotation values. `bones.json.driven` defines
wire order; `bones.json.skeleton` defines the parent-first export skeleton.
`LeftShoulder`, `RightShoulder`, `LeftToeBase`, and `RightToeBase` are not driven.
The canonical hips rest height is 0.95 meters.

## Motion and clip

```typescript
interface MotionFrame {
  t: number;
  h: [number, number, number];
  r: number[];
}
interface Clip {
  name: string;
  loop: boolean;
  fps: number;
  frames: MotionFrame[];
  skeleton?: 'full' | 'body';
}
interface Segment {
  name: string;
  start: number;
  end: number;
  loop: boolean;
  description: string;
}
```

Each `r` has 192 finite numbers, grouped as `(x,y,z,w)` world-delta quaternions
relative to T-pose. Apply `boneWorld = delta * restWorld`, parents first.
Each quaternion norm differs from 1 by at most 0.02. All motion numbers must
be finite. This in-place contract requires `abs(h.x)` and `abs(h.z)` <= 0.000001.

Export clips start at `t=0`, with strictly increasing subsequent timestamps,
ending no later than 180 seconds. FPS is an integer from 1 through 120.
The inclusive maximum is 21601 frames. The export endpoint accepts at most
50 clips per request. Names match `^[A-Za-z0-9_]{1,24}$`.
Segments describe editable ranges inside a take; the Web app produces clips.

## HTTP

| Method | Path | Input / output |
|---|---|---|
| GET | `/api/health` | `{ok, blender, gemini}` |
| POST | `/api/export` | `{clips: Clip[]}` → `{files: [{name, url}]}` |
| GET | `/files/{name}.fbx` | FBX download |
| POST | `/api/takes` | Multipart video + duration → `{takeId, segments}` |

Uploads retain the current 100 MiB / 180 second limit. Supported decoding
depends on the browser and provider; a `video/*` MIME type alone is not a codec
guarantee. The video sent for semantic slicing is unmirrored.

422 rejects invalid input before Blender starts. Validation details expose
location, message, and error type, not raw payload values. Other current codes:
413 size/duration, 415 media type, 500 export failure, 503 Gemini unconfigured,
502 Gemini failure. The Web app can fall back to local motion-energy slicing.

## FBX sidecar

`<name>.emotecap.json` contains `name: string`, `loop: boolean`, `fps: number`.
Unity reads it to configure clip naming and looping. Publishing currently
allows same-name replacement; job-scoped non-overwriting output is a later
product milestone, not a guarantee of this contract revision.

## Live Link

Endpoint: `/ws/live?role=source|sink`. The source sends a hello with
`type="hello"`, `version=2`, and `bones` equal to `bones.json.driven`, then
frames with `type="frame"` and the MotionFrame fields. Live timestamps are
stream timestamps; export clip timestamp bounds do not constrain live uptime.
The current relay forwards text; protocol negotiation, origin/session checks,
and source ownership are separate M3 work. `clip_ready` is not a completed
delivery feature. Legacy v1 data is outside the current acceptance matrix.

## Acceptance fixtures

`fixtures/tpose.clip.json` and `fixtures/raise-right-arm.clip.json` are shared
regression inputs. A right-arm raise must remain a right-arm raise with the
head up in the browser, exported FBX, and Unity. Source parity tests are only
one part of that check; real Blender/Unity playback must also be verified.
````

- [x] **Step 5: 執行驗證。** 在 `server/` 跑 `uv run --frozen --python 3.12.14 pytest tests/test_contract.py tests/test_contract_parity.py -q`；在 `web/` 跑 `npm test -- src/motion/contract.test.ts`。兩者應全通過；確認 `bones.json` 與 Unity runtime 無 diff。

- [x] **Step 6: 提交此邊界修正。**

```text
git add contracts/motion-v1.md server/tests/test_contract_parity.py web/src/motion/contract.test.ts
git commit -m "test: align motion contract documentation and consumers on v2"
```

### Task 3: 在 API 邊界拒絕損毀的 motion

**Files:**
- Create: `server/tests/test_motion_validation.py`
- Modify: `server/tests/test_export_api.py`
- Modify: `server/emotecap_server/contract.py`
- Modify: `server/emotecap_server/main.py`

**Interfaces:**
- Consumes: 現有 `MotionFrame`、`Clip`、`ExportRequest`；`POST /api/export`。
- Produces: 相同 models 與 wire 欄位，新增數值／時序約束。422 的 `detail` 為 `{loc: list, msg: str, type: str}[]`；不含原始 `input` 或 exception `ctx`。

- [x] **Step 1: 建立完整 model 行為測試。**

```python
import copy
import json
from pathlib import Path

import pytest
from pydantic import ValidationError
from emotecap_server.contract import Clip

FIXTURE = Path(__file__).resolve().parents[2] / "contracts/fixtures/tpose.clip.json"


def valid_clip() -> dict:
    clip = json.loads(FIXTURE.read_text(encoding="utf-8"))
    frame = clip["frames"][0]
    clip["fps"] = 30
    clip["frames"] = [dict(copy.deepcopy(frame), t=t) for t in [0, 1 / 30]]
    return clip


@pytest.mark.parametrize("field", ["t", "h", "r"])
@pytest.mark.parametrize("value", [float("nan"), float("inf"), -float("inf")])
def test_rejects_non_finite_motion(field, value):
    clip = valid_clip()
    if field == "t":
        clip["frames"][0][field] = value
    else:
        clip["frames"][0][field][0] = value
    with pytest.raises(ValidationError):
        Clip.model_validate(clip)


@pytest.mark.parametrize("times", [[0, 0], [0, 2, 1], [1, 2], [0, 180.001]])
def test_rejects_invalid_clip_times(times):
    clip = valid_clip()
    frame = clip["frames"][0]
    clip["frames"] = [dict(copy.deepcopy(frame), t=t) for t in times]
    with pytest.raises(ValidationError):
        Clip.model_validate(clip)


@pytest.mark.parametrize("rotation", [[0, 0, 0, 0], [0, 0, 0, 1.03]])
def test_rejects_invalid_quaternion_norm(rotation):
    clip = valid_clip()
    clip["frames"][0]["r"][:4] = rotation
    with pytest.raises(ValidationError):
        Clip.model_validate(clip)


@pytest.mark.parametrize("axis", [0, 2])
def test_rejects_horizontal_root_translation(axis):
    clip = valid_clip()
    clip["frames"][0]["h"][axis] = 0.1
    with pytest.raises(ValidationError):
        Clip.model_validate(clip)


def test_accepts_rounding_and_body_export_with_full_wire_frame():
    clip = valid_clip()
    clip["skeleton"] = "body"
    clip["frames"][0]["r"][:4] = [0, 0, 0, 1.01]
    assert Clip.model_validate(clip).skeleton == "body"


def test_accepts_inclusive_180_second_120_fps_boundary():
    clip = valid_clip()
    frame = clip["frames"][0]
    clip["fps"] = 120
    clip["frames"] = [dict(frame, t=i / 120) for i in range(21601)]
    result = Clip.model_validate(clip)
    assert len(result.frames) == 21601
    assert result.frames[-1].t == 180
```

- [x] **Step 2: 在既有 API 測試加入 422 與禁止啟動 exporter 的案例。** 沿用該檔現有 `fixture_clip`、`client`、`export_calls`。

```python
@pytest.mark.parametrize("overflow", [False, True])
def test_bad_motion_returns_json_422_without_starting_export(
    client: TestClient, export_calls: list[list[str]], overflow: bool
) -> None:
    clip = fixture_clip()
    if overflow:
        clip["frames"][0]["r"][0] = "FINITE_OVERFLOW"
        raw = json.dumps({"clips": [clip]}).replace('"FINITE_OVERFLOW"', '1e999')
    else:
        clip["frames"][0]["r"][:4] = [0, 0, 0, 0]
        raw = json.dumps({"clips": [clip]})
    response = client.post("/api/export", content=raw,
                           headers={"content-type": "application/json"})
    assert response.status_code == 422
    assert export_calls == []
    detail = response.json()["detail"]
    assert detail and all(set(item) == {"loc", "msg", "type"} for item in detail)
```

- [x] **Step 3: 執行紅燈。** `server/`：

```text
uv run --frozen --python 3.12.14 pytest tests/test_motion_validation.py tests/test_export_api.py -q
```

預期多個 invalid input 未被拒，以及合法 21601 frames 被舊長度上限拒絕。

- [x] **Step 4: 修改 model。** 在 `contract.py` 加入 `import math`、`Self`、`ConfigDict`、`model_validator` imports；以以下完整定義取代 `MotionFrame`、`Clip`，其他 models 保留。

```python
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
            if abs(norm - 1.0) > 0.02:
                raise ValueError(f"quaternion {index // 4} must have unit length within 0.02")
        return self


class Clip(BaseModel):
    name: Annotated[str, Field(pattern=CLIP_NAME_PATTERN)]
    loop: bool
    fps: Annotated[int, Field(ge=1, le=MAX_FPS)]
    frames: Annotated[
        list[MotionFrame], Field(min_length=1, max_length=MAX_FPS * MAX_CLIP_SECONDS + 1)
    ]
    skeleton: Literal["full", "body"] = "full"

    @model_validator(mode="after")
    def validate_timeline(self) -> Self:
        if self.frames[0].t != 0:
            raise ValueError("clip must start at t=0")
        if any(right.t <= left.t for left, right in zip(self.frames, self.frames[1:])):
            raise ValueError("clip timestamps must be strictly increasing")
        return self
```

- [x] **Step 5: 加入可 JSON 序列化的驗證錯誤 handler。** 在 `main.py` imports 加 `Request`、`from fastapi.exceptions import RequestValidationError`、`from fastapi.responses import JSONResponse`；在 `app = FastAPI(...)` 後加入：

```python
@app.exception_handler(RequestValidationError)
async def invalid_request(_: Request, exc: RequestValidationError) -> JSONResponse:
    detail = [
        {"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]
    return JSONResponse(status_code=422, content={"detail": detail})
```

移除 input／ctx 也避免把整段動作或不合法浮點數帶進錯誤回應；不捕捉所有 Exception，不把 exporter 的 500 改成成功。

- [x] **Step 6: 跑 Step 3 聚焦測試，再跑 `uv run --frozen --python 3.12.14 pytest -q -m "not slow"`。** 全部應通過；既有兩個 fixture 應仍能建立 `Clip`。不可為了通過而放寬到接受非有限值。

- [x] **Step 7: 提交。**

```text
git add server/emotecap_server/contract.py server/emotecap_server/main.py server/tests/test_motion_validation.py server/tests/test_export_api.py
git commit -m "fix: validate motion values and clip timelines before export"
```

### Task 4: 可驗證、可離線重用的模型安裝

**Files:**
- Create: `web/scripts/asset-integrity.mjs`
- Create: `web/scripts/asset-integrity.test.mjs`
- Create: `web/scripts/mediapipe-assets.json`
- Modify: `web/scripts/fetch-mediapipe.mjs`
- Modify: `web/package.json` 的 scripts

**Interfaces:**
- Consumes: 資產描述 `{url: string, dest: string, sha256: string}`；`fetchFn(url, options) -> Promise<Response>`。
- Produces: `digest(bytes) -> string`、`sameContents(sourcePath, destPath) -> boolean`、`ensureAsset(asset, fetchFn = fetch) -> Promise<'cached' | 'downloaded'>`。
- 安裝入口與 public 路徑保持相同；不修改 capture 模型呼叫端。

- [x] **Step 1: 寫 Node 內建行為測試。** 完整建立以下檔案；只使用合成 bytes 與假 fetch，不上網。

```javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { digest, ensureAsset, sameContents } from './asset-integrity.mjs';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), 'emotecap-assets-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bytes = Buffer.from('model');
  return { root, bytes, asset: {
    url: 'https://example.invalid/model.task', dest: join(root, 'model.task'),
    sha256: digest(bytes),
  } };
}

test('downloads valid content and then reuses it offline', async (t) => {
  const { asset, bytes } = fixture(t);
  assert.equal(await ensureAsset(asset, async () => new Response(bytes)), 'downloaded');
  assert.equal(await ensureAsset(asset, async () => { throw new Error('offline'); }), 'cached');
  assert.deepEqual(readFileSync(asset.dest), bytes);
});

test('repairs a same-size corrupt cache', async (t) => {
  const { asset, bytes } = fixture(t);
  writeFileSync(asset.dest, 'xxxxx');
  assert.equal(await ensureAsset(asset, async () => new Response(bytes)), 'downloaded');
  assert.deepEqual(readFileSync(asset.dest), bytes);
});

test('wrong digest never publishes a replacement or partial file', async (t) => {
  const { root, asset } = fixture(t);
  writeFileSync(asset.dest, 'old');
  await assert.rejects(ensureAsset(asset, async () => new Response('wrong')), /SHA256/);
  assert.equal(readFileSync(asset.dest, 'utf8'), 'old');
  assert.deepEqual(readdirSync(root), ['model.task']);
});

test('network failure fails clearly and leaves no model file', async (t) => {
  const { root, asset } = fixture(t);
  await assert.rejects(ensureAsset(asset, async () => { throw new Error('offline'); }), /offline/);
  assert.deepEqual(readdirSync(root), []);
});

test('HTTP failures and interrupted response bodies are not cached', async (t) => {
  const { root, asset } = fixture(t);
  await assert.rejects(ensureAsset(asset, async () => new Response('', { status: 503 })), /503/);
  await assert.rejects(ensureAsset(asset, async () => ({
    ok: true, arrayBuffer: async () => { throw new Error('interrupted'); },
  })), /interrupted/);
  assert.deepEqual(readdirSync(root), []);
});

test('WASM equality compares content, including same-size changes', (t) => {
  const { root } = fixture(t);
  const a = join(root, 'a.wasm');
  const b = join(root, 'b.wasm');
  writeFileSync(a, 'aaaa');
  assert.equal(sameContents(a, b), false);
  writeFileSync(b, 'bbbb');
  assert.equal(sameContents(a, b), false);
  writeFileSync(b, 'aaaa');
  assert.equal(sameContents(a, b), true);
});
```

- [x] **Step 2: 在 `web/` 執行 `node --test scripts/asset-integrity.test.mjs`。** 預期缺少 `asset-integrity.mjs`，不是沒有找到測試。

- [x] **Step 3: 實作完整驗證 helper。**

```javascript
import { createHash, randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname } from 'node:path';

export function digest(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

export function sameContents(sourcePath, destPath) {
  return existsSync(destPath) && digest(readFileSync(sourcePath)) === digest(readFileSync(destPath));
}

export async function ensureAsset({ url, dest, sha256 }, fetchFn = fetch) {
  if (existsSync(dest) && digest(readFileSync(dest)) === sha256) return 'cached';
  mkdirSync(dirname(dest), { recursive: true });
  const partial = `${dest}.${randomUUID()}.part`;
  try {
    const response = await fetchFn(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`Model download failed: HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (digest(bytes) !== sha256) throw new Error(`SHA256 mismatch: ${basename(dest)}`);
    writeFileSync(partial, bytes, { flag: 'wx' });
    renameSync(partial, dest);
    return 'downloaded';
  } finally {
    rmSync(partial, { force: true });
  }
}
```

- [x] **Step 4: 建立完整模型清冊。** Hash 與本輪實際下載的檔案一致；不能為了讓失敗消失而在下載時自動重寫 hash。

```json
[
  {
    "file": "pose_landmarker_heavy.task",
    "url": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_heavy/float16/latest/pose_landmarker_heavy.task",
    "sha256": "64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b"
  },
  {
    "file": "pose_landmarker_full.task",
    "url": "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task",
    "sha256": "4eaa5eb7a98365221087693fcc286334cf0858e2eb6e15b506aa4a7ecdcec4ad"
  },
  {
    "file": "hand_landmarker.task",
    "url": "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/latest/hand_landmarker.task",
    "sha256": "fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1"
  }
]
```

- [x] **Step 5: 用以下完整內容取代 downloader。** WASM 來源仍是 lockfile 安裝出的 npm package，變更由 byte digest 判斷。

```javascript
#!/usr/bin/env node
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureAsset, sameContents } from './asset-integrity.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const wasmSource = join(root, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm');
const wasmDest = join(root, 'public', 'mediapipe', 'wasm');
const assets = JSON.parse(readFileSync(new URL('./mediapipe-assets.json', import.meta.url), 'utf8'));

try {
  if (!existsSync(wasmSource)) throw new Error('MediaPipe WASM is missing. Run npm ci first.');
  mkdirSync(wasmDest, { recursive: true });
  for (const entry of readdirSync(wasmSource, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const source = join(wasmSource, entry.name);
    const dest = join(wasmDest, entry.name);
    if (!sameContents(source, dest)) copyFileSync(source, dest);
  }
  for (const asset of assets) {
    if (basename(asset.file) !== asset.file) throw new Error('Asset filename must be a basename');
    const outcome = await ensureAsset({ ...asset, dest: join(root, 'public', 'models', asset.file) });
    console.log(`[mediapipe] ${asset.file}: ${outcome}, SHA256 verified`);
  }
} catch (error) {
  console.error(`[mediapipe] ${error instanceof Error ? error.message : String(error)}`);
  console.error('Check your network/proxy and run npm run fetch-assets. Keep TLS verification enabled.');
  process.exitCode = 1;
}
```

- [x] **Step 6: 更新 package scripts。** 只替換下列三項並新增 `test:assets`，其他 scripts 不變。

```json
{
  "fetch-assets": "node --use-system-ca --use-env-proxy scripts/fetch-mediapipe.mjs",
  "predev": "node --use-system-ca --use-env-proxy scripts/fetch-mediapipe.mjs",
  "prebuild": "node --use-system-ca --use-env-proxy scripts/fetch-mediapipe.mjs",
  "test:assets": "node --test scripts/asset-integrity.test.mjs"
}
```

- [x] **Step 7: 在 `web/` 依序執行 `npm run test:assets`、`npm test`、`npm run fetch-assets`、`npm run build`。** 六個 assets 行為測試通過；真實模型需逐一顯示 SHA256 verified；任何 digest mismatch 都使流程失敗。既有有效快取的離線行為由測試證明，不需要關閉整台機器的網路。

- [x] **Step 8: 提交。** 不加入下載的模型／WASM／node_modules。

```text
git add web/scripts/asset-integrity.mjs web/scripts/asset-integrity.test.mjs web/scripts/mediapipe-assets.json web/scripts/fetch-mediapipe.mjs web/package.json
git commit -m "build: verify MediaPipe assets before use"
```

### Task 5: 固定工具、三平台 CI 與開發入口

**Files:**
- Create: `.node-version`、`server/.python-version`、`.github/workflows/ci.yml`、`docs/development.md`
- Modify: `web/package.json`、`web/package-lock.json`（僅 root metadata）、`README.md`、`CLAUDE.md`

**Interfaces:**
- Consumes: Task 1–4 的 `npm test`、`npm run test:assets`、`npm run build`、`uv run --frozen pytest -m "not slow"`。
- Produces: 每個 OS 的 `unit-and-web-build` 檢查。它不表示 Blender/Unity/真實鏡頭已通過。

- [x] **Step 1: 建立工具檔與 package metadata。** `.node-version` 全文是 `24.19.0` 加換行；`server/.python-version` 全文是 `3.12.14` 加換行。在 `web/package.json` 頂層加入：

```json
{
  "engines": { "node": ">=24.19.0 <25", "npm": ">=11.21.0 <12" },
  "packageManager": "npm@11.21.0"
}
```

在 `web/` 用 npm `11.21.0` 跑 `npm install --package-lock-only --ignore-scripts` 以同步 root metadata。檢查 `git diff -- web/package-lock.json server/uv.lock`：不得更新 dependency 版本、integrity 或 uv lock。

- [x] **Step 2: 建立完整 CI workflow。** 三個 action SHA 在規劃當日由其官方 repository 的 `refs/tags/v6` 查得；重跑前可驗證，但不自行漂移到其他版本。

```yaml
name: unit-and-web-build
on:
  push:
  pull_request:
permissions:
  contents: read
jobs:
  verify:
    name: unit-and-web-build (${{ matrix.os }})
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: ${{ matrix.os }}
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803
      - uses: actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38
        with:
          node-version-file: .node-version
          cache: npm
          cache-dependency-path: web/package-lock.json
      - run: npm install --global npm@11.21.0
      - uses: actions/setup-python@ece7cb06caefa5fff74198d8649806c4678c61a1
        with:
          python-version-file: server/.python-version
      - run: python -m pip install uv==0.12.6
      - run: npm ci
        working-directory: web
      - run: npm run test:assets
        working-directory: web
      - run: npm test
        working-directory: web
      - run: npm run build
        working-directory: web
      - run: uv sync --frozen --python 3.12.14
        working-directory: server
      - run: uv run --frozen --python 3.12.14 pytest -q -m "not slow"
        working-directory: server
```

- [x] **Step 3: 建立以下完整開發指南。**

````markdown
# Development

Use Node 24.19.0, npm 11.21.0, Python 3.12.14, and uv 0.12.6.
Install dependencies with the committed lockfiles. Do not run an upgrade as
part of routine setup. `.env` and captured media stay local.

## Setup and checks

In `web/`:
```text
npm ci
npm run test:assets
npm test
npm run build
```

In `server/`:
```text
uv sync --frozen --python 3.12.14
uv run --frozen --python 3.12.14 pytest -q -m "not slow"
```

The Web prebuild downloads approximately 48 MB of models when absent and
verifies their SHA256. Valid caches can be reused offline. The scripts use
Node system certificates and environment proxy support; configure your
normal proxy/certificate environment if necessary. Never disable TLS
verification or replace a recorded digest just to make a download pass.

## Run locally

Copy the root `.env.example` to `.env` if configuration is needed. Set
`BLENDER_PATH` to your local Blender executable for FBX export. Gemini is
optional. Start the server in `server/`:
```text
uv run --frozen --python 3.12.14 uvicorn emotecap_server.main:app --host 127.0.0.1 --port 8787
```
In a second terminal in `web/` run `npm run dev`, then open
`http://localhost:5173`. Stop both terminals when finished.

## What the checks prove

The three-platform CI checks source logic, protocol parity, input validation,
model integrity, types, and the Web build. It uses no Gemini API key.
It does not run a camera, real Blender export, or Unity playback.

With Blender configured, run `uv run --frozen --python 3.12.14 pytest -q -m slow`
from `server/` for the real export smoke tests. A skipped test is not a pass.
Before a release, also verify right-arm direction, scale, timing, and playback
in Unity using both shared fixtures and approved sample recordings.

## Changes and review

Use small `feat:`, `fix:`, `test:`, `docs:`, `build:`, or `chore:` commits.
Run checks for the code you change and request review. Keep original motion
fixtures and valid v2 consumers working. Update contract documentation and
all consumers together if a future version changes the wire format.

Do not commit third-party character models, raw personal recordings, keys,
runtime exports, or dependency directories. Release packaging and licensing
have their own acceptance criteria in the product plan.
````

- [x] **Step 4: 更新 README 的工具與測試說明。** 將 Node 工具欄改為 `24.19.0 (npm 11.21.0)`，uv 欄改為 `0.12.6 (Python 3.12.14)`，初次依賴安裝改 `npm ci`，server 同步改 `uv sync --frozen --python 3.12.14`。將 Tests 段落完整換成：

```markdown
Run `npm run test:assets`, `npm test`, and `npm run build` in `web/`.
Run `uv run --frozen --python 3.12.14 pytest -q -m "not slow"` in `server/`.
Real Blender smoke tests are separate (`-m slow`); Unity and camera checks
remain separate release requirements. See [Development](docs/development.md)
for the pinned tools, network setup, and what each check proves.
```

保留得獎資訊、功能介紹與 demo；不增加未實測的平台／動作品質宣稱。

- [x] **Step 5: 用以下完整內容更新持續有效的協作規則。** 舊的時間表與 lane 名稱保留在既有歷史規格，不繼續限制目前的 Windows 開發者。

```markdown
# EmoteCap — project instructions

EmoteCap is being prepared for an open-source product release. The original
HackNite documents remain historical records; they are not current deadlines
or machine-specific edit restrictions.

Read the active product specification, the implementation plan for your task,
`docs/development.md`, and `contracts/motion-v1.md` before implementation.

Keep the existing web, motion-core, server, Blender, and Unity boundaries.
Agree file ownership before concurrent work. Preserve changes made by others.
Motion contract changes must update documentation, fixtures, and consumers
together; coordinate them with other active contributors.

Use the pinned tools and lockfiles. Run relevant tests before handing work
off. Use behavior tests for data/algorithm changes; verify user flows with
the actual browser and Unity where required. Report skipped/unrun checks.

Never commit secrets, private recordings, runtime data, or third-party
characters. New settings belong in `.env.example` without real values.
Preserve project history and require the release checklist before publishing.
```

- [x] **Step 6: 在目前環境跑完整入口一次。** `web/`：`npm ci` → `npm run test:assets` → `npm test` → `npm run build`；`server/`：`uv sync --frozen --python 3.12.14` → `uv run --frozen --python 3.12.14 pytest -q -m "not slow"`。記錄實際計數、版本及任何 warning。檢查 `git diff --check` 與 `git status --short`。

- [x] **Step 7: 提交並交付檢閱。**

```text
git add .node-version server/.python-version .github/workflows/ci.yml docs/development.md web/package.json web/package-lock.json README.md CLAUDE.md
git commit -m "build: add a pinned cross-platform verification workflow"
```

提交不等於 push／release。遠端 CI 只有實際執行後才報通過；尚未執行就明確寫「workflow 已建立，遠端未驗證」。M1 出口仍需三 OS 的實際 CI 結果，可在使用者授權推送／PR 的流程中完成。

## 驗收與自我審查對照

| 規格 | 任務 | 行為證據 |
|---|---|---|
| F1 | Task 1 | 真正 Python 子程序的 code 3、timeout、中文／空白路徑 |
| F2 | Task 2 | v2 文件、C#／JSON driven order、TS fixture 形狀 |
| F3 | Task 3 | model 邊界、合法 21601 frames、API 422、exporter 未被呼叫 |
| F4 | Task 4 | 六個 assets tests、真實模型 digest、完整 Web build |
| F5 | Task 5 | pinned tools、locked install、三 OS workflow 與操作文件 |

本計畫已對照上述範圍自我檢查；沒有把 M2–M5 的產品功能誤標成這份計畫的完成項。執行完成後需要獨立 code review；Python／TypeScript 變更需檢查各自的型別、例外與相容性。若採 Native，由主執行者依序完成，最後交獨立 reviewer；若採分工代理，先依所選技能安排任務與審查。現在不啟動任何實作代理。
