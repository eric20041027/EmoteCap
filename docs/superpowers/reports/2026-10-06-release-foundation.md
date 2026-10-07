# EmoteCap M1 本機交付記錄

日期：2026-10-06（America/New_York）

狀態：五個本機實作任務完成；獨立審查進行中。遠端三平台 CI 尚未執行，因此 M1 的跨平台出口尚未完成，也不代表可正式發布 v1。

## 位置與版本

- 原始 clone：`C:/Users/smallfire123123/Desktop/EmoteCap`，保留原本 `main` 與未提交的規劃文件。
- 實作 worktree：`C:/Users/smallfire123123/Desktop/EmoteCap-release-foundation`。
- 分支：`feat/release-foundation`；本輪程式基準：`591b405073fca86fbb1346a3f5c4d94b57bd52b5`。
- 原始基準：`713d349df05aa26b6b95a1b7974f7f3d8e574149`。
- 驗證平台：Windows；Node `24.19.0`、npm `11.21.0`、Python `3.12.14`、uv `0.12.6`。
- 變更已在本機提交；沒有推送、PR、合併或 release。

## 實作與驗證

| 範圍 | 已完成內容 | 本機證據 |
|---|---|---|
| Task 1 | Python 子程序替身取代 Unix shell，保留 timeout、退出碼與 stderr 尾端驗證 | 重現原來的 Windows 失敗，再驗證修正；中文與空白路徑可用 |
| Task 2 | v2 協定文件、C#／Python／JSON driven order、TS fixtures 一致性 | 暫時改錯 C# 順序與 TS 版本均使 guard 失敗，之後還原 |
| Task 3 | 有限數值、四元數、原地 hips、严格遞增時間與 21601 幀邊界；安全 422 | 行為測試先失敗再通過；不合法輸入不呼叫 exporter |
| Task 4 | SHA256 模型驗證、離線快取、損毀更新與原子寫入；WASM 比較內容 | 6 項 Node 測試通過；三個官方模型實際下載並驗證，建置重用快取 |
| Task 5 | 工具版本、三平台 workflow、開發文件與現行協作規則 | 全新依賴安裝入口、所有本機測試及完整 Web build 通過 |

| 檢查 | 結果 |
|---|---|
| `npm ci` | 成功；沿用鎖定依賴 |
| `npm run test:assets` | 6 passed |
| `npm test` | 226 passed / 30 files |
| `npm run build` | TypeScript 檢查及 Vite build 成功 |
| `uv sync --frozen --python 3.12.14` | 成功 |
| `uv run --frozen --python 3.12.14 pytest -q -m "not slow"` | 380 passed、2 deselected |
| lockfile 比對 | npm 僅 root engines metadata 新增；其他 package records 及 Python lock 未變 |
| 遠端 CI | workflow 已建立，遠端未驗證；沒有 CI run 連結 |
| 真實攝影機、Blender、Unity | 本輪未執行；2 個 Blender slow tests 明確排除 |

第一次真實模型請求曾失敗；保持 TLS 驗證的探測回應 HTTP 200，重試後三個模型均完成。未將該次失敗當成成功。有效快取的離線行為由不允許網路成功的測試驗證。

模型 SHA256：

| 檔案 | SHA256 |
|---|---|
| `pose_landmarker_heavy.task` | `64437af838a65d18e5ba7a0d39b465540069bc8aae8308de3e318aad31fcbc7b` |
| `pose_landmarker_full.task` | `4eaa5eb7a98365221087693fcc286334cf0858e2eb6e15b506aa4a7ecdcec4ad` |
| `hand_landmarker.task` | `fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1` |

## 已知檢查訊息

- npm audit 發現既有 `source-map-js@1.2.1` 高風險公告，路徑為 Vite → PostCSS → source-map-js（開發依賴）。公告描述惡意 indexed source map 的 section offset 可阻塞事件迴圈，修補版為 `1.2.2`。見 [GitHub 公告](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)。目前未修改依賴圖；此項待最終審查裁定，不能宣稱依賴安全檢查已通過。
- 既有 Vite bundle 大於 500 kB 提示仍在。
- 既有 Starlette TestClient 對 httpx 的棄用提示仍在。

## 執行裁定

以下記錄依決定順序排列，每項保留若判斷錯誤的成本：

1. Desktop 對話無法使用 app worktree 工具，所以建立手動 Git linked worktree，隔離 `main`。成本：該 worktree 的生命週期由 Git 管理。
2. 協定文字由人工檢閱；保留可證明會攔截跨語言漂移的測試，移除只檢查標題字句的測試。成本：未來文句漂移需要文件審查。
3. 四元數容許範圍使用包含端點的 `[0.98, 1.02]`，避免浮點減法誤拒端點。成本：未來改容差需同步更新兩端。
4. 模型測試使用獨立計算的固定 digest，不用待測函式生成期望值。成本：測試 bytes 改變時需明確更新 digest。
5. Vitest 排除 `scripts/**`，讓 Node 安裝測試用專用入口執行。成本：開發者與 CI 必須同時執行兩套測試，已反映於文件與 workflow。

## 獨立審查

進行中；完成後記錄裁定、修正與延後項目。

## 後續出口

1. 在授權推送或 PR 後，取得 Windows、macOS、Linux 的實際 workflow 結果。
2. 處理安全公告與發布清單，完成實機攝影機／Blender／Unity 驗收。
3. 依[產品規劃](../specs/2026-10-06-open-source-product-design.md)推進專案保存、可靠工作流程與開源發布；不將本輪基礎修正視為正式 v1。

操作入口見 [Development](../../development.md)。
