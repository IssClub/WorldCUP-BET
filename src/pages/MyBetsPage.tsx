import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Bet, SpecialBet } from '../lib/supabase';
import { flagUrl } from '../lib/flagMap';
import { teamHe } from '../lib/teamNames';
import { WINNER_ODDS, TOP_SCORER_ODDS } from '../lib/tournamentOdds';
import { Trash2, Trophy, Star } from 'lucide-react';

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

  useEffect(() => { if (profile) loadBets(); }, [profile?.id]);

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
    await supabase.from('profiles').update({ bank: profile.bank + bet.amount }).eq('id', profile.id);
    await refresh();
    await loadBets();
    setCancelling(null);
  }

  const canCancel = (bet: Bet) =>
    bet.status === 'pending' && new Date(bet.kickoff_at) > new Date();

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
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{profile?.display_name}</span>
        </div>
      </header>

      <div className="page-wrap pt-4">
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
            <span className="mb-stat-lbl">נרוויחו</span>
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

                  {/* Exact score */}
                  {bet.exact_home !== null && (
                    <div className="mb-exact">⚡ ניחוש: {bet.exact_home}:{bet.exact_away}</div>
                  )}

                  {/* Cancel */}
                  {cancellable && (
                    <button
                      className="mb-cancel"
                      onClick={() => cancelBet(bet)}
                      disabled={cancelling === bet.id}
                    >
                      <Trash2 size={13} />
                      {cancelling === bet.id ? 'מבטל...' : 'בטל הימור — החזר ' + bet.amount + ' נק׳'}
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
