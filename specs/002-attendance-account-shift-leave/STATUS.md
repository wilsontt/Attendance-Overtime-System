# 專案狀態：出勤記錄-擴充需求3

**Spec ID**: `002-attendance-account-shift-leave`（規格目錄名；**不是** git 分支）
**線 A Git**: 已合入 `main`（含日期欄段別 `d54f706`）
**線 B Git**: `feature/002-line-b-backend-auth-leave`
**Last Updated**: 2026-09-21

## 階段進度

### 線 A：計算與預覽/PDF 兩列 (前端)
- [x] **PRD 定稿**: 完成 (`出勤記錄-擴充需求3_prd.md`)
- [x] **Plan 定稿**: 完成 (`plan-line-a-shift-overtime.md`)
- [x] **Tasks 拆解**: 完成 (直接進入實作)
- [x] **實作**: 完成 (支援公司班/倉庫班切換、早晚段拆分、預覽與 PDF 匯出)
- [x] **測試與驗證**: 完成 (單元測試通過，UI 驗證完成)

### 線 B：後端身分、假勤、匯入、班表 CRUD (後端/全端)
- [x] **PRD 定稿**: 完成（含 2026-09-20 **lazy auth／公開主流程** 對齊，見 PRD §5.3.1）
- [x] **Plan 定稿**: 完成 (`plan-line-b-backend-auth-leave.md`；已同步 lazy auth)
- [x] **B0 Design／契約**（OpenAPI 優先）:
  - [x] B0-1 `contracts/openapi.yaml`
  - [x] B0-2 `data-model.md`
  - [x] B0-3 `research.md`
- [x] **Tasks 拆解**: 完成 (`tasks-line-b.md`)
- [ ] **實作**: 進行中
  - [x] B1 Auth + 員工主檔（backend API；**員工 UI／圖形驗證碼 → B6**）
  - [x] B2 班表 + 派班 + computation-context
  - [x] B3 匯入 + 年假回沖（本機公開上傳維持；伺服器正式匯入需登入）
  - [x] 本機上傳「同時寫入伺服器」勾選（預設勾選；失敗保留本機；補單面板）
  - [x] B4 行事曆 + 政府日曆（入口／登入流 + leave calendar API + gov sync 14718）
  - [x] B5 詞庫 + Compose（SQLite 掛卷）
  - [x] **B6** Admin UI＋圖形驗證碼（員工頁、Admin 殼層、captcha 登入、政府日曆納入 Admin）
  - [x] **Admin UX 微調**：員工列表當前年假額度、儲存／啟停後關閉編輯區、派班顯示姓名、PaginatedDataTable
  - [x] **Admin／行事曆 UX**：列表排除 Admin、不可對 Admin 派班、員工編輯鎖定 Modal、行事曆不預設 000000、年假卡片置頂
  - [x] **B7** 假勤摘要（PRD §5.5.1：年假餘額＋各假別已請含 0；行事曆同入口）
  - [x] **B7 延伸**：假勤摘要 8 卡片點開該假別曆年明細（鎖定 Modal；沿用 `listAttendance`；年假＝請年休假；僅 `leaveQuantity>0`）
- [ ] **測試與驗證**: 部分（B1～B7 單元／建置；瀏覽器端對端待確認）

