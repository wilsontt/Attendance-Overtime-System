import React, { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';
import {
  createAssignment,
  createShift,
  deleteAssignment,
  deleteShift,
  listAssignments,
  listShifts,
  updateShift,
  type Shift,
  type ShiftAssignment,
} from '../api/shifts';

type AdminShiftsPageProps = {
  onBack: () => void;
};

const AdminShiftsPage: React.FC<AdminShiftsPageProps> = ({ onBack }) => {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [employeeId, setEmployeeId] = useState('');
  const [shiftId, setShiftId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState('');
  const [effectiveTo, setEffectiveTo] = useState('');

  const reload = useCallback(async () => {
    setError('');
    try {
      const [s, a] = await Promise.all([listShifts(true), listAssignments()]);
      setShifts(s);
      setAssignments(a);
      setShiftId((prev) => prev || s[0]?.id || '');
    } catch (err) {
      setError(err instanceof ApiError ? err.body.message : '載入失敗');
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [s, a] = await Promise.all([listShifts(true), listAssignments()]);
        if (cancelled) return;
        setShifts(s);
        setAssignments(a);
        setShiftId((prev) => prev || s[0]?.id || '');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.body.message : '載入失敗');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Admin：班表與派班</h1>
        <button type="button" className="underline text-blue-700" onClick={onBack}>
          回加班單
        </button>
      </div>

      {error ? <p className="text-red-600 text-sm">{error}</p> : null}

      <section className="bg-white rounded border p-4 space-y-3">
        <h2 className="font-semibold">班表</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm">
            班名
            <input
              className="block border rounded px-2 py-1"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="text-sm">
            上班
            <input
              className="block border rounded px-2 py-1"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
            />
          </label>
          <label className="text-sm">
            下班／晚段起點
            <input
              className="block border rounded px-2 py-1"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="bg-slate-800 text-white px-3 py-2 rounded"
            onClick={async () => {
              try {
                await createShift({ name, startTime, endTime });
                setName('');
                await reload();
              } catch (err) {
                setError(err instanceof ApiError ? err.body.message : '新增失敗');
              }
            }}
          >
            新增班表
          </button>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="border p-2">名稱</th>
              <th className="border p-2">時間</th>
              <th className="border p-2">狀態</th>
              <th className="border p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {shifts.map((s) => (
              <tr key={s.id}>
                <td className="border p-2">{s.name}</td>
                <td className="border p-2">
                  {s.startTime}–{s.endTime}
                </td>
                <td className="border p-2">{s.status}</td>
                <td className="border p-2 space-x-2">
                  {s.status === 'active' ? (
                    <button
                      type="button"
                      className="underline"
                      onClick={async () => {
                        try {
                          await updateShift(s.id, { status: 'disabled' });
                          await reload();
                        } catch (err) {
                          setError(
                            err instanceof ApiError ? err.body.message : '停用失敗',
                          );
                        }
                      }}
                    >
                      停用
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="underline"
                      onClick={async () => {
                        try {
                          await updateShift(s.id, { status: 'active' });
                          await reload();
                        } catch (err) {
                          setError(
                            err instanceof ApiError ? err.body.message : '啟用失敗',
                          );
                        }
                      }}
                    >
                      啟用
                    </button>
                  )}
                  <button
                    type="button"
                    className="underline text-red-700"
                    onClick={async () => {
                      try {
                        await deleteShift(s.id);
                        await reload();
                      } catch (err) {
                        setError(
                          err instanceof ApiError ? err.body.message : '刪除失敗',
                        );
                      }
                    }}
                  >
                    刪除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="bg-white rounded border p-4 space-y-3">
        <h2 className="font-semibold">派班起迄</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-sm">
            員工編號
            <input
              className="block border rounded px-2 py-1"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              maxLength={6}
            />
          </label>
          <label className="text-sm">
            班表
            <select
              className="block border rounded px-2 py-1"
              value={shiftId}
              onChange={(e) => setShiftId(e.target.value)}
            >
              {shifts
                .filter((s) => s.status === 'active')
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="text-sm">
            起日
            <input
              type="date"
              className="block border rounded px-2 py-1"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
            />
          </label>
          <label className="text-sm">
            迄日（可空）
            <input
              type="date"
              className="block border rounded px-2 py-1"
              value={effectiveTo}
              onChange={(e) => setEffectiveTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="bg-slate-800 text-white px-3 py-2 rounded"
            onClick={async () => {
              try {
                await createAssignment({
                  employeeId,
                  shiftId,
                  effectiveFrom,
                  effectiveTo: effectiveTo || null,
                });
                setEmployeeId('');
                setEffectiveFrom('');
                setEffectiveTo('');
                await reload();
              } catch (err) {
                setError(err instanceof ApiError ? err.body.message : '派班失敗');
              }
            }}
          >
            新增派班
          </button>
        </div>
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100 text-left">
              <th className="border p-2">員工</th>
              <th className="border p-2">班表</th>
              <th className="border p-2">起迄</th>
              <th className="border p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a) => (
              <tr key={a.id}>
                <td className="border p-2">{a.employeeId}</td>
                <td className="border p-2">{a.shiftName}</td>
                <td className="border p-2">
                  {a.effectiveFrom} ~ {a.effectiveTo ?? '開放'}
                </td>
                <td className="border p-2">
                  <button
                    type="button"
                    className="underline text-red-700"
                    onClick={async () => {
                      try {
                        await deleteAssignment(a.id);
                        await reload();
                      } catch (err) {
                        setError(
                          err instanceof ApiError ? err.body.message : '刪除失敗',
                        );
                      }
                    }}
                  >
                    刪除
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
};

export default AdminShiftsPage;
