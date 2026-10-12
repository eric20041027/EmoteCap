# 發布預備檔與剩餘驗證

這一輪先完成不依賴 Mac 的來源／文件／封裝準備。這是私人候選檔的預備作業，不是正式 release；不建立 tag、不公開二進位檔，也不改變原始22項M1–M5要求。

## 已固定的基線

| 身分 | 固定值與範圍 |
|---|---|
| 已整合主分支 | 56ccbcc622864e298a56ee27cb63ce56aa2fab99；PR3–9依序合併、本機同步、工作目錄乾淨 |
| Windows建置來源 | eeae4e6b822a7809a42ef0db6b5d58ee45a13e09；與上述main檔案樹相同 |
| Windows ZIP | 88,530,946bytes／5,771檔案；SHA256 `1a109d0443e4a12b5f5746c743b2c0211933282e8b08aeeed856f52b8338b101` |
| Unity package | com.emotecap.mocap0.2.0／Unity6000.5／Newtonsoft3.2.2；96個原有檔案，既有安裝與測試有各自固定來源 |
| Mac待測來源 | 3967beb98c9781b18ab737d3f2f70ed8b8e6dc6d；不因Windows或文件更新而改標籤 |

來源／UPM預備檔已使用乾淨的文件準備commit eb8e9e3bc9495733f9de9a2c4feaaf2c4664578a；相對main56ccbcc只有文件差異，應用、契約、依賴、版本、授權與96個UPMpayload檔案保持不變。Windows ZIP沿用上述已驗證檔案；新的文件commit不會被冒稱為這份Windows ZIP的建置來源。準備commit、檔案SHA256、逐檔核對結果與後續報告commit會分別記錄。

## 預備檔的交付契約

- 兩次來源tar.gz及UPM tgz必須逐位元一致；每個成員均與指定Git來源相同，沒有重複、逃逸、symlink或其他非一般檔案。
- 來源檔僅含Git追蹤內容，不加入環境、runtime快取、私人的.env、同意收據、測試執行資料或使用者影片。原本經同意的專案素材保持其原始來源範圍。
- UPM依然是0.2.0，不提升版本或重新編譯；全部96payload檔案、GUID、fixture及MIT／第三方文字須與原合格套件一致。封裝相同不表示重新完成Mac、實機或人員驗證。
- 新的本機預備資料夾包含一份來源archive、一份UPM、原Windows ZIP的精確副本、manifest、SHA256清單、中文說明與發布文案草稿。舊包、收據與失敗紀錄保留。
- manifest明確記錄codebaseline、preparation source、Windows build source、artifact digest及仍待驗證項目。產品正式版本／tag仍未選定，不推定可公開發布。

## 不需要Mac但仍須完成的門檻

| 工作 | 狀態／需要的成果 |
|---|---|
| 當前來源整合與CI | main56ccbcc已通過；新的文件PR另做exact-headCI，不能挪用舊數字 |
| 來源／UPM預備檔及清單 | 已完成兩次一致建置、全部Git成員與SHA256核對；UPM與原合格套件連壓縮檔SHA256也相同 |
| SDK／模型／native及Microsoft散布路徑 | 來源與supplied terms證據已分項記錄；完整判定仍待證據／publisher條件，不以專案MIT代替 |
| 另一台乾淨Windows11x64 | 在無開發環境的實際機器執行一入口、sample/save/reload/backup/import、實際Blender匯出；同機PATH隔離不能替代 |
| 五位Unity新手 | 五位各自同意的非開發參與者，至少四位獨立在600秒內完成；閱讀／首次啟動依原計時規則納入，不替他人接受，不收集私人接受收據 |
| 具體公開發布確認 | 所有必要門檻通過後，呈現確切finalsource／artifacts／SHA256／tag／文案／目的地再請owner批准 |

Mac3967B2、實機品質與指定筆電效能門檻仍保持待測，不改用合成資料或其他機器數字代替。Unity／Blender既有來源合格證據可被引用，其作用與沒有重新執行的範圍要明示。

原供應商討論只有讀取刷新；不自動發送新訊息或代表任何人接受第三方協議。舊licensing inventory或收據的pre-approval/prebuild布林欄位保持原文，現在的狀態以具名的新階段記錄判定。[目前進度](release-progress.md)、[權利證據](redistribution-assessment.md)、[正式發布清單](release-checklist.md)。

## 本機預備檔驗證結果

資料夾：`C:/Users/smallfire123123/Desktop/EmoteCap-Release-Preview/2026-10-12-eb8e9e3`。它包含固定來源的封裝，而後續文件／PR commit是驗證報告身分；不因此重建或重新標記既有Windows包。

| 檔案 | 成員／位元組 | SHA256 |
|---|---|---|
| EmoteCap-source-eb8e9e3.tar.gz | 1094／5586388 | `fe232fee30aafda107703b85fa044e51aa668317b2ba48ad11e281dbc370a247` |
| com.emotecap.mocap-0.2.0-eb8e9e3.tgz | 96／123574 | `3425eec6e67015b282846be18c9dac8a72a271d0be7d47722d80f746fec46b46` |
| EmoteCap-Windows-eeae4e6.zip | 5771／88530946 | `1a109d0443e4a12b5f5746c743b2c0211933282e8b08aeeed856f52b8338b101` |

兩組source／UPM各建置兩次，逐成員對上Git bytes／mode。實際逃逸路徑、重複成員、symlink三個負例均被拒絕；無需解壓負例。Windows是精確複製既有合格ZIP，未重新下載runtime／wheel或執行Editor。舊版、收據、50份保護檔和22項要求保留。`SHA256SUMS.txt`保留最初三個artifact及manifest；`SHA256SUMS-v2.txt`額外涵蓋中文說明與文案。兩份清單均不自稱涵蓋自己。

manifest的rights／實機／公開發布仍為false，tag／產品正式版本仍為null。較早準備commit內的待辦文案屬封裝前階段；本文件與後續PR報告記錄實際資格結果。UPM原始inventory先於MIT來源採用，不能據其歷史false重新否定已確認的專案MIT。
