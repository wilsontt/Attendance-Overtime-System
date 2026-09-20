/**
 * 主應用程式組件
 *
 * 用途：加班單主流程公開（lazy auth）；行事曆／Admin 才需登入（PRD §5.3.1）。
 */

import { useEffect, useState } from 'react';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import AdminShiftsPage from './pages/AdminShiftsPage';
import LeaveCalendarPage from './pages/LeaveCalendarPage';
import { fetchMe, logout, type MeResponse } from './api/auth';
import './App.css';

type AppView = 'home' | 'login' | 'calendar' | 'admin-shifts';
type LoginIntent = 'calendar' | 'admin-shifts';

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

  if (view === 'calendar' && user) {
    return (
      <LeaveCalendarPage
        user={user}
        onBack={() => setView('home')}
        onLogout={handleLogout}
      />
    );
  }

  if (view === 'admin-shifts' && user?.role === 'admin') {
    return <AdminShiftsPage onBack={() => setView('home')} />;
  }

  return (
    <div className="App relative min-h-screen">
      <HomePage
        user={user}
        authNotice={authNotice}
        onOpenCalendar={() => requireSession('calendar')}
        onOpenAdmin={() => requireSession('admin-shifts')}
        onLogout={handleLogout}
        onDismissNotice={() => setAuthNotice('')}
      />
    </div>
  );
}

export default App;
