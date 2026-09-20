/**
 * 請假行事曆頁（B4 完整資料尚未接上；先提供登入後可見的明確入口頁）。
 */

import type { ReactElement } from 'react';
import type { MeResponse } from '../api/auth';

type LeaveCalendarPageProps = {
  user: MeResponse;
  onBack: () => void;
  onLogout: () => void;
};

function LeaveCalendarPage({
  user,
  onBack,
  onLogout,
}: LeaveCalendarPageProps): ReactElement {
  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6">
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-xl font-bold text-slate-800">請假行事曆</h1>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-700">
              {user.employeeId} {user.name}（
              {user.role === 'admin' ? 'Admin' : '員工'}）
            </span>
            <button
              type="button"
              className="underline text-blue-700"
              onClick={onBack}
            >
              回加班單首頁
            </button>
            <button
              type="button"
              className="underline text-blue-700"
              onClick={() => {
                void onLogout();
              }}
            >
              登出
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-700 space-y-2">
          <p>已登入，可查看行事曆內容。</p>
          <p className="text-sm text-slate-500">
            請假列、國定／補班標示將於線 B 的 B4（政府日曆＋
            <code className="mx-1">GET /api/leave/calendar</code>
            ）接上後顯示於此。員工僅見本人；Admin 可改選員工。
          </p>
        </div>
      </div>
    </div>
  );
}

export default LeaveCalendarPage;
