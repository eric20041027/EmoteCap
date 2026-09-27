# OneTake — 設計文件

> **Act once. Animate anything.**
> HackNite 2026（2026-09-26 20:00 → 09-27 08:00 EDT）
> 目標：Overall Winner
> 狀態：設計已確認（21:05）。21:15 修訂：Gemini 功能暫緩（見 §14）。「OneTake」是工作名稱，提交前可以改。

## 1. 一句話

用電腦鏡頭錄一次、連續做好幾個動作。OneTake 依動作之間的停頓自動切成片段，解算成人形骨架動作，再匯出 Unity 能直接用的 Humanoid FBX。錄的時候還能透過 Live Link 讓 Unity 角色即時同步。

**痛點**：Unity 開發者的角色動作只能從 Mixamo 現成的動作庫挑，想要的動作常常沒有；專業動捕設備又太貴。

**跟 Rokoko Vision / DeepMotion / QuickMagic 的差異**：

1. 一鏡到底：依停頓自動切片，錄一次就得到一整套動作庫，現場命名、標記循環。
2. Unity Live Link：鏡頭前動，Unity 角色即時跟著動。
3. 匯入 Unity 不用設定：FBX 自動設成 Humanoid + Loop，直接套到任何人形角色。
4. 全部在本機即時跑（MediaPipe 在瀏覽器裡），開源、免費。

## 2. 範圍

### MVP（02:00 前完成）

- 瀏覽器鏡頭即時姿勢偵測，加上 3D 人偶預覽
- 錄一段 take（每幀的 landmarks 和 MotionFrame），最長 3 分鐘
- 自動切片：依動作之間的停頓分段。片段列表可以改名、改起訖時間、勾選循環、刪除
- 每個片段匯出一個 Humanoid FBX（Mixamo 骨架命名、T-pose rest）
- Unity 套件：FBX 匯入時自動設成 Humanoid + Loop；Live Link 即時驅動角色
- 貼地修正：調整 Hips 高度，讓最低的那隻腳貼地（即時層就做）

### 品質階段（02:00–05:00，照順序做，做到哪算哪）

1. 腳部固定：用雙骨 IK 把著地的腳釘住
2. 循環片段自動找循環點並淡化接縫；頭尾姿勢相近的片段預設勾選循環
3. 在時間軸上直接拖曳切點
4. 錄製時同步錄 webm，預覽片段時跟人偶並排播放
5. 匯出後自動送進 Unity（`clip_ready` 訊息 → Editor 自動下載並匯入）
6. 跳躍：用影像座標估計 Hips 往上的位移

### 不做

手指、臉部表情、多人、水平方向的 root motion（一律輸出原地動畫）、用講的修動作、語音導演、雲端部署、帳號系統。Gemini 相關功能暫緩，見 §14。

## 3. Demo 腳本（= 成功標準）

| 秒 | 畫面 | 證明了什麼 |
|---|---|---|
| 0–15 | 「Mixamo 只有它有的動作」 | 痛點 |
| 15–45 | 站起來動，Unity 遊戲場景裡的角色即時跟著動 | Live Link、執行力 |
| 45–75 | 一鏡到底：待機 → 揮手 → 揮劍 → 勝利舞，每個動作之間停一下 | 使用方式 |
| 75–95 | 自動切出 4 個片段，現場改名，待機勾選循環 | 一鏡到底切片 |
| 95–125 | 匯出到 Unity，套到兩個不同身材的角色都能播 | 實用性、完整度 |
| 125–150 | 一頁技術架構 +「Act once. Animate anything.」 | 技術深度 |

## 4. 架構

```
鏡頭 → [web] MediaPipe PoseLandmarker(33 點) → motion-core 解算 → three.js 人偶預覽
                                                   ├─ Live Link ─ws→ [server] relay ─ws→ [Unity] 角色即時同步
                                                   └─ 錄製 take：每幀 landmarks + MotionFrame
[web]    motion-core 錄後處理：自動切片 → 使用者調整 → 循環修整 → 腳部固定 → Clip[]
[web]    ─POST /api/export→ [server] Blender headless → 每個 Clip 一個 FBX + .onetake.json
[Unity]  FBX 放進 Assets/OneTake/ → Importer 自動設 Humanoid + Loop → 拖到任何人形角色
```

