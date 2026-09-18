# 資料模型：擴充需求 3／線 B

**Spec**: [出勤記錄-擴充需求3_prd.md](./出勤記錄-擴充需求3_prd.md)  
**Plan**: [plan-line-b-backend-auth-leave.md](./plan-line-b-backend-auth-leave.md)  
**API 契約**: [contracts/openapi.yaml](./contracts/openapi.yaml)  
**Date**: 2026-09-18

本文件與 OpenAPI schemas 對齊，供 Prisma `schema.prisma` 實作。表名採 snake_case；應用層 TypeScript 用 camelCase。

---

## 1. 目的

定義線 B 持久化實體、鍵值、約束與重匯交易，使後端實作與前端契約一致。

## 2. 範圍

- 範圍內：帳號、年假、班表／派班、出勤匯入、政府日曆、工作地點詞庫、session、稽核。
- 範圍外：加班計算結果表（時數仍由前端線 A 計算）；SSO。

## 3. ER 總覽

```text
User 1──* AnnualLeaveQuota
User 1──* ShiftAssignment *──1 Shift
User 1──* AttendanceDay
User 1──* AttendanceImportBatch
User 1──* Session
GovCalendarDay（獨立）
WorkLocationTerm（獨立，created_by → User）
AuditLog（actor → User，可 null）
```

「已請年假」**不另建餘額表**：由 `AttendanceDay` 中 `attendance_type = 請年休假` 的 `leave_quantity` 依曆年加總；`AnnualLeaveQuota.remaining` 為計算欄（API 回傳，可不存 DB）。

---

## 4. 實體說明

### 4.1 User（`users`）

| 欄位 | 型別 | 約束 | 說明 |
|------|------|------|------|
| id | uuid PK | | 內部鍵 |
| employee_id | char(6) | UK, `^\d{6}$` | 等於出勤檔員工編號；Admin 亦用 6 碼或固定碼（seed 定） |
| name | text | not null | 顯示姓名 |
| role | enum | `employee` \| `admin` | |
| pin_hash | text | not null | bcrypt |
| password_hash | text | null | 僅 admin 必填 |
| is_active | boolean | default true | Admin 禁止 false |
| is_protected | boolean | default false | seed Admin = true；不可刪／停 |
| failed_login_count | int | default 0 | |
| locked_until | timestamptz | null | |
| created_at / updated_at | timestamptz | | |

規則：
- 唯一受保護 Admin 至少一筆；應用層拒絕 `DELETE` 與 `is_active=false`。
- PIN／密碼雜湊永不經 API 回傳。

### 4.2 Session（`sessions`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | 等於 cookie 值或 cookie 對應之 session id |
| user_id | uuid FK → users | |
| expires_at | timestamptz | 預設建立後 8 小時 |
| created_at | timestamptz | |

Cookie 名：`attendance_session`（見 OpenAPI）。

### 4.3 AnnualLeaveQuota（`annual_leave_quotas`）

| 欄位 | 型別 | 約束 |
|------|------|------|
| id | uuid PK | |
| employee_id | char(6) FK | 與 users.employee_id 一致（或 FK users.id，實作二擇一，建議 FK users.id） |
| user_id | uuid FK | 建議主關聯 |
| year | int | 西元曆年 |
| quota_days | numeric(6,2) | |
| UK | (user_id, year) | |

API `usedDays`／`remainingDays` 為查詢時計算。

### 4.4 Shift（`shifts`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | |
| name | text UK | 如「公司班」「倉庫班」 |
| start_time | time / char(5) | `HH:mm` |
| end_time | time / char(5) | 平日晚段加班起點 |
| status | enum | `active` \| `disabled` |
| created_at / updated_at | | |

刪除：若存在任何 `ShiftAssignment`（含歷史）→ 禁止，僅可停用。  
停用：若存在「現職」派班（`effective_to` is null 或 `effective_to >= today`）→ 禁止。

### 4.5 ShiftAssignment（`shift_assignments`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK | |
| shift_id | uuid FK | |
| effective_from | date | |
| effective_to | date null | null＝開放結束 |

計算：對某 `belong_date`，取 `effective_from <= date AND (effective_to IS NULL OR effective_to >= date)`；若多段重疊，取 `effective_from` 最大者（實作時加 CHECK 或應用層防重疊）。

