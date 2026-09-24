# ds1 上機操作檢查清單 — 出勤加班單線 B

> **適用**：僅測試主機 **ds1**。  
> **對應計畫**：[plan-ds1-deploy-line-b.md](./plan-ds1-deploy-line-b.md)  
> **前置**：D0／D2 已完成（repo 內 compose／nginx／範本）。本清單執行 D1 → D3 → D4 → D5。  
> **本階段不做**：HTTPS（維持 `ATTENDANCE_COOKIE_SECURE=false`）。

---

## 1. 目的／適用範圍

- 在 ds1 啟用線 B：`attendance-api`＋SQLite＋Nginx `/attendance/api/`。
- 資料落在 `${DATA_ROOT}/attendance/`（對齊教育訓練 `${DATA_ROOT}/training/`）。
- 給維運逐步勾選；指令可直接貼上終端。

| 項目 | 值 |
|------|-----|
| `DATA_ROOT` 預設 | `/opt/apps/enterprise-portal/data` |
| DB（主機） | `${DATA_ROOT}/attendance/attendance.db` |
| DB（容器） | `/data/attendance.db`（`DATABASE_URL=file:/data/attendance.db`） |
| 工作目錄 | `cd /opt/apps/enterprise-portal/deploy`（**以主機實際 clone 路徑為準**） |
| Compose 服務 | `attendance`（靜態）、`attendance-api`（API）、`nginx` |

---

## 2. 前置條件

- [ ] 確認 D0／D2 已合入 ds1 將拉取的程式（含 `attendance-api`、Nginx `/attendance/api/`）
- [ ] 確認本階段 **HTTPS 暫緩**；`.env` 使用 `ATTENDANCE_COOKIE_SECURE=false`
- [ ] 確認有審核過的策略 B **測試快照** `attendance.db`（或已約定來源路徑）
- [ ] 確認 Admin seed 密碼策略已決定（見 §3）
- [ ] 確認有 sudo／Docker 權限；可寫入 `${DATA_ROOT}`

---

## 3. 決策摘要（已拍板，勿改錯）

| # | 決議 |
|---|------|
| 首次 DB | **策略 B**：測試快照 |
| 服務名 | **`attendance-api`** |
| Cookie | **`COOKIE_SECURE=false`**（HTTPS 暫緩） |
| Admin | 登入比對 DB `password_hash`；seed 與快照密碼對齊 |

### 重要風險（必讀）

API 映像 CMD **每次啟動**會跑 `prisma migrate deploy`＋**`node dist/prisma/seed.js`**（編譯後 seed；勿再依賴映像內 `src/`）。seed 的 update **會覆寫** Admin `password_hash`。

因此 `deploy/.env` 的 `ATTENDANCE_ADMIN_SEED_PASSWORD` **必須**與快照可登入密碼一致，**或**接受改為 `.env` 密碼並記入密碼庫。

禁止：未備份就覆寫已有 `attendance.db`。

---

## 4. 操作步驟

> 以下預設工作目錄為企業入口 `deploy/`。若 clone 路徑不同，以主機實際路徑為準。

```bash
cd /opt/apps/enterprise-portal/deploy
```

### Phase D1 — 主機資料目錄

- [ ] 建立目錄

```bash
sudo mkdir -p /opt/apps/enterprise-portal/data/attendance
```

- [ ] 權限對齊教育訓練（先查再設；數值以主機現況為準）

```bash
ls -ld /opt/apps/enterprise-portal/data/training
ls -ld /opt/apps/enterprise-portal/data/attendance
# 若需對齊，範例（owner/group 以 training 目錄為準）：
# sudo chown -R "$(stat -c '%U:%G' /opt/apps/enterprise-portal/data/training)" /opt/apps/enterprise-portal/data/attendance
```

- [ ] **若目錄已有 `attendance.db`**：先備份，禁止直接覆寫

```bash
# 僅在檔案已存在時執行
ts=$(date +%Y%m%d-%H%M%S)
sudo cp -a /opt/apps/enterprise-portal/data/attendance/attendance.db \
  "/opt/apps/enterprise-portal/data/attendance/attendance.db.bak-${ts}"
ls -la /opt/apps/enterprise-portal/data/attendance/
```

- [ ] 放入審核過的策略 B 快照（來源路徑改成實際值）

```bash
# 範例：sudo cp /path/to/approved/attendance.db /opt/apps/enterprise-portal/data/attendance/attendance.db
ls -la /opt/apps/enterprise-portal/data/attendance/attendance.db
```

**期望**：`${DATA_ROOT}/attendance/attendance.db` 存在且為預期快照。

---

### Phase D3 — 環境變數、映像、確認 DB

- [ ] 拉取含 D2 之程式至 ds1（git pull／部署流程依站內慣例）

- [ ] 編輯 `deploy/.env`（勿 commit；對照 `.env.example`）

```bash
# 確認／補上（密碼改為實際值；勿用長期 ChangeMeAdmin!）
grep -E '^(DATA_ROOT|ATTENDANCE_)' .env || true
```

必要項：

```bash
DATA_ROOT=/opt/apps/enterprise-portal/data
ATTENDANCE_COOKIE_SECURE=false
ATTENDANCE_ADMIN_SEED_PASSWORD=<與快照可登入密碼一致，或刻意新密碼並記密碼庫>
```

