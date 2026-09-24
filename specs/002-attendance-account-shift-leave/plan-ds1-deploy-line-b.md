# 出勤加班單 — ds1 線 B 部署計畫

> **狀態**：D0／D2 已完成（repo 內 compose／nginx／範本）。**尚未**在 ds1 上機（D1／D3／D4／D5 待維運視窗）。  
> **For agentic workers：** 上機前再確認「核准紀錄」與策略 B 快照／seed 密碼對齊。  
> **上機檢查清單**：[checklist-ds1-deploy-line-b.md](./checklist-ds1-deploy-line-b.md)（維運逐步勾選）

**Goal:** 在測試主機 ds1 安全啟用線 B（API＋SQLite＋`/attendance/api/`），使登入／行事曆／匯入／Admin 與本機行為一致，且資料落在 `${DATA_ROOT}/attendance/`（對齊教育訓練 `${DATA_ROOT}/training/`）。

**Architecture:** 企業入口 `deploy/`：`attendance`＝靜態前端；`attendance-api`＝Fastify＋Prisma SQLite（掛卷）；入口 Nginx `/attendance/api/` → API，`/attendance/` → 靜態。

**Tech Stack:** Docker Compose、Nginx、Fastify API、Prisma＋SQLite、路徑 `/attendance/`。

**Spec／依據:**

- [plan-line-b-backend-auth-leave.md](./plan-line-b-backend-auth-leave.md)「部署與遷移」
- [research.md](./research.md)、[STATUS.md](./STATUS.md)
- `deploy/docker-compose.yml`、`deploy/nginx/nginx.conf`、`deploy/.env.example`

## Global Constraints

- 首次只開 **ds1 測試**；不碰正式。
- 資料：`${DATA_ROOT}/attendance/attendance.db` → 容器 `file:/data/attendance.db`（`DATA_ROOT` 預設 `/opt/apps/enterprise-portal/data`）。
- **首次 DB＝策略 B（測試快照）**；禁止未備份覆寫。
- **HTTPS 暫緩**（下階段）；目前 `ATTENDANCE_COOKIE_SECURE=false`。之後全站 HTTPS 再改 `true`，重工極小。
- Admin：**登入比對 DB `password_hash`**（與教育訓練／AETIM 相同）。`ATTENDANCE_ADMIN_SEED_PASSWORD` 僅供 seed；**容器每次啟動會跑 seed 並 update 覆寫 Admin 雜湊** → 須與快照可登入密碼一致，或接受改為 `.env` 密碼。
- 未登入加班單主流程仍須可用。

---

## 0. 現況（D2 後）

| 項目 | 狀態 |
|------|------|
| 本機線 B | 實作／測試完成 |
| `deploy` → `attendance` | 靜態前端（不變） |
| `deploy` → `attendance-api` | **已新增**（D2） |
| Nginx `/attendance/api/` | **已新增**（D2） |
| ds1 `${DATA_ROOT}/attendance` | **尚未建立**（D1） |
| ds1 上機 | **未執行**（D3～D5） |

---

## 1. 架構

```
瀏覽器
  ├─ /attendance/        → enterprise-attendance (Nginx 靜態)
  └─ /attendance/api/    → enterprise-attendance-api:3000/api/
                              volume: ${DATA_ROOT}/attendance → /data
                              DATABASE_URL=file:/data/attendance.db
```

| | 教育訓練 | 出勤 |
|--|----------|------|
| Compose | `training-backend` | `attendance-api` |
| 主機目錄 | `${DATA_ROOT}/training/` | `${DATA_ROOT}/attendance/` |
| DB | `education_training.db` | `attendance.db` |

---

## 2. D2 已異動檔案

| 檔案 | 動作 |
|------|------|
| `deploy/docker-compose.yml` | 新增 `attendance-api`；nginx `depends_on` 含之 |
| `deploy/nginx/nginx.conf` | `upstream attendance-api`；`location /attendance/api/`（在靜態之前） |
| `deploy/.env.example` | `ATTENDANCE_COOKIE_SECURE`／`ATTENDANCE_ADMIN_SEED_PASSWORD` 說明 |
| `deploy/scripts/update.sh` | 支援 `attendance-api` |
| `deploy/scripts/deploy.sh` | 補 API health curl 提示 |

**刻意不做（本階段）**：ds1 建目錄／拷貝 DB／build up（D1／D3／D4）。

---

## 3. 分階段任務

### Phase D0 — 對齊與核准

- [x] 首次 DB：**B（測試快照）**
- [x] 服務名：`attendance-api`
- [x] Cookie：HTTPS **暫緩** → `COOKIE_SECURE=false`
- [x] Admin：DB 雜湊模式；seed 密碼與快照對齊或接受覆寫；`.env` 用強密碼（勿長期 `ChangeMeAdmin!`）
- [x] 時程：先改 repo（D2），再開維運上機
- [x] HTTPS 後做不重工（僅入口 TLS＋改 Secure）

