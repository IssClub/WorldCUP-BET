import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import type { Profile } from './lib/supabase';
import LoginPage from './pages/LoginPage';
import PlayerPage from './pages/PlayerPage';
import AdminPage from './pages/AdminPage';
import MyBetsPage from './pages/MyBetsPage';
import TournamentPage from './pages/TournamentPage';
import LeaderboardPage from './pages/LeaderboardPage';
import { registerPush, pushSupported } from './lib/push';
import { LEAGUE_BADGES } from './lib/leagueBadges';
import { teamHe } from './lib/teamNames';
import { applyTeamTheme, resetTeamTheme } from './lib/teamColors';
import { Trophy, Swords, BarChart2, Globe, Ticket, BellRing, Lock, X, Check } from 'lucide-react';
import { AppModalProvider } from './contexts/AppModalContext';

type Tab = 'bets' | 'mybets' | 'leaderboard' | 'tournament' | 'admin';

function PushModal({ userId }: { userId: string }) {
  const [show, setShow] = useState(false);
  const [registering, setRegistering] = useState(false);

  useEffect(() => {
    if (!pushSupported()) return;
    // אם המשתמש כבר אישר או דחה — לא מציגים
    if (Notification.permission !== 'default') return;
    // בדוק אם המשתמש כבר פוטר את החלון הזה בעבר
    if (localStorage.getItem('pushDismissed')) return;

    // בדוק אם כבר יש subscription פעיל ב-DB
    supabase
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('player_id', userId)
      .then(({ count }) => {
        if (!count || count === 0) {
          setTimeout(() => setShow(true), 800);
        }
      });
  }, [userId]);

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
          <button className="push-modal-no" onClick={() => { localStorage.setItem('pushDismissed', '1'); setShow(false); }}>
            לא עכשיו
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FavoriteTeamModal ────────────────────────────────────────────────────────

const TEAM_LIST = Object.keys(LEAGUE_BADGES);

function FavoriteTeamModal({
  profile,
  onClose,
  onSaved,
}: {
  profile: Profile;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [selected, setSelected] = useState<string>(profile.favorite_team ?? '');
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [useColors, setUseColors] = useState(
    localStorage.getItem('useTeamTheme') === 'true'
  );
  const [saving, setSaving] = useState(false);

  const currentTeam = profile.favorite_team;

  async function save() {
    if (!selected && !displayName.trim()) return;
    setSaving(true);
    const updates: Record<string, string> = {};
    if (selected) updates.favorite_team = selected;
    if (displayName.trim() && displayName.trim() !== profile.display_name)
      updates.display_name = displayName.trim();
    if (Object.keys(updates).length)
      await supabase.from('profiles').update(updates).eq('id', profile.id);
    localStorage.setItem('useTeamTheme', useColors ? 'true' : 'false');
    if (useColors && selected) applyTeamTheme(selected);
    else if (!useColors) resetTeamTheme();
    await onSaved();
    setSaving(false);
    onClose();
  }

  const handleSelect = (team: string) => {
    setSelected(team);
    if (useColors) applyTeamTheme(team);
  };

  const handleToggleColors = (on: boolean) => {
    setUseColors(on);
    if (on && selected) applyTeamTheme(selected);
    else resetTeamTheme();
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(0,0,0,0.75)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '12px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 16,
          padding: '20px 16px 16px',
          width: '100%',
          maxWidth: 420,
          maxHeight: '88dvh',
          overflowY: 'auto',
          position: 'relative',
          border: '1px solid var(--border)',
        }}
      >
        {/* Close */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, left: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4,
          }}
        >
          <X size={18} />
        </button>

        <h3 style={{ margin: '0 0 14px', fontSize: '1.1rem', fontWeight: 800, textAlign: 'right' }}>
          הגדרות פרופיל
        </h3>

        {/* Rename */}
        <div style={{ marginBottom: 18 }}>
          <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: 6, textAlign: 'right' }}>
            כינוי
          </label>
          <input
            value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            maxLength={30}
            dir="auto"
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              background: 'var(--surface2)', border: '1px solid var(--border)',
              color: 'var(--text)', fontSize: '0.9rem', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Team grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 8,
          marginBottom: 16,
        }}>
          {TEAM_LIST.map(team => {
            const isSelected = selected === team;
            return (
              <button
                key={team}
                onClick={() => handleSelect(team)}
                style={{
                  background: isSelected ? 'rgba(255,255,255,0.07)' : 'transparent',
                  border: isSelected ? '2px solid var(--green)' : '2px solid var(--border)',
                  borderRadius: 10,
                  padding: '8px 4px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'border-color 0.15s, background 0.15s',
                  position: 'relative',
                }}
              >
                {isSelected && (
                  <div style={{
                    position: 'absolute', top: 4, right: 4,
                    background: 'var(--green)', borderRadius: '50%',
                    width: 14, height: 14,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Check size={9} strokeWidth={3} color="#000" />
                  </div>
                )}
                <img
                  src={LEAGUE_BADGES[team]}
                  alt={teamHe(team)}
                  style={{ width: 38, height: 38, objectFit: 'contain' }}
                  onError={e => { (e.target as HTMLImageElement).style.opacity = '0.3'; }}
                />
                <span style={{
                  fontSize: '0.6rem',
                  fontWeight: 600,
                  color: isSelected ? 'var(--green)' : 'var(--text-muted)',
                  textAlign: 'center',
                  lineHeight: 1.25,
                  direction: 'rtl',
                }}>
                  {teamHe(team)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Theme toggle */}
        {selected && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid var(--border)',
            marginBottom: 12,
            gap: 8,
          }}>
            <button
              onClick={() => handleToggleColors(!useColors)}
              style={{
                width: 40, height: 22, borderRadius: 11,
                background: useColors ? 'var(--green)' : 'var(--border)',
                border: 'none', cursor: 'pointer',
                position: 'relative', flexShrink: 0,
                transition: 'background 0.2s',
              }}
            >
              <span style={{
                position: 'absolute',
                top: 3, left: useColors ? 20 : 3,
                width: 16, height: 16, borderRadius: '50%',
                background: '#fff',
                transition: 'left 0.2s',
                display: 'block',
              }} />
            </button>
            <span style={{ fontSize: '0.82rem', color: 'var(--text)', textAlign: 'right', flex: 1 }}>
              עיצוב בצבעי <strong>{teamHe(selected)}</strong>
            </span>
          </div>
        )}

        <button
          onClick={save}
          disabled={(!selected && !displayName.trim()) || saving}
          style={{
            width: '100%',
            padding: '11px',
            borderRadius: 10,
            background: selected ? 'var(--green)' : 'var(--border)',
            color: selected ? '#000' : 'var(--text-muted)',
            border: 'none',
            fontWeight: 800,
            fontSize: '0.92rem',
            cursor: selected ? 'pointer' : 'default',
            transition: 'background 0.2s',
          }}
        >
          {saving ? 'שומר...' : selected ? `שמור — ${teamHe(selected)}` : displayName.trim() ? 'שמור כינוי' : 'בחר קבוצה או הזן כינוי'}
        </button>
      </div>
    </div>
  );
}

// ── UserChip (top-left persistent badge) ────────────────────────────────────

function UserChip({ profile, onOpenModal }: { profile: Profile; onOpenModal: () => void }) {
  const badge = profile.favorite_team ? LEAGUE_BADGES[profile.favorite_team] : null;

  return (
    <button
      onClick={onOpenModal}
      title={profile.favorite_team ? `קבוצה: ${teamHe(profile.favorite_team)}` : 'בחר קבוצה אהודה'}
      style={{
        position: 'fixed',
        top: 'env(safe-area-inset-top, 0px)',
        left: 0,
        zIndex: 300,
        height: 48,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '0 10px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
      }}
    >
      {badge ? (
        <img
          src={badge}
          alt={teamHe(profile.favorite_team!)}
          style={{ width: 24, height: 24, objectFit: 'contain', flexShrink: 0 }}
        />
      ) : (
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          border: '1.5px dashed var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '0.65rem', color: 'var(--text-muted)',
        }}>?</div>
      )}
      <span style={{
        fontSize: '0.78rem',
        fontWeight: 700,
        color: 'var(--text)',
        maxWidth: 90,
        overflow: 'hidden',
        whiteSpace: 'nowrap',
        textOverflow: 'ellipsis',
      }}>
        {profile.display_name}
      </span>
    </button>
  );
}

