# EmoteCap 繁體中文快速上手

EmoteCap 將相機或影片中的動作轉成可編輯、可匯出的 Humanoid 動畫。本次重建保留十二小時黑客松 MVP 的核心，加入專案儲存、原始動作保留、備份、匯出工作與明確的處理同意。

**目前是尚未發布的開發預覽。** 以下適用於重建後的專案目錄，請使用發布進度記錄的固定開發來源；預設 main、堆疊開發 PR 與歷史展示各有自己的範圍。目前沒有核准發布的正式安裝包。[English README](../README.md)、[實際發布進度](release-progress.md)。

## 1. 從原始碼啟動

準備 Node24.19.0、npm11.21.0、uv0.12.6；啟動入口會選用 Python3.12.14。保留專案的鎖定檔。在 Windows 終端機進入這份重建專案的根目錄：

```powershell
cd web
npm ci
npm run build
cd ..
.\start.cmd
```

第一次建置約需下載48MB模型並校驗 SHA256。啟動成功後，系統瀏覽器會開啟 **http://127.0.0.1:8787**。保持終端機執行；Ctrl+C 結束服務。如果瀏覽器沒有自動開啟，等成功訊息出現後手動開啟該網址。連接埠被占用時會回報錯誤，不會關閉其他程式。

Linux/macOS 原始碼開發可在相同建置後使用根目錄 `./start.sh`。目前的 Windows 候選包測試、限定範圍的 Mac M2／Unity 觀察與固定來源三平台 CI 各有自己的限制，不等於完整產品或平台支援已通過。[完整啟動說明](local-start.md)、[開發環境](development.md)、[平台證據與待驗項目](release-progress.md#platform-evidence-and-pending-support)。

## 2. 先用範例完成一次備份

1. 按 **Use sample project**；它是含60個原始影格的合成右手抬起動作，不使用相機或雲端金鑰。
2. 修改 **Clip 1 name**、片段起訖時間，或按 **Find pauses**。等儲存狀態顯示 **Saved**。
3. 按 **Download project**，保留 `.emotecap` 備份。
4. 重新整理頁面，確認名稱與原始動作仍在。按 **Import project** 匯入剛下載的備份；匯入會建立新的專案識別，不覆蓋原專案。

瀏覽器儲存是復原副本，與瀏覽器和完整網址綁定。更換瀏覽器、連接埠、網址或電腦前，先下載備份，再到新位置匯入。原始影片的保留與備份需另外選擇；不保留影片仍可編輯已解算的動作。

片段的 **Play** 會播放與匯出相同的裁切、重新取樣及平滑後動作；**Play original take** 播放原始影格。來源標籤會顯示目前預覽內容；修改片段後會停止播放，需要再按 Play。兩種播放都保留原始動作。

## 3. 錄製或匯入影片

建立新 take 後，先閱讀 **Camera and video processing**。MediaPipe 在裝置上處理影像與影片，但 SDK 會向 Google 傳送效能與使用指標。自行決定是否勾選 **Allow MediaPipe performance and usage metrics**，再明確按 **Start camera** 或 **Import video**。

僅勾選不會啟動相機或載入模型。同意只適用目前頁面，重新整理後會取消。錄製可使用 **Calibrate T-pose**、**Record**、**Stop**，完成後再編輯片段。隨時取消勾選會停止新的處理：錄製透過正常停止與儲存保留已錄下的動作；倒數與未完成的影片匯入會取消。已開始的操作可能完成，已送出的指標無法收回。[隱私與限制](sdk-privacy.md)。

實際 SDK 的錄製、保存與匯出流程，以及限定範圍的 Mac 實拍觀察已有證據；完整身體／手指追蹤品質、編碼器與硬體驗收仍待完成。新版影格計數修補需要 Mac B2 實機回歸，不能用合成流程或舊版本數據替代。[鏡頭量測方法](camera-measurements.md)。

## 4. 匯出 FBX

匯出需要另外安裝 Blender；目前實際通過驗證的是 **Blender4.5.14LTS**。例如用你自己的完整執行檔路徑啟動：

```powershell
.\start.cmd --blender "C:\Program Files\Blender Foundation\Blender 4.5\blender.exe"
```

選擇 **Export FBX**，在 **Export jobs** 查看完成與下載、取消或重新建立重試工作。工作保留送出當下的片段版本，後續編輯不會改寫該工作。Blender、Unity 均未隨包附上。

動作格式是48個受驅動骨骼；完整匯出骨架52根、純身體22根。[motion v2 契約](../contracts/motion-v1.md) 保留歷史檔名。本機 Unity UPM0.2.0要求6000.5；已在 Windows6000.5.9f1執行 Editor 與接收器測試。先進入 Play mode，再於接收器 Inspector 貼上 Studio 配對碼並按 Connect。來源已透過堆疊草稿 PR 提供，但尚無核准發布的重建版本；請從固定 checkout 使用 Add package from disk 安裝。[接收器指南](../unity/com.emotecap.mocap/Documentation~/paired-receiver.md)。原創兩種身材角色的 Windows 範例檢查與 Mac6000.5.9f1一般 Package Manager 安裝／播放已在指定範圍通過；完整動作品質／硬體／新使用者／權利與公開發布驗收仍待完成，2021.3未經驗證。

## 5. 分清楚三種資料選擇

- **Keep source video**：在本機保留原始影片，供重新開啟使用。
- **Include source video in backup**：是否將原始影片放入下載的備份。
- **Allow sending the selected source video to Google Gemini**：獨立的雲端上傳同意，之後仍需按 **Send selected video**；與 MediaPipe 同意無關。

範例、追蹤、本機切段、備份與匯出不需要 Gemini 金鑰。原始碼設定使用根目錄私有 `.env`；安裝包設定使用 `%LOCALAPPDATA%\EmoteCap\settings.env`。不要把金鑰、設定或私人影片放入公開 Web 目錄。服務端工作與瀏覽器專案是不同的儲存位置。

Windows 安裝包目前是內部候選版；固定來源3967beb已包含 MIT、SDK 同意介面及原生影格計數，實際 SDK／保存／匯入／Blender 匯出流程通過本機驗證。仍需完整第三方散布評估、乾淨機器與新使用者驗收。將來正式來源若變更，需重新建置及校驗對應發行物。[候選版說明](windows-candidate.md)、[發布檢查表](release-checklist.md)。

專案自行擁有權利的程式碼、文件與原創素材已採用 [MIT 授權](../LICENSE)。擁有者已確認原始內容、另一位貢獻者的授權依據，以及四個媒體檔案均為自行產出；見[中文確認紀錄](release-license-proposal.zh-TW.md)。第三方套件／模型保留原授權，完整散布與正式發行驗收仍待完成。參與開發請看 [CONTRIBUTING](../CONTRIBUTING.md)、安全問題請看 [SECURITY](../SECURITY.md)。


## 不用鏡頭即可播放的 Unity 範例

Windows 的 Unity6000.5.9f1／Built-in 已有實際範例檢查，Mac 同版本的一般安裝／播放也已限定範圍驗收。在 Package Manager 選擇 EmoteCap Mocap，匯入 Starter Rigs 範例；進入 Play mode 前選擇 **EmoteCap → Create Starter Scene**，依 Unity 提示保存修改中的場景，再按 Play。兩個不同身材的原創角色會播放舉右手動畫，不需要鏡頭、Gemini 金鑰或配對碼。

輸出保存在 Assets/EmoteCap/StarterRigs；再次建立會拒絕既有目的地，請直接開啟已保存的 StarterScene。畫面中的選單控制 Standard，Tall 會獨立播放同一個初始片段。測試自己的匯出時，將該角色 Clip Player 的 Editor Folder 改成匯出資料夾，進入 Play 後按 Refresh；可逐一開啟角色的 Show Menu。停用播放器會停止它持有的動畫 graph。其他 Render Pipeline／平台／版本仍需另外驗證。[完整範例指南](../unity/com.emotecap.mocap/Documentation~/sample-playback.md)。
