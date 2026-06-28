import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Bet, SpecialBet } from '../lib/supabase';
import { flagUrl } from '../lib/flagMap';
import { teamHe } from '../lib/teamNames';
import { WINNER_ODDS, TOP_SCORER_ODDS } from '../lib/tournamentOdds';
import { Trash2, Trophy, Star, BellRing, Pencil, Check, X, BellOff } from 'lucide-react';
import { registerPush, unregisterPush, pushSupported } from '../lib/push';

function Flag({ team }: { team: string }) {
  const url = flagUrl(team, 'w40');
  if (!url) return <span>🏳️</span>;
  return <img src={url} alt={team} width={28} height={17} style={{ borderRadius: 2, objectFit: 'cover' }} />;
}

const TZ = 'Asia/Jerusalem';
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: TZ });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });

const pickLabel = (pick: string, home: string, away: string) =>
  pick === 'home' ? teamHe(home) : pick === 'away' ? teamHe(away) : 'תיקו';

export default function MyBetsPage() {
  const { profile, refresh } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [specialBets, setSpecialBets] = useState<SpecialBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [newName, setNewName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [useBank, setUseBank] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => { if (profile) loadBets(); }, [profile?.id]);
  useEffect(() => {
    supabase.from('settings').select('use_bank').single()
      .then(({ data }) => setUseBank(data?.use_bank ?? false));
  }, []);
  useEffect(() => {
    if (!pushSupported() || Notification.permission !== 'granted') return;
    navigator.serviceWorker.getRegistration().then(async reg => {
      const sub = await reg?.pushManager.getSubscription();
      setPushEnabled(!!sub);
    });
  }, []);

  async function togglePush() {
    if (!profile || pushBusy) return;
    setPushBusy(true);
    if (pushEnabled) {
      await unregisterPush(profile.id);
      setPushEnabled(false);
    } else {
      const ok = await registerPush(profile.id);
      if (!ok) alert('לא הצלחנו להפעיל התראות — ודא שאישרת הרשאת התראות בדפדפן');
      setPushEnabled(ok);
    }
    setPushBusy(false);
  }

  async function loadBets() {
    if (!profile) return;
    setLoading(true);
    setLoadError('');
    const [betsRes, specialRes] = await Promise.all([
      supabase.from('bets').select('*').eq('player_id', profile.id).order('kickoff_at', { ascending: false }),
      supabase.from('special_bets').select('*').eq('player_id', profile.id),
    ]);
    if (betsRes.error) {
      setLoadError('שגיאה בטעינת ההימורים — נסה שוב');
    } else {
      setBets((betsRes.data as Bet[]) || []);
    }
    setSpecialBets((specialRes.data as SpecialBet[]) || []);
    setLoading(false);
  }

  async function cancelBet(bet: Bet) {
    if (!profile) return;
    setCancelling(bet.id);
    const { error: delErr } = await supabase.from('bets').delete().eq('id', bet.id);
    if (delErr) {
      alert('שגיאה בביטול: ' + delErr.message);
      setCancelling(null);
      return;
    }
    // במצב צבירה לא נוכה כסף בעת הימור, אז לא מחזירים כסף בביטול
    if (useBank) {
      await supabase.from('profiles').update({ bank: profile.bank + bet.amount }).eq('id', profile.id);
      await refresh();
    }
    await loadBets();
    setCancelling(null);
  }

  // ביטול אפשרי רק עד 5 דקות לפני kickoff (עקבי עם סגירת ההימורים)
  const canCancel = (bet: Bet) =>
    bet.status === 'pending' && new Date(bet.kickoff_at).getTime() > Date.now() + 5 * 60 * 1000;

  async function sendTestPush() {
    if (!('serviceWorker' in navigator) || !('Notification' in window)) {
      alert('הדפדפן שלך לא תומך בהתראות');
      return;
    }
    if (Notification.permission !== 'granted') {
      alert('התראות לא אושרו — אשר התראות קודם דרך כפתור הפעמון בעמוד הראשי');
      return;
    }
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      alert('Service worker לא פעיל — נסה לרענן את הדף');
      return;
    }
    reg.showNotification('🔔 בדיקת התראה', {
      body: 'ההתראות עובדות מצוין! ✅',
      icon: '/WorldCUP-BET/icon-trophy.png',
    });
  }

  async function saveName() {
    if (!profile) return;
    const trimmed = newName.trim();
    if (trimmed.length < 2) { alert('שם חייב להיות לפחות 2 תווים'); return; }
    setSavingName(true);
    await supabase.from('profiles').update({ display_name: trimmed }).eq('id', profile.id);
    await refresh();
    setSavingName(false);
    setEditingName(false);
  }

  const totalBet = bets.reduce((s, b) => s + b.amount, 0);
  const totalWon = bets.filter(b => b.status === 'won').reduce((s, b) => s + (b.payout ?? 0), 0);
  const pending = bets.filter(b => b.status === 'pending').length;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-pulse">⚽</div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24">
      <header className="hdr">
        <div className="hdr-inner">
          <span className="font-bold">ההימורים שלי</span>
          <div className="flex items-center gap-2">
            {editingName ? (
              <>
                <input
                  className="input"
                  style={{ fontSize: '0.85rem', padding: '4px 8px', width: 130, textAlign: 'right' }}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                  autoFocus
                  maxLength={30}
                />
                <button onClick={saveName} disabled={savingName} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--green)' }}>
                  <Check size={16} />
                </button>
                <button onClick={() => setEditingName(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#f87171' }}>
                  <X size={16} />
                </button>
              </>
            ) : (
              <>
                <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{profile?.display_name}</span>
                <button
                  onClick={() => { setNewName(profile?.display_name ?? ''); setEditingName(true); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', opacity: 0.6 }}
                  title="שנה שם"
                >
                  <Pencil size={13} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>
      <div className="hdr-spacer" />

      <div className="page-wrap pt-4">
        {/* התראות פוש — בראש הדף */}
        {pushSupported() && (
          <div className="mb-4">
            {Notification.permission === 'denied' ? (
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <BellOff size={13} />
                התראות חסומות — הפעל ב-הגדרות האייפון → Safari / האפליקציה
              </div>
            ) : (
              <>
                <div className="card p-4" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div className="text-sm font-semibold">התראות פוש</div>
                    <div className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      תזכורות לפני משחק, תוצאות הימורים וסיכום יומי
                    </div>
                  </div>
                  <button
                    onClick={togglePush}
                    disabled={pushBusy}
                    style={{
                      width: 48, height: 26, borderRadius: 13, border: 'none', cursor: pushBusy ? 'default' : 'pointer',
                      background: pushEnabled ? 'var(--green)' : 'var(--border)',
                      position: 'relative', flexShrink: 0, transition: 'background 0.2s', opacity: pushBusy ? 0.6 : 1,
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 3,
                      left: pushEnabled ? 25 : 3,
                      width: 20, height: 20, borderRadius: '50%',
                      background: '#fff', transition: 'left 0.2s',
                    }} />
                  </button>
                </div>
                {pushEnabled && (
                  <div className="mt-2 text-center">
                    <button onClick={sendTestPush} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.8rem', padding: '6px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <BellRing size={13} />
                      בדוק התראות
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* שגיאת טעינה */}
        {loadError && (
          <div className="err-banner mb-4">
            ⚠️ {loadError}
            <br />
            <button onClick={loadBets} style={{ marginTop: 6, textDecoration: 'underline', background: 'none', border: 'none', color: '#f87171', cursor: 'pointer', fontSize: '0.85rem' }}>נסה שוב</button>
          </div>
        )}

        {/* Stats strip */}
        <div className="mb-grid">
          <div className="mb-stat">
            <span className="mb-stat-val">{bets.length}</span>
            <span className="mb-stat-lbl">הימורים</span>
          </div>
          <div className="mb-stat">
            <span className="mb-stat-val" style={{ color: 'var(--gold)' }}>{pending}</span>
            <span className="mb-stat-lbl">ממתינים</span>
          </div>
          <div className="mb-stat">
            <span className="mb-stat-val">{totalBet.toLocaleString()}</span>
            <span className="mb-stat-lbl">הושקעו</span>
          </div>
          <div className="mb-stat">
            <span className="mb-stat-val" style={{ color: 'var(--green)' }}>{totalWon.toLocaleString()}</span>
            <span className="mb-stat-lbl">זכיות</span>
          </div>
        </div>

        {/* ניחושי טורניר */}
        {specialBets.length > 0 && (
          <div className="mb-special-card">
            <div className="mb-special-hdr">
              <Trophy size={14} style={{ color: 'var(--gold)' }} />
              <span>ניחושי טורניר</span>
            </div>
            {specialBets.map(sb => {
              const isWinner = sb.type === 'winner';
              const odds = isWinner
                ? WINNER_ODDS.find(o => o.name === sb.prediction)?.price
                : TOP_SCORER_ODDS.find(o => o.name === sb.prediction)?.price;
              const statusColor = sb.status === 'won' ? 'var(--green)' : sb.status === 'lost' ? '#f87171' : 'var(--gold)';
              const statusLabel = sb.status === 'won' ? '✓ זכייה' : sb.status === 'lost' ? '✗ הפסד' : 'ממתין';
              return (
                <div key={sb.id} className="mb-special-row">
                  <div className="mb-special-icon">
                    {isWinner ? '🏆' : '👟'}
                  </div>
                  <div className="mb-special-info">
                    <div className="mb-special-label">{isWinner ? 'זוכה הטורניר' : 'מלך השערים'}</div>
                    <div className="mb-special-pick">
                      {isWinner ? teamHe(sb.prediction) : sb.prediction}
                      {odds && <span className="mb-special-odds">×{odds}</span>}
                    </div>
                  </div>
                  <span className="mb-special-status" style={{ color: statusColor }}>{statusLabel}</span>
                </div>
              );
            })}
          </div>
        )}

        {bets.length === 0 && !loadError ? (
          <div className="card p-10 text-center mt-4">
            <div className="text-5xl mb-4">🎯</div>
            <div className="font-bold text-lg">עוד לא הימרת</div>
            <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>עבור להימורים כדי להתחיל</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {bets.map(bet => {
              const potential = Math.floor(bet.amount * bet.odds_value);
              const statusColor = bet.status === 'won' ? 'var(--green)' : bet.status === 'lost' ? '#f87171' : 'var(--gold)';
              const statusLabel = bet.status === 'won' ? 'זכייה ✓' : bet.status === 'lost' ? 'הפסד ✗' : 'ממתין';
              const cancellable = canCancel(bet);

              return (
                <div key={bet.id} className="mb-card">
                  {/* Header row */}
                  <div className="mb-card-top">
                    <div className="mb-game">
                      <Flag team={bet.home_team} />
                      <span className="mb-team">{teamHe(bet.home_team)}</span>
                      <span className="mb-vs">vs</span>
                      <span className="mb-team">{teamHe(bet.away_team)}</span>
                      <Flag team={bet.away_team} />
                    </div>
                    <span className="mb-status" style={{ color: statusColor }}>{statusLabel}</span>
                  </div>

                  {/* Date */}
                  <div className="mb-date">{fmtDate(bet.kickoff_at)} · {fmtTime(bet.kickoff_at)}</div>

                  {/* Bet details */}
                  <div className="mb-details">
                    <div className="mb-pick">
                      {pickLabel(bet.pick, bet.home_team, bet.away_team)}
                    </div>
                    <div className="mb-nums">
                      <span className="mb-num-item">
                        <span className="mb-num-lbl">הימור</span>
                        <span className="mb-num-val">{bet.amount}</span>
                      </span>
                      <span className="mb-sep">×</span>
                      <span className="mb-num-item">
                        <span className="mb-num-lbl">יחס</span>
                        <span className="mb-num-val">{bet.odds_value.toFixed(2)}</span>
                      </span>
                      <span className="mb-sep">=</span>
                      <span className="mb-num-item">
                        <span className="mb-num-lbl">{bet.status === 'won' ? 'זכית' : 'פוטנציאל'}</span>
                        <span className="mb-num-val" style={{ color: bet.status === 'won' ? 'var(--green)' : 'var(--text)' }}>
                          {bet.status === 'won' ? (bet.payout ?? potential) : potential}
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Exact score guess */}
                  {bet.exact_home !== null && (
                    <div className="mb-exact">
                      ⚡ ניחוש: {pickLabel(bet.pick, bet.home_team, bet.away_team)} {bet.exact_home}:{bet.exact_away}
                    </div>
                  )}

                  {/* Actual result — only for settled bets */}
                  {(bet.status === 'won' || bet.status === 'lost') && bet.actual_home !== null && bet.actual_away !== null && (
                    <div className="mb-actual">
                      {(() => {
                        const aw = bet.actual_home > bet.actual_away ? 'home'
                          : bet.actual_away > bet.actual_home ? 'away' : 'draw';
                        const winnerName = aw === 'home' ? teamHe(bet.home_team)
                          : aw === 'away' ? teamHe(bet.away_team) : 'תיקו';
                        return <>🏁 תוצאה: <strong>{winnerName}</strong> {bet.actual_home}:{bet.actual_away}</>;
                      })()}
                    </div>
                  )}

                  {/* Cancel */}
                  {cancellable && (
                    <button
                      className="mb-cancel"
                      onClick={() => cancelBet(bet)}
                      disabled={cancelling === bet.id}
                    >
                      <Trash2 size={13} />
                      {cancelling === bet.id ? 'מבטל...' : useBank ? 'בטל הימור — החזר ' + bet.amount + ' נק׳' : 'בטל הימור'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