// ── ResetPasswordPage ────────────────────────────────────────────────────────

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

// ── TaglineModal ─────────────────────────────────────────────────────────────

function TaglineModal({ profileId, onClose }: { profileId: string; onClose: () => void }) {
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    await supabase.from('profiles').update({ tagline: text.trim() }).eq('id', profileId);
    setSaving(false);
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(0,0,0,0.82)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'var(--card)',
          borderRadius: 20,
          padding: '28px 20px 20px',
          width: '100%',
          maxWidth: 400,
          border: '1px solid rgba(255,214,0,0.35)',
          boxShadow: '0 0 40px rgba(255,214,0,0.12)',
          textAlign: 'right',
          position: 'relative',
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: 'absolute', top: 12, left: 12,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', padding: 4, fontSize: '1.1rem',
          }}
        >
          <X size={18} />
        </button>

        <div style={{ fontSize: '3rem', textAlign: 'center', marginBottom: 10 }}>👑</div>
        <h3 style={{ margin: '0 0 4px', fontSize: '1.25rem', fontWeight: 900, color: 'var(--gold)', textAlign: 'center' }}>
          מוביל המחזור!
        </h3>
        <p style={{ margin: '0 0 18px', fontSize: '0.84rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          כתוב משהו שיופיע בטבלת הדירוג
        </p>

        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          maxLength={120}
          dir="rtl"
          rows={3}
          placeholder="למשל: אין עליי 🔥"
          style={{
            width: '100%',
            padding: '10px 12px',
            borderRadius: 10,
            background: 'var(--surface2)',
            border: '1.5px solid rgba(255,214,0,0.3)',
            color: 'var(--text)',
            fontSize: '0.95rem',
            resize: 'none',
            boxSizing: 'border-box',
            outline: 'none',
            marginBottom: 14,
          }}
          autoFocus
        />

        <button
          onClick={save}
          disabled={!text.trim() || saving}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: 12,
            background: text.trim() ? 'var(--gold)' : 'var(--border)',
            color: text.trim() ? '#000' : 'var(--text-muted)',
            border: 'none',
            fontWeight: 900,
            fontSize: '0.95rem',
            cursor: text.trim() ? 'pointer' : 'default',
            transition: 'background 0.2s',
          }}
        >
          {saving ? 'שומר...' : 'שמור והפתיע את כולם 🏆'}
        </button>
      </div>
    </div>
  );
}

