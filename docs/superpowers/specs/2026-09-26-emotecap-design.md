# EmoteCap — 設計文件

> **Act once. Animate anything.**
> HackNite 2026（2026-09-26 20:00 → 09-27 08:00 EDT）
> 目標：Overall Winner，同時投 Best Use of Gemini API
> 狀態：設計已確認（21:05）；21:15 調整開發順序：**先做動捕 → Unity，Gemini 延後**。專案名稱 **EmoteCap**（21:40 定案）。

## 0. 目前狀態（2026-09-27 02:00 更新）

三個階段都已完成並在 `main` 上。原始設計之後新增的功能：

- **手指**：契約 v2，48 根驅動骨骼（身體 18 + 手指 30）；網頁可選「身體 / 身體 + 手指」骨架。
- **iPhone 鏡頭**：Safari 透過接續互通相機使用 iPhone，會記住上次選的鏡頭；可裁成直式 3:4。
- **防抖**：地標和每根骨頭的旋轉都有 One Euro 濾波（Low / Medium / High）；Unity Live Link 在兩幀之間平滑插值。
- **站姿**：站立時腳掌貼平地面；偵測跳躍。
- **匯入影片**：現成影片逐格轉成 take，走同一套 Gemini 切片 → FBX 流程（見 `2026-09-27-video-import-design.md`）。
- **Unity**：動畫選單（Clip Player）、實體碰撞（Body Colliders）、道具重置（Reset Props）、匯出後自動建立播放清單。

## 1. 一句話

用電腦鏡頭錄一次、連續做好幾個動作。EmoteCap 用 Gemini 看影片，自動切成命名好的動畫片段，解算成人形骨架動作，再匯出 Unity 能直接用的 Humanoid FBX。錄的時候還能透過 Live Link 讓 Unity 角色即時同步。

**痛點**：Unity 開發者的角色動作只能從 Mixamo 現成的動作庫挑，想要的動作常常沒有；專業動捕設備又太貴。

**跟 Rokoko Vision / DeepMotion / QuickMagic 的差異**：

1. 一鏡到底：Gemini 自動切片、命名、標記循環，錄一次就得到一整套動作庫。
2. Unity Live Link：鏡頭前動，Unity 角色即時跟著動。
3. 全部在本機即時跑（MediaPipe 在瀏覽器裡），開源、免費。

**開發順序**：動捕 → Unity 是地基，先做到能用；Live Link 第二；Gemini 最後疊上去。

## 2. 範圍（照階段做，前一階段通了才開下一階段）

### 階段 1：動捕 → Unity（01:00 前完成，最優先）

- 瀏覽器鏡頭即時姿勢偵測，加上 3D 人偶預覽
- 貼地修正：調整 Hips 高度，讓最低的那隻腳貼地（即時層就做）
- 錄一段 take（每幀 MotionFrame）
- 手動裁切：設定開始和結束點、取名、勾選是否循環。**一次錄製 = 一個片段**
- 匯出 Humanoid FBX（Blender headless，Mixamo 骨架命名、T-pose rest）
- 匯出的檔案直接寫進 Unity 專案的 `Assets/EmoteCap/`（見 7.1），Importer 自動設成 Humanoid + Loop，套到 Mixamo 角色上就能播

### 階段 2：Unity Live Link（02:30 前）

- server 的 WebSocket relay
- 瀏覽器每幀送出 MotionFrame，Unity 收到後驅動角色，即時同步

### 階段 3：Gemini 一鏡到底自動切片（04:00 前）

- 錄製時同時錄 webm 影片
- 上傳影片 → Gemini 回傳 Segment[] → 用動作能量修準切點 → 一個 take 變成多個片段，一次匯出
- Gemini 失敗時改用動作能量做備援切片
- **至少要做出這個階段的最小版本（不修切點也可以），才有資格投 Gemini 獎**

### 品質階段（有時間才做，照順序）

