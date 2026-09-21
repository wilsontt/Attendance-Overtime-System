import React, { useState } from 'react';
import AdminEmployeesPage from './AdminEmployeesPage';
import AdminShiftsPage from './AdminShiftsPage';
import AdminGovCalendarPage from './AdminGovCalendarPage';

type AdminTab = 'employees' | 'shifts' | 'gov-calendar';

const tabClass = (active: boolean) =>
  active
    ? 'rounded border-2 border-slate-900 bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white'
    : 'rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50';

const AdminHubPage: React.FC = () => {
  const [tab, setTab] = useState<AdminTab>('employees');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Admin 管理</h1>
        <p className="text-sm text-slate-600">
          員工帳號、班表／派班、政府辦公日曆同步
        </p>
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin 分頁">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'employees'}
          className={tabClass(tab === 'employees')}
          onClick={() => setTab('employees')}
        >
          員工帳號
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'shifts'}
          className={tabClass(tab === 'shifts')}
          onClick={() => setTab('shifts')}
        >
          班表與派班
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'gov-calendar'}
          className={tabClass(tab === 'gov-calendar')}
          onClick={() => setTab('gov-calendar')}
        >
          政府辦公日曆
        </button>
      </div>

      {tab === 'employees' ? <AdminEmployeesPage /> : null}
      {tab === 'shifts' ? <AdminShiftsPage /> : null}
      {tab === 'gov-calendar' ? <AdminGovCalendarPage /> : null}
    </div>
  );
};

export default AdminHubPage;
