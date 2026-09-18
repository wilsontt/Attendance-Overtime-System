# 出勤加班單系統 — 後端 API

對應規格：`specs/002-attendance-account-shift-leave/`（OpenAPI、data-model、PLAN 線 B）。

**ORM**：Prisma **6**（勿升到 Prisma 8 CLI，該版指令不相容本專案 migrate／generate 流程）。

## 啟動（本機）

1. 複製環境變數：`cp .env.example .env`
2. 啟動 PostgreSQL（專案根目錄，需 Docker daemon）：`docker compose up -d db`
3. 遷移與種子：
   ```bash
   npm run prisma:generate
   npx prisma migrate deploy
   npm run prisma:seed
   ```
4. 開發伺服器：`npm run dev` → `http://localhost:3000`

預設 Admin：`employeeId=000000`，密碼／PIN 見 `.env`（`ADMIN_SEED_PASSWORD`／`ADMIN_SEED_PIN`）。

## 指令

```bash
npm test          # 單元測試（不需 DB）
npm run build     # TypeScript 建置
npm run prisma:migrate   # 開發用 migrate
```

## 契約

API 路徑以 `specs/002-attendance-account-shift-leave/contracts/openapi.yaml` 為準。目前已實作 B1：`/api/auth/*`、`/api/me`、`/api/admin/employees`。
