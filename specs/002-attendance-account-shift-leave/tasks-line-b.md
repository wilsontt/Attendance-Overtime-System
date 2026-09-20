# Tasks：擴充需求 3／線 B

**Input**: [plan-line-b-backend-auth-leave.md](./plan-line-b-backend-auth-leave.md)、[contracts/openapi.yaml](./contracts/openapi.yaml)、[data-model.md](./data-model.md)、[research.md](./research.md)  
**Branch**: `feature/002-line-b-backend-auth-leave`

## B0 Design／契約

- [x] B0-1 `contracts/openapi.yaml`
- [x] B0-2 `data-model.md`
- [x] B0-3 `research.md`
- [x] 本 tasks 文件

## B1 Auth + 員工主檔

- [x] 建立 `backend/`（Fastify 5、TypeScript、Prisma 6、Vitest）
- [x] Prisma schema（完整線 B 模型）+ init migration + seed Admin／兩班
- [x] `POST /api/auth/login`｜`logout`｜`GET /api/me`（Cookie session、bcrypt、鎖定）
- [x] Admin CRUD `/api/admin/employees`（PIN、年假額度、Admin 保護）
- [x] 單元測試：登入鎖定邏輯／密碼雜湊（整合測試待 Docker DB）
- [x] 前端：LoginPage、App lazy auth、API client、Vite proxy
- [x] **規格變更已實作**：首頁公開；請假行事曆／Admin 班表才要 session（PRD §5.3.1）

## B2 班表 + 派班 + 計算脈絡

- [x] Shift／ShiftAssignment CRUD（刪除／停用規則）
- [x] `GET /api/computation-context`
- [x] 前端：Admin 班表／派班頁；HomePage 本機班表標為除錯降級
- [x] 單元測試：停用／刪除規則、日類型推導（整合測試待 Docker DB）

## B3 匯入 + 年假回沖

- [x] 後端 TXT／CSV 解析 + `POST /api/attendance/import` 交易（**需 session**）
- [x] `GET /api/attendance`
- [x] 員工非本人 403；未知假別標記；年假加總／可負
- [x] 前端：本機公開上傳維持；伺服器正式匯入面板（需登入）
- [x] 單元測試：解析／未知假別／重匯年假語意（跨年分年）；整合測試待 Docker DB

## B4 行事曆 + 政府日曆

- [ ] 同步 dataset/14718 + 排程／手動 sync API
- [ ] `GET /api/leave/calendar`
- [ ] 前端：首頁明確「行事曆」入口；未登入點入 → LoginPage → LeaveCalendarPage
- [ ] 補班優先 gov、失敗可手勾；同步失敗不阻斷主流程

## B5 詞庫 + 部署銜接

- [ ] `GET/POST /api/work-locations`
- [ ] PreviewModal 自動完成＋入庫
- [ ] Docker Compose（db + api）+ Nginx `/attendance/api/`
- [ ] README／CLAUDE 補線 B 依賴與契約路徑

## 完成定義（線 B）

對照 PLAN「驗收對照（線 B）」全部勾選，且後端整合測試通過。
