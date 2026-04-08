# 實作計劃：Shared-UI 導覽列接入

**分支**：`chore/prepare-shared-ui-integration`（建議／實際以本機為準）  
**計劃撰寫日**：2026-04-08  
**實作完成日**：2026-04-08  
**關聯**：企業入口網站 [`0.shared-ui/README.md`](../../0.shared-ui/README.md)

---

## 第一部分：實作前計劃（規格凍結）

### 目標

在 `HomePage` 上方新增可重用的頂部導覽列，套用 `0.shared-ui` 既有元件，覆蓋「首頁初始狀態」與「上傳 TXT 後狀態」。

### 實作範圍

- UI 組裝：`PortalTopNav` + `CrownBrand` + `NavCalendarCluster`
- 設定接入：Vite alias / `server.fs.allow`、TypeScript `paths`／`include`
- 樣式基礎：接入 Tailwind（使用者選定：正式接入 Tailwind）
- 版號來源：採用 `frontend/package.json` 的 `version`（使用者選定）

### 主要變更檔案（計劃時預期）

- `frontend/src/pages/HomePage.tsx`
- `frontend/src/App.tsx`
- `frontend/vite.config.ts`
- `frontend/tsconfig.app.json`
- `frontend/package.json`
- 專案根目錄 `README.md`

### 執行步驟（計劃）

1. 建立 `TopTitleNav`（或等價命名）UI 組件，封裝三欄內容：
   - 左：`CrownBrand`（公司名顯示為「海灣國際」）
   - 中：`出勤加班單系統 v{version}`
   - 右：`NavCalendarCluster`
2. 在 `HomePage` 將既有 `img + h1` 區塊替換為 `TopTitleNav`，確保不影響上傳、篩選、下載流程。
3. 調整 Vite 設定：新增 `@shared-ui` alias、補 `server.fs.allow` 允許企業入口網站根目錄（含 `0.shared-ui`）。
4. 調整 TypeScript 設定：新增 `paths`，並把實際引用的 `0.shared-ui` 原始碼納入 `include`（避免納入僅示範用之 `Examples.tsx`）。
5. 接入 Tailwind 所需基礎設定，讓 shared-ui 元件 class 生效。
6. 新增／確認依賴：`date-fns`（執行期）與於 `0.shared-ui` 目錄執行 `npm install`（供 tsc／IDE 解析）。
7. 驗證：`npm run build`、`npm run dev`、首屏與上傳後兩種狀態 UI 檢查。
8. 文件同步：更新 `README.md` 的接入說明與版號來源規則。

### 驗收標準（計劃）

- 首頁與上傳後頁面均顯示同一條頂部導覽列。
- 左中右資訊完整：Logo＋海灣國際／系統名＋版號／日期時間。
- `npm run build` 成功，無 alias／型別解析錯誤。
- 不改變既有資料解析、篩選、報表下載行為。

### 風險與對策（計劃）

- Tailwind 與既有全域 CSS 可能衝突：以最小範圍 class 驗證，必要時調整容器層級。
- `tsconfig include` 過廣可能把示範檔納入檢查：僅納入實際引用檔案。

---

## 第二部分：實作後結論

已依計劃完成接入：`HomePage` 頂部改為共用 `PortalTopNav` 版型，左欄為 `CrownBrand`（標題「海灣國際」、canonical Logo）、中欄為「出勤加班單系統」與 `frontend/package.json` 之 `version`、右欄為 `NavCalendarCluster`（即時日期時間）。企業入口網站根目錄之 `0.shared-ui` 已透過 Vite `@shared-ui` 別名與 `server.fs.allow` 打通；Tailwind CSS v4（`@tailwindcss/vite`）已啟用，並於 `src/index.css` 以 `@source` 掃描 `0.shared-ui`，避免 `lg:` 等 responsive utilities 未進 bundle 導致中欄永遠隱藏。`npm run build`（`tsc -b && vite build`）已通過。既有 Vitest 元件測試仍有歷史性失敗（與本次導覽列無直接關係），已預留 `jsdom` 與 `vite.config` 之 `test` 區塊供後續修測。

---

## 第三部分：實作摘要

### 新增／重點修改之檔案

| 路徑 | 說明 |
|------|------|
| `frontend/src/components/TopTitleNav.tsx` | 組裝 `PortalTopNav`、`CrownBrand`、`NavCalendarCluster` |
| `frontend/src/constants/appVersion.ts` | 匯出 `APP_VERSION`（執行期為 Vite `define` 注入值） |
| `frontend/src/vite-env.d.ts` | 宣告全域 `__APP_VERSION__` |
| `frontend/vite.config.ts` | `define` 讀取 `package.json.version`、`@shared-ui` alias、`fs.allow`、`tailwindcss()`、`defineConfig` 來自 `vitest/config`、`test`（jsdom） |
| `frontend/tsconfig.app.json` | `baseUrl`、`paths`、`include` 精簡列入 portal-nav／crown-brand／必要 calendar-icon 檔案 |
| `frontend/src/index.css` | `@import "tailwindcss"`、`@source "../../../0.shared-ui"` |
| `frontend/src/App.css` | `#root` 寬度／對齊微調，利於頂欄與主內容 |
| `frontend/src/App.tsx` | 外層 `relative min-h-screen`（符合 portal-nav 文件建議） |
| `frontend/src/pages/HomePage.tsx` | 以 `TopTitleNav` 取代原 `img + h1` |
| `frontend/eslint.config.js` | 瀏覽器 globals 補 `__APP_VERSION__` |
| `README.md`（專案根） | 共用 UI 安裝、版號來源、Tailwind 說明 |

### 相依套件（frontend）

- 執行期／建置：`date-fns`、`tailwindcss`、`@tailwindcss/vite`
- 開發／測試：`jsdom`（Vitest `environment: 'jsdom'`）

### 版號策略

- 顯示字串與 `frontend/package.json` 的 `version` 一致。
- 建置時由 `vite.config.ts` 讀取該檔並以 `define` 注入 `__APP_VERSION__`，避免在嚴格 TS 設定下直接 `import` JSON 與 `erasableSyntaxOnly` 衝突。

### 驗證紀錄

- 已執行：`cd frontend && npm run build` — 成功。
- 建議手動：`npm run dev`，確認未上傳與上傳 TXT 後頂欄皆存在、版號正確。

### 文件同步

- 已更新專案根目錄 `README.md`。
- 若組織層級另有主控清單（例如 `0.docs/企業入口網站-實作產物清單.md`），可視需要補「本子專案已接入 `0.shared-ui` 頂欄」— **本次未修改該檔**。

### 後續可選工作

- 修復或重寫既有 Vitest 元件測試（jest-dom、`FileUploader` 文案與 mock、`ReportGenerator` 等）。
- 小螢幕時 `PortalTopNav` 中欄預設隱藏：若產品要求在手機上仍顯示系統名＋版號，需在 `right` 或左欄補替代呈現。

---

**文件版本**：1.0.0  
**備註**：本檔為「實作前計劃」與「實作後結論／摘要」之合併留存，不取代 Cursor 內之 `.cursor/plans` 原始計劃檔。
