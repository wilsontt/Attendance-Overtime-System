/**
 * 主應用程式組件
 *
 * 用途：共用導覽列殼層 + lazy auth。
 * 加班單／請假行事曆／Admin 皆在導覽列下方切換主內容。
 * 登入頁以全螢幕覆蓋顯示，底下殼層（含 HomePage）保持掛載，避免本機出勤列表被卸載。
 */

import { useEffect, useRef, useState } from 'react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import AdminHubPage from './pages/AdminHubPage';
import LeaveCalendarPage from './pages/LeaveCalendarPage';
import { TopTitleNav } from './components/TopTitleNav';
import { fetchMe, logout, type MeResponse } from './api/auth';
import { AUTH_SESSION_EXPIRED_EVENT } from './api/client';
import './App.css';

type AppView = 'home' | 'login' | 'calendar' | 'admin';
type LoginIntent = 'calendar' | 'admin';
type ShellView = 'home' | 'calendar' | 'admin';

function App() {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [view, setView] = useState<AppView>('home');
  const [loginIntent, setLoginIntent] = useState<LoginIntent | null>(null);
  const [authNotice, setAuthNotice] = useState('');
  /** 未登入勾選「同時寫入伺服器」時暫存檔，之後登入再由 HomePage 自動匯入（不強制導向登入） */
  const [pendingServerImportFile, setPendingServerImportFile] =
    useState<File | null>(null);
  const userRef = useRef(user);
  userRef.current = user;

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

  useEffect(() => {
    const onExpired = () => {
      // 未登入時 /api/me 401 不應當成「過期」提示
      if (!userRef.current) return;
      setUser(null);
      setView('home');
      setLoginIntent(null);
      setPendingServerImportFile(null);
      setAuthNotice('登入已過期，請重新登入。');
    };
    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired);
    return () => {
      window.removeEventListener(AUTH_SESSION_EXPIRED_EVENT, onExpired);
    };
  }, []);

  const shellView: ShellView =
    view === 'login' ? 'home' : (view as ShellView);

  const requireSession = (intent: LoginIntent) => {
    setAuthNotice('');
    if (user) {
      if (intent === 'admin' && user.role !== 'admin') {
        setAuthNotice('Admin 管理僅限 Admin 帳號。');
        setView('home');
        return;
      }
      setView(intent === 'calendar' ? 'calendar' : 'admin');
      return;
    }
    setLoginIntent(intent);
    setView('login');
  };

  const handleLoggedIn = (me: MeResponse) => {
    setUser(me);
    const intent = loginIntent;
    setLoginIntent(null);
    if (intent === 'admin') {
      if (me.role === 'admin') {
        setView('admin');
      } else {
        setAuthNotice('Admin 管理僅限 Admin 帳號。');
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
      setPendingServerImportFile(null);
    }
  };

  const navButtonClass = (active: boolean) =>
    active
      ? 'rounded border border-blue-800 bg-blue-700 px-2 py-1 font-semibold text-white'
      : 'rounded border border-slate-400 bg-white px-2 py-1 text-slate-700 hover:bg-slate-50';

  return (
    <div className="App relative min-h-screen">
      {view === 'login' ? (
        <LoginPage
          intent={loginIntent}
          onLoggedIn={handleLoggedIn}
          onCancel={() => {
            setLoginIntent(null);
            setPendingServerImportFile(null);
            setView('home');
          }}
        />
      ) : null}

      <div
        className={view === 'login' ? 'hidden' : undefined}
        aria-hidden={view === 'login'}
      >
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
                  className={navButtonClass(shellView === 'admin')}
                  onClick={() => requireSession('admin')}
                >
                  Admin 管理
                </button>
                {user ? (
                  <>
                    <span className="hidden max-w-40 truncate text-slate-600 sm:inline">
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
          <output className="mb-3 flex items-start justify-between gap-2 rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span>{authNotice}</span>
            <button
              type="button"
              className="shrink-0 underline"
              onClick={() => setAuthNotice('')}
            >
              關閉
            </button>
          </output>
        ) : null}

        <div
          className={shellView === 'home' ? undefined : 'hidden'}
          aria-hidden={shellView !== 'home'}
        >
          <HomePage
            loggedIn={Boolean(user)}
            pendingServerImportFile={pendingServerImportFile}
            onConsumePendingServerImport={() => setPendingServerImportFile(null)}
            onDeferServerImport={(file) => {
              setPendingServerImportFile(file);
            }}
          />
        </div>

        {shellView === 'calendar' && user ? (
          <LeaveCalendarPage user={user} />
        ) : null}

        {shellView === 'admin' && user?.role === 'admin' ? (
          <AdminHubPage />
        ) : null}
      </div>
    </div>
  );
}

export default App;
