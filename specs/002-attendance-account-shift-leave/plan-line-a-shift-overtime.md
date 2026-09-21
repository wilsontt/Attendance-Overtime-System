# 實作計畫：擴充需求 3 - 線 A (計算與預覽/PDF 兩列)

**Spec ID**: `002-attendance-account-shift-leave` | **Git**: 已合入 `main` | **Date**: 2026-09-17 | **Spec**: [出勤記錄-擴充需求3_prd.md](./出勤記錄-擴充需求3_prd.md) | **Status**: Completed
**Input**: Feature specification from `specs/002-attendance-account-shift-leave/出勤記錄-擴充需求3_prd.md`

## 摘要

實作擴充需求 3 的「線 A」部分：支援公司班與倉庫班的加班計算邏輯，包含早段與晚段兩筆加班的拆分、誤餐費判定，以及在預覽與 PDF 匯出時支援一天兩列的顯示。此階段暫不實作後端帳號與資料庫，班表與補班可先透過前端手動選擇與勾選。

## 技術背景

**Language/Version**: TypeScript, React 18
**Primary Dependencies**: Vite, Tailwind CSS, html2canvas, jspdf
**Storage**: N/A (純前端狀態)
**Testing**: vitest
**Target Platform**: Web Browser
**Project Type**: single (frontend)
**Performance Goals**: 即時計算與預覽渲染不卡頓
**Constraints**: 輸出 PDF 每頁固定 16 列（1 表頭 + 15 資料），兩段加班需佔用兩列
**Scale/Scope**: 前端計算邏輯重構、UI 預覽與匯出調整

## 規範檢查 (Constitution Check)

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **P1: 規格驅動開發 (SDD)**: 功能基於明確的規格書 (`出勤記錄-擴充需求3_prd.md`)。
- [x] **P2: 設計即安全 (Security by Design)**: N/A (純前端計算，無資安影響)。
- [x] **P3: 清晰與可測試性 (Clarity and Testability)**: 使用者故事具備明確且可測試的驗收標準。
- [x] **P4: 漸進式價值交付 (Incremental Value Delivery)**: 功能拆分為小而可驗證的增量 (優先交付線 A)。
- [x] **P5: 主要語言（zh-TW） (Primary Language)**: 所有專案產出物皆使用繁體中文。
- [x] **P6: 程式碼品質標準 (Code Quality Standards)**: 程式碼將經過審查並符合標準。
- [x] **P7: 嚴謹測試標準 (Rigorous Testing Standards)**: 功能將包含對應的測試 (calculationService.test.ts)。
- [x] **P8: 一致的使用者體驗 (User Experience Consistency)**: UI/UX 符合現有設計系統。
- [x] **P9: 效能要求 (Performance Requirements)**: 效能要求已於規格中定義。
- [x] **P10: 架構設計 (Architectural Design)**: 架構符合 DDD、模組化單體與非同步通訊原則。
- [x] **P11: 技術堆疊 (Technology Stack)**: 使用核准的技術堆疊。
- [x] **P12: 數據治理 (Data Governance)**: N/A (此階段無資料庫)。
- [x] **P13: 可觀測性 (Observability)**: N/A (此階段無後端)。

## 專案結構

### 文件 (此功能)

```text
specs/002-attendance-account-shift-leave/
├── 出勤記錄-擴充需求3_prd.md
├── plan-line-a-shift-overtime.md
├── STATUS.md
└── tasks-line-a.md
```

### 原始碼 (儲存庫根目錄)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── AttendanceTable.tsx
│   │   ├── PreviewModal.tsx
│   │   └── ReportGenerator.tsx
│   ├── services/
│   │   ├── calculationService.ts
│   │   ├── reportService.ts
│   │   └── paginationService.ts
│   └── types/
│       └── index.ts
└── tests/
    └── services/
        └── calculationService.test.ts
```

**結構決策**: 維持現有純前端架構，主要修改 `calculationService.ts` 以支援兩段式計算，並調整 `PreviewModal` 與 `reportService` 以支援一天多列的顯示與分頁。