**原則：所有動作數學只寫一次，放在 TypeScript 的 motion-core。** 預覽、Live Link、匯出用的都是同一份結果。Server 不碰動作數學，只負責 Blender 匯出和 relay。

| 元件 | 位置 | 技術 | 負責 |
|---|---|---|---|
| Web app | `web/` | Vite + React + TypeScript、`@mediapipe/tasks-vision`（PoseLandmarker Heavy，GPU）、three.js | Web |
| motion-core 即時層（§6.1） | `web/src/motion/live/` | 純 TS 函式 + vitest | Claude（主機） |
| motion-core 錄後處理（§6.2） | `web/src/motion/post/` | 純 TS 函式 + vitest | AI / 後端 |
| Server | `server/` | Python 3.12 + FastAPI + uv | AI / 後端 |
| Blender 匯出 | `server/blender/export_fbx.py` | Blender 5.1 headless（bpy） | AI / 後端 |
| Unity 套件 | `unity/com.onetake.mocap/` | UPM 套件、C#、`System.Net.WebSockets.ClientWebSocket` | Unity（smallfire） |

## 5. 資料契約 v1（改之前先在群組講）

完整版放在 `contracts/motion-v1.md`，以下是重點。

### 5.1 座標系

- **Canonical**：右手座標、+Y 朝上、角色面向 +Z、單位公尺（跟 glTF / three.js 一樣）
- MediaPipe world landmark → canonical：`(x, -y, -z)`。送進 MediaPipe 的畫面**不鏡像**，鏡像只用 CSS 做在顯示上。
- canonical → Unity：位置 `(-x, y, z)`，四元數 `(x, -y, -z, w)`
- canonical → Blender：位置 `(x, -z, y)`，四元數 `Quaternion((w, x, -z, y))`
- **C1 驗收**：「舉右手」測試。瀏覽器、FBX、Unity 裡的角色都要舉**右手**，頭要朝上。

### 5.2 骨頭順序 `BONES`（父骨頭在前，索引固定）

| # | 名稱（= Unity `HumanBodyBones`） | FBX / Mixamo 名稱 |
|---|---|---|
| 0 | Hips | mixamorig:Hips |
| 1 | Spine | mixamorig:Spine |
| 2 | Chest | mixamorig:Spine1 |
| 3 | UpperChest | mixamorig:Spine2 |
| 4 | Neck | mixamorig:Neck |
| 5 | Head | mixamorig:Head |
| 6 / 9 | LeftUpperArm / RightUpperArm | mixamorig:LeftArm / RightArm |
| 7 / 10 | LeftLowerArm / RightLowerArm | mixamorig:LeftForeArm / RightForeArm |
| 8 / 11 | LeftHand / RightHand | mixamorig:LeftHand / RightHand |
| 12 / 15 | LeftUpperLeg / RightUpperLeg | mixamorig:LeftUpLeg / RightUpLeg |
| 13 / 16 | LeftLowerLeg / RightLowerLeg | mixamorig:LeftLeg / RightLeg |
| 14 / 17 | LeftFoot / RightFoot | mixamorig:LeftFoot / RightFoot |

匯出骨架另外包含**不驅動**的 `mixamorig:LeftShoulder` / `RightShoulder` / `LeftToeBase` / `RightToeBase`，這幾根永遠維持 rest。

### 5.3 Canonical 骨架（T-pose，各骨頭起點，公尺）