1. 腳部固定：用雙骨 IK 把著地的腳釘住
2. 循環片段自動找循環點，並淡化接縫
3. 匯出後透過 `clip_ready` 通知遠端機器上的 Unity 自動下載（給不在同一台電腦的隊友用）
4. 跳躍：用影像座標估計 Hips 往上的位移

### 不做

手指、臉部表情、多人、水平方向的 root motion（一律輸出原地動畫）、用講的修動作、語音導演、雲端部署、帳號系統。

## 3. Demo 腳本（= 成功標準）

| 秒 | 畫面 | 證明了什麼 |
|---|---|---|
| 0–15 | 「Mixamo 只有它有的動作」 | 痛點 |
| 15–45 | 站起來動，Unity 遊戲場景裡的角色即時跟著動 | Live Link、執行力 |
| 45–75 | 一鏡到底：待機 → 揮手 → 揮劍 → 勝利舞 | 使用方式 |
| 75–95 | Gemini 切出 4 個命名好的片段，待機標記為循環 | Gemini 影片理解 |
| 95–125 | 匯出到 Unity，套到兩個不同身材的角色都能播 | 實用性、完整度 |
| 125–150 | 一頁技術架構 +「Act once. Animate anything.」 | 技術深度 |

階段 3 來不及時的備案：45–95 秒改成「錄一個動作 → 手動裁切 → 匯出」，其他照舊。

## 4. 架構

```
鏡頭 → [web] MediaPipe PoseLandmarker(33 點) → motion-core 解算 → three.js 人偶預覽
                                                   ├─【階段 2】Live Link ─ws→ [server] relay ─ws→ [Unity] 角色即時同步
                                                   └─ 錄製 take：每幀 MotionFrame（階段 3 加錄 webm）
【階段 1】[web] 手動裁切 → Clip ─POST /api/export→ [server] Blender headless → FBX + .emotecap.json
                                                   → 寫進 Unity 專案 Assets/EmoteCap/ → Importer 自動設 Humanoid + Loop
【階段 3】[web] 上傳影片 ─POST /api/takes→ [server] Gemini → Segment[] → [web] 修準切點 → 多個 Clip 一次匯出
```

**原則：所有動作數學只寫一次，放在 TypeScript 的 motion-core。** 預覽、Live Link、匯出用的都是同一份結果。Server 不碰動作數學，只負責 Blender、relay 和 Gemini。

| 元件 | 位置 | 技術 | 負責 |
|---|---|---|---|
| Web app | `web/` | Vite + React + TypeScript、`@mediapipe/tasks-vision`（PoseLandmarker Heavy，GPU）、three.js | Web |
| motion-core | `web/src/motion/` | 純 TS 函式 + vitest | Claude（主機） |
| Server | `server/` | Python 3.12 + FastAPI + uv、`google-genai`（階段 3） | AI / 後端 |
| Blender 匯出 | `server/blender/export_fbx.py` | Blender 5.1 headless（bpy） | AI / 後端 |
| Unity 套件 | `unity/com.emotecap.mocap/` | UPM 套件、C#、`System.Net.WebSockets.ClientWebSocket` | Unity（smallfire） |

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

### 5.5 Clip 與 Segment

```json
{ "name": "Idle_Breathing", "loop": true, "fps": 30, "frames": [ /* MotionFrame, t 從 0 開始 */ ] }
{ "name": "Sword_Slash", "start": 12.4, "end": 14.1, "loop": false, "description": "..." }
```

- `name`：只能用 `[A-Za-z0-9_]`，PascalCase 加底線，最多 24 個字元。同一次匯出裡重名就加 `_2`。
- Clip 的 frames 已經處理過：濾波、貼地、腳部固定（有做的話）、循環修整（有做的話）。
- Segment 是階段 3 Gemini 回傳的片段範圍，web 端依照它從 take 切出 Clip。

### 5.6 HTTP API（server 預設 `http://localhost:8787`）

