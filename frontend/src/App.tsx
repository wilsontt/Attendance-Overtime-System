/**
 * 主應用程式組件
 *
 * 用途：共用導覽列殼層 + lazy auth。
 * 加班單／請假行事曆／Admin 皆在導覽列下方切換主內容（登入頁除外）。
 */

import { useEffect, useState } from 'react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import AdminShiftsPage from './pages/AdminShiftsPage';
import LeaveCalendarPage from './pages/LeaveCalendarPage';
import { TopTitleNav } from './components/TopTitleNav';
import { fetchMe, logout, type MeResponse } from './api/auth';
import './App.css';

type AppView = 'home' | 'login' | 'calendar' | 'admin-shifts';
type LoginIntent = 'calendar' | 'admin-shifts';
type ShellView = 'home' | 'calendar' | 'admin-shifts';

function App() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [view, setView] = useState<AppView>('home');
  const [loginIntent, setLoginIntent] = useState<LoginIntent | null>(null);
  const [authNotice, setAuthNotice] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const me = await fetchMe();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const shellView: ShellView =
    view === 'login' ? 'home' : (view as ShellView);

  const requireSession = (intent: LoginIntent) => {
    setAuthNotice('');
    if (user) {
      if (intent === 'admin-shifts' && user.role !== 'admin') {
        setAuthNotice('班表管理僅限 Admin 帳號。');
        setView('home');
        return;
      }
      setView(intent === 'calendar' ? 'calendar' : 'admin-shifts');
      return;
    }
    setLoginIntent(intent);
    setView('login');
  };

  const handleLoggedIn = (me: MeResponse) => {
    setUser(me);
    const intent = loginIntent;
    setLoginIntent(null);
    if (intent === 'admin-shifts') {
      if (me.role === 'admin') {
        setView('admin-shifts');
      } else {
        setAuthNotice('班表管理僅限 Admin 帳號。');
        setView('home');
      }
      return;
    }
    if (intent === 'calendar') {
      setView('calendar');
      return;
    }
    setView('home');
  };

  const handleLogout = async () => {
    try {
      await logout();
    } finally {
      setUser(null);
      setView('home');
      setLoginIntent(null);
    }
  };

  if (view === 'login') {
    return (
      <LoginPage
        intent={loginIntent}
        onLoggedIn={handleLoggedIn}
        onCancel={() => {
          setLoginIntent(null);
          setView('home');
        }}
      />
    );
  }

  const navButtonClass = (active: boolean) =>
    active
      ? 'rounded border border-blue-800 bg-blue-700 px-2 py-1 font-semibold text-white'
      : 'rounded border border-slate-400 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50';

  return (
    <div className="App relative min-h-screen">
      <div className="mb-5 -mx-4 sm:-mx-5">
        <TopTitleNav
          actions={
            <div className="flex flex-wrap items-center justify-end gap-2 text-sm">
              <button
                type="button"
                className={navButtonClass(shellView === 'home')}
                onClick={() => setView('home')}
              >
                加班單
              </button>
              <button
                type="button"
                className={navButtonClass(shellView === 'calendar')}
                onClick={() => requireSession('calendar')}
              >
                請假行事曆
              </button>
              <button
                type="button"
                className={navButtonClass(shellView === 'admin-shifts')}
                onClick={() => requireSession('admin-shifts')}
              >
                Admin 管理
              </button>
              {user ? (
                <>
                  <span className="hidden sm:inline text-slate-600 max-w-[10rem] truncate">
                    {user.employeeId} {user.name}
                  </span>
                  <button
                    type="button"
                    className="underline text-blue-700"
                    onClick={() => {
                      void handleLogout();
                    }}
                  >
                    登出
                  </button>
                </>
              ) : null}
            </div>
          }
        />
      </div>

      {authNotice ? (
        <div
          className="mb-3 flex items-start justify-between gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="status"
        >
          <span>{authNotice}</span>
          <button
            type="button"
            className="underline shrink-0"
            onClick={() => setAuthNotice('')}
          >
            關閉
          </button>
        </div>
      ) : null}

      {/* 加班單主流程保持掛載，切換行事曆／Admin 回來時保留已上傳列表 */}
      <div className={shellView === 'home' ? undefined : 'hidden'} aria-hidden={shellView !== 'home'}>
        <HomePage loggedIn={Boolean(user)} />
      </div>

      {shellView === 'calendar' && user ? (
        <LeaveCalendarPage user={user} />
      ) : null}

      {shellView === 'admin-shifts' && user?.role === 'admin' ? (
        <AdminShiftsPage />
      ) : null}
    </div>
  );
}

export default App;
