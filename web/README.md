# 隨機分組工具（網頁版）

Vue 3 + TypeScript + Vite 打造的靜態網頁版，部署在 GitHub Pages。功能與桌面版（[../classification.py](../classification.py)）相同：名單管理、輪休、依勝率加權分組、勝率／同隊勝率統計。

## 資料存在哪裡？

瀏覽器的 `localStorage`（key: `pika_team_killer_state_v1`），只存在你目前使用的這個瀏覽器裡，換裝置或清瀏覽器資料就會不見。想要備份或搬到別台電腦／分享給隊友，有三種方式：

- **匯出／匯入 JSON**：下載完整資料（名單、勝率、同隊勝率），或選一個 JSON 檔覆蓋目前資料
- **匯入 CSV 名單**：上傳一欄式的 CSV（每列一個名字，可以有標題列），整批取代目前名單
- **雲端同步（Google Sheet）**：見下方「雲端同步設定」，讓多台裝置／多個隊友共用同一份資料

## 其他功能

- **手動替換隊伍成員**：分組後，每個成員名字旁邊有一個「⇄」按鈕，點下去可以選擇把他跟休息區或另一隊的某人互換位置，不用整組重新抽
- **雲端下載時的差異偵測**：從 Google Sheet 下載資料時，會先比對本機和雲端的差異（新增/缺少的成員、勝率不一致的人），列出來給你確認後才套用，不會默默覆蓋

## 雲端同步設定（Google Sheet，一次性設定）

原理：靜態網站本身沒有後端，沒辦法直接安全地寫入 Google Sheet。做法是在 Sheet 裡掛一個 **Google Apps Script**，部署成一個網址（Web App），網頁再去呼叫這個網址讀寫資料。腳本原始碼在 [google-apps-script/Code.gs](google-apps-script/Code.gs)。

1. 打開你要用的 Google Sheet（例如你分享的那份）
2. 上方選單：**擴充功能 → Apps Script**
3. 把預設的 `Code.gs` 內容整個刪掉，貼上本專案 [google-apps-script/Code.gs](google-apps-script/Code.gs) 的內容，儲存（Ctrl+S）
4. 右上角 **部署 → 新增部署作業**
   - 類型選 **網頁應用程式**
   - 「執行身分」選 **我**
   - 「誰可以存取」選 **所有人**（因為使用者要求不做額外的安全驗證；缺點是知道網址的人都能改資料，請自行評估風險）
   - 點 **部署**，第一次會要求你授權（Google 會跳出「未經驗證的應用程式」警告，這是正常的，選「進階」→「前往...（不安全）」繼續即可，因為這是你自己寫的腳本）
5. 複製產生的網址（長得像 `https://script.google.com/macros/s/xxxxx/exec`）
6. 回到網頁版工具，在「雲端同步」區塊貼上這個網址
7. 按 **上傳到雲端**，第一次會把目前本機資料寫進 Sheet，並自動建立三個分頁：`Names`、`WinStats`、`TeammateStats`
8. 之後任何裝置只要貼上同一個網址，按 **從雲端下載** 就能拿到最新資料（會先顯示差異，確認後才套用）

之後如果 Apps Script 程式碼有更新，要記得回到 Apps Script 編輯器「部署 → 管理部署作業 → 編輯 → 新增版本」重新部署，網址通常不會變。

## 開發

```bash
cd web
npm install
npm run dev
```

## 型別檢查 + 打包

```bash
npm run build
```

打包結果在 `dist/`，`vite.config.ts` 裡設定了 `base: '/pika_team_killer/'`，對應 GitHub Pages 專案頁面的網址路徑；本機用 `npm run preview` 預覽時網址也會是 `http://localhost:4173/pika_team_killer/`。

## 目錄結構

```
web/
├─ google-apps-script/
│  └─ Code.gs                  貼到 Google Sheet 的 Apps Script，把 Sheet 變成 JSON API
├─ src/
│  ├─ logic.ts                 純邏輯（分組演算法、勝率計算、成員互換），不依賴 Vue
│  ├─ cloudSync.ts             呼叫 Apps Script 網址讀寫雲端資料、比對差異
│  ├─ csv.ts                   解析匯入的 CSV 名單
│  ├─ composables/
│  │  └─ useTeamState.ts       把 logic.ts 包成 Vue 響應式狀態 + localStorage 持久化
│  ├─ components/
│  │  ├─ WinrateDialog.vue     勝率統計彈窗
│  │  └─ TeammateDialog.vue    同隊勝率彈窗
│  └─ App.vue                  主畫面
```

## 部署

由 `.github/workflows/deploy-pages.yml` 自動處理：push 到 `main` 且變更到 `web/**` 時，會自動 build 並部署到 GitHub Pages。第一次使用前，需要到 repo 的 Settings → Pages，把 Source 設成 **GitHub Actions**（詳見根目錄 [README.md](../README.md) 的說明）。
