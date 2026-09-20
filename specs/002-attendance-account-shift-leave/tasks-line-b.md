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
- [x] Admin CRUD `/api/admin/employees`（年假額度、Admin 保護；舊版必填 pin → B6 移除）
- [x] 單元測試：登入鎖定邏輯／密碼雜湊（整合測試用本機 SQLite）
- [x] 前端：LoginPage、App lazy auth、API client、Vite proxy
- [x] **規格變更已實作**：首頁公開；請假行事曆／Admin 才要 session（PRD §5.3.1）
- [x] **B6**：員工管理 UI＋圖形驗證碼登入（見下方 B6）

## B2 班表 + 派班 + 計算脈絡

- [x] Shift／ShiftAssignment CRUD（刪除／停用規則）
- [x] `GET /api/computation-context`
- [x] 前端：Admin 班表／派班頁；HomePage 本機班表標為除錯降級
- [x] 單元測試：停用／刪除規則、日類型推導（整合用本機 SQLite）

## B3 匯入 + 年假回沖

- [x] 後端 TXT／CSV 解析 + `POST /api/attendance/import` 交易（**需 session**）
- [x] `GET /api/attendance`
- [x] 員工非本人 403；未知假別標記；年假加總／可負
- [x] 前端：本機公開上傳維持；伺服器正式匯入面板（需登入）
- [x] 前端：本機上傳「同時寫入伺服器」勾選（預設勾選）；未登入導向登入後自動匯入；失敗保留本機列表
- [x] 前端：下方面板文案改為「補單／重匯」
- [x] 單元測試：解析／未知假別／重匯年假語意（跨年分年）；整合用本機 SQLite

## B4 行事曆 + 政府日曆

- [x] 同步 dataset/14718 + 啟動時／每日背景同步 + 手動 sync API
- [x] `GET /api/leave/calendar`
- [x] 前端 LeaveCalendarPage 接 API；Admin 可選員工、可手動同步
- [x] 同步失敗不阻斷主流程（仍可手勾補班）；單元測試：CSV 對應／選年 URL

## B5 詞庫 + 部署銜接

- [x] `GET/POST /api/work-locations`
- [x] PreviewModal 自動完成＋確認下載時入庫（需登入）
- [x] Docker Compose（api＋SQLite 掛卷；`--profile full` 含 web＋`/attendance/api/` 反代）；本機開發零 Docker
- [x] README／CLAUDE／backend README 補線 B 依賴與契約路徑

## B6 Admin UI＋圖形驗證碼（下一步｜2026-09-20 規格已定）

對齊教育訓練：登入用**圖形驗證碼**，不發放入庫 PIN。

- [x] 頂欄「Admin 管理」殼層：分頁或子選單 — **員工帳號**｜**班表與派班**｜**政府辦公日曆**
- [x] `AdminEmployeesPage`：列表／建立／停用／年假額度（**無** PIN 欄／重設 PIN）
- [x] 後端：`GET /api/auth/captcha`；登入改 `captchaId`＋`captchaAnswer`；員工／Admin 皆驗證碼；Admin 另驗密碼；建立員工移除必填 `pin`
- [x] 前端 LoginPage：顯示驗證碼圖、可重新取圖；拿掉「4 碼 PIN」長期密鑰欄位語意
- [x] OpenAPI／data-model／seed 文件同步（`ADMIN_SEED_PIN` 不作為登入因子）
- [x] 政府日曆：Admin 殼層內手動 sync＋顯示結果
- [x] 驗收：建員工（無 PIN）→ 員工以編號＋圖形驗證碼登入 → 正式匯入該編號成功

## 完成定義（線 B）

對照 PLAN「驗收對照（線 B）」全部勾選；B6 完成後線 B 前端 Admin 缺口關閉。
