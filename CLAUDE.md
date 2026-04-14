# CLAUDE.md

此檔案為 Claude Code (claude.ai/code) 在此儲存庫工作時提供指引。

## 快速指令

```bash
# 開發
npm run dev              # 啟動 Vite 開發伺服器於 http://localhost:5173

# 建置與測試
npm run build            # TypeScript 檢查 + Vite 建置至 dist/
npm run lint             # ESLint 檢查（僅報告，不自動修復）
npm run preview          # 本機預覽已建置的應用

# 從根目錄（如需要）
cd frontend && npm install  # 安裝依賴套件
```

## 專案概述

**出勤加班單系統**是一個 React 應用程式，用於自動化企業員工的加班時數計算與報表產生。使用者上傳出勤記錄（CSV 或 TXT 格式），系統自動計算加班時數與誤餐費，並支援匯出至 Excel/PDF 或列印報表。

**版本號**：在建置時從 `frontend/package.json` 注入 → 顯示於 UI 標題列

## 架構設計

### 三層結構

```
src/
├── pages/           → 單一頁面入口（HomePage）
├── components/      → UI 元件（FileUploader、PreviewModal、ReportGenerator 等）
└── services/        → 核心商業邏輯（計算、解析、匯出）
```

### 資料流程

1. **輸入**：透過 `FileUploader` 上傳 CSV 或 TXT 檔案
2. **解析**：`csvParser`（react-papaparse）或自訂 `txtParser` 解析出 `AttendanceRecord[]`
3. **計算**：`calculationService` 將記錄轉換為 `OvertimeReport[]`，包括：
   - 加班時數（含時間對齊規則）
   - 誤餐費（下班時間 ≥ 19:30 時給予 NT$50）
   - 加班時間範圍（顯示格式）
4. **預覽**：`PreviewModal` 允許使用者選擇記錄、標記國定假日、填寫原因、驗證資料
5. **匯出**：`reportService`（Excel/PDF）或瀏覽器列印

### 核心資料型別

- **AttendanceRecord**：從檔案解析的原始資料（員工、日期、上下班時間、請假類型）
- **OvertimeReport**：計算後的結果（含 `overtimeHours`、`mealAllowance`、`overtimeRange`、`overtimeReason`）

## 主要服務

### calculationService.ts
實現複雜的時間對齊規則：
- **平日（週一至週五，非國定假日）**：加班從 18:00 起算，結束時間向下對齊至 30 分鐘單位
- **假日（週六、週日或國定假日）**：全天工時，開始時間向上對齊至整點、結束時間向下對齊至 30 分鐘單位
- **兩者皆同**：小於 30 分鐘計為 0；否則向下對齊至 0.5 小時單位
- **誤餐費**：僅平日；下班時間 ≥ 19:30 給予 NT$50

主要函式：
- `parseTime()`：將 "HH:mm" 轉換為午夜起算的分鐘數
- `alignStartTime()` / `alignEndTime()`：應用對齊規則
- `roundToHalfHour()`：強制執行 ≥ 30 分鐘規則與 0.5 小時對齊
- `calculateOvertimeAndMealAllowance()`：單筆記錄的主要進入點
- `getWeekday()`：將日期字串轉換為星期幾（支援民國年與西元年）

### reportService.ts
匯出資料並處理分頁（每頁 16 列，固定格式）：
- 將記錄分為「平日加班」與「假日加班」兩個表格
- 產生 Excel（兩個工作表）與 PDF（多頁，含標題/頁尾）
- 分頁規則：1 列標題 + 15 列資料，不足 15 筆時以空白列補齊

### txtParser.ts
解析固定寬度的 TXT 出勤記錄（自訂格式，非 CSV）。

### paginationService.ts
將資料分割為頁面（每頁 16 列：1 列標題 + 15 列資料）。

## 重要模式與限制

### 時間對齊邏輯
系統必須強制執行嚴格的時間對齊規則以符合法規要求。修改計算規則時，需驗證 `tests/services/calculationService.test.ts` 中的測試案例。

