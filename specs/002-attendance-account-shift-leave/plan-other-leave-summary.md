# 其他假別摘要 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 讓清單外考勤別（如颱風假）可解析、全日免缺卡補登，並在假勤摘要固定顯示「其他假別」卡與含假別欄的明細。

**Architecture:** 後端 `summarizeLeaveQuantities` 加總未知假別為 `otherLeave.usedDays`；前端 TXT／CSV 對齊未知假別解析；行事曆摘要多一張固定卡，明細以「非 §7.6 清單」過濾並顯示假別欄。正式 `leaveTotals`／公假不加總颱風假。

**Tech Stack:** Fastify／Prisma／Vitest（backend）；React／Vite／Vitest（frontend）；OpenAPI YAML。

**Spec:** `specs/002-attendance-account-shift-leave/design-other-leave-summary.md`（已核准）

## Global Constraints

- 正體中文 UI 文案；假別名稱「其他假別」固定字串。
- §7.6 正式清單不新增颱風假：`請年休假`、`病假`、`婚假`、`產假`、`育嬰假`、`事假`、`公假`、`喪假`。
- 未知判定＝非空且不在正式清單（對齊 `isUnknownLeaveType`）。
- 全天＝`leaveQuantity >= 1` 略過缺卡；部分（`< 1`）仍須補登。
- TypeScript 禁用 `any`；async/await。
- **勿自動 git commit**（除非使用者明確要求）。

## Review Focus

1. `颱風假/1日` 無實刷 → 解析後主列表不擋缺卡補登。
2. `颱風假/0.5日` 無實刷 → 仍擋預覽（須補登）。
3. 颱風假天數**不**出現在公假 `leaveTotals` 卡。
4. 「其他假別」卡無資料仍顯示 `0 天`；明細無列時文案「本年度無其他假別紀錄」。
5. 明細列同時有「颱風假」與另一未知假別時，假別欄可區分。

---

## File map

| File | Responsibility |
|------|----------------|
| `backend/src/modules/calendar/leaveSummary.ts` | `otherLeave.usedDays` 加總 |
| `backend/tests/leaveSummary.test.ts` | 摘要單元測試 |
| `backend/tests/attendanceImport.test.ts` 或新增 TXT 測 | `颱風假/1日` 解析 |
| `specs/.../contracts/openapi.yaml` | `LeaveSummaryResponse.otherLeave` |
| `frontend/src/constants/leaveTypes.ts` | 前端正式清單＋`isUnknownLeaveType` |
| `frontend/src/services/txtParser.ts` | 未知假別解析 |
| `frontend/tests/services/txtParser.test.ts` | 颱風假案例 |
| `frontend/src/components/FileUploader.tsx` | CSV 允許未知＋回報 |
| `frontend/src/api/leaveCalendar.ts` | 型別 `otherLeave` |
| `frontend/src/pages/LeaveCalendarPage.tsx` | 其他假別卡＋明細欄／過濾 |
| `specs/.../出勤記錄-擴充需求3_prd.md` | §5.5.1／§7.8 覆寫「未知不另列」 |
| `specs/.../STATUS.md`、`design-other-leave-summary.md` | 狀態同步 |

---

### Task 1: Backend leave summary `otherLeave`

**Files:**
- Modify: `backend/src/modules/calendar/leaveSummary.ts`
- Modify: `backend/tests/leaveSummary.test.ts`
- Modify: `specs/002-attendance-account-shift-leave/contracts/openapi.yaml`（`LeaveSummaryResponse`）

**Interfaces:**
- Consumes: `LeaveQuantityRow`（既有 `unknownLeaveType`）
- Produces:
  ```ts
  export type LeaveSummaryTotals = {
    annualLeave: { quotaDays: number; usedDays: number; remainingDays: number };
    leaveTotals: Array<{ leaveType: string; usedDays: number }>;
    otherLeave: { usedDays: number };
  };
  ```
  - `otherLeave.usedDays`＝所有 `unknownLeaveType === true` 列之 `leaveQuantity` 加總；無則 `0`
  - `leaveTotals` 仍忽略未知（公假等不變）

- [x] **Step 1: 寫失敗測試**

