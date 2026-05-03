import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import PlayerPage from './pages/PlayerPage';
import AdminPage from './pages/AdminPage';
import MyBetsPage from './pages/MyBetsPage';
import TournamentPage from './pages/TournamentPage';
import LeaderboardPage from './pages/LeaderboardPage';
import { registerPush, pushSupported } from './lib/push';
import { Trophy, Swords, BarChart2, Globe, Ticket, BellRing, Lock } from 'lucide-react';

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

function ResetPasswordPage() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  async function handleReset() {
    if (password.length < 6) { setError('סיסמה חייבת להיות לפחות 6 תווים'); return; }
    if (password !== confirm) { setError('הסיסמאות לא תואמות'); return; }
    setLoading(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (e) { setError(e.message); return; }
    setDone(true);
    setTimeout(() => window.location.replace(window.location.pathname.split('?')[0]), 2500);
  }

  return (
    <div className="pitch-bg flex items-center justify-center p-4" style={{ minHeight: '100dvh' }}>
      <div className="w-full max-w-md fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
               style={{background: 'rgba(0,200,83,0.15)', border: '2px solid rgba(0,200,83,0.4)'}}>
            <Lock size={36} style={{color: 'var(--green)'}} />
          </div>
          <h1 className="bebas text-4xl tracking-wider" style={{color: 'var(--text)'}}>סיסמה חדשה</h1>
        </div>
        <div className="card p-6 flex flex-col gap-4">
          {done ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-3">✅</div>
              <div className="font-bold" style={{color: 'var(--green)'}}>הסיסמה עודכנה בהצלחה!</div>
              <div className="text-sm mt-1" style={{color: 'var(--text-muted)'}}>מעביר אותך לאפליקציה...</div>
            </div>
          ) : (
            <>
              <input
                className="input"
                type="password"
                placeholder="סיסמה חדשה (לפחות 6 תווים)"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              <input
                className="input"
                type="password"
                placeholder="אמת סיסמה"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
              />
              {error && (
                <div className="text-sm px-3 py-2 rounded-lg" style={{background:'rgba(239,68,68,0.1)',color:'#f87171',border:'1px solid rgba(239,68,68,0.2)'}}>
                  {error}
                </div>
              )}
              <button className="btn-primary" onClick={handleReset} disabled={loading}>
                {loading ? 'שומר...' : 'שמור סיסמה חדשה'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function AppShell() {
  const { user, profile, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('bets');
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);
  const isAdmin = profile?.role === 'admin';

  if (isRecovery) return <ResetPasswordPage />;

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
