# 擷取基礎第一段實作與驗證

日期：2026-10-23。實作範圍：detector 選擇與 recorder buffer；依已批准的 indie-game mocap 設計執行，未開啟實體鏡頭、下載 runtime／wheel／模型或改寫舊候選包。

## 已變更

- 關閉手指時不建立手部模型。Camera、影片匯入及量測入口使用相同設定；切換時清理舊資源，授權撤回仍阻止較晚返回的模型進入工作流程。
- 每個有效影格只驗證、複製一次自身數值並加入私有 buffer；不再每幀複製整段錄製。React 每100ms讀 frameCount／duration 摘要。
- 每五秒 checkpoint 與停止直接讀最新不可變快照，包含尚未更新到畫面的最後有效影格。保留180秒／21601幀／專案容量、時間遞增及 quaternion 檢查。

## 實際驗證

| 驗證 | 結果／限制 |
|---|---|
| Web Vitest | 57檔、595項通過 |
| TypeScript | 通過；獨立 reviewer 亦重新執行通過 |
| 資產／安全／原版基準工具 | 49項通過；沿用既有資產，未下載 |
| 正式 Web build | 通過；既有大型 bundle 提示仍存在 |
| Chrome155.0.8059.82受控瀏覽器 | 14項通過：record／stop／checkpoint／reload recovery／withdrawal／late models／hand-intent switch；使用合成 stream，非實體鏡頭 |
| 三分鐘合成重播 | 21601幀、180秒；全部保留；1803次摘要／狀態通知，36次顯式快照；本機約99.535ms。只量 recorder loop，未包含持久化 checkpoint、detector、render 或實際輸入延遲 |

單元測試先確認舊版 body-only 仍呼叫 hand factory 而失敗，再修至通過。新 recorder API 的測試先失敗於 API 未實作，再通過；原 reducer 的時序、有效前綴、容量、陣列所有權、空 take、discard／load 防護已移至 production session API。另以實際 checkpoint／store 測試驗證未 publish 影格的保存與最後一幀。

初次工具嘗試的 sandbox MSYS IPC、跨 worker temp、junction 權限限制均保留失敗收據；改用已驗證的本機工具權限或專案內 temp 後通過，不更改測試判準。

## 獨立審查

Fresh reviewer 使用 gpt-6-astra，唯讀範圍5cf0663…ac6dce8：0 Critical／0 Important／2 Minor。沒有新 merge／tag／公開二進位發布。

延後 Minor：

1. `RecorderSession.load()` 沿用舊行為，直接持有 caller 提供的 imported frames；若 caller 修改它，snapshot 也會改變。現行 Studio import 經 addTake，不走此入口；後續可限制為 validated frozen input 或在載入時正規化。
2. session 的 subscribe／discard 測試不能當作實際 hook unmount／StrictMode 測試。現有 browser entry 不使用 StrictMode；interval cleanup 程式經檢查，但本段不宣稱已完成該生命周期的瀏覽器資格。

## 裁決與範圍

- 保留工作區／全部收據，遵照 owner 指示；代價是本機空間。
- R2校正／信心度、R3上半身／provenance／Unity mask、R4profiling 仍須實作驗證。此次不把它們判完成；若次序選錯，代價是使用者須較晚取得完整功能。
- R1殘餘 dead-UI 清理留待 import graph 驗證；若判斷錯誤，代價是暫時保留維護負擔，避免誤刪共用元件。
- 實際精度／裝置效能／真人驗收維持待辦，依 owner 暫不實測；代價是不能對這些能力作發布承諾。
- 原權利研究獨立保存；W1SDK通知及W2Microsoft散布路徑缺口沒有被本次程式測試關閉。代價是Windows公開候選包仍不能因此獲得完整發布結論。
- 遠端CI／衝突狀態須於推送後另查；本機通過不代表遠端通過。代價是後續可能仍需CI修正。

後續計畫：[校正與信心度](../plans/2026-10-23-calibration-confidence.md)。精度基線完成後接續四配置及 Unity 上身 mask；原 Mac B2／乾淨 Windows／五位新手驗收保留原始來源及門檻。