在 `leaveSummary.test.ts` 將既有「ignores unknown」改為／新增：

```ts
it('sums unknown leave into otherLeave and keeps leaveTotals free of unknown', () => {
  const result = summarizeLeaveQuantities(
    [
      { attendanceType: '請年休假', leaveQuantity: 1, unknownLeaveType: false },
      { attendanceType: '事假', leaveQuantity: 1, unknownLeaveType: false },
      { attendanceType: '特休', leaveQuantity: 2, unknownLeaveType: true },
      { attendanceType: '颱風假', leaveQuantity: 1, unknownLeaveType: true },
      { attendanceType: '颱風假', leaveQuantity: 0.5, unknownLeaveType: true },
      { attendanceType: null, leaveQuantity: 0, unknownLeaveType: false },
    ],
    14,
  );
  expect(result.otherLeave).toEqual({ usedDays: 3.5 });
  expect(result.leaveTotals.find((t) => t.leaveType === '公假')?.usedDays).toBe(0);
  expect(result.leaveTotals.find((t) => t.leaveType === '事假')?.usedDays).toBe(1);
});
```

並修正舊測試：預期物件須含 `otherLeave: { usedDays: 2 }`（對應原「特休 2」案例）或拆成上列新測。

- [x] **Step 2: 跑測確認失敗**

Run: `cd backend && npm test -- --run tests/leaveSummary.test.ts`  
Expected: FAIL（缺 `otherLeave` 或 usedDays 不符）

- [x] **Step 3: 實作 `summarizeLeaveQuantities` 回傳 `otherLeave`**

對 `row.unknownLeaveType` 為 true 者加總 `leaveQuantity`；OpenAPI `LeaveSummaryResponse` 加 required `otherLeave`（`usedDays: number`），description：該曆年未知假別數量加總，未出現為 0。

- [x] **Step 4: 跑測確認通過**

Run: `cd backend && npm test -- --run tests/leaveSummary.test.ts`  
Expected: PASS

---

### Task 2: Frontend TXT／CSV 未知假別解析

**Files:**
- Create: `frontend/src/constants/leaveTypes.ts`
- Modify: `frontend/src/services/txtParser.ts`
- Modify: `frontend/tests/services/txtParser.test.ts`
- Modify: `frontend/src/components/FileUploader.tsx`

**Interfaces:**
- Consumes: 無
- Produces:
  ```ts
  // frontend/src/constants/leaveTypes.ts
  export const KNOWN_LEAVE_TYPES = [
    '請年休假', '病假', '婚假', '產假', '育嬰假', '事假', '公假', '喪假',
  ] as const;
  export function isUnknownLeaveType(attendanceType: string | null | undefined): boolean;
  ```
  - `txtParser`：先匹配正式清單 `假別/n日`；否則 `([\u4e00-\u9fa5]{1,10})/(\d+(?:\.\d+)?)日`，排除 `上班`／`下班`
  - CSV：不因未知假別 throw；可選 callback／回傳告知未知名稱供 HomePage 提示（最小：console 或既有提示區；若 FileUploader 僅 `onUpload`，在解析後對未知名稱 `alert` 一次列出即可）

- [x] **Step 1: 寫失敗測試（TXT 颱風假）**

```ts
it('parses 颱風假/1日 with empty punches as leave without clocks', () => {
  const content = `
員工姓名               歸屬日期/班別      考勤別/數量/備註/日期時間起迄                             標準時間             刷卡日期 時間  主管核定
================================================================================================================================================
100057 鄒東良          1151023/1          颱風假/1日//1151023  - 1151023                            上班/1023 09:00                       異常
                                                                                                    下班/1023 18:00                       異常
                        -------------------------------------------------------------------------------------------------------------------------
`;
  const records = parseTxtContent(content);
  expect(records).toHaveLength(1);
  expect(records[0].attendanceType).toBe('颱風假');
  expect(records[0].leaveQuantity).toBe(1);
  expect(records[0].clockIn).toBe('');
  expect(records[0].clockOut).toBe('');
});
```

- [x] **Step 2: 跑測確認失敗**