| 骨頭 | 位置 | 骨頭 | 位置 |
|---|---|---|---|
| Hips | (0, 0.95, 0) | LeftShoulder | (0.05, 1.40, 0) |
| Spine | (0, 1.05, 0) | LeftUpperArm | (0.18, 1.40, 0) |
| Chest | (0, 1.17, 0) | LeftLowerArm | (0.46, 1.40, 0) |
| UpperChest | (0, 1.29, 0) | LeftHand | (0.72, 1.40, 0)，末端 (0.90, 1.40, 0) |
| Neck | (0, 1.45, 0) | LeftUpperLeg | (0.09, 0.93, 0) |
| Head | (0, 1.55, 0)，末端 (0, 1.75, 0) | LeftLowerLeg | (0.09, 0.50, 0) |
| | | LeftFoot | (0.09, 0.08, 0) |
| | | LeftToeBase | (0.09, 0.00, 0.14)，末端 (0.09, 0.00, 0.20) |

右側 = 左側的 x 取負。`H0 = 0.95` 是 canonical 的 Hips 高度。

### 5.4 MotionFrame（JSON，只用扁平陣列，讓 Unity `JsonUtility` 能直接解析）

```json
{ "t": 1.2333, "h": [0.0, 0.93, 0.0], "r": [0, 0, 0, 1, 0, 0, 0, 1] }
```

- `t`：秒（take 內的時間）
- `h`：Hips 位置，canonical 公尺，已經換算成 canonical 骨架的比例。x、z 目前固定為 0（原地動畫）。
- `r`：18 × 4 = 72 個 float，照 `BONES` 順序排，每根骨頭一組四元數 `(x, y, z, w)`。存的是**相對 T-pose 的世界旋轉差**。
- 套到任何骨架上的方法：`boneWorldRotation = r[b] × restWorldRotation[b]`，父骨頭先套。

### 5.5 Segment 與 Clip

```json
{ "name": "Clip_01", "start": 12.4, "end": 14.1, "loop": false }
{ "name": "Idle_Breathing", "loop": true, "fps": 30, "frames": [ /* MotionFrame, t 從 0 開始 */ ] }
```

- Segment 由自動切片產生，使用者在片段列表裡修改。
- `name`：只能用 `[A-Za-z0-9_]`，最多 24 個字元，預設依序為 `Clip_01`、`Clip_02`…。同一個 take 裡重名就加 `_2`。
- Clip 的 frames 已經處理過：濾波、貼地、腳部固定（有做的話）、循環修整。

### 5.6 HTTP API（server 預設 `http://localhost:8787`）

| 方法 | 路徑 | 輸入 | 輸出 |
|---|---|---|---|
| GET | `/api/health` | – | `{ ok, blender }` |
| POST | `/api/export` | `{ clips: Clip[] }`，請求上限 20MB | `{ files: [{ name, url }] }` |
| GET | `/files/{name}.fbx` | – | FBX 檔 |

### 5.7 WebSocket Live Link：`ws://localhost:8787/ws/live?role=source|sink`

- source（瀏覽器）連上後先送一次 `{"type":"hello","version":1,"bones":[...]}`，之後每幀送 `{"type":"frame","t":…,"h":[…],"r":[…]}`
- server 把 source 的訊息原封不動轉給所有 sink（Unity）
- 匯出完成後，server 廣播給所有 sink：`{"type":"clip_ready","name":"…","url":"…","loop":true}`

## 6. motion-core（`web/src/motion/`）

### 6.1 即時層（`live/`，每幀跑）

1. One Euro 濾波，套在每個 landmark 座標上。初始參數 `minCutoff = 1.0`、`beta = 0.01`、`dCutoff = 1.0`，現場再調。
2. 解算：用「主軸 + 第二軸」建正交座標框，得到世界旋轉，再除以 rest 框得到旋轉差

   | 骨頭 | 主軸 | 第二軸 |
   |---|---|---|
   | Hips | 右髖 → 左髖 | 髖中點 → 肩中點 |
   | Chest、UpperChest | 右肩 → 左肩 | 髖中點 → 肩中點 |
   | Spine | Hips 和 Chest 做 slerp(0.5) | – |
   | Head | 右耳 → 左耳 | 耳中點 → 鼻子 |
   | Neck | UpperChest 和 Head 做 slerp(0.5) | – |
   | UpperArm、LowerArm | 肩 → 肘、肘 → 腕 | 手肘彎曲平面的法向量 |
   | Hand | 腕 → 食指和小指的中點 | 小指 → 食指 |
   | UpperLeg、LowerLeg | 髖 → 膝、膝 → 踝 | 膝蓋彎曲平面的法向量 |
   | Foot | 腳跟 → 腳尖 | 腳踝 → 膝蓋 |

