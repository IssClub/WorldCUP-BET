import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Bet, SpecialBet } from '../lib/supabase';
import { teamHe } from '../lib/teamNames';
import { LEAGUE_BADGES } from '../lib/leagueBadges';
import { Trash2, Trophy, Star, BellRing, BellOff, ChevronDown, ChevronUp } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { registerPush, unregisterPush, pushSupported } from '../lib/push';

function Flag({ team }: { team: string }) {
  const badge = LEAGUE_BADGES[team];
  if (badge) return <img src={badge} alt={team} width={26} height={26} style={{ borderRadius: 4, objectFit: 'contain', flexShrink: 0 }} />;
  return <span>🏳️</span>;
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
  const [roundMap, setRoundMap] = useState<Map<string, number>>(new Map());
  const [openRounds, setOpenRounds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [cancelling, setCancelling] = useState<string | null>(null);
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
    const [betsRes, specialRes, schedRes] = await Promise.all([
      supabase.from('bets').select('*').eq('player_id', profile.id).order('kickoff_at', { ascending: false }),
      supabase.from('special_bets').select('*').eq('player_id', profile.id),
      supabase.from('league_schedule').select('id, round_num'),
    ]);
    if (betsRes.error) {
      setLoadError('שגיאה בטעינת ההימורים — נסה שוב');
    } else {
      setBets((betsRes.data as Bet[]) || []);
    }
    setSpecialBets((specialRes.data as SpecialBet[]) || []);
    const sched = schedRes.data ?? [];
    const rm = new Map(sched.map(r => [r.id, r.round_num ?? 0]));
    setRoundMap(rm);

    // פתח את המחזור האחרון שיש לו הימורים — מבוסס על ההימורים עצמם
    const betsData = (betsRes.data as Bet[]) || [];
    const betRounds = betsData.map(b => rm.get(b.external_game_id) ?? 0);
    const maxBetRound = betRounds.length > 0 ? Math.max(...betRounds) : 0;
    setOpenRounds(new Set([maxBetRound]));

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

  const toggleRound = (round: number) => {
    setOpenRounds(prev => {
      const next = new Set(prev);
      if (next.has(round)) next.delete(round);
      else next.add(round);
      return next;
    });
  };

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
      <AppHeader title="ההימורים שלי" />
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
            <span className="mb-stat-val" style={{ color: 'var(--green)' }}>{bets.filter(b => b.status === 'won').length}</span>
            <span className="mb-stat-lbl">ניחושים נכונים</span>
          </div>
          <div className="mb-stat">
            <span className="mb-stat-val" style={{ color: 'var(--green)' }}>{totalWon.toLocaleString()}</span>
            <span className="mb-stat-lbl">נק' זכיות</span>
          </div>
        </div>

        {/* ניחושי טורניר */}
        {specialBets.length > 0 && (
          <div className="mb-special-card">
            <div className="mb-special-hdr">
              <Trophy size={14} style={{ color: 'var(--gold)' }} />
              <span>ניחושי עונה</span>
            </div>
            {specialBets.map(sb => {
              const typeIcon =
                sb.type === 'winner'    ? '🏆' :
                sb.type === 'relegated' ? '📉' : '👟';
              const typeLabel =
                sb.type === 'winner'    ? 'אלוף הליגה' :
                sb.type === 'relegated' ? 'יורד לליגה א׳' : 'מלך השערים';
              const displayName =
                (sb.type === 'winner' || sb.type === 'relegated') ? teamHe(sb.prediction) : sb.prediction;
              const statusColor = sb.status === 'won' ? 'var(--green)' : sb.status === 'lost' ? '#f87171' : 'var(--gold)';
              const statusLabel = sb.status === 'won' ? '✓ זכייה' : sb.status === 'lost' ? '✗ הפסד' : 'ממתין';
              return (
                <div key={sb.id} className="mb-special-row">
                  <div className="mb-special-icon">{typeIcon}</div>
                  <div className="mb-special-info">
                    <div className="mb-special-label">{typeLabel}</div>
                    <div className="mb-special-pick">{displayName}</div>
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
          (() => {
            // קבץ הימורים לפי מחזור (round_num), מסודר מהאחרון לראשון
            const byRound = new Map<number, Bet[]>();
            for (const bet of bets) {
              const r = roundMap.get(bet.external_game_id) ?? 0;
              if (!byRound.has(r)) byRound.set(r, []);
              byRound.get(r)!.push(bet);
            }
            const sortedRounds = [...byRound.keys()].sort((a, b) => b - a);

            return (
              <div className="flex flex-col gap-4">
                {sortedRounds.map(round => {
                  const isOpen = openRounds.has(round);
                  const roundBets = byRound.get(round)!;
                  const roundWins = roundBets.filter(b => b.status === 'won').length;
                  const roundLosses = roundBets.filter(b => b.status === 'lost').length;
                  return (
                  <div key={round}>
                    <button
                      onClick={() => toggleRound(round)}
                      style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        background: 'none', border: 'none', borderBottom: '1px solid var(--border)',
                        padding: '6px 2px 8px', marginBottom: isOpen ? 10 : 0, cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 1 }}>
                        מחזור {round || '?'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {roundBets.some(b => b.status !== 'pending') && (
                          <span>
                            <span style={{ color: 'var(--green)' }}>✓{roundWins}</span>
                            {' '}
                            <span style={{ color: '#f87171' }}>✗{roundLosses}</span>
                          </span>
                        )}
                        {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </span>
                    </button>
                    {isOpen && <div className="flex flex-col gap-3">
                      {roundBets.map(bet => {
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
                                {bet.exact_home !== null
                                  ? <span>⚡ ניחוש: <span dir="ltr">{bet.pick === 'away' ? `${bet.exact_away}:${bet.exact_home}` : `${bet.exact_home}:${bet.exact_away}`}</span></span>
                                  : pickLabel(bet.pick, bet.home_team, bet.away_team)
                                }
                              </div>
                              <div className="mb-nums">
                                {bet.status === 'won' ? (
                                  <span style={{ color: 'var(--green)', fontWeight: 700 }}>+{bet.payout ?? 0} נק׳</span>
                                ) : bet.status === 'lost' ? (
                                  <span style={{ color: '#f87171', fontWeight: 700 }}>0 נק׳</span>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                                    כיוון נכון: 3 נק׳ | 🎯 מדויק: 5 נק׳
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Actual result — only for settled bets */}
                            {(bet.status === 'won' || bet.status === 'lost') && bet.actual_home !== null && bet.actual_away !== null && (
                              <div className="mb-actual">
                                {(() => {
                                  const aw = bet.actual_home > bet.actual_away ? 'home'
                                    : bet.actual_away > bet.actual_home ? 'away' : 'draw';
                                  const winnerName = aw === 'home' ? teamHe(bet.home_team)
                                    : aw === 'away' ? teamHe(bet.away_team) : 'תיקו';
                                  return <>🏁 תוצאה: <strong>{winnerName}</strong> <span dir="ltr">{aw === 'away' ? `${bet.actual_away}:${bet.actual_home}` : `${bet.actual_home}:${bet.actual_away}`}</span></>;
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
                                {cancelling === bet.id ? 'מבטל...' : 'בטל הימור'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>}
                  </div>
                );
                })}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}
