# 校正與信心度基礎實作

本段承接已批准設計，保留 motion v2／既有專案格式，未作真人或實體鏡頭驗收。

## 已變更及驗證

- 明確指定的校正 sample 不再被上一個 solve 的 pose／hands 覆蓋；成功後重設座標／旋轉／跳躍歷史，避免舊濾波拉回錯參考。
- Camera 校正需連續至少8幀、350ms；相鄰抵達間隔不超過150ms，最新資料不超過200ms，必要關節需可見，世界點位移不超過35mm。最多保留60幀／1秒。錯姿勢、移動、停格、低信心度會拒絕並顯示原因。
- 改相機／品質／手指／crop 設定後建立新 solver／window；校正身份比對實際 solver，取消舊倒數。
- Pose filter 不接納低信心度／非有限資料，恢復觀測或長間隔後重建座標濾波。Hand filter 只檢查座標有限性，不把 SDK 的 visibility0 當成 pose 信心度。

| 驗證 | 本段結果 |
|---|---|
| Web full suite（最終修補） | 58檔、613項通過 |
| TypeScript | 通過 |
| 合成瀏覽器 | 15項擷取／校正／授權流程通過；另1項SDK形狀手指錄製通過 |
| 資產／安全／基準 | 最小工具修補後50項通過 |
| 安全掃描 | npm audit：info／low／moderate／high／critical 全0 |
| 正式建置 | 通過；保留大型 bundle 提示 |

Camera window 的數值是首輪可重現政策，尚非實際攝影機的調參結論。Import 保留原 T-pose held-run 與整段重新解算流程；它會使用選定的明確 sample，但尚未套用 camera 的穩定視窗條件。

## 安全工具修補

草稿PR11的39991933578在三個OS的npm audit均失敗，因現有Vite8.3.1／Vitest5.0.2命中近期公告。只更新至同系列明確修補版本Vite8.3.3及Vitest5.0.3，共6個套件變更；未使用全面audit fix，未下載runtime／wheel／模型。獨立npm11.21.0工具從官方registry取得並核對SHA512，安裝腳本禁用。

依據：[Vite公告](https://github.com/advisories/GHSA-9jrq-w75r-8gcw)、[Windows editor命令問題](https://github.com/advisories/GHSA-587h-7wmj-h5pm)、[Vitest mock註冊](https://github.com/advisories/GHSA-qxg6-89mg-rqv8)、[Windows mock路徑問題](https://github.com/advisories/GHSA-xp26-3454-mjgp)。其餘同次公告列於保留的原CI log與audit收據。

## 獨立審查及裁決

Fresh gpt-6-astra唯讀審查e7df181…b5f57f6，找到1項Important：共享pose visibility規則會錯誤排除SDK-shaped手部資料。已用visibility0的60度手指彎曲重現RED，再分開pose／hand admission修至GREEN；全613項及實際瀏覽器錄製均通過。依Native流程不重複派reviewer；沒有延後Minor。

裁決：

- 保留全部收據與工作區；代價是本機空間。
- 完整body dropout的有界hold／relax與R3的parent／inactive-bone政策一起完成；代價是本段尚不能宣稱已完成所有confidence行為。
- CI實際發現安全問題，例外允許針對性工具修補；代價是重新資格工具鏈及dev依賴bytes變更。
- R3profiles／provenance／Unity mask仍需實作；代價是上半身完整功能尚未交付。
- 不以合成資料宣稱真人精度、硬體延遲或發布資格；代價是仍需原實測驗收。
- reviewer未另做獨立live漏洞枚舉；parent的實際npm audit全0僅代表當次registry已知公告結果；代價是新公告仍可能影響CI。

目前草稿不合併、不建立tag、不發布二進位。原Windows權利缺口及Mac／乾淨機／新手驗收保留。