| 階段 | 方法 | 路徑 | 輸入 | 輸出 |
|---|---|---|---|---|
| 1 | GET | `/api/health` | – | `{ ok, blender, gemini }` |
| 1 | POST | `/api/export` | `{ clips: Clip[] }` | `{ files: [{ name, url }] }` |
| 1 | GET | `/files/{name}.fbx` | – | FBX 檔 |
| 3 | POST | `/api/takes` | multipart：`video`（webm，≤ 100MB、≤ 3 分鐘）、`duration` | `{ takeId, segments: Segment[] }` |

### 5.7 WebSocket Live Link（階段 2）：`ws://localhost:8787/ws/live?role=source|sink`

- source（瀏覽器）連上後先送一次 `{"type":"hello","version":1,"bones":[...]}`，之後每幀送 `{"type":"frame","t":…,"h":[…],"r":[…]}`
- server 把 source 的訊息原封不動轉給所有 sink（Unity）
- 品質階段：匯出完成後，server 廣播給所有 sink：`{"type":"clip_ready","name":"…","url":"…","loop":true}`

## 6. motion-core（`web/src/motion/`）

### 6.1 即時層（每幀跑，階段 1）

1. One Euro 濾波，套在每個 landmark 座標上。初始參數 `minCutoff = 1.0`、`beta = 0.01`、`dCutoff = 1.0`，現場再調
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

### 6.2 錄後處理（只對錄好的 take 跑）

1. **裁切**（階段 1）：取 [開始, 結束] 之間的幀，`t` 改成從 0 開始。
2. **修準切點**（階段 3）：動作能量 `E(t)` = 關鍵點速度總和（先平滑）。每個 Gemini 切點在前後 0.75 秒內找 `E` 的最小值，把切點移過去。
3. **備援切片**（階段 3）：Gemini 失敗時，`E` 低於門檻（整段 `E` 的第 20 百分位數）超過 0.4 秒的區間當作分隔點，片段依序命名 `Clip_01`、`Clip_02`…
4. **腳部固定**（品質階段）：腳跟或腳尖高度 < 3cm、速度 < 0.15 m/s、持續 ≥ 4 幀，就判定為著地。著地期間把腳固定在剛著地時的位置，用雙骨 IK（餘弦定理，保留原本膝蓋的彎曲平面）重新解 UpperLeg 和 LowerLeg。
5. **循環修整**（品質階段，loop 片段）：在片段內找「姿勢距離 + 速度差」最小的一對幀 (i, j)，且 j − i ≥ 0.8 秒。裁成 [i, j]，最後 6 幀往第一幀做 slerp 淡化接縫。

### 6.3 預覽人偶

three.js 依照 5.3 的 canonical 骨架，每根骨頭用一個膠囊體畫出人偶。它本身就是匯出用的骨架，所以預覽看到的就是匯出的結果，也不會有模型授權問題。

## 7. Server（`server/`）

### 7.1 Blender 匯出（階段 1，最優先）

- 指令：`$BLENDER_PATH -b --factory-startup -P server/blender/export_fbx.py -- --in <clips.json> --out <dir>`。`BLENDER_PATH` 預設 `/Applications/Blender.app/Contents/MacOS/Blender`。
- 照 5.3 建 canonical 骨架：Mixamo 命名、T-pose，包含不驅動的 Shoulder 和 ToeBase。
- 逐幀照 `BONES` 順序（父骨頭先）設定 pose bone：世界旋轉 = `r[b] × rest`，Hips 位置 = `h`。
- 每個 Clip 匯出一個 FBX：只包含骨架、`bake_anim=True`、`add_leaf_bones=False`、Y 朝上。**C1 驗收：Unity 匯入後比例正確（身高約 1.75m）。**
- 每個 FBX 旁邊寫一個 `<name>.emotecap.json`（`{ name, loop, fps }`），給 Unity Importer 讀。
- 輸出位置：`server/data/exports/`。如果 `.env` 有設 `UNITY_EXPORT_DIR`（例如 `/path/to/UnityProject/Assets/EmoteCap`），就同時複製一份過去，Unity 切回前景時會自動匯入。

