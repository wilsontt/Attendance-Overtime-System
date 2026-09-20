# 實作計畫：擴充需求 3 - 線 B (後端身分、假勤、匯入、班表 CRUD)

**Git Branch**: `feature/002-line-b-backend-auth-leave` | **Spec ID**: `002-attendance-account-shift-leave` | **Date**: 2026-09-18 | **Spec**: [出勤記錄-擴充需求3_prd.md](./出勤記錄-擴充需求3_prd.md) | **Status**: Approved（B0 完成）
**Input**: Feature specification from `specs/002-attendance-account-shift-leave/出勤記錄-擴充需求3_prd.md`（線 B：E3-4～9）
**Depends on**: 線 A 已完成（計算兩列、班表手選、補班手勾、預覽／PDF／Excel）

## 摘要

將現況「純前端靜態站」升級為「前端 + API + 持久化」模組化單體：提供員工／Admin 登入（**lazy auth**）、員工與年假主檔、班表 CRUD 與派班起迄、出勤匯入（本機公開上傳＋伺服器正式匯入）、請假行事曆、政府辦公日曆抓取、以及工作地點共用詞庫。

**登入時機（對齊 PRD §5.3.1｜2026-09-20）**：加班單主流程（HomePage 上傳／計算／預覽／匯出）**公開、不設整站登入閘道**；Session 僅於「行事曆」與「Admin 查詢／維護」需要。未登入計算用本機班表／手選，並以檔內員工編號辨識假別與加班。已登入且有伺服器派班／日類型時，前端可改讀 API 脈絡；線 A 計算公式仍在瀏覽器。

## 技術背景（鎖定決策）

PRD §2.5 將 API／DB／PIN 儲存／政府日曆資料集標為設計待決。本 PLAN **鎖定**下列選型，作為後續 `design.md`／`data-model.md`／`contracts/` 的輸入；若需改選，必須先改本 PLAN 再實作。

| 項目 | 決策 | 理由 |
|------|------|------|
| 架構 | 模組化單體：`backend/` + 既有 `frontend/` | 符合 Constitution P10；單一部署單元即可 |
| Runtime | Node.js 22（與現有 Dockerfile 一致） | 與前端同語系，降低維運分裂 |
| API | Fastify 5 + TypeScript | 輕量、型別友善、適合內部工具規模 |
| ORM／DB | Prisma + **SQLite**（專案根 `data/attendance.db`；ds1 掛卷 `/data`） | 對齊教育訓練本機零 Docker；關聯仍由 Prisma 管理 |
| 遷移 | Prisma Migrate | schema 變更可追溯 |
| 驗證 | Session Cookie（HttpOnly、Secure、SameSite=Lax）+ `bcrypt` 雜湊 | PRD 明確排除 SSO；PIN／Admin 密碼不可明文 |
| API 契約 | OpenAPI 3（`specs/.../contracts/openapi.yaml`） | 前後端對齊、可產生型別 |
| 日曆資料 | 行政院人事行政總處／政府資料開放平臺「行政機關辦公日曆」；排程每日抓取 | PRD E3-6；失敗時仍允許手勾補班（E3-2.1） |
| 部署 | Docker Compose：`frontend`(Nginx) + `api`；SQLite 掛卷；反向代理 `/attendance/api/` | 延續現有 `/attendance/` 路徑；**無獨立 Postgres 服務** |
| 測試 | 後端：Vitest + Supertest；前端：既有 Vitest；匯入／年假：整合測試必過 | 對應 PRD 附錄 B 匯入／帳號項 |

**刻意不做（本線）**：OIDC／企業 AD（PRD 範圍外）；跨日夜班；假別法定天數控管；加班原因常用清單。

**Constitution 例外說明**：P2 模板提及 OIDC；本增量依 PRD「PIN 為識別碼、非 SSO」採自建帳密／PIN，並以雜湊、嘗試次數限制、稽核日誌滿足「設計即安全」精神。

