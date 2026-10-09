# EmoteCap M1 本機交付記錄

日期：2026-10-06（America/New_York）

狀態：五個本機實作任務完成，獨立審查通過。遠端三平台 CI 尚未執行，因此 M1 的跨平台出口尚未完成，也不代表可正式發布 v1。

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
| Task 3 | 有限數值、四元數、原地 hips、嚴格遞增時間與 21601 幀邊界；安全 422 | 行為測試先失敗再通過；不合法輸入不呼叫 exporter |
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

- npm audit 發現既有 `source-map-js@1.2.1` 高風險公告，路徑為 Vite → PostCSS → source-map-js（開發依賴）。公告描述惡意 indexed source map 的 section offset 可阻塞事件迴圈，修補版為 `1.2.2`。見 [GitHub 公告](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)。目前未修改依賴圖；依本輪凍結依賴圖的範圍保留為優先獨立安全修補，正式發布或處理不受信任 source map 前須解決；不能宣稱依賴安全檢查已通過。
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

獨立 reviewer：`gpt-6-astra`，審查範圍 `713d349..1dbca72`。Critical 0、Important 0、Minor 0，接受本輪 M1 本機分支；沒有需要修正的程式項目，也沒有延後的小問題。這不是完整 M1 出口或正式發布認證。

Reviewer 額外重跑 backend（380 passed、2 deselected）、assets（6 passed）與差異格式檢查。前端及建置採用本輪執行證據。受影響的 `source-map-js` 仍是 High 安全後續項，不能因為屬開發依賴而稱為無風險。

對 reviewer 明確未判定的範圍，逐項裁定如下；它們沒有被當成已驗證：

| 裁定 | 理由與保留範圍 | 若判斷錯誤的成本 |
|---|---|---|
| 6. 三平台 CI | 取得授權推送／PR 的實際 job 結果前，F5 保持待驗證 | 跨平台缺陷尚未發現 |
| 7. 攝影機與完整瀏覽器流程 | 留在 M2／M4 整合驗收；本輪未變更擷取 UI | 實際錄製流程仍未驗證 |
| 8. Blender／Unity | M4 驗證方向、比例、播放及版本；靜態 parity 只攔截格式漂移 | 動畫 runtime 缺陷可能存在 |
| 9. 不規則 timestamp 與 FPS | M1 保留既有按 frame index 匯出的行為；M4 處理時間語意，Web 現有 clip 會重採樣 | 自訂 API 的不規則時間可產生非預期播放長度 |
| 10. Gemini 真實服務 | 本輪接受 mock 證據，真實 API 與雲端同意流程另行驗收 | 真實 API／帳務行為未驗證 |
| 11. 其他代理／憑證環境 | 接受目前主機的 TLS 下載與合成離線／失敗測試，不推論所有網路可用 | 其他環境可能仍需設定網路 |
| 12. 斷電與檔案系統故障 | 驗證後替換處理一般錯誤；可重建模型不宣稱 fsync／斷電持久性 | 強殺可能留下暫存檔，或需重新下載 |
| 13. 既有安全公告 | M1 保留凍結依賴，另列優先修補；不發布、不處理不受信任 source map | 惡意 source map 仍可能阻塞建置工具 |
| 14. M2／M3 產品流程 | 專案保存、防覆蓋、job、relay、影片清理與 Gemini opt-in 保留在路線圖 | MVP 的資料流失及操作限制仍在 |
| 15. 授權與正式發布 | M5 處理授權、第三方再散布、包裝與發布；本輪沒有對外發布 | 不能把本分支宣稱為正式開源成品 |

延後的小問題：**無**。安全公告與上述待驗證範圍不降格成小問題。

## 後續出口

1. 在授權推送或 PR 後，取得 Windows、macOS、Linux 的實際 workflow 結果。
2. 處理安全公告與發布清單，完成實機攝影機／Blender／Unity 驗收。
3. 依[產品規劃](../specs/2026-10-06-open-source-product-design.md)推進專案保存、可靠工作流程與開源發布；不將本輪基礎修正視為正式 v1。

操作入口見 [Development](../../development.md)。

## 暫存清理限制

自動核准機制拒絕清除本輪 `.superpowers/sdd/2026-10-06-release-foundation/` 暫存目錄；工具只回報 `blocked by policy`，沒有提供更細原因。目錄保留且不受 Git 追蹤，沒有改用其他方式繞過限制。所有執行裁定與驗證結果已另存於本文件，不依賴暫存內容。實作 worktree 與分支亦保留。
