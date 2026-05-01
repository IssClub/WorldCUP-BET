import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Bet } from '../lib/supabase';
import { flagUrl } from '../lib/flagMap';
import { Trash2 } from 'lucide-react';

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
  pick === 'home' ? home : pick === 'away' ? away : 'תיקו';

export default function MyBetsPage() {
  const { profile, refresh } = useAuth();
  const [bets, setBets] = useState<Bet[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState<string | null>(null);

  useEffect(() => { loadBets(); }, []);

  async function loadBets() {
    setLoading(true);
    const { data } = await supabase
      .from('bets')
      .select('*')
      .eq('player_id', profile!.id)
      .order('kickoff_at', { ascending: false });
    setBets((data as Bet[]) || []);
    setLoading(false);
  }

  async function cancelBet(bet: Bet) {
    if (!profile) return;
    setCancelling(bet.id);
    await supabase.from('bets').delete().eq('id', bet.id);
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

        {bets.length === 0 ? (
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
                      <span className="mb-team">{bet.home_team}</span>
                      <span className="mb-vs">vs</span>
                      <span className="mb-team">{bet.away_team}</span>
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
