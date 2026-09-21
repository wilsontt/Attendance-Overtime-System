/**
 * 請假行事曆：顯示國定／補班與個人請假（GET /api/leave/calendar）。
 * 月表與假別明細 Modal 使用 @shared-ui/data-table；假勤摘要維持卡片（點卡片開明細）。
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from 'react';
import {
  PaginatedDataTable,
  type DataTableColumn,
} from '@shared-ui/data-table';
import {
  listAttendance,
  type AttendanceDay,
} from '../api/attendance';
import type { MeResponse } from '../api/auth';
import { ApiError } from '../api/client';
import {
  fetchLeaveCalendar,
  fetchLeaveSummary,
  syncGovCalendar,
  type LeaveCalendarDay,
  type LeaveSummaryResponse,
} from '../api/leaveCalendar';

type LeaveCalendarPageProps = {
  user: MeResponse;
};

/** 明細 Modal 開啟目標：顯示名稱與台帳假別過濾值可分開（年假卡片）。 */
type LeaveDetailTarget = {
  displayName: string;
  attendanceType: string;
  year: number;
  /** 與當次摘要查詢綁定的員工編號（Admin 不可用輸入框即時值，避免漂移）。 */
  employeeId: string;
};

const DAY_TYPE_LABEL: Record<LeaveCalendarDay['dayType'], string> = {
  weekday: '平日',
  rest_day: '休息日',
  holiday: '例假／國定',
  make_up: '補班',
};

const EMPLOYEE_ID_PATTERN = /^\d{6}$/;
const ANNUAL_LEAVE_TYPE = '請年休假';