## 規範檢查 (Constitution Check)

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- [x] **P1: SDD**：依 `出勤記錄-擴充需求3_prd.md` 線 B。
- [x] **P2: Security by Design**：自建登入 + 雜湊 + RBAC（employee／admin）+ 匯入授權 + 稽核（登入失敗／帳號異動／重匯）；例外見上表。
- [x] **P3: 可測試性**：附錄 B 匯入／帳號／班表／詞庫項可寫成自動化測試。
- [x] **P4: 漸進交付**：下方 Phase B0～B6 各自可驗收。
- [x] **P5: zh-TW**：文件與註解繁中。
- [x] **P6～P7**：ESLint／審查；單元＋整合測試。
- [x] **P8: UX**：Admin CRUD 採明確儲存／取消（非 auto-save）；沿用 `0.shared-ui` 頂欄。
- [x] **P9: 效能**：單次匯入以一人一月為主；政府日曆離線快取，請求不即時打外網。
- [x] **P10: 模組化單體**：後端依領域模組切分（auth、employee、shift、attendance、leave、calendar、workLocation）。
- [x] **P11: 技術堆疊**：本 PLAN 鎖定表。
- [x] **P12: 數據治理**：Prisma schema 為唯一結構來源；重匯為交易性覆蓋。
- [x] **P13: 可觀測性**：結構化 log（requestId、actorId、action）；關鍵業務寫 `audit_log`。

## 交付切分（Phase）

| Phase | 對應 E3 | 可驗收產出 |
|-------|---------|------------|
| **B0** Design／契約 | §2.5 | 見下方 B0 子順序；完成後前後端依 OpenAPI 對齊 |
| **B1** Auth + 員工主檔 | E3-4、E3-5 | 登入／登出；**lazy auth**（首頁公開）；Admin CRUD 員工 API、年假額度（PIN 隨機見 B6） |
| **B2** 班表 + 派班 | E3-1、E3-8 | 班表 CRUD（刪除／停用規則）；派班起迄；已登入可讀伺服器班；**未登入用本機班表／手選** |
| **B3** 匯入 + 年假回沖 | E3-7、E3-4.2～4.5 | 本機公開上傳維持；伺服器正式匯入：本人限制、Admin 代匯、區間重匯交易、未知假別 |
| **B4** 行事曆 + 政府日曆 | E3-6、E3-2 | 首頁明確入口；未登入點入先登入；個人請假曆；國定／補班自 14718 自動＋手動 sync；失敗可手勾 |
| **B5** 工作地點詞庫 + 銜接 | E3-9、§5.8 | 共用詞庫 API；預覽自動完成；Compose api＋**SQLite 掛卷**（無 Postgres） |
| **B6** Admin UI 對齊（下一步） | E3-4～6、PRD §5.3／§5.9 | Admin 殼層：員工｜班表｜政府日曆；`AdminEmployeesPage`；建立／重設 **隨機 PIN**（一次明文）；OpenAPI 同步 |

### B0 子順序（OpenAPI 優先）

大順序仍為 Plan 核准 → B0 → Tasks／B1+。B0 **內部**優先序如下（不必等 research 寫完才開契約）：

1. **`contracts/openapi.yaml`**：先凍結 paths、schemas、錯誤碼，供前後端對齊；可匯入 Postman 當 Collection 骨架（尚無伺服器時僅契約／Mock，不作正式行為驗收）。
2. **`data-model.md`**：與 OpenAPI schema 對齊（可與第 1 步同輪）；實體、重匯交易、約束寫清。
3. **`research.md`**：補契約寫不死的細節（政府日曆資料集、session 實作選型等）。
4. **seed Admin 規格**（可寫在 data-model 或 research）：預設 Admin、公司班、倉庫班。

線 A 計算規則 **不在本 PLAN 重寫**；B2／B4 完成後，前端改以「歸屬日派班 + 伺服器日類型」呼叫既有 `calculateOvertimeAndMealAllowance`。

## 專案結構

### 文件（此功能）

