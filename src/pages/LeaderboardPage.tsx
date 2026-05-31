import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Profile, Bet } from '../lib/supabase';
import { RefreshCw, Crown, ChevronDown, ChevronUp } from 'lucide-react';
import { teamHe } from '../lib/teamNames';
import { flagUrl } from '../lib/flagMap';

type PlayerStats = Profile & {
  wins: number;
  losses: number;
  exactHits: number;
  totalBets: number;
  bets: Bet[];
};

const TZ = 'Asia/Jerusalem';
const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', timeZone: TZ });

function Flag({ team, size = 18 }: { team: string; size?: number }) {
  const url = flagUrl(team, 'w40');
  if (!url) return <span style={{ fontSize: size * 0.75 }}>⚽</span>;
  return (
    <img src={url} alt={team} width={size} height={Math.round(size * 0.6)}
      style={{ borderRadius: 2, objectFit: 'cover', flexShrink: 0 }} />
  );
}

const isExactHit = (bet: Bet) => {
  if (bet.status !== 'won' || bet.exact_home === null) return false;
  if (bet.actual_home !== null && bet.actual_away !== null) {
    return bet.exact_home === bet.actual_home && bet.exact_away === bet.actual_away;
  }
  // fallback: payout > base means exact bonus was applied
  return (bet.payout ?? 0) > Math.floor(bet.amount * bet.odds_value);
};

// Show bets for games that have already kicked off (settled or in-progress)
const isStartedGame = (bet: Bet) => new Date(bet.kickoff_at) <= new Date();