### 7.2 WS relay（階段 2）

- source 的訊息轉給所有 sink；sink 斷線不影響 source。

### 7.3 Gemini 切片（階段 3）

- 模型：`gemini-3.8-flash`（有免費額度）。開工前先用 `models.list` 確認可用；不能用就改 `gemini-3.7-flash`。
- 影片 ≤ 20MB 直接 inline 送，超過就走 Files API。設定 `video_metadata.fps = 5`。
- `response_schema` = `Segment[]`（用 pydantic 定義）。
- Prompt 重點：一個演員在同一段連續影片裡做了好幾個不同動作；忽略開頭站位和結尾走回電腦的時間；每個不同的動作切成一段；時間用秒、精確到小數點後一位；會自然重複的動作（待機、原地走、原地跑、循環舞步）設 `loop=true`。
- 回傳後要驗證：start < end、在影片長度內、片段不重疊（重疊就從中點切開）、名稱符合 5.5 的規則。

### 7.4 其他

- 上傳的影片和匯出的 FBX 放在 `server/data/`（已加進 gitignore）。
- CORS 只開放 `http://localhost:5173`。
- `GEMINI_API_KEY` 從 `.env` 讀。沒有 key 時 server 照常啟動（階段 1、2 不需要），只有 `/api/takes` 回 503，`/api/health` 回報 `gemini: false`。

## 8. Unity 套件（`unity/com.emotecap.mocap/`）

- 安裝：Package Manager → Add package from git URL → `https://github.com/<owner>/<repo>.git?path=/unity/com.emotecap.mocap`（repo 建好後換成實際網址）
- `Editor/EmoteCapImporter.cs`（AssetPostprocessor，階段 1）
  - 只處理 `Assets/EmoteCap/` 底下的 FBX
  - `animationType = Human`、`avatarSetup = CreateFromThisModel`
  - 讀同名的 `.emotecap.json`，設定 clip 名稱、`loopTime`、`loopPose`
- `Runtime/EmoteCapLiveLink.cs`（階段 2）
  - 連到 `ws://<host>:8787/ws/live?role=sink`，host 可在 Inspector 設定，隊友的機器也能連
  - Start 時記錄每根骨頭的 rest 世界旋轉。角色必須是 T-pose 的 bind pose（Mixamo 角色符合），而且不能掛 Animator Controller
  - 在 LateUpdate 套用最新一幀：`bone.rotation = ToUnity(r[b]) * restWorld[b]`，父骨頭先套；Hips 高度 = `rigHipsRestY × h.y / H0`
  - 斷線後每 2 秒自動重連；沒有收到資料時角色停在最後的姿勢
  - 在背景執行緒收資料，主執行緒只讀最新一幀
- 品質階段：`Editor/EmoteCapSync.cs` 收到 `clip_ready` 就把 FBX 下載到 `Assets/EmoteCap/`，再 `AssetDatabase.Refresh()`
- 使用提醒：Animator state 要勾 **Foot IK**
- Mixamo 模型不要 commit 進公開 repo（授權問題），demo 場景用本機的模型

## 9. 錯誤處理

| 情況 | 系統行為 |
|---|---|
| 鏡頭權限被拒或沒有鏡頭 | 整頁提示，附重試按鈕 |
| 畫面裡沒有人，或 visibility 太低 | 人偶停在上一幀，畫面提示「退後一點，讓全身入鏡」 |
| Blender 失敗 | `/api/export` 回 500，附 Blender stderr 最後 20 行，UI 顯示錯誤 |
| Live Link 斷線 | 兩端都自動重連，Unity 角色停在最後的姿勢 |
| Gemini 失敗、逾時（30 秒）或回傳格式不對（階段 3） | 改用 6.2-3 的備援切片，UI 標示「自動切片（備援）」 |
| 上傳超過 100MB 或 3 分鐘（階段 3） | 前端先擋，server 再擋一次（回 413） |

