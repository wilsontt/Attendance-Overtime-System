import React, { useState } from 'react';
import { ApiError } from '../api/client';
import { syncGovCalendar } from '../api/leaveCalendar';

const AdminGovCalendarPage: React.FC = () => {
  const [year, setYear] = useState(new Date().getFullYear());
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const onSync = async (syncYear?: number) => {
    setSyncing(true);
    setError('');
    setInfo('');
    try {
      const result = await syncGovCalendar(syncYear);
      setInfo(
        `已同步：${result.years.join('、')} 年，寫入 ${result.upsertedCount} 筆（來源 ${result.source}）`,
      );
    } catch (err) {
      setError(
        err instanceof ApiError
          ? `${err.body.message}（加班單仍可手勾補班）`
          : '同步失敗（加班單仍可手勾補班）',
      );
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-bold text-slate-800">政府辦公日曆</h2>
      <p className="text-sm text-slate-600">
        自政府資料開放平臺 dataset/14718 下載當前年／次年 CSV 寫入本機 SQLite。
        後端啟動與每日亦會背景同步；此處可手動觸發。
      </p>
      <div className="flex flex-wrap items-end gap-3 rounded border bg-white p-4">
        <label className="text-sm">
          指定西元年（可空白＝當年＋次年）
          <input
            type="number"
            className="mt-1 block border rounded px-2 py-1 w-28"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          />
        </label>
        <button
          type="button"
          className="rounded bg-slate-800 px-3 py-2 text-sm text-white disabled:opacity-60"
          disabled={syncing}
          onClick={() => {
            void onSync(year);
          }}
        >
          {syncing ? '同步中…' : '同步指定年'}
        </button>
        <button
          type="button"
          className="rounded border border-slate-400 px-3 py-2 text-sm disabled:opacity-60"
          disabled={syncing}
          onClick={() => {
            void onSync(undefined);
          }}
        >
          同步當年＋次年
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {info ? <p className="text-sm text-green-700">{info}</p> : null}
    </div>
  );
};

export default AdminGovCalendarPage;
