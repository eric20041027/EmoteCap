# EmoteCap 正式發行授權提案

[英文原文](release-license-proposal.md)於 2026-10-07 為 M5 發布門檻準備；本繁體中文版於 2026-10-08 整理。擁有者已於 2026-10-08 確認以下四項。**專案自行擁有權利的內容已採用 MIT；正式 tag／GitHub Release 仍待完整發布驗收與批准**。

## 已採用的專案授權

已採用 **MIT 授權**，並使用以下著作權標示：

```text
Copyright (c) 2026 EmoteCap contributors
```

適用範圍為專案自行擁有權利的程式碼、文件，以及原創的合成範例。依 MIT 條款，使用者可以使用、修改、再散布及商業利用，但須保留授權與著作權通知；授權也包含按原樣提供、無擔保的條款。正式條文以 [SPDX MIT 授權全文](https://spdx.org/licenses/MIT.html)為準。

GitHub repository 可以公開閱讀，並不等於已經授予上述使用權利。[GitHub 的專案授權說明](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/licensing-a-repository)可供參考。

## 已盤點的專案權利

原始遠端 main 快照 `713d349df05aa26b6b95a1b7974f7f3d8e574149` 的 Git 紀錄如下：

| 貢獻者 | 該快照中的提交次數 | 紀錄中的貢獻 |
|---|---:|---|
| eric20041027 | 67 | 原始專案開發與歷史紀錄 |
| leokao0806 | 1 | `fa91968`：README.md 文件 |

這些數字是 Git 作者紀錄，**不能單獨證明著作權歸屬或授權已取得**。原提案盤點時，根目錄及 UPM 中未找到專案的 `LICENSE`／`NOTICE`。後續新增的第三方清冊或通知，也不代表專案本身已取得 MIT 授權。

擁有者已確認以下四個文件媒體檔案都是自行產出，沒有第三方素材，並同意其公開使用：

- `docs/media/import-video.jpg`
- `docs/media/gemini-slicing.jpg`
- `docs/media/hero.gif`
- `docs/media/dozed-off.gif`

早期只列出兩張圖片，漏列了兩個 GIF；目前四個檔案均已取得擁有者的明確確認。原始開發歷史與貢獻者署名會保留。新增第三方角色或私人錄影，須另有適用的使用權依據。

## 已收到的四項確認

擁有者於 2026-10-08 回覆：「同意MIT 2 同意 3對 4.素材都是我產出的沒有第三方」。依四個編號，記錄如下：

1. **同意 MIT 提案與著作權標示**：對專案自行擁有權利的內容採用 MIT，並使用上面的 `EmoteCap contributors` 標示。
2. **原始程式碼與文件**：擁有者確認有權以此方式公開授權，或已取得相關同意。
3. **其他貢獻者的 README 貢獻**：擁有者已確認 `leokao0806` 的該筆貢獻有適當的同意或授權依據。
4. **四個文件媒體檔案**：擁有者已確認均為自行產出、沒有第三方素材，並同意公開使用。

這項確認針對專案自行擁有或取得權利的內容，**不要求你把第三方函式庫或模型改授權成 MIT**。

## 第三方套件、模型與工具如何處理

- **npm／Python 套件、runtime、WASM 與實際隨包附帶的依賴**：保留原有授權、著作權及必要通知，記錄確切版本、檔案雜湊與實際複製的授權文本。
- **MediaPipe 模型**：三個 task 權重來自 Google 模型儲存服務，各自有獨立雜湊；模型卡中的 Apache 2.0 證據記錄在[第三方材料](../third_party/README.md)。SDK 的授權不能直接推定涵蓋所有權重或 task archive 的每個資產；完整評估與正式散布仍有待完成。
- **Blender 4.5.14**：使用經官方雜湊核對的開發工具／使用者自行選擇的匯出器。產品目前不附帶 Blender，其工具授權與來源另行記錄。
- **Unity 編輯器與 Newtonsoft 3.2.2**：Unity 編輯器由使用者自行準備。英文原提案將官方 Newtonsoft 3.2.2 列為預計的 UPM 依賴；目前[套件設定](../unity/com.emotecap.mocap/package.json)已明確宣告這項依賴。這項進度不代表專案或所有第三方權利已獲批准。
- **正式發布**：同意本提案後，仍須完成 release checklist、確認發行物的來源 commit 與 SHA256，並取得正式發行批准，才建立版本 tag／GitHub Release。

## 目前確認狀態

| 項目 | 狀態 |
|---|---|
| 專案擁有者對 MIT、標示與原始權利的決定 | 已於 2026-10-08 同意 |
| 其他貢獻者的同意／授權依據 | 擁有者已於 2026-10-08 確認 |
| 四個媒體檔案的公開使用權 | 擁有者已確認自行產出、沒有第三方素材 |
| 完整第三方清冊與必要通知 | 持續整理與評估中 |
| 公開正式發行 | 尚未批准 |

此處記錄擁有者的明確確認，不宣稱已獨立完成法律查證。根目錄與 Unity UPM 已加入相同 MIT 文本；第三方材料保留原條款，舊候選包／tarball 的內容與來源仍維持原始紀錄。完整進度見[發布進度](release-progress.md)。