3. 退化處理：手臂或腿打直（彎曲角 < 10°）時，第二軸沿用上一幀；四元數跟上一幀的內積 < 0 時取反，避免翻轉。
4. 關節限制：手肘、膝蓋只能沿一個軸彎，範圍 0°–150°。
5. landmark 的 visibility < 0.5 時，相關骨頭維持上一幀。
6. Hips 高度 `h.y`：在以髖為原點的 canonical 座標裡，取兩腳腳跟和腳尖中最低點的 y 取負，讓最低的腳貼地。再乘上 `canonical 腿長 / 演員腿長` 換算成 canonical 比例（演員腿長取最近 30 幀的中位數）。

### 6.2 錄後處理（`post/`，只對錄好的 take 跑）

1. **自動切片**：動作能量 `E(t)` = 關鍵點速度總和（先平滑）。`E` 低於門檻（整段 `E` 的第 20 百分位數）持續超過 0.4 秒的區間視為停頓。停頓之間的動作區間各成一段，前後各多留 0.1 秒；短於 0.5 秒的片段丟掉。開頭走位、結尾走回電腦也會被切成片段，由使用者在列表裡刪掉。整段都沒有停頓時，整段當成一個片段。
2. **使用者調整**（UI）：改名、改起訖時間、勾選循環、刪除。
3. **循環修整**（品質階段）：在片段內找「姿勢距離 + 速度差」最小的一對幀 (i, j)，且 j − i ≥ 0.8 秒。裁成 [i, j]，最後 6 幀往第一幀做 slerp 淡化接縫。
4. **腳部固定**（品質階段）：腳跟或腳尖高度 < 3cm、速度 < 0.15 m/s、持續 ≥ 4 幀，就判定為著地。著地期間把腳固定在剛著地時的位置，用雙骨 IK（餘弦定理，保留原本膝蓋的彎曲平面）重新解 UpperLeg 和 LowerLeg。

### 6.3 預覽人偶

three.js 依照 5.3 的 canonical 骨架，每根骨頭用一個膠囊體畫出人偶。它本身就是匯出用的骨架，所以預覽看到的就是匯出的結果，也不會有模型授權問題。

## 7. Server（`server/`）

### 7.1 Blender 匯出

- 指令：`$BLENDER_PATH -b --factory-startup -P server/blender/export_fbx.py -- --in <clips.json> --out <dir>`。`BLENDER_PATH` 預設 `/Applications/Blender.app/Contents/MacOS/Blender`。
- 照 5.3 建 canonical 骨架：Mixamo 命名、T-pose，包含不驅動的 Shoulder 和 ToeBase。
- 逐幀照 `BONES` 順序（父骨頭先）設定 pose bone：世界旋轉 = `r[b] × rest`，Hips 位置 = `h`。
- 每個 Clip 匯出一個 FBX：只包含骨架、`bake_anim=True`、`add_leaf_bones=False`、Y 朝上。**C1 驗收：Unity 匯入後比例正確（身高約 1.75m）。**
- 每個 FBX 旁邊寫一個 `<name>.onetake.json`（`{ name, loop, fps }`），給 Unity Importer 讀。

### 7.2 其他

- WS relay：source 的訊息轉給所有 sink；sink 斷線不影響 source。
- 匯出的 FBX 放在 `server/data/`（已加進 gitignore）。
- CORS 只開放 `http://localhost:5173`。
- 設定從 `.env` 讀（`BLENDER_PATH`、`PORT`），`.env.example` 要 commit。目前不需要任何 API key。

## 8. Unity 套件（`unity/com.onetake.mocap/`）