## 最近更新
- 2026-09-21: **Code review 修復**：員工模式拒登 Admin；captcha 改七段 path（無明文數字）；全天請假時數 0；民國年日期篩選；PreviewModal 切假日保留輸入／部分請假可編原因／選取後才驗工作地點；登入 rate limit；受保護 Admin 密碼僅本人可改；前端 401 清 session。
- 2026-09-21: **請假行事曆月表／明細改用共用 DataTable**：假勤摘要維持 8 卡片；月表與假別明細 Modal 用 `PaginatedDataTable`（`@shared-ui/data-table`）。
- 2026-09-21: **假勤摘要卡片明細 Modal**：行事曆頁 8 張摘要卡片可點開該假別曆年明細（鎖定式 Modal；沿用 `GET /api/attendance`；年假過濾「請年休假」；僅 `leaveQuantity>0`；無資料提示）。PRD §5.5.1／§7.8、OpenAPI `getLeaveSummary` 說明已對齊。
- 2026-09-21: **Admin／行事曆 UX**：員工／派班列表排除 Admin；create／update 不可對 Admin 派班；員工編輯改鎖定 Modal（取消／×；建立後不自動開編輯）；請假行事曆 Admin 不預設查 000000、未滿 6 碼不自動 API；假勤摘要年假卡片置頂（共 8 張）。OpenAPI 已同步。
- 2026-09-21: **Admin UX 微調**：員工列表帶 `quotaYear`／`quotaDays`；儲存／啟停後關閉編輯區；派班列表顯示 `employeeName`；員工／班表／派班改用 `@shared-ui/data-table` 的 `PaginatedDataTable`。
- 2026-09-21: **完成 B7**：`GET /api/leave/summary`、行事曆頁假勤摘要（未出現假別顯示 0、未知不另列）。
- 2026-09-21: **PRD／PLAN 對齊假勤摘要（B7）**：§5.5.1／§7.8；凍結來源 E3-4.4～4.5、E3-6；下一步實作。
- 2026-09-20: **完成 B6**：圖形驗證碼登入、AdminHub（員工／班表／政府日曆）、員工建帳無 PIN。
- 2026-09-20: **規格對齊 B6（圖形驗證碼）**：登入比照教育訓練 captcha（非入庫 PIN）；Admin＝員工＋班表＋政府日曆；政府日曆＝14718。下一步實作 B6。
- 2026-09-20: （已撤銷）先前「建帳隨機 PIN 一次明文」敘述改為登入圖形驗證碼。
- 2026-09-20: **DB 改 SQLite**：本機／ds1 對齊教育訓練（專案根 `data/attendance.db`；Compose 掛卷 `/data`）；移除 Postgres／本機 Docker DB 依賴。
- 2026-09-20: 完成 B5：工作地點詞庫 API、PreviewModal 自動完成／入庫、Compose full profile（web＋API 反代）、文件更新。
- 2026-09-20: 完成 B4：`GET /api/leave/calendar`、政府日曆 dataset/14718 同步（手動＋每日背景）、行事曆頁接 API。
- 2026-09-20: PRD／PLAN／tasks 對齊 lazy auth：加班單主流程公開；Session 僅行事曆與 Admin；未登入用本機班表／檔內編號計算。
- 2026-09-18: 修正分支：`main` fast-forward 納入線 A 段別 commit；釐清 Spec ID ≠ git 分支；刪除本機殘留 `master`。
- 2026-09-18: 完成 B2：班表／派班 CRUD、computation-context、Admin 班表頁；本機班表改標為除錯。
- 2026-09-18: 完成 B1：Fastify/Prisma backend、登入／員工 API、前端登入閘道；Docker DB 需本機 daemon 後再 migrate／整合測。
- 2026-09-18: 完成 B0 與 `tasks-line-b.md`；下一階段為 B1（backend scaffold + 登入／員工）。
- 2026-09-18: 完成 B0：OpenAPI 契約、data-model、research（政府日曆 dataset/14718、DB session）。
- 2026-09-18: 調整線 B B0 內部順序為 OpenAPI → data-model → research；STATUS 新增 B0 追蹤項。
- 2026-09-18: 建立分支 `feature/002-line-b-backend-auth-leave`；撰寫線 B PLAN 草稿（Fastify + Prisma + PostgreSQL，Phase B0～B5）。
- 2026-09-17: 日期欄顯示補上段別；預覽、Excel、PDF、列印統一顯示 `週三 早段`／`週三 晚段`。
- 2026-09-17: 完成「線 A」前端計算與預覽/PDF 兩列實作，並通過測試。班表切換改為全域設定。
- 2026-09-17: 建立 PRD 開頭三行、STATUS.md 初稿、plan-line-a-shift-overtime.md。
