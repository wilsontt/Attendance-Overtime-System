# 出勤加班單系統 — 後端 API

對應規格：`specs/002-attendance-account-shift-leave/`（OpenAPI、data-model、PLAN 線 B）。

**ORM**：Prisma **6** + **SQLite**（對齊教育訓練：`data/*.db` 掛卷；勿升到 Prisma 8 CLI）。

## 啟動（本機開發｜不需 Docker）

1. 複製環境變數：`cp .env.example .env`  
   - 預設 `DATABASE_URL="file:../../data/attendance.db"`（相對 `prisma/` → 專案根 `data/attendance.db`）
2. 遷移與種子（會自動建立 `data/attendance.db`；請確保專案根已有 `data/`）：
   ```bash
   npm run prisma:generate
   npm run prisma:migrate   # 或 npx prisma migrate deploy
   npm run prisma:seed
   ```
3. 開發伺服器：`npm run dev` → `http://localhost:3000`

預設 Admin：`employeeId=000000`，密碼見 `.env`（`ADMIN_SEED_PASSWORD`）。登入另需**圖形驗證碼**（B6；對齊教育訓練）。`ADMIN_SEED_PIN` 僅舊 seed 相容，不作登入因子。

## Docker Compose（僅 ds1／正式）

本機開發**不要** `docker compose`。部署才建映像，並掛 SQLite 目錄（對齊教育訓練 `/data`）：

```bash
# 於 1.出勤加班單系統/
# 預設掛 ./data → 容器 /data；ds1 設 ATTENDANCE_DATA=${DATA_ROOT}/attendance
# DATA_ROOT 預設 /opt/apps/enterprise-portal/data → 主機 …/data/attendance/attendance.db
docker compose up -d --build api

# 含前端 Nginx 反代（需在企業入口網站根目錄，且有 0.shared-ui）
docker compose -f 1.出勤加班單系統/docker-compose.yml --profile full up -d --build
# http://localhost:8080/attendance/ ；API：/attendance/api/
```

容器環境：`DATABASE_URL=file:/data/attendance.db`。

**容器啟動**：以非 root 的 `node` 使用者執行；`migrate deploy` → **`node dist/prisma/seed.js`** → **`node dist/src/server.js`**。掛卷 `/data` 須對該 UID（官方映像多為 1000）可寫。本機開發仍用 `npm run prisma:seed`（`tsx prisma/seed.ts`）。

**企業入口 `deploy/`（ds1）**：**D2 已完成**（`attendance-api`＋Nginx `/attendance/api/`）。上機步驟（建 `${DATA_ROOT}/attendance`、快照 DB、build／up）見  
`specs/002-attendance-account-shift-leave/plan-ds1-deploy-line-b.md`。

## 指令

```bash
npm test                 # 單元測試（不需 DB）
npm run lint             # ESLint 檢查（僅報告，不自動修復）
npm run build            # TypeScript 建置
npm run prisma:migrate   # 開發用 migrate
```

### ESLint

- 設定檔：`eslint.config.js`（ESLint 9+ flat config；針對 Node／Fastify／Vitest）
- 涵蓋：`src/**/*.ts`、`prisma/**/*.ts`、`tests/**/*.ts`；忽略 `dist`、`node_modules`、`prisma/migrations`
- **不要**直接複製 `frontend/eslint.config.js`（前端含 React 插件與 `globals.browser`）
- 必要 devDependencies：`eslint`、`@eslint/js`、`typescript-eslint`、`globals`（套件名為複數 `globals`，不是 `global`）
- 依賴已列入 `package.json`；`npm install` 後即可 `npm run lint`

## 契約與實作範圍

API 路徑以 `specs/002-attendance-account-shift-leave/contracts/openapi.yaml` 為準。

| Phase | 路徑（摘要） |
|-------|----------------|
| B1 | `/api/auth/*`、`/api/me`、`/api/admin/employees` |
| B2 | `/api/admin/shifts*`、`/api/computation-context` |
| B3 | `/api/attendance/import`、`/api/attendance` |
| B4 | `/api/leave/calendar`、`/api/admin/gov-calendar/sync` |
| B5 | `/api/work-locations` |