function AppShell() {
  const { user, profile, loading, refresh } = useAuth();
  const [tab, setTab] = useState<Tab>('bets');
  const [isRecovery, setIsRecovery] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showTaglineModal, setShowTaglineModal] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setIsRecovery(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Show team picker if user hasn't chosen yet (once per session)
  useEffect(() => {
    if (!profile) return;
    if (!profile.favorite_team && !sessionStorage.getItem('skipTeamModal')) {
      const t = setTimeout(() => setShowTeamModal(true), 1400);
      return () => clearTimeout(t);
    }
  }, [profile?.id, profile?.favorite_team]);

  // Apply team theme on load
  useEffect(() => {
    if (!profile?.favorite_team) return;
    if (localStorage.getItem('useTeamTheme') === 'true') {
      applyTeamTheme(profile.favorite_team);
    }
  }, [profile?.favorite_team]);

  // Show tagline modal: URL param (app was closed) or SW message (app was open)
  useEffect(() => {
    if (!profile) return;

    // מקרה 1: האפליקציה נפתחה עם ?set-tagline=1
    const params = new URLSearchParams(window.location.search);
    if (params.get('set-tagline') === '1') {
      setShowTaglineModal(true);
      window.history.replaceState({}, '', window.location.pathname);
    }

    // מקרה 2: האפליקציה הייתה פתוחה — ה-SW שלח postMessage
    const handler = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK' &&
          typeof event.data?.url === 'string' &&
          event.data.url.includes('set-tagline')) {
        setShowTaglineModal(true);
      }
    };
    navigator.serviceWorker?.addEventListener('message', handler);
    return () => navigator.serviceWorker?.removeEventListener('message', handler);
  }, [profile?.id]);

  const handleTeamModalClose = useCallback(() => {
    sessionStorage.setItem('skipTeamModal', '1');
    setShowTeamModal(false);
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
    { key: 'tournament' as Tab, label: 'ליגה', icon: Globe },
    ...(isAdmin ? [{ key: 'admin' as Tab, label: 'ניהול', icon: Trophy }] : []),
  ];

  return (
    <AppModalProvider value={{ openTeamModal: () => setShowTeamModal(true) }}>
    <div className="pitch-bg" style={{ minHeight: '100dvh' }}>
      {profile && <PushModal userId={profile.id} />}
      {profile && showTaglineModal && (
        <TaglineModal profileId={profile.id} onClose={() => { setShowTaglineModal(false); refresh(); }} />
      )}
      {profile && showTeamModal && (
        <FavoriteTeamModal
          profile={profile}
          onClose={handleTeamModalClose}
          onSaved={refresh}
        />
      )}
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
    </AppModalProvider>
  );
}


export default function App() {
  return (
    <AuthProvider>
      <AppShell />
    </AuthProvider>
  );
}