```text
specs/002-attendance-account-shift-leave/
├── 出勤記錄-擴充需求3_prd.md
├── plan-line-a-shift-overtime.md          # 已完成
├── plan-line-b-backend-auth-leave.md      # 本文件
├── STATUS.md
├── contracts/
│   └── openapi.yaml                       # B0-1 優先產出
├── data-model.md                          # B0-2（與 OpenAPI 對齊）
├── research.md                            # B0-3（契約後補細節）
└── tasks-line-b.md                        # B0 契約就緒後或並行拆解
```

### 原始碼（儲存庫根目錄）

```text
backend/
├── package.json
├── prisma/
│   ├── schema.prisma
│   └── seed.ts                 # 預設 Admin、公司班、倉庫班
├── src/
│   ├── app.ts                  # Fastify 組裝
│   ├── config.ts
│   ├── plugins/                # auth、prisma、cors
│   ├── modules/
│   │   ├── auth/
│   │   ├── employee/
│   │   ├── shift/
│   │   ├── attendance/         # 匯入、重匯交易
│   │   ├── leave/              # 年假額度／已請
│   │   ├── calendar/           # 請假視圖、政府日曆同步
│   │   └── workLocation/
│   └── lib/                    # hash、errors、audit
└── tests/
    ├── unit/
    └── integration/            # 重匯年假、匯入授權

frontend/                       # 既有；新增登入與 Admin 頁、API client
├── src/
│   ├── api/                    # fetch 封装、型別
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── AdminEmployeesPage.tsx
│   │   ├── AdminShiftsPage.tsx
│   │   ├── AdminGovCalendarPage.tsx   # 或 Admin 殼層分頁
│   │   └── LeaveCalendarPage.tsx
│   └── ...既有 HomePage／PreviewModal（改讀 API）

docker-compose.yml              # api（SQLite 掛卷）+ 可選 web；無 Postgres
data/attendance.db              # 本機 SQLite（gitignore；僅 .gitkeep 進庫）
```

**結構決策**：後端獨立 `backend/`，不把 API 塞進 `frontend/`；Nginx 將 `/attendance/api/` 反代至 Fastify，靜態前端路徑維持 `/attendance/`。

## 資料模型（摘要，細節寫入 data-model.md）

| 實體 | 關鍵欄位 | 規則 |
|------|----------|------|
| `User` | `employee_id` 6 碼 UK、`role` employee\|admin、`pin_hash`、`password_hash?`、`name`、`is_active` | Admin 不可刪／停；員工可停用 |
| `AnnualLeaveQuota` | `employee_id`、`year`、`quota_days` | 曆年一筆；剩餘 = quota − 已請，可負 |
| `Shift` | `name`、`start_time`、`end_time`、`status` active\|disabled | 預設公司／倉庫；有引用不可刪 |
| `ShiftAssignment` | `employee_id`、`shift_id`、`effective_from`、`effective_to` | 計算用歸屬日落點 |
| `AttendanceImportBatch` | `employee_id`、`date_from`、`date_to`、`imported_by`、`imported_at` | 重匯範圍依據 |
| `AttendanceDay` | `employee_id`、`belong_date`、`attendance_type`、`leave_qty`、`clock_in`、`clock_out`、`raw_*` | 一天一列；重匯刪區間後整寫 |
| `LeaveLedger` | 由 `AttendanceDay` 衍生或實體化 | 僅「請年休假」計入已請 |
| `GovCalendarDay` | `date`、`day_type` holiday\|make_up\|workday | 補班→平日規則 |
| `WorkLocationTerm` | `text` UK、`created_by`、`created_at` | 全員共用 |
| `AuditLog` | `actor_id`、`action`、`payload`、`created_at` | 登入失敗、CRUD、重匯 |

**重匯交易（必須同一 DB transaction）**：

1. 計算檔內 `min(belong_date)～max(belong_date)`。
2. 該員工該區間內既有「請年休假」考勤數量加回（沖銷已請）。
3. 刪除該員工該區間 `AttendanceDay`（及相關 ledger）。
4. 寫入新檔全部列。
5. 依新列重算該曆年（跨年則多年）已請。

## API 邊界（合約目錄細化）

