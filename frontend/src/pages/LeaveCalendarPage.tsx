/**
 * 請假行事曆主內容（顯示於共用導覽列下方；B4 完整資料尚未接上）。
 */

import type { ReactElement } from 'react';
import type { MeResponse } from '../api/auth';

type LeaveCalendarPageProps = {
  user: MeResponse;
};

function LeaveCalendarPage({ user }: LeaveCalendarPageProps): ReactElement {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold text-slate-800">請假行事曆</h1>
      <p className="text-sm text-slate-600">
        目前登入：{user.employeeId} {user.name}（
        {user.role === 'admin' ? 'Admin' : '員工'}）
      </p>
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-slate-700 space-y-2">
        <p>已登入，可查看行事曆內容。</p>
        <p className="text-sm text-slate-500">
          請假列、國定／補班標示將於線 B 的 B4（政府日曆＋
          <code className="mx-1">GET /api/leave/calendar</code>
          ）接上後顯示於此。員工僅見本人；Admin 可改選員工。
        </p>
      </div>
    </div>
  );
}

export default LeaveCalendarPage;