Run: `cd frontend && npx vitest run tests/services/txtParser.test.ts`  
Expected: FAIL（attendanceType 空）

- [x] **Step 3: 實作 `leaveTypes.ts`＋改 `txtParser` 未知假別後備；CSV 允許未知**

正式清單 regex 與後端一致（含婚假等）。FileUploader 移除「不在白名單則 throw」；空白／「空」仍視為無假。

- [x] **Step 4: 跑測確認通過**

Run: `cd frontend && npx vitest run tests/services/txtParser.test.ts`  
Expected: PASS

---

### Task 3: 假勤摘要「其他假別」卡與明細

**Files:**
- Modify: `frontend/src/api/leaveCalendar.ts`
- Modify: `frontend/src/pages/LeaveCalendarPage.tsx`

**Interfaces:**
- Consumes: `LeaveSummaryResponse.otherLeave.usedDays`（Task 1 API）；`isUnknownLeaveType`（Task 2）
- Produces: UI 行為
  - `LeaveDetailTarget` 擴充：
    ```ts
    type LeaveDetailTarget = {
      displayName: string;
      year: number;
      employeeId: string;
      kind: 'typed' | 'other';
      /** kind==='typed' 時必填 */
      attendanceType?: string;
    };
    ```
  - `kind==='other'`：過濾 `isUnknownLeaveType(item.attendanceType) && item.leaveQuantity > 0`
  - 明細欄：typed 維持歸屬日期／數量／上班／下班；**other 多一欄「假別」**（`attendanceType`）
  - emptyState：other 用「本年度無其他假別紀錄」；typed 維持「本年度無此假別紀錄」
  - 卡片：在 `leaveTotals.map` 之後固定一顆「其他假別」，顯示 `{summary.otherLeave.usedDays} 天`

- [x] **Step 1: 更新 `LeaveSummaryResponse` 型別含 `otherLeave: { usedDays: number }`**

- [x] **Step 2: 實作卡片、過濾、`DETAIL_COLUMNS`／條件欄、emptyState**

說明文字改為：正式假別未出現顯示 0；其他假別為清單外考勤加總。註解「8 卡片」改為含其他假別。

- [x] **Step 3: 型別檢查**

Run: `cd frontend && npx tsc -b --pretty false`（或專案既有 `npm run build` 之 tsc 步驟）  
Expected: 無因 `otherLeave` 缺失之錯誤

---

### Task 4: 文件同步

**Files:**
- Modify: `specs/002-attendance-account-shift-leave/出勤記錄-擴充需求3_prd.md`（§5.5.1、§7.8、附錄／狀態句「未知不另列」→ 固定「其他假別」卡）
- Modify: `specs/002-attendance-account-shift-leave/STATUS.md`
- Modify: `specs/002-attendance-account-shift-leave/design-other-leave-summary.md`（狀態→已核准／已實作）
- Modify: `specs/002-attendance-account-shift-leave/data-model.md`（若有 LeaveSummary 描述）

- [x] **Step 1: 更新 PRD §5.5.1／§7.8：其他假別卡＋明細含假別欄；覆寫「未知不另列」**

- [x] **Step 2: STATUS 記一筆完成項；design 核准勾選與狀態更新**

- [x] **Step 3: 全後端相關測再跑一次**

Run: `cd backend && npm test -- --run tests/leaveSummary.test.ts`  
Run: `cd frontend && npx vitest run tests/services/txtParser.test.ts`  
Expected: PASS

---

## Self-review (plan author)

| Spec 要求 | Task |
|-----------|------|
| TXT 認颱風假等 | Task 2 |
| CSV 可匯入未知＋不整檔拒絕 | Task 2 |
| 全日免缺卡（靠解析成功） | Task 2（既有 HomePage 邏輯） |
| `otherLeave.usedDays` API | Task 1 |
| 固定「其他假別」卡＋明細假別欄 | Task 3 |
| 不併公假 | Task 1 測試 |
| 文件／OpenAPI | Task 1、4 |

Review Focus 1–2 由 Task 2 解析＋既有 `leaveQuantity>=1` 行為覆蓋；若實作後需回歸，可另加 HomePage 單元測（本 plan 不強制，避免擴大範圍）。