- [ ] 建置映像

```bash
docker compose build attendance-api attendance
```

**期望**：build 成功，無錯誤結束。

> **埠口**：前端 `attendance` 容器改非 root、聽 **8080**。入口 `deploy/nginx/nginx.conf` 的 `upstream attendance` 須為 `server attendance:8080;`（舊 `：80` 會 502）。

- [ ] 再次確認 DB 就位（禁止未備份覆寫）

```bash
ls -la "${DATA_ROOT:-/opt/apps/enterprise-portal/data}/attendance/attendance.db"
```

**期望**：檔案存在；若剛覆蓋，須已有 `.bak-*`。

---

### Phase D4 — 上線

**方式 A（compose 直接）**

- [ ] 啟動 API

```bash
docker compose up -d attendance-api
```

- [ ] 重載 Nginx（載入 `/attendance/api/`）

```bash
docker compose up -d --build --force-recreate nginx
```

- [ ] （前端有變更時）更新靜態

```bash
docker compose up -d --build attendance
```

**方式 B（update.sh）**

- [ ] 亦可依序：

```bash
./scripts/update.sh attendance-api
./scripts/update.sh nginx
# 前端有變更時：
# ./scripts/update.sh attendance
```

**健康檢查**

- [ ] 靜態前端

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/attendance/
```

**期望**：`200`

- [ ] API health

```bash
curl -s http://localhost/attendance/api/health
```

**期望**：回應含 `ok`（例如 `{"ok":true}`）

- [ ] （選用）容器狀態

```bash
docker compose ps attendance attendance-api nginx
```

**期望**：三者為 running／healthy（依站內慣例）。

---

### Phase D5 — 煙測、密碼庫、STATUS

- [ ] 完成下方 §5 煙測表全部勾選
- [ ] Admin 實際可登入密碼記入密碼庫（**勿進 git**）
- [ ] 更新本規格 [STATUS.md](./STATUS.md)：勾選 ds1 部署完成／最近更新加一行
- [ ] （可選）回寫 [plan-ds1-deploy-line-b.md](./plan-ds1-deploy-line-b.md) D1／D3～D5 勾選狀態

---

## 5. 煙測表

| # | 勾選 | 案例 | 操作摘要 | 期望 |
|---|------|------|----------|------|
| 1 | - [ ] | 未登入上傳 TXT | 瀏覽器開 `/attendance/`，未登入上傳 TXT | 可算加班；不強制跳登入 |
| 2 | - [ ] | 同時寫入後登入 | 勾「同時寫入伺服器」→ 本機載入後再自行登入 | 登入後自動寫入伺服器 |
| 3 | - [ ] | 請假行事曆 | 登入後開行事曆 | 摘要＋月表；日期含「星期X」 |
| 4 | - [ ] | Admin 登入 | 員工編號 `000000`＋密碼＋captcha | 可進 Admin |
| 5 | - [ ] | 重啟 API 資料仍在 | `docker compose restart attendance-api` 後再查資料 | 先前寫入仍在 |
| 6 | - [ ] | 停 API 靜態仍可開 | `docker compose stop attendance-api` 後開 `/attendance/` | 靜態頁仍可開；測完記得 `docker compose start attendance-api` |

煙測 5／6 指令：

```bash
# 煙測 5
docker compose restart attendance-api
curl -s http://localhost/attendance/api/health

# 煙測 6
docker compose stop attendance-api
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/attendance/
docker compose start attendance-api
curl -s http://localhost/attendance/api/health
```

---

## 6. 回滾步驟

目標：API 異常時，**靜態加班單主流程**仍可用。

- [ ] 停止 API

```bash
cd /opt/apps/enterprise-portal/deploy
docker compose stop attendance-api
```

- [ ] （必要時）還原 Nginx：拿掉或還原不含 `/attendance/api/` 的 conf，再：

```bash
docker compose up -d --build --force-recreate nginx
# 或
./scripts/update.sh nginx
```

- [ ] 確認靜態仍可用

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost/attendance/
```

**期望**：`200`；使用者仍可本機上傳計算（無伺服器身分功能）。

- [ ] （資料回滾）若 DB 損壞，停 API 後由備份還原：

```bash
docker compose stop attendance-api
# sudo cp -a /opt/apps/enterprise-portal/data/attendance/attendance.db.bak-<ts> \
#   /opt/apps/enterprise-portal/data/attendance/attendance.db
docker compose start attendance-api
```

---

## 7. 完成後要更新的文件

- [ ] [STATUS.md](./STATUS.md) — 「ds1／測試環境部署」勾選完成；「最近更新」加一行
- [ ] [plan-ds1-deploy-line-b.md](./plan-ds1-deploy-line-b.md) — D1／D3～D5 勾選；核准紀錄「ds1 上機」改已完成
- [ ] （若密碼變更）企業密碼庫 — Admin 可登入密碼（勿寫進 git）
- [ ] （可選）本 checklist 頂部加註實際上機日期／執行人

---

## 修訂紀錄

| 版本 | 日期 | 說明 |
|------|------|------|
| v1.0.0 | 2026-09-24 | 初稿：對齊 plan-ds1-deploy-line-b D1～D5 可勾選操作 |