export default function LeaderboardPage() {
  const { profile: me } = useAuth();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    load();
    const channel = supabase
      .channel('leaderboard-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function load() {
    setLoading(true);
    const [profilesRes, betsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('bank', { ascending: false }),
      supabase.rpc('get_leaderboard_bets'),
    ]);

    const profiles: Profile[] = profilesRes.data || [];
    const bets: Bet[] = (betsRes.data || []) as Bet[];

    const betsByPlayer: Record<string, Bet[]> = {};
    for (const bet of bets) {
      if (!betsByPlayer[bet.player_id]) betsByPlayer[bet.player_id] = [];
      betsByPlayer[bet.player_id].push(bet);
    }

    const mapped = profiles.map(p => {
      const pb = betsByPlayer[p.id] || [];
      const settledBets = pb.filter(b => b.status === 'won' || b.status === 'lost');
      return {
        ...p,
        wins: settledBets.filter(b => b.status === 'won').length,
        losses: settledBets.filter(b => b.status === 'lost').length,
        exactHits: settledBets.filter(isExactHit).length,
        totalBets: pb.length,
        bets: pb,
      };
    });

    // מיון: בנק → ניחושים נכונים → בולים
    mapped.sort((a, b) =>
      b.bank - a.bank ||
      b.wins - a.wins ||
      b.exactHits - a.exactHits
    );

    setPlayers(mapped);
    setLoading(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}>
      <div className="text-5xl animate-pulse">🏆</div>
    </div>
  );

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div className="pb-28" style={{ minHeight: '100dvh' }}>
      <header className="hdr">
        <div className="hdr-inner">
          <span className="font-bold">טבלת דירוג</span>
          <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <RefreshCw size={16} />
          </button>
        </div>
      </header>
      <div className="hdr-spacer" />

      <div className="page-wrap pt-6 flex flex-col gap-3">

        {/* Banner */}
        <div className="ldr-banner">
          <Crown size={28} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <div>
            <div className="font-bold text-base">דירוג שחקנים</div>
            <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
              {players.length} משתתפים · לחץ על שחקן לפירוט הימורים
            </div>
          </div>
        </div>

        {/* League table */}
        <div className="card" style={{ overflow: 'hidden' }}>

          {/* Table header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '30px 1fr 30px 30px 30px 30px 58px',
            padding: '8px 12px',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.65rem',
            fontWeight: 700,
            color: 'var(--text-muted)',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}>
            <span>#</span>
            <span>שם</span>
            <span style={{ textAlign: 'center' }}>נ</span>
            <span style={{ textAlign: 'center' }}>✓</span>
            <span style={{ textAlign: 'center' }}>✗</span>
            <span style={{ textAlign: 'center' }}>🎯</span>
            <span style={{ textAlign: 'right' }}>נק׳</span>
          </div>

          {/* Rows */}
          {players.map((p, i) => {
            const isMe = p.id === me?.id;
            const isOpen = expanded === p.id;
            // Show bets for started games (including pending on live games)
            const startedBets = p.bets.filter(isStartedGame);
            const hasHistory = startedBets.length > 0;

            return (
              <div key={p.id} style={{ borderBottom: i < players.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>

                {/* Player row */}
                <div
                  onClick={() => hasHistory && setExpanded(isOpen ? null : p.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '30px 1fr 30px 30px 30px 30px 58px',
                    padding: '11px 12px',
                    alignItems: 'center',
                    cursor: hasHistory ? 'pointer' : 'default',
                    background: isMe ? 'rgba(0,200,83,0.07)' : 'transparent',
                  }}
                >
                  {/* Position */}
                  <span style={{
                    fontSize: i < 3 ? '1.05rem' : '0.82rem',
                    fontWeight: 700,
                    color: i === 0 ? 'var(--gold)' : 'var(--text-muted)',
                    lineHeight: 1,
                  }}>
                    {i < 3 ? MEDALS[i] : i + 1}
                  </span>

                  {/* Name */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                    <span style={{
                      fontWeight: isMe ? 700 : 500,
                      fontSize: '0.88rem',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {p.display_name}
                    </span>
                    {isMe && (
                      <span style={{
                        fontSize: '0.58rem', background: 'var(--green)', color: '#000',
                        borderRadius: 4, padding: '1px 4px', fontWeight: 700, flexShrink: 0,
                      }}>אתה</span>
                    )}
                    {hasHistory && (
                      isOpen
                        ? <ChevronUp size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                        : <ChevronDown size={11} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                    )}
                  </div>

                  {/* Total bets */}
                  <span style={{ textAlign: 'center', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>
                    {p.totalBets}
                  </span>

                  {/* Wins */}
                  <span style={{ textAlign: 'center', color: 'var(--green)', fontWeight: 700, fontSize: '0.9rem' }}>
                    {p.wins}
                  </span>

                  {/* Losses */}
                  <span style={{ textAlign: 'center', color: '#f87171', fontWeight: 700, fontSize: '0.9rem' }}>
                    {p.losses}
                  </span>

                  {/* Exact hits */}
                  <span style={{ textAlign: 'center', color: 'var(--gold)', fontWeight: 700, fontSize: '0.9rem' }}>
                    {p.exactHits}
                  </span>

                  {/* Bank */}
                  <span style={{
                    textAlign: 'right',
                    fontWeight: 800,
                    fontSize: '0.92rem',
                    color: i === 0 ? 'var(--gold)' : p.bank < 500 ? '#f87171' : 'var(--green)',
                  }}>
                    {p.bank.toLocaleString()}
                  </span>
                </div>

                {/* Expanded bet history */}
                {isOpen && hasHistory && (
                  <div style={{
                    borderTop: '1px solid var(--border)',
                    background: 'rgba(0,0,0,0.25)',
                    padding: '8px 10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                  }}>
                    <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 2, paddingRight: 2 }}>
                      היסטוריית הימורים
                    </div>
                    {startedBets.map(bet => {
                      const isPending = bet.status === 'pending';
                      const won = bet.status === 'won';
                      const exact = isExactHit(bet);
                      const pickLabel = bet.pick === 'home' ? teamHe(bet.home_team)
                        : bet.pick === 'away' ? teamHe(bet.away_team) : 'תיקו';

                      return (
                        <div key={bet.id} style={{
                          padding: '7px 9px',
                          borderRadius: 8,
                          background: isPending
                            ? 'rgba(255,214,0,0.06)'
                            : won ? 'rgba(0,200,83,0.08)' : 'rgba(248,113,113,0.08)',
                          border: `1px solid ${isPending
                            ? 'rgba(255,214,0,0.2)'
                            : won ? 'rgba(0,200,83,0.18)' : 'rgba(248,113,113,0.18)'}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}>
                          {/* Result badge */}
                          <div style={{ fontSize: '1rem', flexShrink: 0 }}>
                            {isPending ? '⏳' : exact ? '🎯' : won ? '✅' : '❌'}
                          </div>

                          {/* Game + pick */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                              <Flag team={bet.home_team} size={14} />
                              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{teamHe(bet.home_team)}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>-</span>
                              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{teamHe(bet.away_team)}</span>
                              <Flag team={bet.away_team} size={14} />
                              <span style={{ fontSize: '0.63rem', color: 'var(--text-muted)' }}>{fmtDate(bet.kickoff_at)}</span>
                            </div>
                            <div style={{ display: 'flex', gap: 10, marginTop: 3, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '0.7rem' }}>
                                ניחוש: <span style={{
                                  color: isPending ? 'var(--gold)' : won ? 'var(--green)' : '#f87171',
                                  fontWeight: 700
                                }}>{pickLabel}</span>
                                {bet.exact_home !== null && (
                                  <span style={{ color: exact ? 'var(--gold)' : 'inherit' }}>
                                    {' '}{bet.exact_home}:{bet.exact_away}
                                  </span>
                                )}
                              </span>
                              {bet.actual_home !== null && !isPending && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                  תוצאה: <span style={{ color: 'var(--text)', fontWeight: 700 }}>{bet.actual_home}:{bet.actual_away}</span>
                                </span>
                              )}
                              {isPending && (
                                <span style={{ fontSize: '0.63rem', color: 'var(--gold)', fontWeight: 600 }}>
                                  ממתין לתוצאה
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Points change */}
                          <div style={{ flexShrink: 0, textAlign: 'center' }}>
                            {isPending ? (
                              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                {bet.amount.toLocaleString()}
                              </div>
                            ) : (
                              <div style={{ fontSize: '0.78rem', fontWeight: 800, color: won ? 'var(--green)' : '#f87171' }}>
                                {won ? `+${(bet.payout ?? 0).toLocaleString()}` : `-${bet.amount.toLocaleString()}`}
                              </div>
                            )}
                            <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>נק׳</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