## 10. 測試（hackathon 模式：放寬全域的 TDD / 80% 覆蓋率規則）

- **motion-core**：TDD + vitest。
  - 階段 1 必測：T-pose 輸入 → 所有骨頭都是單位四元數；左手從平舉往上抬 90°；手肘彎 90°；轉頭 45°；手臂打直時不會翻轉；One Euro 濾波能降低雜訊；裁切後 `t` 從 0 開始
  - 階段 3：修準切點能找到能量最小值；備援切片在靜止區間切開
  - 品質階段：雙骨 IK 誤差 < 1mm；循環修整能找到合成正弦動作的週期
- **server**：pytest。階段 1 做一個 Blender smoke test（fixture clip 能產生 FBX）；階段 3 用 mock 測 Gemini 三種情況（正常、格式錯、逾時）。
- **Unity 和 UI**：每個檢查點手動跑一次 demo 檢查清單。
- **共用測資**：`contracts/fixtures/` 放一段 T-pose clip 和一段揮手 clip 的 JSON，每個 lane 都拿來測。

## 11. 分工與時程

每個 lane 的工作照順序排，前面的做完才做後面的。

| Lane | 工作順序 | C1（23:00）驗收 |
|---|---|---|
| Web | ① 鏡頭 + MediaPipe + 人偶預覽 ② 錄製 + 裁切 UI + 呼叫匯出 ③ Live Link 發送 ④ 錄 webm + 上傳 + 多片段列表 | 鏡頭 → MediaPipe 跑起來，骨架疊在畫面上；人偶跟著動 |
| AI / 後端 | ① Blender 匯出 ② FastAPI `/api/export` + 寫進 `UNITY_EXPORT_DIR` ③ WS relay ④ Gemini 切片 | fixture clip 經過 Blender 匯出成 FBX；`/api/export` 能回傳檔案 |
| Unity + Claude | Unity：① Importer + 驗證 FBX ② Live Link 接收 ③ demo 場景。Claude：① solver + 貼地 ② 裁切 ③ 修準切點 + 備援切片 ④ 品質階段 | fixture FBX 在 Unity 設成 Humanoid、套到 Mixamo 角色能播、比例正確、「舉右手」通過；motion-core 階段 1 測試全過 |

| 時間 | 檢查點 |
|---|---|
| 21:45 | repo 骨架推上 GitHub，每個人 clone 開工 |
| 23:00 | **C1**：上表每一格驗收通過 |
| 01:00 | **C2（最重要）**：鏡頭錄一段 → 裁切 → 匯出 FBX → Unity 角色能播 |
| 02:30 | **C3**：Live Link 用真的鏡頭跑，Unity 角色即時同步 |
| 04:00 | **C4**：Gemini 一鏡到底自動切片 |
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
| 動作抖動 | 中 | 調 One Euro 參數；Hips 和 Spine 濾重一點 |
| 階段 3（Gemini）來不及 | 中 | demo 改用手動裁切（見第 3 節備案）；至少做出不修切點的最小版本，保留 Gemini 獎資格 |
| Gemini 切點不準 | 中 | 用動作能量修準 |
| Live Link 延遲或斷線 | 低 | 本機連線 + 自動重連；最壞情況改用瀏覽器預覽來 demo |

## 13. 提交清單

- [ ] GitHub repo（public），附英文 README：GIF、架構圖、安裝步驟
- [ ] 專案名稱
- [ ] Demo 影片：YouTube 不公開連結，3 分鐘以內
- [ ] 描述：痛點 → 我們做了什麼 → Gemini 怎麼用 → 技術架構
- [ ] Technologies：Gemini API、MediaPipe、three.js、React、Vite、TypeScript、FastAPI、Python、Blender、Unity、C#