### 4.6 AttendanceImportBatch（`attendance_import_batches`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK | 檔案所屬員工 |
| imported_by | uuid FK | 操作者（本人或 Admin） |
| date_from / date_to | date | 檔內歸屬日 min～max |
| source_filename | text | |
| imported_at | timestamptz | |

### 4.7 AttendanceDay（`attendance_days`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | |
| user_id | uuid FK | |
| belong_date | date | 一天一列 |
| attendance_type | text null | 原始或清單內名稱 |
| leave_quantity | numeric(6,2) | default 0 |
| clock_in / clock_out | char(5) null | `HH:mm` |
| unknown_leave_type | boolean | 不在假別清單 |
| import_batch_id | uuid FK null | |
| UK | (user_id, belong_date) | |

假別清單（與 OpenAPI `LeaveType` 一致，排除後「空」可視為無假）：  
`請年休假`、`病假`、`婚假`、`產假`、`育嬰假`、`事假`、`公假`、`喪假`。

僅 `請年休假` 計入年假已請。

### 4.8 GovCalendarDay（`gov_calendar_days`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| date | date PK | |
| day_type | enum | 對應 API：`holiday` \| `make_up` \| `weekday`（資料集若僅標假／補班，未列日可推導為 weekday） |
| name | text null | 節日名稱 |
| synced_at | timestamptz | |

對前端 `DayType` 映射：
- 政府補班 → `make_up`（計算視同平日）
- 政府放假 → `holiday`
- 非補班週六 → API 層推為 `rest_day`（可不存表，依星期＋gov 推導）
- 週日 → `holiday`（例假，與國定同一套加班規則）

### 4.9 WorkLocationTerm（`work_location_terms`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | |
| text | text UK | max 40 字元 |
| created_by | uuid FK null | |
| created_at | timestamptz | |

### 4.10 AuditLog（`audit_logs`）

| 欄位 | 型別 | 說明 |
|------|------|------|
| id | uuid PK | |
| actor_id | uuid FK null | |
| action | text | 如 `login_failed`、`import`、`employee_update` |
| payload | jsonb | |
| created_at | timestamptz | |

---

## 5. 重匯交易（必須單一 DB transaction）

對目標員工 `U`、本次檔 `date_from = min(belong_date)`、`date_to = max(belong_date)`：

1. 鎖定該員工相關列（依實作選 `SELECT … FOR UPDATE`）。
2. 區間內既有列若 `attendance_type = 請年休假`，其 `leave_quantity` 視為將被沖銷（刪除後自然從加總消失；無需先改 quota 表）。
3. `DELETE FROM attendance_days WHERE user_id=U AND belong_date BETWEEN date_from AND date_to`。
4. `INSERT` 新檔全部列；標記 `unknown_leave_type`。
5. 寫入 `attendance_import_batches`。
6. 寫 `audit_logs`。
7. Commit。  
8. 回應中附上受影響曆年之 `AnnualLeaveQuota` 快照（used／remaining 現算）。

殘缺區間檔：契約不擋匯入，但 Admin 作業文件要求完整檔；可選在結果加 `warning`。

---

## 6. Seed 規格

| 項目 | 值 |
|------|-----|
| Admin | `employee_id` 建議 `000000` 或文件化碼；`role=admin`；`is_protected=true`；初始 password／PIN 僅存於部署密文／`.env.example` 說明，禁止 commit 明文生產密碼 |
| 公司班 | name=公司班，09:00–18:00，active |
| 倉庫班 | name=倉庫班，08:00–17:00，active |

誤餐規則不存班表列：全班共用「平日／補班且下班 ≥19:30 → 50」，寫死於前端計算（線 A）與文件。

---

## 7. 與 OpenAPI 對照

| OpenAPI schema | 主要表 |
|----------------|--------|
| MeResponse / Employee | users |
| AnnualLeaveQuota | annual_leave_quotas + 聚合 attendance_days |
| Shift / ShiftAssignment | shifts / shift_assignments |
| AttendanceDay / ImportResult | attendance_days / batches |
| DayComputationContext | shift_assignments + gov_calendar_days + 星期推導 |
| LeaveCalendarDay | attendance_days + gov |
| WorkLocationTerm | work_location_terms |

---

## 8. 參考

- PRD §5.3～5.7、§7
- PLAN 資料模型摘要與重匯步驟
- `contracts/openapi.yaml`
