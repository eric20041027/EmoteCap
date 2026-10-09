# EmoteCap M1：正式發布基礎規格

日期：2026-10-06（America/New_York）
狀態：已授權 Native 執行；本機實作完成、獨立審查通過。三平台 CI 尚待遠端執行，並非正式產品已完成。
產品背景：[開源產品提案](2026-10-06-open-source-product-design.md)

## Goal

讓現有 EmoteCap 的開發環境、動作協定、輸入驗證與模型資產可重現且可測，提供後續產品化的可靠起點。

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

## Requirements and acceptance

| ID | 要求 | 驗收 |
|---|---|---|
| F1 | Windows 可執行 exporter 的 exit-code／timeout 測試 | 用 Python 子程序替身取代 `/bin/sh`；仍驗證真實 process timeout、尾端 stderr 與非零退出碼，不 skip 失敗 |
| F2 | 文檔、TS、Python、C# 與 fixture 對齊現行 v2 | 共用測試檢查 driven order／數量／版本、fixture；修正 `motion-v1.md` 文義而保留舊路徑 |
| F3 | 不合法 motion 在啟動 Blender 前遭拒 | Python model 與 HTTP 測試涵蓋非有限值、壞 quaternion、非原地 hips、重複／倒序時間、超時長；HTTP 422 不回傳不可 JSON 序列化的輸入 |
| F4 | 模型快取有內容驗證 | Node 內建測試涵蓋成功下載、離線快取、同尺寸壞檔、hash 錯誤、網路失敗；WASM 複製改為比內容 |
| F5 | fresh checkout 的自動檢查可重現 | 固定工具版本；保留依賴鎖；三作業系統上 F1–F4、既有測試及完整 `npm run build` 通過；更新開發文件 |

## Model baseline

以下 hash 是本輪從現有 downloader 的三個官方 URL 下載後計算，不是 upstream 簽章或模型授權證明。URL 仍可能漂移；內容漂移時必須失敗並透過獨立變更更新清冊。

| 檔案 | bytes | SHA256 |
|---|---:|---|
| `pose_landmarker_heavy.task` | 30664242 | `64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b` |
| `pose_landmarker_full.task` | 9398198 | `4eaa5eb7a98365221087693fcc286334cf0858e2eb6e15b506aa4a7ecdcec4ad` |
| `hand_landmarker.task` | 7819105 | `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1` |

## File boundaries

| 檔案／群組 | 責任 |
|---|---|
| `server/tests/test_exporter.py` | 可跨平台的 Blender process 替身；不修改真實 exporter |
| `contracts/motion-v1.md` | 現行 v2 協定說明；名稱保留作相容連結 |
| `server/tests/test_contract_parity.py`、`web/src/motion/contract.test.ts` | 多語言骨架定義與測資一致性 |
| `server/emotecap_server/contract.py` | motion/clip 的數值與時序驗證 |
| `server/emotecap_server/main.py` | 422 訊息安全序列化；其他 API 行為維持 |
| `server/tests/test_motion_validation.py`、`test_export_api.py` | 格式與邊界的行為測試 |
| `web/scripts/asset-integrity.mjs`、`.test.mjs` | 純 Node 內容驗證、原子下載與其測試 |
| `web/scripts/mediapipe-assets.json`、`fetch-mediapipe.mjs` | 資產清冊及安裝入口 |
| `.github/workflows/ci.yml`、`.node-version`、`server/.python-version`、`web/package.json` | 可重現工具與檢查入口 |
| `docs/development.md`、`CLAUDE.md`、`README.md` | 現行操作與協作規則；舊賽事規格保留 |

## Explicit limits

M1 不是可發布 v1。它不交付專案保存、job 佇列、Live Link 配對、Blender／Unity 真實驗證或開源授權；這些各有產品路線圖中的出口條件。F2 的 C# 原始碼比較是 drift guard，不能取代 Unity 編譯與播放測試。

M1 完成報告必須包含當前 commit、測試計數、作業系統、Python／Node 版本、模型 digest、CI run 連結（若已執行），以及未執行的實機驗收。不得把尚未在遠端跑過的 workflow 說成 CI 已通過。
