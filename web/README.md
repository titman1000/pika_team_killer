# 隨機分組工具（網頁版）

Vue 3 + TypeScript + Vite 打造的靜態網頁版，部署在 GitHub Pages。功能與桌面版（[../classification.py](../classification.py)）相同：名單管理、輪休、依勝率加權分組、勝率／同隊勝率統計。

## 資料存在哪裡？

瀏覽器的 `localStorage`（key: `pika_team_killer_state_v1`），只存在你目前使用的這個瀏覽器裡，換裝置或清瀏覽器資料就會不見。想要備份或搬到別台電腦／分享給隊友，用頁面上的：

- **匯出資料**：下載一個 JSON 檔（包含名單、勝率、同隊勝率）
- **匯入資料**：選擇 JSON 檔，覆蓋目前瀏覽器裡的資料

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
├─ src/
│  ├─ logic.ts                 純邏輯（分組演算法、勝率計算），不依賴 Vue
│  ├─ composables/
│  │  └─ useTeamState.ts       把 logic.ts 包成 Vue 響應式狀態 + localStorage 持久化
│  ├─ components/
│  │  ├─ WinrateDialog.vue     勝率統計彈窗
│  │  └─ TeammateDialog.vue    同隊勝率彈窗
│  └─ App.vue                  主畫面
```

## 部署

由 `.github/workflows/deploy-pages.yml` 自動處理：push 到 `main` 且變更到 `web/**` 時，會自動 build 並部署到 GitHub Pages。第一次使用前，需要到 repo 的 Settings → Pages，把 Source 設成 **GitHub Actions**（詳見根目錄 [README.md](../README.md) 的說明）。
