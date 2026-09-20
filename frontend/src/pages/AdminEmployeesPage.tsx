import React, { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  createEmployee,
  getEmployee,
  listEmployees,
  updateEmployee,
  type Employee,
  type EmployeeDetail,
} from '../api/employees';

const AdminEmployeesPage: React.FC = () => {
  const [items, setItems] = useState<Employee[]>([]);
  const [selected, setSelected] = useState<EmployeeDetail | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [name, setName] = useState('');
  const [quotaYear, setQuotaYear] = useState(new Date().getFullYear());
  const [quotaDays, setQuotaDays] = useState(0);
  const [editName, setEditName] = useState('');
  const [editQuotaYear, setEditQuotaYear] = useState(new Date().getFullYear());
  const [editQuotaDays, setEditQuotaDays] = useState(0);

  const reload = useCallback(async () => {
    setError('');
    try {
      const result = await listEmployees(false);
      setItems(result.items);
    } catch (err) {
      setError(err instanceof ApiError ? err.body.message : '載入員工失敗');
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const openDetail = async (id: string) => {
    setError('');
    setInfo('');
    try {
      const detail = await getEmployee(id);
      setSelected(detail);
      setEditName(detail.name);
      const q = detail.quotas[0];
      setEditQuotaYear(q?.year ?? new Date().getFullYear());
      setEditQuotaDays(q?.quotaDays ?? 0);
    } catch (err) {
      setError(err instanceof ApiError ? err.body.message : '讀取員工失敗');
    }
  };

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setInfo('');
    try {
      const created = await createEmployee({
        employeeId,
        name,
        quotaYear,
        quotaDays,
      });
      setInfo(`已建立員工 ${created.employeeId} ${created.name}`);
      setEmployeeId('');
      setName('');
      await reload();
      setSelected(created);
    } catch (err) {
      setError(err instanceof ApiError ? err.body.message : '建立失敗');
    }
  };

  const onSaveDetail = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    setError('');
    setInfo('');
    try {
      const updated = await updateEmployee(selected.employeeId, {
        name: editName,
        quota: { year: editQuotaYear, quotaDays: editQuotaDays },
      });
      setSelected(updated);
      setInfo('已儲存');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.body.message : '儲存失敗');
    }
  };

  const onToggleActive = async () => {
    if (!selected) return;
    setError('');
    setInfo('');
    try {
      const updated = await updateEmployee(selected.employeeId, {
        isActive: !selected.isActive,
      });
      setSelected(updated);
      setInfo(updated.isActive ? '已啟用' : '已停用');
      await reload();
    } catch (err) {
      setError(err instanceof ApiError ? err.body.message : '更新狀態失敗');
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-bold text-slate-800">員工帳號</h2>
      <p className="text-sm text-slate-600">
        登入採圖形驗證碼，建帳不必發放 PIN。伺服器正式匯入前請先建立對應 6
        碼員工編號。
      </p>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {info ? <p className="text-sm text-green-700">{info}</p> : null}

      <form
        onSubmit={(e) => {
          void onCreate(e);
        }}
        className="rounded border bg-white p-4 space-y-3"
      >
        <h3 className="font-semibold">新增員工</h3>
        <div className="flex flex-wrap gap-3 items-end">
          <label className="text-sm">
            員工編號
            <input
              className="mt-1 block border rounded px-2 py-1"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              maxLength={6}
              required
            />
          </label>
          <label className="text-sm">
            姓名
            <input
              className="mt-1 block border rounded px-2 py-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </label>
          <label className="text-sm">
            年假年度
            <input
              type="number"
              className="mt-1 block border rounded px-2 py-1 w-24"
              value={quotaYear}
              onChange={(e) => setQuotaYear(Number(e.target.value))}
            />
          </label>
          <label className="text-sm">
            年假額度
            <input
              type="number"
              step="0.5"
              className="mt-1 block border rounded px-2 py-1 w-24"
              value={quotaDays}
              onChange={(e) => setQuotaDays(Number(e.target.value))}
            />
          </label>
          <button
            type="submit"
            className="rounded bg-slate-800 px-3 py-2 text-sm text-white"
          >
            建立
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="px-3 py-2">編號</th>
              <th className="px-3 py-2">姓名</th>
              <th className="px-3 py-2">角色</th>
              <th className="px-3 py-2">狀態</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody>
            {items.map((row) => (
              <tr key={row.employeeId} className="border-t">
                <td className="px-3 py-2 font-mono">{row.employeeId}</td>
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2">{row.role}</td>
                <td className="px-3 py-2">
                  {row.isActive ? '啟用' : '停用'}
                </td>
                <td className="px-3 py-2">
                  <button
                    type="button"
                    className="underline text-blue-700"
                    onClick={() => {
                      void openDetail(row.employeeId);
                    }}
                  >
                    編輯
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected ? (
        <form
          onSubmit={(e) => {
            void onSaveDetail(e);
          }}
          className="rounded border bg-white p-4 space-y-3"
        >
          <h3 className="font-semibold">
            編輯 {selected.employeeId}（{selected.role}）
          </h3>
          <label className="block text-sm">
            姓名
            <input
              className="mt-1 w-full max-w-sm border rounded px-2 py-1"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              required
            />
          </label>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="text-sm">
              年假年度
              <input
                type="number"
                className="mt-1 block border rounded px-2 py-1 w-24"
                value={editQuotaYear}
                onChange={(e) => setEditQuotaYear(Number(e.target.value))}
              />
            </label>
            <label className="text-sm">
              年假額度
              <input
                type="number"
                step="0.5"
                className="mt-1 block border rounded px-2 py-1 w-24"
                value={editQuotaDays}
                onChange={(e) => setEditQuotaDays(Number(e.target.value))}
              />
            </label>
          </div>
          {selected.quotas.length > 0 ? (
            <ul className="text-xs text-slate-600 space-y-1">
              {selected.quotas.map((q) => (
                <li key={q.year}>
                  {q.year}：額度 {q.quotaDays}／已請 {q.usedDays}／剩餘{' '}
                  {q.remainingDays}
                </li>
              ))}
            </ul>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              className="rounded bg-slate-800 px-3 py-2 text-sm text-white"
            >
              儲存
            </button>
            {selected.role !== 'admin' ? (
              <button
                type="button"
                className="rounded border border-slate-400 px-3 py-2 text-sm"
                onClick={() => {
                  void onToggleActive();
                }}
              >
                {selected.isActive ? '停用' : '啟用'}
              </button>
            ) : null}
          </div>
        </form>
      ) : null}
    </div>
  );
};

export default AdminEmployeesPage;
