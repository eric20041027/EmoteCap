# 上游權利核對：按實際交付內容分開判定

日期：2026-10-23（America/New_York）。這是新的具名判讀，不覆寫原 inventory、舊收據或候選包。基準是已整合的 main `5cf0663bc82d1596e448cba51241eff7f85c527c`；審查起點 `9cb3eaa` 的 Git tree 相同。

結論：**專案 MIT 已確認；source／UPM 不能被 Windows binary 的條件一概阻擋。Windows 目前仍有兩個必須釐清的資訊缺口，不能宣稱全部上游權利已完成。** 本輪沒有開攝影機、接受契約、更新依賴、重新下載 runtime／wheel 或對外發布二進位。

## 實際交付範圍

獨立審查重新計算實際檔案及所有已列出的授權文字；以下 SHA256 都是完整值，不能僅依檔名判定。

| 交付物 | 本次核對 | 權利判讀範圍 |
|---|---|---|
| Source preview `eb8e9e3` | 1094 members；`fe232fee30aafda107703b85fa044e51aa668317b2ba48ad11e281dbc370a247` | 無 `.dll/.pyd/.exe/.wasm/.task`；專案原始碼的 MIT 與隨附來源／文字原有授權分開。不能用未內含的 Windows runtime 當此 archive 的阻擋理由。 |
| UPM 0.2.0 | 96 members；`3425eec6e67015b282846be18c9dac8a72a271d0be7d47722d80f746fec46b46` | 有專案 MIT、原創 samples、dependency material；Newtonsoft 3.2.2 只宣告 Unity registry dependency，未 vendor DLL。保留 wrapper/UCL 與原 MIT notices，不重新授權它們。 |
| Windows candidate `eeae4e6` | 5771 members；`1a109d0443e4a12b5f5746c743b2c0211933282e8b08aeeed856f52b8338b101` | 包含 SDK／模型／Python／native；492 個 inventory 授權文字逐一重算，0 missing／0 mismatch。這證明已列文字交付，不自動證明未知組件已完整列出。 |