| Method | Path | 角色 | 行為 |
|--------|------|------|------|
| POST | `/api/auth/login` | public | 員工：編號+PIN；Admin：帳號+密碼+4碼 |
| POST | `/api/auth/logout` | any | 清 session |
| GET | `/api/me` | any | 目前使用者 |
| CRUD | `/api/admin/employees` | admin | 員工／PIN／年假額度 |
| CRUD | `/api/admin/shifts` | admin | 班表；刪除前檢查引用 |
| CRUD | `/api/admin/shift-assignments` | admin | 派班起迄 |
| POST | `/api/attendance/import` | employee\|admin | 員工驗證檔內編號＝本人；Admin 不限 |
| GET | `/api/attendance` | employee\|admin | 查詢；Admin 可指定員工 |
| GET | `/api/leave/calendar` | employee\|admin | 請假＋國定／補班 |
| POST | `/api/admin/gov-calendar/sync` | admin | 手動觸發同步 |
| GET/POST | `/api/work-locations` | any | 前綴搜尋；送出新字串入庫 |

前端加班計算仍在瀏覽器；API 提供「該日 shift + day_type」供計算輸入，避免後端重寫線 A 公式（除非後續另開 PLAN）。

## 前端銜接要點

1. **Lazy auth（禁止整站閘道）**：未登入可進 HomePage 完成加班單主流程。點「行事曆」或 **Admin 管理** 時，若無 session 再導向 LoginPage；登入成功後進入目標頁。已登入時頂欄顯示姓名／角色與登出。
2. **本機公開上傳**：`FileUploader` 維持未登入可上傳；依檔內員工編號辨識與計算。
3. **伺服器正式匯入**：另走 `POST /api/attendance/import`（需 session）；錯誤顯示「非本人檔」「未知假別」等。匯入前員工帳號須已存在（Admin 於員工頁建立）。
4. **班表**：未登入＝本機班表／手選（正式公開路徑）。已登入可顯示伺服器派班結果（Admin 可調派班）；本機手選可保留為降級／除錯。
5. **補班／政府日曆**：優先讀 `GovCalendarDay`（啟動＋每日自動自 data.gov.tw/14718；Admin 可手動 sync）。無資料或未登入時沿用「加到平日加班」勾選。**本版不做**本機 CSV 上傳備援。
6. **工作地點**：`PreviewModal` 呼叫詞庫前綴 API（需登入）；確認下載時若為新字串則 POST 入庫。
7. **行事曆頁**：首頁明確入口；請假＋國定標示；員工本人、Admin 可選員工。
8. **Admin 管理殼層（B6）**：頂欄「Admin 管理」下至少：**員工帳號**（列表／建立／停用／年假／重設 PIN）、**班表與派班**、**政府辦公日曆**（手動同步＋最近結果）。建立／重設 PIN 時後端隨機 4 碼，回應含一次明文 `plainPin`（或同等欄位），UI 醒目顯示並可複製；之後不可再查明文。

## 安全需求（實作必做）

| 項目 | 規格 |
|------|------|
| PIN／密碼 | `bcrypt`（cost ≥ 10）；永不回傳雜湊。員工 PIN **建立／重設時隨機產生**，僅該次 API／UI 回傳明文一次 |
| 登入鎖定 | 同一帳號連續失敗 5 次鎖 15 分鐘（可設定） |
| Session | 伺服器端 session 表或簽章 cookie；逾時 8 小時 |
| 授權 | 每個匯入／查詢檢查 `role` 與 `employee_id` |
| Admin 保護 | DB 約束或應用層禁止 `DELETE`／`is_active=false` 對唯一 Admin |
| 傳輸 | 正式環境 HTTPS；開發可用 HTTP |

## 測試策略

| 層級 | 必測案例（對應 PRD 附錄 B） |
|------|---------------------------|
| 單元 | 年假剩餘可負；跨年兩列分年；跨月同年 |
| 整合 | 員工匯入他人檔 → 403；Admin 代匯成功 |
| 整合 | 同區間完整檔重匯：錯列覆蓋、年假不雙扣 |
| 整合 | 未知假別標記；有打卡仍可計算加班（前端） |
| 整合 | 停用班：現職無人才能停；有歷史引用不可刪 |
| 整合 | 工作地點新字入庫後，另一 session 可搜到 |
| 前端 | **未登入可上傳與計算**；行事曆／Admin 需登入；詞庫自動完成 |

