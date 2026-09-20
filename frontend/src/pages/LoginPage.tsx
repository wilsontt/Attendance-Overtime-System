import React, { useState } from 'react';
import { login, type LoginRequest, type MeResponse } from '../api/auth';
import { ApiError } from '../api/client';

type LoginIntent = 'calendar' | 'admin-shifts';

type LoginPageProps = {
  intent?: LoginIntent | null;
  onLoggedIn: (user: MeResponse) => void;
  onCancel: () => void;
};

const intentHint = (intent: LoginIntent | null | undefined): string => {
  if (intent === 'calendar') return '登入後進入請假行事曆';
  if (intent === 'admin-shifts') return '登入後進入 Admin 班表管理';
  return '請選擇員工或 Admin 登入';
};

const LoginPage: React.FC<LoginPageProps> = ({
  intent,
  onLoggedIn,
  onCancel,
}) => {
  const [mode, setMode] = useState<'employee' | 'admin'>(
    intent === 'admin-shifts' ? 'admin' : 'employee',
  );
  const [employeeId, setEmployeeId] = useState('');
  const [username, setUsername] = useState('000000');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const body: LoginRequest =
        mode === 'employee'
          ? { mode: 'employee', employeeId, pin }
          : { mode: 'admin', username, password, pin };
      const me = await login(body);
      onLoggedIn(me);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.body.message);
      } else {
        setError('無法連線後端 API，請確認已啟動 backend（:3000）');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md bg-white shadow-md rounded-lg p-6 space-y-4"
      >
        <h1 className="text-xl font-bold text-slate-800">出勤加班單系統登入</h1>
        <p className="text-sm text-slate-600">{intentHint(intent)}</p>
        <div className="flex gap-2" role="group" aria-label="登入身分">
          <button
            type="button"
            aria-pressed={mode === 'employee'}
            className={
              mode === 'employee'
                ? 'flex-1 rounded border-2 border-slate-900 bg-slate-800 py-2 font-semibold text-white shadow-sm hover:border-slate-900 hover:bg-slate-900'
                : 'flex-1 rounded border border-slate-300 bg-white py-2 text-slate-600 hover:bg-slate-50'
            }
            onClick={() => setMode('employee')}
          >
            員工
          </button>
          <button
            type="button"
            aria-pressed={mode === 'admin'}
            className={
              mode === 'admin'
                ? 'flex-1 rounded border-2 border-slate-900 bg-slate-800 py-2 font-semibold text-white shadow-sm hover:border-slate-900 hover:bg-slate-900'
                : 'flex-1 rounded border border-slate-300 bg-white py-2 text-slate-600 hover:bg-slate-50'
            }
            onClick={() => setMode('admin')}
          >
            Admin
          </button>
        </div>

        {mode === 'employee' ? (
          <label className="block text-sm">
            員工編號（6 碼）
            <input
              className="mt-1 w-full border rounded px-3 py-2"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              maxLength={6}
              required
            />
          </label>
        ) : (
          <>
            <label className="block text-sm">
              帳號
              <input
                className="mt-1 w-full border rounded px-3 py-2"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label className="block text-sm">
              密碼
              <input
                type="password"
                className="mt-1 w-full border rounded px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
          </>
        )}

        <label className="block text-sm">
          4 碼 PIN
          <input
            className="mt-1 w-full border rounded px-3 py-2"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            maxLength={4}
            required
          />
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-blue-700 text-white py-2 rounded disabled:opacity-60"
        >
          {submitting ? '登入中…' : '登入'}
        </button>
        <button
          type="button"
          className="w-full border border-slate-300 py-2 rounded text-slate-700"
          onClick={onCancel}
        >
          取消，回加班單首頁
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