UPM 原始 `projectLicenseApproved:false` 屬 MIT 採用前歷史快照，不能重新否定已確認的專案 MIT。Unity 的 [package manifest](https://docs.unity3d.com/6000.5/Documentation/Manual/upm-manifestPkg.html) 將 dependencies 定義為其他套件的固定版本依賴；[legal files 指南](https://docs.unity3d.com/6000.5/Documentation/Manual/cus-legal.html) 則區分套件授權及內含第三方元素。這支持區分 dependency declaration 與實際打包 DLL，不代表替操作者接受 Unity 條款。

## 已有充分交付證據的項目

| 項目 | 可以成立的結論 | 保留的適用邊界 |
|---|---|---|
| 專案／原創素材 | owner 已批准 MIT、contributors header、原碼／README 貢獻及四份原創文件素材。 | 不是對 Google、Microsoft、Unity 或其他上游的重新授權。 |
| 三個 task models | 官方 guides 對到三個凍結 asset，兩張 model cards 有 Apache 宣告；六個 TFLite member 已有 hashes／metadata，未找到附加 asset 或另一份 license。外部 grant 不會被 metadata 的 null license 欄推翻。 | 將 whole task 的 detector＋landmarker 與現有 Apache text 做明確 association；這是授權／交付對應，不是重建模型。 |
| Certifi／MPL | 三處實際來源、全部 14 個原始檔及取得位置已交付於 SOURCE-ACCESS；可關閉這個已知 source-form delivery 項目。 | 不把 MPL 套到未含該程式碼的整個產品。 |
| OpenSSL | Python 的 3.5.8 與 cryptography 的 4.0.2 已分開；各完整授權文字與對應 bytes 已交付。 | 仍依實際適用內容保留 attribution／條件式 NOTICE，不能宣稱所有 native vendor 都已重新還原。 |
| Rust permissive alternatives | 官方 wheel/native 對應、source-lock superset、compiler terms／372 text associations／補充來源已保留。OR expression 可選允許路徑，附帶 GPL/LGPL 的另一選項不會自行把 Windows 變成 copyleft。 | 記明所選 permissive alternative；保留 Unicode 等 AND 條件及原 expression，不把 build/dev／其他 target 當已連入 Windows。 |
| CPython／HACL／KaRaMeL | 原供應商文字、HACL MIT、KaRaMeL Apache attribution 與 runtime images 的已列來源對應已交付。 | 供應商 metadata 的舊 OpenSSL link names 要與實際 PE／版本一起讀；不能靠名字推論完整連結圖。 |

Model 依據：[Pose guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker)、[Hand guide](https://developers.google.com/edge/mediapipe/solutions/vision/hand_landmarker)、既有 model-card 收據與 supplier 宣告。Apache 的 [第 4 節](https://www.apache.org/licenses/LICENSE-2.0) 要求適用的 license／修改標示／attribution／條件式 NOTICE；它沒有一般性的 reproducible-build、gitHead、逐位元 build attestation 或 source-offer 要求。

**Rust target 的具體縮小：**兩個已保存 compiler commits 的 `library/std/Cargo.toml` 把 fortanix-sgx-abi 放在 SGX target、wasip1 放在 WASI p1、vex-sdk 放在 vexos。它們出現在 Cargo.lock 並不證明 Windows MSVC target 使用它們。因此不能僅因 fortanix 的 MPL 名稱，要求本 Windows 包提供無關 target 的來源。這是 source-graph 判讀，沒有冒稱還原每一個 compiler binary。

## Windows 尚未關閉的兩個資訊缺口

### W1：SDK 1.0.1 的適用第三方通知範圍

Registry／supplier 已有 Apache 宣告、SRI／九個預編譯檔對應，現有完整 Apache text 也已交付。官方 tarball 14 個檔案沒有 LICENSE／NOTICE，是供應商封裝事實，不等於授權自動失效。source map 的 Closure header 已有證據，但不能由它推出整個 WASM/native 的適用 vendor notices。

真正要補的是「哪些第三方 attribution／NOTICE 適用於這批 prebuilt bytes」，可由 supplier 的 component／notice statement 或充分的依賴材料完成。既有 [artifact-specific 問題](https://github.com/google-ai-edge/mediapipe/issues/6306#issuecomment-6093130792) 已問過；2026-10-23 經 connector 讀取所有 comments，仍只有四則，沒有後續答覆。本輪不重複發訊息，也不把缺少非必要 attestation 當成獨立阻擋條件。

### W2：Microsoft 14.44 的 publisher 散布路徑

實際候選包含 14.44.35211.0；已記錄的本機 VS2026 runtime 是不同的 14.51 bytes。原 Python Windows section 提供 conditional onward-distribution 說明，首次 READ／ACCEPT 也已處理 recipient protection；但 recipient 選擇本身不能建立 publisher grant。

[Microsoft redistribution 指南](https://learn.microsoft.com/en-us/cpp/windows/redistributing-visual-cpp-files?view=msvc-170) 要求使用適用 license／REDIST 路徑。需確認這份 14.44 由 Python upstream onward authorization／VS2022 third-party distributor route，或哪一個其他適用 route 涵蓋，再對照既有 recipient terms。不能把 consumer V14 runtime 的使用權當作 publisher 散布權。

已保存的 [VS2022 Community terms](https://visualstudio.microsoft.com/license-terms/vs2022-ga-community/) 第 4 節是 functionality＋recipient protection；VS2026 文件才在相應條文明列 indemnify／defend。**不能只因電腦裝有 VS2026，就把其額外義務套到這份 14.44。** 本輪也不要求安裝新 VS、替換 DLL 或代 owner 同意新合約。

另讀到 [python-build-standalone #1343](https://github.com/astral-sh/python-build-standalone/issues/1343)：2026-09-01 的另一份 archive 有相似問題，issue 已關閉，唯一回覆沒有給出 artifact-specific route。它不是本專案 2026-08-25 archive 的授權判定，也不能把關閉 issue 解讀成允許或禁止。本輪不另開重複 issue；精確問題的未送出草稿保留於本機審查資料夾，只有取得 owner 授權才會考慮對外提交。

## 後續最小變更

1. 下一個 licensing increment 用新的 assessment／association 記錄上述結論，保留原 inventory 和原條款，不直接把歷史 `false` 改成 `true`。
2. 將三個 model 與已交付 Apache text 的 association、Rust permissive 選擇及 target exclusions 寫成具名判斷；只執行相應文件／member／notice 驗證，不以重建全部 wheels 充當法律判定。
3. W1、W2 各保留確切問題與可接受證據。尚未解決前不宣稱 Windows 全權利通過，但也不阻擋無相關 binaries 的 source／UPM 範圍。
4. 最後選定 artifact 才重新執行相應內容／來源檢查與發布批准；本報告不發布、不放寬原 M1–M5 實機／人員門檻。

本機證據索引：`.superpowers/sdd/2026-10-23-core-product-review/`；沿用 `2026-10-08-redistribution-assessment-3b184518`、`2026-10-08-native-rust-assessment-f920e922`、`2026-10-09-sdk-source-mapping`、`2026-10-10-ms-runtime-conditions` 與固定候選收據。新的判讀和舊原始資料分開保存。
