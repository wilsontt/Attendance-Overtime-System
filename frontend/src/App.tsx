/**
 * 主應用程式組件
 *
 * 用途：登入閘道 + 首頁／Admin 班表頁。
 */

import { useEffect, useState } from 'react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import AdminShiftsPage from './pages/AdminShiftsPage';
import { fetchMe, logout, type MeResponse } from './api/auth';
import './App.css';

type AppView = 'home' | 'admin-shifts';

function App() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [booting, setBooting] = useState(true);
  const [view, setView] = useState<AppView>('home');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe();
        if (!cancelled) setUser(me);
      } catch (err) {
        if (!cancelled) {
          void err;
          setUser(null);
        }
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (booting) {
    return (
      <div className="App min-h-screen flex items-center justify-center text-slate-600">
        載入中…
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLoggedIn={setUser} />;
  }

  if (view === 'admin-shifts' && user.role === 'admin') {
    return <AdminShiftsPage onBack={() => setView('home')} />;
  }

  return (
    <div className="App relative min-h-screen">
      <div className="absolute right-4 top-3 z-20 flex items-center gap-3 text-sm">
        {user.role === 'admin' ? (
          <button
            type="button"
            className="underline text-blue-700"
            onClick={() => setView('admin-shifts')}
          >
            班表管理
          </button>
        ) : null}
        <span className="text-slate-700">
          {user.employeeId} {user.name}（
          {user.role === 'admin' ? 'Admin' : '員工'}）
        </span>
        <button
          type="button"
          className="underline text-blue-700"
          onClick={async () => {
            try {
              await logout();
            } finally {
              setUser(null);
              setView('home');
            }
          }}
        >
          登出
        </button>
      </div>
      <HomePage />
    </div>
  );
}

export default App;
