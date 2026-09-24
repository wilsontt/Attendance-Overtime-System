# Research：擴充需求 3／線 B

**Spec**: [出勤記錄-擴充需求3_prd.md](./出勤記錄-擴充需求3_prd.md)  
**Plan**: [plan-line-b-backend-auth-leave.md](./plan-line-b-backend-auth-leave.md)  
**契約**: [contracts/openapi.yaml](./contracts/openapi.yaml)  
**資料模型**: [data-model.md](./data-model.md)  
**Date**: 2026-09-18

補齊 PRD §2.5／PLAN 中「契約寫不死」的實作決策。若與 OpenAPI／data-model 衝突，以本文件決策為準並回寫契約。

---

## 1. Session 實作

| 方案 | 優點 | 缺點 |
|------|------|------|
| A. DB `sessions` 表 + 隨機 session id Cookie | 可主動撤銷、審計清楚、與 data-model 一致 | 每次請求查 DB |
| B. 簽章 Cookie（如 `@fastify/secure-session`）無伺服器狀態 | 實作快 | 撤銷困難、鎖定狀態難同步 |

**決策：A**。Cookie 名 `attendance_session`；值為 `sessions.id`（uuid）；`expires_at = now + 8h`；登出刪列；登入成功重置 `failed_login_count`。

鎖定：連續失敗 5 次 → `locked_until = now + 15m`；API `423` + `LOGIN_LOCKED`。

---

## 2. 密碼與圖形驗證碼（對齊教育訓練）

### 2.1 Admin 密碼

- 演算法：`bcrypt`，cost **≥ 10**（建議 12）。
- **僅 Admin** 有 `password_hash`；登入時驗證密碼。
- Seed：`ADMIN_SEED_PASSWORD`（僅 seed；不入庫明文）。**廢止**以入庫 PIN 作為登入第二因子。

### 2.2 圖形驗證碼（員工與 Admin 共用）

比照教育訓練 `GET captcha`＋登入帶 `captcha_id`／`answer`：

| 項目 | 決策 |
|------|------|
| 產生 | `GET /api/auth/captcha` → `{ captchaId, image }`（SVG data URL；七段 **path**，答案不入 `<text>`） |
| 內容 | 隨機 **4 位數字**；繪製為圖像 |
| 暫存 | 行程內 Map：`captchaId → answer`；TTL 建議 5 分鐘 |
| 員工登入 | `employeeId` + `captchaId` + `captchaAnswer`（免密碼、無入庫 PIN；**`role=admin` 禁止走此通道**） |
| Admin 登入 | `username` + `password` + `captchaId` + `captchaAnswer` |
| Rate limit | 全站 300/min；auth 路由 30/min |
| 成功後 | 刪除該 `captchaId`（一次性） |
| Bypass | 僅開發可選；正式禁止 |

**不做**：員工入庫 PIN、建帳發 PIN、重設 PIN、Admin 登入再用入庫 4 碼 PIN。

### 2.3 與舊實作差異（B1 → B6）

| 舊（B1） | 新（B6） |
|----------|----------|
| 驗證 `users.pin_hash` | 驗證圖形驗證碼；Admin 另驗 `password_hash` |
| `EmployeeCreate` 必填 `pin` | 建立員工不需 pin |
| `ADMIN_SEED_PIN` 登入用 | 登入不使用（seed 可寫佔位雜湊以相容舊欄位） |

---

## 3. 政府辦公日曆資料集

