# pika_team_killer（隨機分組工具）

一個用 PyQt5 寫的隊伍分組小工具：輸入名單、一鍵隨機分組、記錄勝負，並可依照歷史勝率自動平衡兩隊實力。

## 功能特色

- 名單管理：新增／刪除人員，雙擊名字可切換「不參與本次分組」
- 隨機分組：人數超過 10 人時自動安排輪休，並避免連續兩輪都休息同一批人
- 勝率統計：記錄每人的勝場／敗場，並統計「和誰同隊時」的勝率
- **依勝率加權分組**：分組時會依照每個人目前的勝率，將強者、弱者盡量平均分配到兩隊，讓對戰更公平；也可以取消勾選改回完全隨機分組

## 快速開始（一般使用者，直接用 .exe）

不需要安裝 Python，只要下載執行檔即可使用：

1. 到本專案 GitHub 頁面的 **Releases**（右側欄）
2. 找到 `latest` 版本，下載 `TeamKiller.exe`
3. 建議把 `TeamKiller.exe` 放到「桌面」或其他一般使用者資料夾（例如 `Documents`），**不要**放在 `C:\Program Files` 這類需要系統管理員權限的資料夾，否則可能無法儲存名單與勝率資料
4. 雙擊執行即可開啟

程式執行後會在 `.exe` 所在資料夾自動產生：

- `names.txt`：名單
- `winrate.csv`：個人勝率
- `teammate_winrate.csv`：同隊勝率

這些檔案就是你的資料備份，換電腦時把它們跟 `.exe` 一起複製過去即可。

## 操作說明

1. 在輸入框輸入名字，按「新增」或直接按 Enter
2. 若某人這次不參加，直接**雙擊**他的名字（背景會變黑），再雙擊一次即可恢復參加
3. 勾選「依勝率加權分組」讓系統依照歷史勝率平衡兩隊實力；取消勾選則完全隨機分組
4. 按「開始分組」產生兩隊名單（若人數超過 10 人，多出的人會被安排到下方「休息區」）
5. 對戰結束後，點擊獲勝隊伍上方的「記錄勝利」按鈕，系統會自動更新雙方的勝率與同隊勝率
6. 按「查看勝率」可看到所有人的勝場／敗場／勝率；在勝率表中**雙擊姓名**可以進一步查看他跟每個人同隊時的勝率

## 開發者快速開始（原始碼執行 / 打包 .exe）

### 環境需求

- Python 3.9 以上（CI 使用 3.11）
- Windows（打包 `.exe` 需要在 Windows 上執行 PyInstaller）

### 1. 安裝依賴

```bash
pip install -r requirements.txt
```

### 2. 直接執行原始碼測試

```bash
python classification.py
```

修改程式碼後，先用這個方式確認功能正常，再考慮打包。

### 3. 本機打包成 .exe

```bash
pyinstaller --onefile --windowed --name TeamKiller classification.py
```

打包完成後，執行檔會在 `dist/TeamKiller.exe`。可以直接雙擊測試，確認：

- 名單新增／刪除、輪休、分組是否正常
- 「依勝率加權分組」勾選與取消勾選時，分組結果是否有差異
- 記錄勝利後，`winrate.csv`、`teammate_winrate.csv` 是否有正確產生在 `.exe` 同一資料夾

## CI/CD：自動建置 .exe

本專案已設定 GitHub Actions（[.github/workflows/build.yml](.github/workflows/build.yml)）：

- 每次 push 到 `main` 分支（且變更到 `classification.py` / `requirements.txt`）時，會自動在 Windows 環境上用 PyInstaller 打包
- 打包完成的 `TeamKiller.exe` 會：
  1. 上傳成該次 workflow 執行的 **Artifact**（保留 30 天，可在 Actions 頁面下載）
  2. 同時更新到一個固定的 **`latest` Release**，方便一般使用者直接下載最新版，不用進 Actions 頁面找

也可以在 GitHub 的 Actions 頁面手動點擊 **Run workflow** 觸發建置（`workflow_dispatch`）。

## 資料檔案說明

| 檔案 | 用途 |
| --- | --- |
| `names.txt` | 目前名單 |
| `winrate.csv` | 個人勝場／敗場／勝率 |
| `teammate_winrate.csv` | 兩人同隊時的勝場／敗場／勝率 |

這些檔案不會被提交進 git（見 `.gitignore`），是每個使用者本機/每台電腦自己的資料。
