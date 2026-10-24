# 獨立審查：收斂為獨立 3D 遊戲開發者的動作製作工具

日期：2026-10-23。三個獨立、唯讀審查分別檢查架構、捕捉品質／延遲、上游權利；本輪沒有產品程式修改、套件安裝、服務、攝影機或新實測。main5cf0663 與審查起點9cb3eaa具有相同 tree。以下是程式證據與提案，不是改善幅度的 benchmark。

結論：**保留 React／純 TypeScript motion-core／FastAPI／Blender／Unity 邊界。先修正熱路徑與設定語意，讓核心流程只有「擷取→整理→帶進遊戲」；不需要全面重寫 native shell、改微服務或自訓模型。**

## 優先序與具體證據

| 優先 | 發現 | 具體位置 | 改進方向 |
|---|---|---|---|
| P1 正確性 | 即時校正只檢查有 landmarks，就標 T-pose 成功；未要求姿勢／可信度／穩定窗口。 | `web/src/capture/useCalibration.ts:43–52`、`web/src/motion/solver.ts:205`；影片已有 `web/src/import/tpose.ts:34` 的不同規則。 | 共用可測的 calibration policy，按 capture profile 接受／拒絕並給原因；不把更強 smoothing 當成修好錯誤 rest pose。 |
| P1 正確性 | `calibrate(explicitSample)` 會優先用 lastPoints；影片預覽指定的 held 中間影格可能被較後影格取代。 | `web/src/motion/index.ts:106–114`、`web/src/import/convertVideo.ts:159`。 | 分開明確 sample 校正與 latest-filtered 校正；測試指定影格真的被使用。最終 take 用 fresh solver，不能擴大成所有最終 take 都錯。 |
| P1 熱路徑 | 錄製每幀複製整個 frames array 並觸發 React；整段累積為 O(n²) pointer-copy work。 | `web/src/record/useRecorder.ts:62,137`、`web/src/App.tsx:142`。 | 私有 append/chunk buffer；UI 限頻 snapshot；checkpoint／stop 產生 immutable snapshot。保留每幀驗證、180秒／容量、五秒 checkpoint 與已保存 prefix。 |
| P1 資源 | Body only 略過 hand inference，卻仍初始化手部模型；camera 和 import 都如此。 | `web/src/capture/landmarkers.ts:55`、`web/src/capture/usePose.ts:263`、`web/src/import/useVideoImport.ts:103`。 | model factory 明確接收所需 detectors；不用手指時不建立 hand model，切換／取消／撤回時正確收尾。不宣稱 steady-state FPS 已提升。 |
| P1 新能力 | full/body 是是否包含手指，不是全身／上半身。缺 hips 會影響 torso；grounding／jump／planting 仍無條件執行。 | `web/src/settings/skeleton.ts:3`、`web/src/motion/solver.ts:77–87,285`、`web/src/motion/index.ts:100–104`、`web/src/capture/captureChecks.ts:26`。 | 分開 capture region、finger detail、export rig；定義上半身 hips／root／head fallback，停用下身地面／跳躍推導。這是待新增能力，不冒稱既有 regression。 |
| P1 品質 | 低 confidence 點先污染 landmark filter；多個身體關節缺失時無時限 hold，恢復缺少一致政策。 | `web/src/motion/index.ts:90`、`web/src/motion/oneEuro.ts:62`、`web/src/motion/solver.ts:238,285`。 | confidence-aware admission、hold／relax／reacquisition；先用 dropout 與 step/sine 控制同時比較 jitter、lag、overshoot。 |
| P2 延遲 | pose／hand detectForVideo 與 solver 都在主執行緒。GPU delegate 不等於 JS 已移入 worker。 | `web/src/capture/usePose.ts:197,209`、`web/src/capture/videoFrameLoop.ts:10`、`web/src/preview/PreviewCanvas.tsx:40`。 | 先做分階段 profiling；確有需要才評估一個 in-flight＋latest-only worker，驗證 GPU／OffscreenCanvas 相容性。現行 callback 沒有無限 inference promise queue，不應虛構 backlog 問題。 |
| P2 遊戲整合 | 目前 Unity 是整身覆寫／播放示範，未提供上身 mask 與下身 locomotion 混合。ClipPlayer 清空 Controller。 | `unity/com.emotecap.mocap/Runtime/EmoteCapLiveLink.cs:159–173`、`EmoteCapClipPlayer.cs:32`。 | 保留原 sample，新增 masked upper-body override 範例，先定義 hips／root policy；world-delta 不能直接當 local additive rotation。 |
| P2 精準度限制 | 肢體 twist 依 bend plane／前一 normal 估計；planting 以相對最低腳判接地，不是真正接觸感測。 | `web/src/motion/solver.ts:115,159,292`、`web/src/motion/plant.ts:23`、`web/src/motion/jump.ts:51`。 | 明示單鏡頭不可觀測部分；接觸用 confidence／速度／跳躍狀態評估，勿用新增骨骼數量宣稱真實精度。 |
| P2 簡化 | 舊 RecordPanel→ReviewPanel→SlicePanel 路徑已脫離目前 App 的 ProjectReview；exporter 同時保留新舊路徑。 | `web/src/App.tsx:269`、`web/src/record/RecordPanel.tsx:25`、`ReviewPanel.tsx:32`、`useExporter.ts:43`。 | 做 entry/import graph 後移除不可達 UI；保留仍由 Studio／e2e 使用的 playback／TimeField；server 已公開 compatibility endpoint 不直接刪。 |
| P2 主流程 | 可選 Gemini 與 Live Link 常駐主介面／root controller，增加主要工作流程的概念數量。 | `web/src/App.tsx:60,267,283`、`web/src/cloud/useCloudSlice.ts:7`。 | 移到進階／可選區。Live Link 已預設 off；收合不能隱藏 pending upload、cleanup error、配對撤銷失敗或 consent。 |

