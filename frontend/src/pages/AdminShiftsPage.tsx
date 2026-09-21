import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  PaginatedDataTable,
  type DataTableColumn,
} from '@shared-ui/data-table';
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

const AdminShiftsPage: React.FC = () => {
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

  const shiftColumns = useMemo<DataTableColumn<Shift>[]>(
    () => [
      {
        key: 'name',
        header: '名稱',
        accessor: (row) => row.name,
      },
      {
        key: 'time',
        header: '時間',
        accessor: (row) => `${row.startTime}–${row.endTime}`,
      },
      {
        key: 'status',
        header: '狀態',
        accessor: (row) => (row.status === 'active' ? '啟用' : '停用'),
      },
      {
        key: 'actions',
        header: '操作',
        render: (row) => (
          <div
            className="flex flex-wrap gap-2"
            onClick={(event) => event.stopPropagation()}
          >
            {row.status === 'active' ? (
              <button
                type="button"
                className="underline"
                onClick={() => {
                  void (async () => {
                    try {
                      await updateShift(row.id, { status: 'disabled' });
                      await reload();
                    } catch (err) {
                      setError(
                        err instanceof ApiError ? err.body.message : '停用失敗',
                      );
                    }
                  })();
                }}
              >
                停用
              </button>
            ) : (
              <button
                type="button"
                className="underline"
                onClick={() => {
                  void (async () => {
                    try {
                      await updateShift(row.id, { status: 'active' });
                      await reload();
                    } catch (err) {
                      setError(
                        err instanceof ApiError ? err.body.message : '啟用失敗',
                      );
                    }
                  })();
                }}
              >
                啟用
              </button>
            )}
            <button
              type="button"
              className="underline text-red-700"
              onClick={() => {
                void (async () => {
                  try {
                    await deleteShift(row.id);
                    await reload();
                  } catch (err) {
                    setError(
                      err instanceof ApiError ? err.body.message : '刪除失敗',
                    );
                  }
                })();
              }}
            >
              刪除
            </button>
          </div>
        ),
      },
    ],
    [reload],
  );

  const assignmentColumns = useMemo<DataTableColumn<ShiftAssignment>[]>(
    () => [
      {
        key: 'employee',
        header: '員工',
        render: (row) => (
          <span>
            <span className="font-mono">{row.employeeId}</span> {row.employeeName}
          </span>
        ),
      },
      {
        key: 'shiftName',
        header: '班表',
        accessor: (row) => row.shiftName,
      },
      {
        key: 'range',
        header: '起迄',
        accessor: (row) =>
          `${row.effectiveFrom} ~ ${row.effectiveTo ?? '開放'}`,
      },
      {
        key: 'actions',
        header: '操作',
        render: (row) => (
          <button
            type="button"
            className="underline text-red-700"
            onClick={(event) => {
              event.stopPropagation();
              void (async () => {
                try {
                  await deleteAssignment(row.id);
                  await reload();
                } catch (err) {
                  setError(
                    err instanceof ApiError ? err.body.message : '刪除失敗',
                  );
                }
              })();
            }}
          >
            刪除
          </button>
        ),
      },
    ],
    [reload],
  );

  return (
    <div className="space-y-8">
      <h2 className="text-lg font-bold text-slate-800">班表與派班</h2>

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
        <PaginatedDataTable
          adapter="tailwind"
          paginationMode="client"
          defaultPageSize={10}
          showPaginationWhenSinglePage
          columns={shiftColumns}
          data={shifts}
          getRowKey={(row) => row.id}
          emptyState="尚無班表"
          indexColumnHeader="項次"
        />
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
        <PaginatedDataTable
          adapter="tailwind"
          paginationMode="client"
          defaultPageSize={10}
          showPaginationWhenSinglePage
          columns={assignmentColumns}
          data={assignments}
          getRowKey={(row) => row.id}
          emptyState="尚無派班"
          indexColumnHeader="項次"
        />
      </section>
    </div>
  );
};

export default AdminShiftsPage;