- 安裝：Package Manager → Add package from git URL → `https://github.com/<owner>/<repo>.git?path=/unity/com.onetake.mocap`（repo 建好後換成實際網址）
- `Runtime/OneTakeLiveLink.cs`
  - 連到 `ws://<host>:8787/ws/live?role=sink`，host 可在 Inspector 設定，隊友的機器也能連
  - Start 時記錄每根骨頭的 rest 世界旋轉。角色必須是 T-pose 的 bind pose（Mixamo 角色符合），而且不能掛 Animator Controller
  - 在 LateUpdate 套用最新一幀：`bone.rotation = ToUnity(r[b]) * restWorld[b]`，父骨頭先套；Hips 高度 = `rigHipsRestY × h.y / H0`
  - 斷線後每 2 秒自動重連；沒有收到資料時角色停在最後的姿勢
  - 在背景執行緒收資料，主執行緒只讀最新一幀
- `Editor/OneTakeImporter.cs`（AssetPostprocessor）
  - 只處理 `Assets/OneTake/` 底下的 FBX
  - `animationType = Human`、`avatarSetup = CreateFromThisModel`
  - 讀同名的 `.onetake.json`，設定 clip 名稱、`loopTime`、`loopPose`
- 品質階段：`Editor/OneTakeSync.cs` 收到 `clip_ready` 就把 FBX 下載到 `Assets/OneTake/`，再 `AssetDatabase.Refresh()`
- 使用提醒：Animator state 要勾 **Foot IK**
- Mixamo 模型不要 commit 進公開 repo（授權問題），demo 場景用本機的模型

## 9. 錯誤處理

| 情況 | 系統行為 |
|---|---|
| 鏡頭權限被拒或沒有鏡頭 | 整頁提示，附重試按鈕 |
| 畫面裡沒有人，或 visibility 太低 | 人偶停在上一幀，畫面提示「退後一點，讓全身入鏡」 |
| 自動切片切不出片段（整段沒有停頓） | 整段當成一個片段，UI 提示「動作之間停 0.5 秒會切得更準」 |
| Blender 失敗 | `/api/export` 回 500，附 Blender stderr 最後 20 行，UI 顯示錯誤 |
| Live Link 斷線 | 兩端都自動重連，Unity 角色停在最後的姿勢 |
| 錄製超過 3 分鐘 | 自動停止錄製並提示 |
| `/api/export` 請求超過 20MB | server 回 413，UI 提示把片段分批匯出 |

## 10. 測試（hackathon 模式：放寬全域的 TDD / 80% 覆蓋率規則）

- **motion-core**：TDD + vitest。必測項目：
  - T-pose 輸入 → 所有骨頭都是單位四元數
  - 左手從平舉往上抬 90°
  - 手肘彎 90°
  - 轉頭 45°
  - 手臂打直時不會翻轉
  - One Euro 濾波能降低雜訊
  - 自動切片：合成的「動 → 停 → 動 → 停 → 動」資料切成 3 段，切點誤差 < 0.1 秒；整段沒有停頓 → 1 段
  - 循環修整能找到合成正弦動作的週期（做到循環修整時才寫）
  - 雙骨 IK 誤差 < 1mm（做到腳部固定時才寫）
- **server**：pytest。`/api/export` 用假的 Blender 指令測成功和失敗兩種情況；relay 測 source 的訊息會轉給 sink。Blender 做一個 smoke test：fixture clip 能產生 FBX。
- **Unity 和 UI**：每個檢查點手動跑一次 demo 檢查清單。
- **共用測資**：`contracts/fixtures/` 放一段 T-pose take 和一段揮手 take 的 JSON，每個 lane 都拿來測。

## 11. 分工與時程

| Lane | 負責 | C1（23:00）驗收 |
|---|---|---|
| Web | `web/` UI：鏡頭、MediaPipe、人偶預覽、錄製、片段列表（改名、改時間、循環、刪除）、Live Link 發送 | 鏡頭 → MediaPipe 跑起來，骨架疊在畫面上；人偶會動 |
| AI / 後端 | `server/`：FastAPI、Blender 匯出、WS relay；motion-core 錄後處理（`web/src/motion/post/`） | fixture clip 匯出成 FBX（跟 Unity lane 一起確認 Unity 能播）；relay 能把 fixture 串流轉給 Unity；自動切片測試通過 |
| Unity + Claude | `unity/` 套件、demo 場景；Claude 在主機寫 motion-core 即時層（`web/src/motion/live/`） | FBX 在 Unity 設成 Humanoid 並套到 Mixamo 角色上能播；Live Link 被 fixture 串流帶著動；解算測試全部通過 |