## 保留、收斂與延後

保留 motion-core／共享契約與 fixtures、不可變 take、非破壞 clip、IndexedDB／portable backup、export jobs、Blender canonical FBX、Unity。這些直接支持可恢復、可編輯、可帶進遊戲的作品；不能為了少幾個檔案刪掉資料安全。

收斂舊 UI 分支、重複 exporter 心智模型、capture orchestration、重複校正規則。production 模組目前不是數千行巨物；拆分應以責任／資料流，而不是檔案行數或加入泛用 plugin framework。

將 Gemini／Live Link 留為選配，Unity props／collider 留在 samples。多人、多鏡頭、臉部、任意 rig 編輯器、全引擎整合、native shell、自訓 tracking model 延後；這些不是使用者本輪的必要核心。

## 先不做實機時能驗證什麼

可以驗證：校正拒絕／穩定窗口、明確 sample 語意、confidence/dropout/reacquisition、上身裁切與 hips/head fallback、hands off 不建立模型、長 take 的 snapshot／checkpoint、stage cost／allocations、bounded latest-only 行為、固定資料 preview→FBX→Unity 的方向／比例／時間與 mask/root 邏輯。

不能宣稱：真實人物角度準確度已改善、camera-to-screen 延遲下降、M2筆電有效FPS已達標、遮擋／轉身品質已通過，或五名新手可用性已完成。現有量測的 p95 有特定起終點，不能等同 sensor-to-screen；stationary RMS／heel drift 是代理指標，不是 ground truth。

## 對新版產品的建議

先以「全身／上半身 × 手指開／關」形成四個明確 preset；把輸出骨架與偵測點數分清楚。更多骨骼不等於更多被鏡頭可靠觀測的資訊。保留 v2 48 driven／192 rotation values 與 52／22 export rig，相容舊專案；上半身改的是解算及動畫通道政策，不是隨意縮短 wire array 或刪掉 Humanoid 必要骨架。

新的 Unity 範例先做下半身 locomotion＋masked 上半身 override，再考慮真正 additive。[Unity Avatar Mask](https://docs.unity3d.com/6000.5/Documentation/Manual/class-AvatarMask.html) 支持按 Humanoid 部位／Transform hierarchy 選擇動畫作用範圍；本專案目前尚未完成該整合。

詳細設計見 [產品設計提案](../specs/2026-10-23-indie-game-mocap-design.md)；上游權利見 [本輪核對](../../redistribution-assessment-2026-10-23.zh-TW.md)。本報告不等於允許直接修改全部核心契約，實作須依獲准的設計分段計畫執行。
