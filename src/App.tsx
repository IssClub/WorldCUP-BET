import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import PlayerPage from './pages/PlayerPage';
import AdminPage from './pages/AdminPage';
import MyBetsPage from './pages/MyBetsPage';
import TournamentPage from './pages/TournamentPage';
import InfoPage from './pages/InfoPage';
import { Trophy, Swords, BookOpen, Globe, Ticket } from 'lucide-react';

type Tab = 'bets' | 'mybets' | 'info' | 'tournament' | 'admin';

function AppShell() {
  const { user, profile, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('bets');

  const isAdmin = profile?.role === 'admin';

  if (loading) return (
    <div className="min-h-screen pitch-bg flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">⚽</div>
        <div className="bebas text-3xl" style={{ color: 'var(--green)' }}>טוען...</div>
      </div>
    </div>
  );

  if (!user) return <LoginPage />;

  const tabs = [
    { key: 'bets' as Tab, label: 'הימורים', icon: Swords },
    { key: 'mybets' as Tab, label: 'שלי', icon: Ticket },
    { key: 'info' as Tab, label: 'חוקים', icon: BookOpen },
    { key: 'tournament' as Tab, label: 'מונדיאל', icon: Globe },
    ...(isAdmin ? [{ key: 'admin' as Tab, label: 'ניהול', icon: Trophy }] : []),
  ];

  return (
    <div className="min-h-screen pitch-bg">
      {/* Page content */}
      <div className="pb-20">
        {tab === 'bets' && <PlayerPage />}
        {tab === 'mybets' && <MyBetsPage />}
        {tab === 'info' && <InfoPage />}
        {tab === 'tournament' && <TournamentPage />}
        {tab === 'admin' && isAdmin && <AdminPage />}
      </div>

      {/* Bottom nav */}
      <nav className="bottom-nav">
        {tabs.map(t => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              className={`bnav-btn ${active ? 'bnav-btn-on' : ''}`}
              onClick={() => setTab(t.key)}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 1.8} />
              <span className="bnav-label">{t.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
