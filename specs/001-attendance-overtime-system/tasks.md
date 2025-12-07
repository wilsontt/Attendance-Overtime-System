# Tasks: 出勤加班單系統

**Input**: Design documents from `/specs/001-attendance-overtime-system/`
**Prerequisites**: plan.md (required), spec.md (required for user stories)

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [x] T001 [P] 在 `frontend/` 目錄下初始化 Vite + React + TypeScript 專案。
- [x] T002 [P] 根據 `plan.md` 中的專案結構建立 `frontend/src` 下的初始目錄結構 (components, pages, services, types)。
- [x] T003 [P] 安裝主要依賴套件：React, Vite, Vitest, React Testing Library。
- [x] T004 [P] 配置 linting 和 formatting 工具 (例如 ESLint, Prettier)。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

- [x] T005 在 `frontend/src/types/index.ts` 中定義 `Employee`, `AttendanceRecord`, `OvertimeReport` 的 TypeScript interface。
- [x] T006 在 `frontend/src/services/calculationService.ts` 中建立加班計算服務的初始框架。
- [x] T007 在 `frontend/src/App.tsx` 中設定基本的頁面佈局與路由 (如果需要)。
- [x] T008 [P] 建立 `frontend/src/services/calculationService.test.ts` 測試檔案，並撰寫核心計算邏輯的單元測試。

---

## Phase 3: User Story 1 - 上傳出勤記錄並計算加班費 (Priority: P1) 🎯 MVP

**Goal**: 讓使用者能上傳 CSV 檔案，系統自動計算加班費並顯示結果。

**Independent Test**: 上傳 CSV 檔案後，驗證畫面上顯示的加班時數與誤餐費是否正確。

### Tests for User Story 1

- [x] T009 [P] [US1] 在 `frontend/src/components/FileUploader.test.tsx` 中撰寫檔案上傳元件的單元測試。
- [x] T010 [P] [US1] 在 `frontend/src/components/AttendanceTable.test.tsx` 中撰寫考勤表的單元測試。
- [x] T011 [US1] 擴充 `frontend/src/services/calculationService.test.ts` 的測試案例，涵蓋平日、假日的加班與誤餐費計算規則。

### Implementation for User Story 1

- [x] T012 [P] [US1] 實作 `frontend/src/components/FileUploader.tsx` 元件，包含檔案選擇與讀取功能。[NEEDS CLARIFICATION: 需要研究並選擇一個 CSV 解析庫，例如 PapaParse]
- [x] T013 [P] [US1] 實作 `frontend/src/components/AttendanceTable.tsx` 元件，用來顯示計算後的結果。
- [x] T014 [US1] 在 `frontend/src/services/calculationService.ts` 中實作核心計算邏輯，處理加班時數與誤餐費。
- [x] T015 [US1] 在 `frontend/src/pages/HomePage.tsx` 中整合 `FileUploader` 和 `AttendanceTable` 元件，串接完整的流程。
- [x] T016 [US1] 在 `FileUploader` 中增加對檔案格式的驗證 (例如，限制只能上傳 .csv 檔案)。
- [x] T017 [US1] 在 `calculationService` 中增加錯誤處理機制，以應對格式不符或資料缺失的記錄。

---

## Phase 4: User Story 2 - 篩選與查詢特定員工或日期的加班記錄 (Priority: P2)

**Goal**: 提供依員工姓名和日期範圍篩選結果的功能。

**Independent Test**: 在結果頁面輸入姓名或選擇日期後，驗證表格內容是否正確更新。

### Tests for User Story 2

- [x] T018 [P] [US2] 在 `frontend/src/components/AttendanceTable.test.tsx` 中增加篩選功能的單元測試。

### Implementation for User Story 2

- [x] T019 [P] [US2] 在 `frontend/src/pages/HomePage.tsx` 中增加姓名搜尋輸入框與日期範圍選擇器 UI。
- [x] T020 [US2] 在 `HomePage.tsx` 中實作篩選邏輯，並將篩選後的資料傳遞給 `AttendanceTable` 元件。

---

## Phase 5: User Story 3 - 下載與列印加班記錄報告 (Priority: P3)

**Goal**: 提供將結果匯出為 Excel/PDF 並可列印的功能。

**Independent Test**: 點擊下載或列印按鈕，驗證是否能產出正確的檔案或開啟列印預覽。

### Tests for User Story 3

- [x] T021 [P] [US3] 在 `frontend/src/components/ReportGenerator.test.tsx` 中撰寫報告產生元件的單元測試。

### Implementation for User Story 3

- [x] T022 [P] [US3] 實作 `frontend/src/components/ReportGenerator.tsx` 元件，包含「下載 Excel」、「下載 PDF」及「列印」按鈕。[NEEDS CLARIFICATION: 需要研究並選擇用於產生 Excel 和 PDF 的函式庫]
- [x] T023 [US3] 在 `ReportGenerator.tsx` 中實作將表格資料轉換為 Excel (.xlsx) 格式並觸發下載的功能。
- [x] T024 [US3] 在 `ReportGenerator.tsx` 中實作將表格資料轉換為 PDF (.pdf) 格式並觸發下載的功能。
- [x] T025 [US3] 在 `ReportGenerator.tsx` 中實作呼叫瀏覽器列印功能，並提供適合列印的樣式表。
- [x] T026 [US3] 在 `frontend/src/pages/HomePage.tsx` 中整合 `ReportGenerator` 元件。

---

## Phase N: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [x] T027 [P] 撰寫 `README.md` 文件，說明如何啟動與使用此專案。
- [x] T028 [P] 優化 UI/UX，確保在不同螢幕尺寸下的響應式設計。
- [x] T029 進行跨瀏覽器測試 (Chrome, Firefox, Safari)。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after User Story 1 completion
- **User Story 3 (P3)**: Can start after User Story 1 completion

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories
