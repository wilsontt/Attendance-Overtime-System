/**
 * 伺服器正式匯入（需已登入）：寫入出勤台帳並回沖區間年假。
 * 與本機公開上傳（僅前端計算）分開。
 */

import { useId, useState, type ChangeEvent, type ReactElement } from 'react';
import { ApiError } from '../api/client';
import {
  importAttendanceFile,
  type AttendanceImportResult,
} from '../api/attendance';

type ServerImportPanelProps = {
  loggedIn: boolean;
};

export function ServerImportPanel({
  loggedIn,
}: ServerImportPanelProps): ReactElement | null {
  const inputId = useId();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [lastResult, setLastResult] = useState<AttendanceImportResult | null>(
    null,
  );

  if (!loggedIn) {
    return null;
  }

  const onFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setBusy(true);
    setError('');
    setMessage('');
    setLastResult(null);
    try {
      const result = await importAttendanceFile(file);
      setLastResult(result);
      setMessage(
        `已匯入 ${result.employeeId}：${result.dateFrom}～${result.dateTo}，共 ${result.importedCount} 列`,
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message);
      } else {
        setError('無法連線後端，請確認 API 已啟動');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mb-5 rounded border border-slate-300 bg-slate-50 p-4 space-y-2">
      <h2 className="font-semibold text-slate-800">伺服器正式匯入</h2>
      <p className="text-sm text-slate-600">
        寫入出勤台帳並依區間回沖年假（需登入）。本機上傳計算加班單請用上方檔案選擇，兩者分開。
      </p>
      <div>
        <label
          htmlFor={inputId}
          className={`inline-block cursor-pointer rounded border border-blue-700 bg-white px-3 py-1.5 text-sm text-blue-700 ${busy ? 'opacity-60 pointer-events-none' : ''}`}
        >
          {busy ? '匯入中…' : '選擇 CSV／TXT 正式匯入'}
        </label>
        <input
          id={inputId}
          type="file"
          accept=".csv,.txt,text/csv,text/plain"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            void onFileChange(e);
          }}
        />
      </div>
      {message ? <p className="text-sm text-green-700">{message}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {lastResult?.unknownLeaveTypes.length ? (
        <p className="text-sm text-amber-800">
          未知假別（已寫入打卡、未扣年假）：
          {lastResult.unknownLeaveTypes.join('、')}
        </p>
      ) : null}
      {lastResult?.quotaAfter?.length ? (
        <ul className="text-sm text-slate-700 list-disc pl-5">
          {lastResult.quotaAfter.map((q) => (
            <li key={q.year}>
              {q.year} 年假：額度 {q.quotaDays}、已請 {q.usedDays}、剩餘{' '}
              {q.remainingDays}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
