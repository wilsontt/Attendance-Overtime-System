/**
 * 請假行事曆：顯示國定／補班與個人請假（GET /api/leave/calendar）。
 */

import {
  useCallback,
  useEffect,
  useState,
  type ReactElement,
} from 'react';
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

const DAY_TYPE_LABEL: Record<LeaveCalendarDay['dayType'], string> = {
  weekday: '平日',
  rest_day: '休息日',
  holiday: '例假／國定',
  make_up: '補班',
};

const EMPLOYEE_ID_PATTERN = /^\d{6}$/;

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

  const notableDays = days.filter(
    (d) =>
      d.leaveType ||
      d.dayType === 'holiday' ||
      d.dayType === 'make_up' ||
      Boolean(d.govName),
  );

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
          <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
            <div className="rounded bg-slate-50 px-2 py-1">
              <dt className="text-slate-500">年假</dt>
              <dd className="font-medium">
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
              </dd>
            </div>
            {summary.leaveTotals.map((item) => (
              <div key={item.leaveType} className="rounded bg-slate-50 px-2 py-1">
                <dt className="text-slate-500">{item.leaveType}</dt>
                <dd className="font-medium">{item.usedDays} 天</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-slate-500">
            僅統計已寫入伺服器的請假；未出現的假別顯示 0。
          </p>
        </section>
      ) : null}

      <div className="overflow-x-auto rounded border border-slate-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-100 text-left">
            <tr>
              <th className="p-2 border-b">日期</th>
              <th className="p-2 border-b">日類型</th>
              <th className="p-2 border-b">假別</th>
              <th className="p-2 border-b">數量</th>
              <th className="p-2 border-b">備註／國定名稱</th>
            </tr>
          </thead>
          <tbody>
            {notableDays.length === 0 && !loading ? (
              <tr>
                <td className="p-3 text-slate-500" colSpan={5}>
                  {isAdmin && !EMPLOYEE_ID_PATTERN.test(employeeId)
                    ? error
                      ? '—'
                      : '請輸入員工編號後按查詢。'
                    : '本月尚無請假或國定／補班標示。若政府日曆未同步，Admin 可按上方同步；失敗時加班單仍可手勾「加到平日加班」。'}
                </td>
              </tr>
            ) : (
              notableDays.map((d) => (
                <tr key={d.date} className="odd:bg-white even:bg-slate-50">
                  <td className="p-2 border-b font-mono">{d.date}</td>
                  <td className="p-2 border-b">{DAY_TYPE_LABEL[d.dayType]}</td>
                  <td className="p-2 border-b">{d.leaveType ?? '—'}</td>
                  <td className="p-2 border-b">
                    {d.leaveQuantity != null ? d.leaveQuantity : '—'}
                  </td>
                  <td className="p-2 border-b">{d.govName ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LeaveCalendarPage;
