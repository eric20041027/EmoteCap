# 上半身配置、骨架連續性與 Unity 分層範例

日期：2026-10-23。承接已批准的分段設計，適用揮手、比讚及開門等獨立 3D 遊戲動作。實作保留既有架構與 motion v2；本報告不建立真人精度、實體鏡頭速度或正式發布資格。

## 已完成的行為

| 配置 | 實際驅動骨骼 | FBX 完整骨架 |
|---|---:|---:|
| 全身＋手指 | 48 | 52 |
| 全身、手指關閉 | 18 | 22 |
| 上半身＋手指 | 41 | 52 |
| 上半身、手指關閉 | 11 | 22 |

數量由共用骨骼表推導。上半身模式不要求腿部入鏡；不使用推測的髖／腿觀測、跳躍或腳掌定位。Pelvis 固定於原地 H0，保留合法 Humanoid 骨架及每幀 192 個旋轉數值。任意逐骨自訂選取不在本段範圍。

遺失的身體關節先保持父骨相對姿態 0.4 秒，再以 0.25 秒時間常數放鬆；無觀測歷史的關節跟隨父骨。手指沿用既有局部彎曲政策，手掌失去追蹤時仍隨父骨移動。最終旋轉濾波會保留這個關係，避免不同骨骼濾波強度產生假的關節偏轉。

四種配置以單一設定原子更新，套用於鏡頭、影片匯入與量測入口。倒數／錄製／校正／匯入時鎖定設定；鏡頭上的校正捷徑也有相同工作流程防護。每個 take 記錄區域、root 政策和實際初始手部模型狀態。

專案文件 schema 升至 2，仍讀取 schema 1，舊 take 的 provenance 不補寫新欄位。備份標頭與文件版本不一致會拒絕匯入；新備份寫入 2。舊 sample 原始 bytes 未改寫，motion wire 仍為 2。

Unity 新增獨立 Override layer mask 範例與資產產生選單。預設僅頭／雙臂／手指，保留底層移動動畫的 torso／pelvis；可選含 Body 版本，但 Humanoid 的 Body 群組可能包含 hips，文件明確說明此限制。建立新 mask 使用唯一檔名，不修改既有 controller，僅儲存自己的資產。

## 簡化與量測

以 Oxc AST 核對正式與量測入口、測試及腳本的引用圖，共 208 個來源檔與 3 個 HTML 入口；移除 11 個不可達舊 UI 元件，共 703 行。仍被引用的播放和時間控制保留；未宣稱已清除所有閒置程式。

修補來源 `e7a329597a96b059aa0004279aeba639ed2d127d` 的合成重播包含四配置乘三種動作模式，共 12 條、7,212 幀。每條 601 幀、20 秒虛擬時間，四次 checkpoint 加停止後的保存流程，全部保存。Solver 每條的 p95 約 0.075–0.253 ms；此值包含本機合成解算，不包含模型推論、實體鏡頭、畫面呈現或實際磁碟延遲，不能視為產品端到端速度。

使用 Fake IndexedDB，堆積記憶體前後值不構成配置歸因或洩漏測試。未以這個結果導入 worker；真實推論／呈現／延遲分析仍屬後續效能資格。

## 驗證收據

| 驗證 | 結果 |
|---|---|
| Web 完整單元測試 | 61 檔、634 項通過 |
| TypeScript／正式建置 | 通過；保留既有大型 bundle 提示 |
| 資產／安全／原版基準工具 | 50 項通過 |
| 當次 npm audit | 所有嚴重程度皆 0 |
| 完整合成 Chrome 155.0.8059.82 流程 | 最終修補後 57 通過、1 跳過；含正式 build 入口 |
| Server 原 not-slow 套件 | 1,022 通過、1 跳過、19 未選；保留原 deprecation warning |
| Windows Unity 6000.5.9f1 EditMode | 最終修補後 3／3 通過 |
| Blender 4.5.14 真實匯出及重新匯入 | 上半身 52／22 骨各 61 samples、2 秒；角度最大差 0°，位置最大差約 0.00133 mm，無重複 key time |

Blender 數值只證明合成輸入的匯出往返一致性，不能代表捕捉精度。瀏覽器以合成 stream／受控 detector 驗證流程，沒有啟動實體鏡頭。原 runtime、wheel、模型、候選包與收據保留，沒有重新下載或建立公開二進位。

瀏覽器跳過項為需要額外原版保留影片的比較測試，未把它算成通過；原版 runner 的獨立工具檢查已通過。完整套件的未啟動後端代理訊息及既有 Three shadow 提示保留在 log；FBX 與 Server 另有上述實際驗證。