### Phase D1 — 主機資料目錄（ds1）

- [ ] `sudo mkdir -p /opt/apps/enterprise-portal/data/attendance`
- [ ] 權限對齊 `${DATA_ROOT}/training`
- [ ] 放入審核過的 `attendance.db`（策略 B；先備份目錄若已有檔）

### Phase D2 — Compose／Nginx（repo）

- [x] `attendance-api` 服務（無對外 publish 3000）
- [x] Nginx `/attendance/api/`
- [x] `.env.example`／`update.sh`／`deploy.sh` 提示

### Phase D3 — 映像與首次 DB（ds1）

- [ ] 拉取含 D2 之程式至 ds1
- [ ] 於 `deploy/.env` 設定：
  - `DATA_ROOT=...`
  - `ATTENDANCE_COOKIE_SECURE=false`
  - `ATTENDANCE_ADMIN_SEED_PASSWORD=<與快照一致或刻意新密碼>`
- [ ] `docker compose build attendance-api attendance`
- [ ] 確認 `${DATA_ROOT}/attendance/attendance.db` 已就位（B）
- [ ] **禁止**未備份覆寫

### Phase D4 — 上線（ds1）

- [ ] `docker compose up -d attendance-api`
- [ ] `docker compose up -d --build --force-recreate nginx`（載入新 conf）
- [ ] （前端有變更時）`docker compose up -d --build attendance`
- [ ] 健康檢查：
  - `curl -s -o /dev/null -w "%{http_code}\n" http://localhost/attendance/` → 200
  - `curl -s http://localhost/attendance/api/health` → `{"ok":true}` 類

### Phase D5 — 煙測與回滾

- [ ] §4 煙測全過
- [ ] Admin 密碼記入密碼庫（勿進 git）
- [ ] 回滾：停 `attendance-api`；還原 nginx conf 或暫時拿掉 api location；靜態主流程仍可用
- [ ] 更新 STATUS 勾選 ds1 完成

---

## 4. 煙測清單（ds1）

| # | 案例 | 期望 |
|---|------|------|
| 1 | 未登入上傳 TXT | 可算加班；不強制跳登入 |
| 2 | 勾同時寫入後自行登入 | 自動寫入伺服器 |
| 3 | 請假行事曆 | 摘要＋月表；日期含「星期X」 |
| 4 | Admin `000000`＋密碼＋captcha | 可進 Admin |
| 5 | 重啟 `attendance-api` | DB 資料仍在 |
| 6 | 停 API | 靜態頁仍可開 |

---

## 5. 風險與緩解

| 風險 | 緩解 |
|------|------|
| 啟動 seed 覆寫快照 Admin 密碼 | `.env` 密碼與快照對齊，或接受新密碼並更新密碼庫 |
| 正式映像 seed 缺 `src/` | CMD 使用 `node dist/prisma/seed.js`（方案 B；勿 `tsx prisma/seed.ts`） |
| `/attendance/` 吃掉 api | 已用更長前綴 `/attendance/api/` |
| Cookie Secure | 現階段 false；HTTPS 階段再 true |
| 僅更新前端 | D4 強制 api＋nginx |

---

## 6. 對齊決議（已拍板）

| # | 決議 |
|---|------|
| 1 首次 DB | **B** 測試快照 |
| 2 服務名 | **attendance-api** |
| 3 COOKIE_SECURE | **false**（HTTPS 暫緩） |
| 4 Admin | DB 雜湊；seed／`.env` 與快照對齊策略見 Global Constraints |
| 5 時程 | **先 D2（本變更）**，再維運上機 |
| HTTPS | **下階段**；預期不重工 API／掛卷 |

---

## 7. 核准紀錄

| 欄位 | 內容 |
|------|------|
| 對齊日期 | 2026-09-23 |
| 首次 DB 策略 | **B** |
| COOKIE_SECURE | **false**（HTTPS 暫緩） |
| D2 | **已完成（repo）** |
| ds1 上機 | 待維運視窗（D1／D3～D5） |
| 備註 | 容器 CMD 含 seed update；部署前對齊 seed 密碼與快照 |

---

## 8. 文件修訂

| 版本 | 日期 | 說明 |
|------|------|------|
| v0.1.0 | 2026-09-23 | 初稿 |
| v0.2.0 | 2026-09-23 | 納入 §6 決議；完成 D2（compose／nginx／env／scripts）；標註 seed 覆寫風險與 HTTPS 暫緩 |
| v0.2.1 | 2026-09-24 | 頂部連結維運上機檢查清單 checklist-ds1-deploy-line-b.md |