### 共用 UI 整合
應用使用父資料夾（`0.shared-ui`）中的三個共用 UI 元件：
- `PortalTopNav`：頂部導覽列
- `CrownBrand`：標誌/品牌
- `NavCalendarCluster`：日期/時間顯示

**路徑解析**：Vite 設定在 `vite.config.ts` 中檢查三個位置（`0.shared-ui/`、`../0.shared-ui/`、`../../0.shared-ui/`）。TypeScript 在 `tsconfig.app.json` 的 `paths` 中映射相同路徑。兩者必須保持同步。

### Tailwind CSS v4
使用 `@tailwindcss/vite` 外掛（非 PostCSS）。設定包含指向 `0.shared-ui` 的 `@source` 以確保共用元件的響應式類別被打包。

### 版本注入
- **來源**：`frontend/package.json` 的版本欄位
- **注入**：`vite.config.ts` 定義 `__APP_VERSION__` 常數
- **使用**：`src/constants/appVersion.ts` 與標題列顯示
- **更新**：修改 package.json 版本；Vite 在下次建置時重新注入

### PDF 匯出
使用 `html2canvas` + `jspdf` 將 HTML 渲染至畫布再轉為 PDF，解決 jspdf 原生字體引擎無法正確顯示繁體中文的問題。內嵌 CSS 至關重要；連結的樣式表可能無法渲染。

### 表單驗證與錯誤訊息
- **加班原因**：若記錄已選中且加班時數 ≥ 0.5 小時，為必填
- **錯誤格式**：按頁碼與 ITEM 編號（列數）標識，便於與預覽表對照
- **請假記錄**：略過原因填寫需求；無加班時數需報告

## 開發工作流程

### 新增功能
1. **資料層變更** → 修改 `src/types/index.ts` 中的型別
2. **計算邏輯** → 在 `calculationService.ts` 中擴充，並新增單元測試
3. **UI 元件** → 在 `src/components/` 中建立，如需要則匯入 shared-ui
4. **匯出邏輯** → 更新 `reportService.ts` 以應對 Excel/PDF 變更

### 測試
- 執行：`npm run build` 先執行 TypeScript 檢查；`npm run lint` 執行 ESLint
- `tests/` 中的測試檔案使用 vitest；可使用 `npm test` 執行（在 vite.config.ts 設定）
- **計算測試**至關重要；需使用邊界案例驗證時間對齊規則

### 程式碼檢查與格式化
- **eslint.config.js**：TypeScript + React Hooks + React Refresh 規則
- **prettier**：80 字元行寬、單引號、尾部逗號、分號
- 無自動修復；僅報告。需手動修正。

## 部署

### Docker 建置
`Dockerfile` 中的多階段建置：
1. Node 22 Alpine 建置器：安裝前端依賴、複製 0.shared-ui、使用 Vite 建置
2. Nginx Alpine：於 `/attendance/` 路徑提供靜態 dist/ 檔案
- 主反向代理將 `/attendance/*` 路由至此容器

### 環境設定
- **基礎路徑**：`/attendance/`（在 `vite.config.ts` 中設定）
- **開發伺服器**：於 `0.0.0.0:5173`（所有網路介面）監聽
- **Nginx**：使用 `default.conf` 進行路由

## 未來工作備註

- **共用 UI 更新**：若入口網站元件異動，需在本機與容器環境中測試版面（路徑解析具彈性但兩者都必須存在）。
- **加班計算規則**：任何計算規則異動必須通過所有邊界案例測試，並與規格書對齊（參考 `0.standards/` 與 `specs/`）。
- **PDF 版面**：16 列固定高度格式為硬性限制；對列印範本的 CSS 變更可能破壞分頁。需進行完整的 PDF 匯出端對端測試。
- **國際化**：目前僅支援繁體中文（日期、標籤、錯誤訊息）。未導入 i18n 框架。