function LeaveCalendarPage({ user }: LeaveCalendarPageProps): ReactElement {
  const now = new Date();
  const isAdmin = user.role === 'admin';
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [employeeId, setEmployeeId] = useState(
    isAdmin ? '' : user.employeeId,
  );
  const [days, setDays] = useState<LeaveCalendarDay[]>([]);
  const [summary, setSummary] = useState<LeaveSummaryResponse | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [detailTarget, setDetailTarget] = useState<LeaveDetailTarget | null>(
    null,
  );
  const [detailItems, setDetailItems] = useState<AttendanceDay[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  /** 遞增以作廢在途明細請求（關閉或連點另一張卡片）。 */
  const detailRequestIdRef = useRef(0);

  const reload = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const employeeQuery = isAdmin ? employeeId : undefined;
      const [calendar, leaveSummary] = await Promise.all([
        fetchLeaveCalendar({
          year,
          month,
          employeeId: employeeQuery,
        }),
        fetchLeaveSummary({
          year,
          employeeId: employeeQuery,
        }),
      ]);
      setDays(calendar.days);
      setSummary(leaveSummary);
    } catch (err) {
      setDays([]);
      setSummary(null);
      setError(err instanceof ApiError ? err.body.message : '載入行事曆失敗');
    } finally {
      setLoading(false);
    }
  }, [year, month, employeeId, isAdmin]);

  useEffect(() => {
    if (isAdmin) {
      return;
    }
    void reload();
  }, [isAdmin, reload]);

  const onQuery = () => {
    if (isAdmin && !EMPLOYEE_ID_PATTERN.test(employeeId)) {
      setDays([]);
      setSummary(null);
      setError('請輸入員工編號後按查詢');
      return;
    }
    void reload();
  };

  const onSync = async () => {
    setSyncing(true);
    setInfo('');
    setError('');
    try {
      const result = await syncGovCalendar(year);
      setInfo(
        `已同步政府日曆：${result.years.join('、')} 年，寫入 ${result.upsertedCount} 筆`,
      );
      if (!isAdmin || EMPLOYEE_ID_PATTERN.test(employeeId)) {
        await reload();
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.body.message}（仍可於加班單手勾「加到平日加班」）`
          : '同步失敗（仍可手勾補班）',
      );
    } finally {
      setSyncing(false);
    }
  };

  const notableDays = useMemo(
    () =>
      days.filter(
        (d) =>
          d.leaveType ||
          d.dayType === 'holiday' ||
          d.dayType === 'make_up' ||
          Boolean(d.govName),
      ),
    [days],
  );

  const closeLeaveDetail = () => {
    detailRequestIdRef.current += 1;
    setDetailTarget(null);
    setDetailItems([]);
    setDetailError('');
    setDetailLoading(false);
  };

  const openLeaveDetail = async (target: LeaveDetailTarget) => {
    const requestId = detailRequestIdRef.current + 1;
    detailRequestIdRef.current = requestId;
    setDetailTarget(target);
    setDetailLoading(true);
    setDetailError('');
    setDetailItems([]);
    try {
      const result = await listAttendance({
        dateFrom: `${target.year}-01-01`,
        dateTo: `${target.year}-12-31`,
        ...(isAdmin ? { employeeId: target.employeeId } : {}),
      });
      if (requestId !== detailRequestIdRef.current) {
        return;
      }
      const filtered = result.items
        .filter(
          (item) =>
            item.attendanceType === target.attendanceType &&
            item.leaveQuantity > 0,
        )
        .sort((a, b) => a.belongDate.localeCompare(b.belongDate));
      setDetailItems(filtered);
    } catch (err) {
      if (requestId !== detailRequestIdRef.current) {
        return;
      }
      setDetailError(
        err instanceof ApiError ? err.body.message : '載入請假明細失敗',
      );
    } finally {
      if (requestId === detailRequestIdRef.current) {
        setDetailLoading(false);
      }
    }
  };

  const calendarColumns = useMemo<DataTableColumn<LeaveCalendarDay>[]>(
    () => [
      {
        key: 'date',
        header: '日期',
        cellClassName: 'font-mono',
        accessor: (row) => row.date,
      },
      {
        key: 'dayType',
        header: '日類型',
        accessor: (row) => DAY_TYPE_LABEL[row.dayType],
      },
      {
        key: 'leaveType',
        header: '假別',
        accessor: (row) => row.leaveType ?? '—',
      },
      {
        key: 'leaveQuantity',
        header: '數量',
        accessor: (row) =>
          row.leaveQuantity != null ? String(row.leaveQuantity) : '—',
      },
      {
        key: 'govName',
        header: '備註／國定名稱',
        accessor: (row) => row.govName ?? '—',
      },
    ],
    [],
  );

  const detailColumns = useMemo<DataTableColumn<AttendanceDay>[]>(
    () => [
      {
        key: 'belongDate',
        header: '歸屬日期',
        cellClassName: 'font-mono',
        accessor: (row) => row.belongDate,
      },
      {
        key: 'leaveQuantity',
        header: '數量',
        accessor: (row) => String(row.leaveQuantity),
      },
      {
        key: 'clockIn',
        header: '上班',
        cellClassName: 'font-mono',
        accessor: (row) => row.clockIn ?? '—',
      },
      {
        key: 'clockOut',
        header: '下班',
        cellClassName: 'font-mono',
        accessor: (row) => row.clockOut ?? '—',
      },
    ],
    [],
  );

  const calendarEmptyState =
    isAdmin && !EMPLOYEE_ID_PATTERN.test(employeeId)
      ? error
        ? '—'
        : '請輸入員工編號後按查詢。'
      : '本月尚無請假或國定／補班標示。若政府日曆未同步，Admin 可按上方同步；失敗時加班單仍可手勾「加到平日加班」。';

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-800">請假行事曆</h1>
          <p className="text-sm text-slate-600">
            {user.employeeId} {user.name}（
            {isAdmin ? 'Admin' : '員工'}）
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            className="rounded border border-slate-400 bg-white px-3 py-1.5 text-sm disabled:opacity-60"
            disabled={syncing}
            onClick={() => {
              void onSync();
            }}
          >
            {syncing ? '同步中…' : '同步政府辦公日曆'}
          </button>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-3 items-end">
        <label className="text-sm">
          年
          <input
            type="number"
            className="ml-1 w-24 border rounded px-2 py-1"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <label className="text-sm">
          月
          <input
            type="number"
            min={1}
            max={12}
            className="ml-1 w-16 border rounded px-2 py-1"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          />
        </label>
        {isAdmin ? (
          <label className="text-sm">
            員工編號
            <input
              className="ml-1 w-28 border rounded px-2 py-1"
              value={employeeId}
              maxLength={6}
              onChange={(e) => setEmployeeId(e.target.value)}
            />
          </label>
        ) : null}
        <button
          type="button"
          className="rounded bg-blue-700 text-white px-3 py-1.5 text-sm"
          onClick={onQuery}
        >
          查詢
        </button>
      </div>

      {info ? <p className="text-sm text-green-700">{info}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {loading ? <p className="text-sm text-slate-500">載入中…</p> : null}

      {summary ? (
        <section className="rounded border border-slate-200 bg-white p-4 space-y-3">
          <h2 className="font-semibold text-slate-800">
            {summary.year} 年假勤摘要（民國 {summary.year - 1911} 年）
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <button
              type="button"
              className="rounded bg-slate-50 px-2 py-1 text-left hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              onClick={() => {
                void openLeaveDetail({
                  displayName: '年假',
                  attendanceType: ANNUAL_LEAVE_TYPE,
                  year: summary.year,
                  employeeId: summary.employeeId,
                });
              }}
            >
              <span className="block text-slate-500">年假</span>
              <span className="block font-medium">
                額度 {summary.annualLeave.quotaDays}／已請{' '}
                {summary.annualLeave.usedDays}／剩餘{' '}
                <span
                  className={
                    summary.annualLeave.remainingDays < 0
                      ? 'text-red-700 font-semibold'
                      : undefined
                  }
                >
                  {summary.annualLeave.remainingDays}
                </span>
              </span>
            </button>
            {summary.leaveTotals.map((item) => (
              <button
                key={item.leaveType}
                type="button"
                className="rounded bg-slate-50 px-2 py-1 text-left hover:bg-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                onClick={() => {
                  void openLeaveDetail({
                    displayName: item.leaveType,
                    attendanceType: item.leaveType,
                    year: summary.year,
                    employeeId: summary.employeeId,
                  });
                }}
              >
                <span className="block text-slate-500">{item.leaveType}</span>
                <span className="block font-medium">{item.usedDays} 天</span>
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">
            僅統計已寫入伺服器的請假；未出現的假別顯示 0。點擊卡片可查看該假別明細。
          </p>
        </section>
      ) : null}

      <div className="rounded border border-slate-200 bg-white p-2">
        <PaginatedDataTable
          adapter="tailwind"
          paginationMode="client"
          defaultPageSize={15}
          showPaginationWhenSinglePage
          columns={calendarColumns}
          data={notableDays}
          loading={loading}
          getRowKey={(row) => row.date}
          emptyState={calendarEmptyState}
          indexColumnHeader="項次"
          stripedEvenRows
        />
      </div>

      {detailTarget ? (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="leave-detail-title"
            className="mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-lg"
          >
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-5 py-4">
              <h3
                id="leave-detail-title"
                className="text-lg font-semibold text-slate-800"
              >
                {detailTarget.year} 年 · {detailTarget.displayName} 請假明細
              </h3>
              <button
                type="button"
                className="flex h-8 w-8 items-center justify-center text-3xl leading-none text-slate-500 hover:text-slate-800"
                aria-label="關閉"
                onClick={closeLeaveDetail}
              >
                ×
              </button>
            </div>
            <div className="space-y-3 overflow-y-auto px-5 py-4">
              {detailError ? (
                <p className="text-sm text-red-600">{detailError}</p>
              ) : null}
              <PaginatedDataTable
                adapter="tailwind"
                paginationMode="client"
                defaultPageSize={10}
                showPaginationWhenSinglePage
                columns={detailColumns}
                data={detailItems}
                loading={detailLoading}
                getRowKey={(row, index) => `${row.belongDate}-${index}`}
                emptyState="本年度無此假別紀錄"
                indexColumnHeader="項次"
                stripedEvenRows
              />
              <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-3">
                <button
                  type="button"
                  className="rounded border border-slate-400 px-3 py-2 text-sm"
                  onClick={closeLeaveDetail}
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default LeaveCalendarPage;