| 時間 | 檢查點 |
|---|---|
| 21:45 | repo 骨架推上 GitHub，每個人 clone 開工 |
| 23:00 | **C1**：上表每一格都驗收通過，「舉右手」測試通過 |
| 02:00 | **C2**：整條流程走通（錄一段 → 自動切片 → FBX → Unity 能播），Live Link 用真的鏡頭跑。這時決定要不要加回 Gemini（§14） |
| 05:00 | 停止加功能，只修 bug |
| 05:00–06:30 | Unity lane 錄 demo 影片；Web lane 寫英文 README 和提交描述；AI lane 修 bug、準備備用錄影 |
| 07:30 | 提交，不要拖到 08:00 |

### 協作規則

- 每個 lane 只改自己的資料夾。要改 `contracts/` 之前先在群組講。
- 小步 commit，push 前先 `git pull --rebase`。main 隨時都要能跑。
- commit 訊息用 `feat` / `fix` / `refactor` / `docs` / `test` / `chore` 開頭。
- `.env` 永遠不 commit。新增環境變數時同步加進 `.env.example`。

## 12. 風險與備案

| 風險 | 機率 | 備案 |
|---|---|---|
| 座標系或鏡像搞錯 | 高 | 單元測試、「舉右手」測試、預覽畫面加座標軸 |
| Blender 匯出的 FBX 在 Unity 建不出 Humanoid avatar | 中 | C1 前先驗證；不行就改用本機的 Mixamo 骨架當匯出骨架 |
| 自動切片切錯（動作之間沒停頓，或停頓太短） | 中 | 錄製前提示「動作之間停 0.5 秒」；片段起訖時間可以手動改；品質階段加時間軸拖曳 |
| 動作抖動 | 中 | 調 One Euro 參數；Hips 和 Spine 濾重一點 |
| Live Link 延遲或斷線 | 低 | 本機連線 + 自動重連；最壞情況改用瀏覽器預覽來 demo |

## 13. 提交清單

- [ ] GitHub repo（public），附英文 README：GIF、架構圖、安裝步驟
- [ ] 專案名稱
- [ ] Demo 影片：YouTube 不公開連結，3 分鐘以內
- [ ] 描述：痛點 → 我們做了什麼 → 技術架構
- [ ] Technologies：MediaPipe、three.js、React、Vite、TypeScript、FastAPI、Python、Blender、Unity、C#

## 14. 暫緩：Gemini 功能

21:15 決定先擱置，C2（02:00）時看進度再決定要不要加回來。加回來不用改資料契約，因為 Segment 的格式一樣，只是改由 Gemini 產生名稱和切點。

原本的設計（保留備查）：

- 流程：錄製時同步錄 webm → `POST /api/takes` 上傳影片 → Gemini 看影片，切出片段、命名、判斷要不要循環 → motion-core 在每個切點前後 0.75 秒內找動作能量最小值，把切點修準 → 取代自動切片的結果。Gemini 失敗時退回自動切片。
- 模型：`gemini-3.8-flash`（有免費額度，用之前先 `models.list` 確認）。影片 ≤ 20MB 直接 inline，超過走 Files API；`video_metadata.fps = 5`；`response_schema = Segment[]`。
- Prompt 重點：一個演員在同一段連續影片裡做了好幾個不同動作；忽略開頭站位和結尾走回電腦的時間；每個不同的動作切成一段；時間用秒、精確到小數點後一位；會自然重複的動作設 `loop=true`。
- 安全：API key 只放 server 的 `.env`（repo 是公開的）。
- 加回來的好處：可以投 Best Use of Gemini API；錄的時候動作之間不用刻意停頓；片段自動有有意義的名稱。
- 估計工時：約 3 小時（server 1.5 小時、web 上傳和按鈕 1 小時、測試 0.5 小時）。