## 部署與遷移

1. 新增 `backend/Dockerfile`、根目錄 `docker-compose.yml`（api + SQLite 掛卷；本機開發零 Docker）。
2. 調整企業入口 `deploy/` 與 Nginx：`/attendance/api/` → api:3000；ds1 掛 `${DATA_ROOT}/attendance:/data`。
3. 首次啟動：`prisma migrate deploy` + `seed`（Admin、兩班）→ `data/attendance.db`。
4. README／`frontend/README.md`／`CLAUDE.md` 補「線 B 需 API＋SQLite」說明。

## 風險與緩解

| 風險 | 緩解 |
|------|------|
| 政府日曆資料集 URL／欄位變更 | 同步失敗只記 log；UI 仍可手勾補班 |
| 重匯殘缺檔清掉中間日 | 匯入前檢查提示「須完整區間檔」；文件與 Admin 作業說明 |
| 線 A 手選班與伺服器派班不一致 | B2 後正式路徑只信伺服器；手選降級為開發旗標 |
| Constitution OIDC 與 PRD PIN 衝突 | 本 PLAN 已記載例外；不實作 SSO |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 自建 PIN／密碼而非 OIDC | PRD 明確排除 SSO，員工僅 6 碼+4 碼 PIN | OIDC 超出範圍且無企業 IdP 整合需求 |
| 新增 SQLite 持久化（`data/attendance.db`） | 需跨裝置／重啟後仍保留帳號、匯入、詞庫、年假 | 純 localStorage 無法滿足「下月登入仍在」與 Admin 代操作 |

## 後續步驟（本 PLAN 核准後）

1. 更新 `STATUS.md`：Plan 定稿勾選；進入 B0。
2. **B0-1** 撰寫 `contracts/openapi.yaml`（Auth／員工／匯入先寫完整；其餘端點骨架帶齊，可用 `x-phase` 標 B2～B5）。
3. **B0-2** 撰寫 `data-model.md`，與 OpenAPI schema 對齊。
4. **B0-3** 撰寫 `research.md`（政府日曆資料集、session 實作細節）。
5. 拆 `tasks-line-b.md`（依 Phase B0～B5；契約穩定後再開 B1 實作）。
6. 主控 `README.md` 增加「擴充 3／線 B 後端依賴」與契約路徑說明（實作 API 時同步即可）。
7. B1+ 有可跑 API 後，再用 Postman 打真實端點；CI／回歸以後端整合測試為準。

## 驗收對照（線 B）

- [ ] **未登入可進首頁**完成上傳／本機班表計算／預覽匯出（無整站登入閘道）。
- [ ] 首頁有明確行事曆入口；未登入點入 → 登入 → 顯示行事曆。
- [ ] Admin 維護／查詢需登入。
- [ ] 員工：6 碼 + PIN 登入；Admin：帳密 + 密碼 + 4 碼；Admin 不可刪／停。
- [ ] **Admin 管理**可維護：員工帳號（隨機 PIN 一次明文）、年假額度、班表、派班起迄、政府日曆手動同步。
- [ ] 伺服器正式匯入：員工匯入他人編號檔被拒；Admin 可代匯（檔內員工須已建帳）。
- [ ] 同區間完整檔重匯：覆蓋正確、年假不雙扣、剩餘可負。
- [ ] 請年休假扣考勤數量；跨年分年、跨月同年。
- [ ] 未知假別 highlight；有打卡仍算加班。
- [ ] 停用班規則；歷史依派班起迄重算。
- [ ] 政府日曆自 data.gov.tw/14718 自動＋手動同步標國定／補班；失敗可手勾。
- [ ] 工作地點共用詞庫，跨登入仍在。
- [ ] 部署：Compose 起 api（＋可選 web）；SQLite 掛卷；本機開發零 Docker。
