import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import PlayerPage from './pages/PlayerPage';
import AdminPage from './pages/AdminPage';
import MyBetsPage from './pages/MyBetsPage';
import TournamentPage from './pages/TournamentPage';
import LeaderboardPage from './pages/LeaderboardPage';
import { registerPush, pushSupported } from './lib/push';
import { Trophy, Swords, BarChart2, Globe, Ticket, BellRing } from 'lucide-react';

type Tab = 'bets' | 'mybets' | 'leaderboard' | 'tournament' | 'admin';

function PushModal({ userId }: { userId: string }) {
  const [show, setShow] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    if (Notification.permission === 'default') {
      const timer = setTimeout(() => setShow(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  async function enable() {
    setRegistering(true);
    await registerPush(userId);
    setShow(false);
    setRegistering(false);
  }

  if (!show) return null;
  return (
    <div className="push-modal-overlay" onClick={() => setShow(false)}>
      <div className="push-modal" onClick={e => e.stopPropagation()}>
        <div className="push-modal-icon">
          <BellRing size={32} style={{ color: 'var(--gold)' }} />
        </div>
        <h3 className="push-modal-title">התראות משחקים</h3>
        <p className="push-modal-body">
          קבל התראה מיידית כשמשחק שהימרת עליו נגמר — כולל הפרש הניקוד שלך
        </p>
        <div className="push-modal-btns">
          <button className="push-modal-yes" onClick={enable} disabled={registering}>
            {registering ? '...' : '✅ אשר התראות'}
          </button>
          <button className="push-modal-no" onClick={() => setShow(false)}>
            לא עכשיו
          </button>
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const { user, profile, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('bets');
  const isAdmin = profile?.role === 'admin';

  if (loading) return (
    <div className="pitch-bg flex items-center justify-center" style={{ minHeight: '100dvh' }}>
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
    { key: 'leaderboard' as Tab, label: 'טבלה', icon: BarChart2 },
    { key: 'tournament' as Tab, label: 'מונדיאל', icon: Globe },
    ...(isAdmin ? [{ key: 'admin' as Tab, label: 'ניהול', icon: Trophy }] : []),
  ];

  return (
    <div className="pitch-bg" style={{ minHeight: '100dvh' }}>
      {profile && <PushModal userId={profile.id} />}
      {/* Page content */}
      <div className="pb-20">
        {tab === 'bets' && <PlayerPage />}
        {tab === 'mybets' && <MyBetsPage />}
        {tab === 'leaderboard' && <LeaderboardPage />}
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