本機完整收據位於 `.superpowers/sdd/2026-10-23-upper-body-profiles/`。`stage-replay-v1.json` 保留修補前來源；修補後為 `stage-replay-v2.json`，FBX 對應 `blender-upper-qualification-v2.json`。失敗嘗試與 RED 收據一併保留，未覆寫為成功結果。

## 獨立審查與修補

兩個 fresh gpt-6-astra 唯讀席位審查 `f4470cc…becdcbd`，分別負責 TypeScript 全段及 C#。共 0 Critical、3 Important、1 Minor。依 Native 流程完成一次 material fix pass，沒有再次派審查。

1. 最終 world-space 濾波破壞未追蹤關節的父骨相對關係：三種 smoothing 的整合測試先 RED，再修為局部偏移濾波並以已濾波父骨重組；motion 測試 95 項通過，完整 Web 634 項通過。
2. 既有錄製倒數仍能啟動鏡頭校正，可能在錄製中途重設參考：納入本段明確的鎖定驗收，先以倒數當下的可見捷徑重現，再修 UI 與 callback 雙層防護。第一份測試收據的錯誤 expected state 亦保留；修正為既有 `not-captured` 契約後的 RED 才用來判定產品缺陷。
3. Unity 測試呼叫全域 SaveAssets，可能儲存開發者其他未存素材：以測試自有 dirty mask 重現 RED，改為僅儲存 controller；最終 3／3 通過，另驗證 dirty 狀態及磁碟 bytes 未變。

本段延後 Minor：五個變更檔的 diff-check whitespace 提示。無功能影響，依 Native final pass 規則不做純格式修補；代價是保留少量格式債。

R1 尚有兩項 Minor，原報告保留：`RecorderSession.load()` 沿用 caller frames 引用，目前 Studio import 不使用此入口；session 測試尚未資格實際 hook unmount／StrictMode。R2 的 SDK-shaped 手部 visibility Important 已修正，本段完整回歸保留該檢查。

## 全部裁決及未判定範圍

- 保留所有工作區／證據，遵照 owner；代價是本機空間。原候選與歷史收據不被新結論覆寫。
- 保留架構、既有 API 相容入口及有效骨架，僅刪除引用圖證實不可達的 UI；代價是仍有少量相容性維護負擔。R1 延後的這批 UI 清理已在本段完成。
- 上半身以肩線及 canonical upright 建立參考；代價是無法可靠恢復前傾軀幹，介面已提示。預設 Unity mask 不含 Body；代價是預設分層不使用捕捉到的 torso 動作；含 Body 版本不能承諾獨立排除 hips。
- 手部 provenance 描述初始模型可用性，並非逐幀掉追蹤歷史；代價是不能據此推論整段手部品質。
- 將 inherited 校正倒數競態判為 Important，因為違反本段不混用參考的驗收；代價是額外互動測試，沒有擴張成工作流程重寫。
- C#／TypeScript 分席檢查，各自不替代另一領域；代價是兩次領域審查。沒有 MSBuild solution、ESLint，dotnet build／format 及 ESLint 不可用；使用實際 Unity 編譯、EditMode、TypeScript、測試與建置，不能聲稱 lint／formatter 通過。
- Reviewer 沒有另跑完整套件或 live 漏洞枚舉；由執行端保留完整回歸與當次 audit 收據。代價是新公告仍可能改變後續安全結果；R2 因 CI 實際公告所做的定向 Vite／Vitest 修補保留，不進行全面升級。
- R1 延後的 R2 校正及 R3 配置／有界 dropout 已完成；代價曾是分段交付等待。R4 已取得合成階段成本，真實 detector／render／裝置延遲與調參仍待實測，不以合成結果判定效能改善幅度。
- 不判定真人精度、實體鏡頭效能、目標 avatar 步態／hips／遊戲轉場或其他 OS 的 Unity；代價是這些項目保留 owner 控制的實測門檻，目前只資格 Windows Editor。Mac 結果須對應新來源，舊 B2 結果不自動適用。
- 原 Windows W1 SDK 適用第三方通知、W2 Microsoft 14.44 publisher 散布路徑仍待上游資料；閱讀／接受流程不代替 publisher 授權。代價是 Windows 公開包仍待權利確認；不把它擴大為所有 source／UPM 的阻擋理由。
- 乾淨第二台 Windows、五位 Unity 新手驗收依 owner 暫緩，未取消；代價是尚無正式產品發布結論。
- Reviewer 未判定遠端 CI／mergeability；推送後由執行端核對確切來源 CI。沿用授權更新草稿 PR11，保留工作區；本段未取得新的 main merge、tag 或公開二進位授權。

相關原始判讀：[上游散布評估](../../redistribution-assessment-2026-10-23.zh-TW.md)、[R1 報告](2026-10-23-capture-foundation.zh-TW.md)、[R2 報告](2026-10-23-calibration-confidence.zh-TW.md)。
