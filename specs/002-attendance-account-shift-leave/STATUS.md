# 專案狀態：出勤記錄-擴充需求3

**Feature Branch**: `002-attendance-account-shift-leave`（線 B 工作分支：`feature/002-line-b-backend-auth-leave`）
**Last Updated**: 2026-09-18

## 階段進度

### 線 A：計算與預覽/PDF 兩列 (前端)
- [x] **PRD 定稿**: 完成 (`出勤記錄-擴充需求3_prd.md`)
- [x] **Plan 定稿**: 完成 (`plan-line-a-shift-overtime.md`)
- [x] **Tasks 拆解**: 完成 (直接進入實作)
- [x] **實作**: 完成 (支援公司班/倉庫班切換、早晚段拆分、預覽與 PDF 匯出)
- [x] **測試與驗證**: 完成 (單元測試通過，UI 驗證完成)

### 線 B：後端身分、假勤、匯入、班表 CRUD (後端/全端)
- [x] **PRD 定稿**: 完成 (`出勤記錄-擴充需求3_prd.md`)
- [x] **Plan 定稿**: 完成 (`plan-line-b-backend-auth-leave.md`)
- [x] **B0 Design／契約**（OpenAPI 優先）:
  - [x] B0-1 `contracts/openapi.yaml`
  - [x] B0-2 `data-model.md`
  - [x] B0-3 `research.md`
- [x] **Tasks 拆解**: 完成 (`tasks-line-b.md`)
- [ ] **實作**: 進行中
  - [x] B1 Auth + 員工主檔（backend + LoginPage）
  - [x] B2 班表 + 派班 + computation-context
  - [ ] B3 匯入 + 年假回沖
  - [ ] B4 行事曆 + 政府日曆
  - [ ] B5 詞庫 + Docker 銜接
- [ ] **測試與驗證**: 部分（B1／B2 單元測試通過；整合測試待本機 Docker Postgres）

## 最近更新
- 2026-09-18: 完成 B2：班表／派班 CRUD、computation-context、Admin 班表頁；本機班表改標為除錯。
- 2026-09-18: 完成 B1：Fastify/Prisma backend、登入／員工 API、前端登入閘道；Docker DB 需本機 daemon 後再 migrate／整合測。
- 2026-09-18: 完成 B0 與 `tasks-line-b.md`；下一階段為 B1（backend scaffold + 登入／員工）。
- 2026-09-18: 完成 B0：OpenAPI 契約、data-model、research（政府日曆 dataset/14718、DB session）。
- 2026-09-18: 調整線 B B0 內部順序為 OpenAPI → data-model → research；STATUS 新增 B0 追蹤項。
- 2026-09-18: 建立分支 `feature/002-line-b-backend-auth-leave`；撰寫線 B PLAN 草稿（Fastify + Prisma + PostgreSQL，Phase B0～B5）。
- 2026-09-17: 日期欄顯示補上段別；預覽、Excel、PDF、列印統一顯示 `週三 早段`／`週三 晚段`。
- 2026-09-17: 完成「線 A」前端計算與預覽/PDF 兩列實作，並通過測試。班表切換改為全域設定。
- 2026-09-17: 建立 PRD 開頭三行、STATUS.md 初稿、plan-line-a-shift-overtime.md。
