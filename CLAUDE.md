# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 快速指令

所有指令皆需在 `frontend/` 目錄下執行。

```bash
npm run dev              # 啟動 Vite 開發伺服器於 http://localhost:5173
npm run build            # TypeScript 檢查 + Vite 建置至 dist/
npm run lint             # ESLint 檢查（僅報告，不自動修復）
npm run preview          # 本機預覽已建置的應用

# 測試（使用 vitest，package.json 中無 test script）
npx vitest run                                             # 執行全部測試（單次）
npx vitest run tests/services/calculationService.test.ts  # 執行單一測試檔案
npx vitest                                                 # 監看模式
```

## 專案概述

**出勤加班單系統**是一個純前端 React 應用，用於自動化企業員工的加班時數計算與報表產生。使用者上傳出勤記錄（CSV 或 TXT 格式），系統自動計算加班時數與誤餐費，並支援匯出至 Excel/PDF 或列印報表。

**版本號**：從 `frontend/package.json` 的 `version` 欄位於建置時注入，顯示於 UI 標題列。

## 架構設計

### 四層結構

```
src/
├── pages/           → 單一頁面入口（HomePage）：編排所有子元件、維護全域篩選與報表狀態
├── components/      → UI 元件（FileUploader、AttendanceTable、PreviewModal、ReportGenerator 等）
├── services/        → 核心商業邏輯（計算、解析、匯出、分頁）
└── utils/           → 純工具函式（dateFormatter、overtimeReasonFormatter）
```

### 資料流程

1. **輸入**：`FileUploader` 上傳 CSV（react-papaparse）或 TXT（自訂 `txtParser`），解析為 `AttendanceRecord[]`（保留 `originalClockIn` / `originalClockOut`）
2. **缺卡補登**：`HomePage` 以 `punchOverrides` 合併使用者補登的上下班時間後再計算；缺卡備註在開啟預覽時帶入平日／例假日全域備註，**不**寫入該日加班原因
3. **計算**：呼叫 `calculateOvertimeAndMealAllowance()`，將記錄轉為 `OvertimeReport[]`（`isHoliday` 預設 `false`，全天請假時數為 0；`attendanceType` 可自動填入 `請{attendanceType}`）
4. **平假日覆寫**：主列表 `holidayOverrides`／`weekdayOverrides` 與預覽切換雙向同步，下載前依覆寫重算再過濾門檻
5. **預覽**：`PreviewModal` 維護**自身獨立的報表副本**：開啟時僅保留「有完整刷卡且 `overtimeHours >= 0.5`」的記錄；使用者可勾選、切換 `isHoliday`（`recalculateOvertimeReport()`）、填寫工作地點與備註
6. **匯出**：`reportService`（Excel/PDF）或瀏覽器列印，確認前先驗證必填欄位與缺卡是否補齊

### 核心資料型別（`src/types/index.ts`）

- **AttendanceRecord**：從檔案解析的原始資料（員工、日期、上下班時間、請假類型、原始打卡時間）
- **OvertimeReport**：計算後的結果，繼承 AttendanceRecord 並加入 `overtimeHours`、`mealAllowance`、`overtimeRange`、`overtimeReason`、`isHoliday`

## 主要服務

### calculationService.ts
時間對齊規則：
- **平日（週一至週五，非國定假日）**：加班從 18:00 起算，結束時間向下對齊至 30 分鐘單位
- **假日（週六、週日或 `isHoliday=true`）**：全天工時，開始時間向上對齊至整點、結束時間向下對齊至 30 分鐘單位
- **兩者皆同**：< 30 分鐘計為 0；否則向下對齊至 0.5 小時單位
- **誤餐費**：僅平日；下班時間 ≥ 19:30 給予 NT$50

`isHoliday` 旗標預設為 `false`；主列表國定假日／補班日勾選與 PreviewModal 切換皆會觸發 `recalculateOvertimeReport()`。全天請假（請假天數 ≥ 1）不補登、時數強制 0。

### reportService.ts
匯出並處理分頁（每頁固定 16 列：1 列表頭 + 15 列資料，不足補空白列）：
- 產生 Excel（平日/例假日兩個工作表）與 PDF（多頁，含標題/頁尾/頁碼）
- 加班理由在 PDF/列印輸出前，由 `normalizeOvertimeReasonForPrint()` 轉為全型 Unicode（解決繁中字型排版一致性問題），預覽與 Excel 保留原始輸入

### txtParser.ts
解析固定寬度的 TXT 出勤記錄（自訂格式，非 CSV）。
- 列尾狀態接受「正常／異常／符合」
- 有 `上班/`、`下班/` 時依標籤對位；無前綴且當天僅一筆未知時間時，以 12:00 分上下班

### paginationService.ts
將資料分割為頁面，與 `reportService` 共用全型後的加班理由估算邏輯。

### utils/overtimeReasonFormatter.ts
`normalizeOvertimeReasonForPrint()`：半形 ASCII 與空白 → 全型，非 ASCII（中文）保持不變。

## 重要模式與限制

### PreviewModal 的狀態隔離
PreviewModal 在開啟時以 `props.reports` 為初始值，建立自己的 state。對 `isHoliday` 的切換、勾選狀態等都只存在於 Modal 內部，不會回寫 `HomePage` 的狀態。匯出時才將 Modal 內部整理好的資料往上傳遞給 callback。

開啟時行為：初始化只保留 `overtimeHours >= 0.5` 的記錄（未達門檻日不顯示），並自動將游標聚焦至「平日加班資訊」的工作地點輸入框（無平日加班時退而聚焦例假日）。

### PreviewModal 為鎖定式 Modal
`modal-overlay` 不綁定點擊關閉，點擊預覽頁外框不會關閉；僅能透過「取消」按鈕或右上「×」呼叫 `onClose` 跳回前一頁。

### PDF 匯出
使用 `html2canvas` + `jspdf` 將 HTML 渲染至畫布再轉為 PDF，繞過 jspdf 原生字型引擎無法正確顯示繁體中文的問題。**樣式必須內嵌至 HTML 中**；外部連結的 CSS 可能無法被 html2canvas 渲染。

### 共用 UI 整合
應用使用父資料夾（`0.shared-ui`）中的三個共用 UI 元件（`PortalTopNav`、`CrownBrand`、`NavCalendarCluster`）。
- **路徑解析**：Vite 在 `vite.config.ts` 中自動偵測三個候選路徑（`0.shared-ui/`、`../0.shared-ui/`、`../../0.shared-ui/`），別名為 `@shared-ui`
- TypeScript 在 `tsconfig.app.json` 的 `paths` 中需與 Vite alias 同步
- Tailwind CSS v4 以 `@tailwindcss/vite` 外掛（非 PostCSS）接入，設定包含指向 `0.shared-ui` 的 `@source`

### 缺卡補登（HomePage + AttendanceTable）
- 原始缺卡列顯示 `<input type="time">`，條件用 `originalClockIn`／`originalClockOut`，避免選完小時後輸入框卸載
- 點「下載」前：已開始補登的缺卡列必須同時有上班、下班、缺卡備註，否則 `alert` 並列出未完成名單
- 全天請假列鎖定補登與加班原因

### 表單驗證規則
- **加班原因**：被選中且加班時數 ≥ 0.5 小時的記錄為必填；請假記錄略過
- **長度限制**：加班原因 200 字元、工作地點 40 字元、備註 120 字元（3 列 × 40 字）
- **錯誤格式**：按「平日/例假日 + 頁碼 + ITEM 編號」回報，便於與預覽表對照

### 輸出版面硬性限制
每頁固定 16 列（1 表頭 + 15 資料），CSS 變更可能破壞分頁。完整規格見 `0.standards/` 與 `specs/`。

### 測試
`frontend/tests/` 使用 vitest + jsdom。`calculationService.test.ts` 涵蓋時間對齊邊界案例，修改計算規則必須通過全部測試。

## 部署

`Dockerfile` 多階段建置：Node 22 Alpine 建置器 → Nginx Alpine，於 `/attendance/` 路徑提供靜態 `dist/` 檔案（`vite.config.ts` 的 `base: '/attendance/'`）。
- Build context 為企業入口網站根目錄；`COPY 0.shared-ui /app/frontend/0.shared-ui`
- `npm ci` 異常且 Dockerfile 未改時，先重啟 Docker daemon 再 build