| 項目 | 決策 |
|------|------|
| 主來源 | [政府資料開放平臺 dataset/14718](https://data.gov.tw/dataset/14718)「中華民國政府行政機關辦公日曆表」（人事總處） |
| 格式 | 逐年 CSV（含一般版與 Google 行事曆專用）；B4 實作時下載當前年／次年資源 URL 並快取 |
| 備援結構參考 | [dataset/123662](https://data.gov.tw/dataset/123662)（新北彙整，欄位含 `date`／`isholiday`／`holidaycategory`）可作欄位映射參考，正式同步仍以 14718／人事總處為準 |
| 排程 | 每日一次（程序內 `setInterval`）；另提供 `POST /api/admin/gov-calendar/sync` |
| 手動本機 CSV 上傳 | **本版不做**（PRD §5.5／§5.9）；外網失敗時靠手勾補班 |
| 失敗策略 | 記 log + audit；**不**阻斷匯入／加班；UI 仍可手勾「加到平日加班」（E3-2.1） |

**日類型推導（與 OpenAPI `DayType`）：**

1. 若 `gov_calendar_days` 有該日且為補班 → `make_up`
2. 若為放假／國定 → `holiday`
3. 否則依星期：週一～五 → `weekday`；週六 → `rest_day`；週日 → `holiday`

---

## 4. API 掛載與 CORS

| 環境 | 行為 |
|------|------|
| 開發 | Fastify `:3000`；Vite proxy `/attendance/api` → `http://localhost:3000/api`；SQLite `data/attendance.db`（**不需 Docker**） |
| 正式／ds1（目標） | Nginx：`/attendance/` → 靜態；`/attendance/api/` → `attendance-api:3000/api/`；API 掛卷 `${DATA_ROOT}/attendance:/data`，`DATABASE_URL=file:/data/attendance.db` |
| 正式／ds1（2026-09-23） | **D2 已完成**：`deploy` 含 `attendance-api` 與 `/attendance/api/`。ds1 **尚未**建 `${DATA_ROOT}/attendance`、尚未 up。見 [plan-ds1-deploy-line-b.md](./plan-ds1-deploy-line-b.md) |
| Cookie | `Path=/attendance` 或 `/`（與反代路徑一致）；`SameSite=Lax`；正式 `Secure` |

---

## 5. 匯入檔格式

- 沿用現有前端 `txtParser`／CSV 欄位語意；**解析可先放後端重寫一份**，或 B3 初期接受前端已 parse 的 JSON（若改契約需先改 OpenAPI）。
- **現行契約**：`multipart/form-data` 上傳原始檔，**後端解析**（單一真相，避免前後端解析漂移）。
- 員工授權：解析後若任一 `employeeId ≠ me.employeeId` → 整份 `403 IMPORT_NOT_SELF`（不寫入）。

---

## 6. Admin 多員工單檔

PRD §2.5：Admin 單檔含多名員工時，依檔內每個編號各自套用重匯清檔。

**決策**：B3 第一版若偵測多員工編號 → `400 VALIDATION_ERROR`（`details.reason=multiple_employees`），要求拆檔；多員工支援列為 B3.1 增強（需改 OpenAPI）。現況 TXT 多為一人一檔。

---

## 7. 計算脈絡 API

`GET /api/computation-context` 只回 `shift` + `dayType`，不回加班時數。  
無派班日：`shift: null`，前端顯示錯誤／阻擋下載，避免默默用錯班。

---

## 8. 觀測與稽核

- 每個請求：`requestId`（Fastify 產生）寫入 log。
- `audit_logs` 必記：`login_failed`、`login_success`、`import`、員工／班表 CRUD、`gov_calendar_sync`。

---

## 9. 待實作時再確認

- [x] seed Admin `employee_id` = `000000`（已寫入 seed／config）。
- [x] 14718 同步路徑（B4 已實作；欄位 parsing 以 `govCalendarParse` 為準）。
- [ ] B6：`GET /api/auth/captcha`＋登入改 captcha；拿掉員工 pin；前端 Admin 殼層＋LoginPage 圖形驗證碼。
- [ ] Vite proxy 與 Cookie Path 在本機聯調一次（登入後正式匯入／員工 CRUD）。

---

## 10. 參考連結

- https://data.gov.tw/dataset/14718
- https://data.gov.tw/dataset/123662
- https://www.dgpa.gov.tw/（人事總處辦公日曆公告）
- PLAN 技術鎖定表、安全需求表
