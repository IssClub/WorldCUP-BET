import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Profile, Bet } from '../lib/supabase';
import { Crown, ChevronDown, ChevronUp } from 'lucide-react';
import AppHeader from '../components/AppHeader';
import { teamHe } from '../lib/teamNames';
import { LEAGUE_BADGES } from '../lib/leagueBadges';

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
  const badge = LEAGUE_BADGES[team];
  if (badge) return <img src={badge} alt={team} width={size} height={size} style={{ borderRadius: 3, objectFit: 'contain', flexShrink: 0 }} />;
  return <span style={{ fontSize: size * 0.75 }}>⚽</span>;
}

const isExactHit = (bet: Bet) => {
  if (bet.status !== 'won' || bet.exact_home === null) return false;
  if (bet.actual_home !== null && bet.actual_away !== null) {
    return bet.exact_home === bet.actual_home && bet.exact_away === bet.actual_away;
  }
  // fallback: payout > base means exact bonus was applied
  return (bet.payout ?? 0) > Math.floor(bet.amount * bet.odds_value);
};

// Show only settled bets — don't expose picks for in-progress or future games
const isStartedGame = (bet: Bet) => bet.status === 'won' || bet.status === 'lost';

type RoundSummaryPlayer = {
  id: string;
  display_name: string;
  favorite_team: string | null;
  wins: number;
  losses: number;
  exact: number;
  pts: number;
};
type RoundSummary = { roundNum: number; players: RoundSummaryPlayer[] };

export default function LeaderboardPage() {
  const { profile: me } = useAuth();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [openRounds, setOpenRounds] = useState<Set<number>>(new Set());
  const [roundMap, setRoundMap] = useState<Map<string, number>>(new Map());
  const [roundSummary, setRoundSummary] = useState<RoundSummary | null>(null);
  const [summaryOpen, setSummaryOpen] = useState(false);

  const handleExpand = (playerId: string | null, playerBets?: Bet[]) => {
    setExpanded(playerId);
    if (playerId && playerBets) {
      const rounds = playerBets.map(b => roundMap.get(b.external_game_id) ?? 0);
      const maxRound = rounds.length > 0 ? Math.max(...rounds) : 0;
      setOpenRounds(new Set([maxRound]));
    } else {
      setOpenRounds(new Set());
    }
  };

  const toggleRound = (round: number) => {
    setOpenRounds(prev => {
      const next = new Set(prev);
      if (next.has(round)) next.delete(round);
      else next.add(round);
      return next;
    });
  };

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
    const [profilesRes, betsRes, schedRes] = await Promise.all([
      supabase.from('profiles').select('*').order('bank', { ascending: false }),
      supabase.rpc('get_leaderboard_bets'),
      supabase.from('league_schedule').select('id, round_num, completed'),
    ]);

    const profiles: Profile[] = profilesRes.data || [];
    const bets: Bet[] = (betsRes.data || []) as Bet[];
    const sched = schedRes.data ?? [];

    const newRoundMap = new Map(sched.map(r => [r.id, r.round_num ?? 0]));
    setRoundMap(newRoundMap);

    // ── מחזור אחרון שהושלם לחלוטין ──
    const byRoundNum = new Map<number, { total: number; done: number; ids: string[] }>();
    for (const g of sched) {
      const rn = g.round_num ?? 0;
      if (!byRoundNum.has(rn)) byRoundNum.set(rn, { total: 0, done: 0, ids: [] });
      const rs = byRoundNum.get(rn)!;
      rs.total++;
      rs.ids.push(g.id);
      if (g.completed) rs.done++;
    }
    let lastRoundNum = 0;
    let lastRoundIds: string[] = [];
    for (const [rn, rs] of byRoundNum) {
      if (rs.done === rs.total && rs.total > 0 && rn > lastRoundNum) {
        lastRoundNum = rn;
        lastRoundIds = rs.ids;
      }
    }

    if (lastRoundNum > 0) {
      const idSet = new Set(lastRoundIds);
      const roundBets = bets.filter(b => idSet.has(b.external_game_id) && (b.status === 'won' || b.status === 'lost'));
      const statMap: Record<string, { wins: number; losses: number; exact: number; pts: number }> = {};
      for (const bet of roundBets) {
        if (!statMap[bet.player_id]) statMap[bet.player_id] = { wins: 0, losses: 0, exact: 0, pts: 0 };
        const s = statMap[bet.player_id];
        if (bet.status === 'won') { s.wins++; s.pts += bet.payout ?? 0; if (isExactHit(bet)) s.exact++; }
        else s.losses++;
      }
      const summaryPlayers: RoundSummaryPlayer[] = profiles
        .filter(p => statMap[p.id])
        .map(p => ({ id: p.id, display_name: p.display_name, favorite_team: p.favorite_team ?? null, ...statMap[p.id] }))
        .sort((a, b) => b.pts - a.pts || b.wins - a.wins || b.exact - a.exact);
      setRoundSummary({ roundNum: lastRoundNum, players: summaryPlayers });
    } else {
      setRoundSummary(null);
    }

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
      <AppHeader title="טבלת דירוג" onRefresh={load} />
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
            display: 'flex', alignItems: 'center',
            padding: '8px 14px',
            borderBottom: '1px solid var(--border)',
            fontSize: '0.65rem', fontWeight: 700,
            color: 'var(--text-muted)', letterSpacing: '0.5px',
          }}>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 22 }}>#</span>
              <span>שם</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 2 }}>
              <span style={{ width: 34, textAlign: 'center' }}>✓</span>
              <span style={{ width: 34, textAlign: 'center' }}>✗</span>
              <span style={{ width: 34, textAlign: 'center' }}>🎯</span>
              <span style={{ width: 64, textAlign: 'center' }}>נק׳</span>
            </div>
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
                  onClick={() => hasHistory && handleExpand(isOpen ? null : p.id, startedBets)}
                  style={{
                    display: 'flex', alignItems: 'center',
                    padding: '11px 14px',
                    cursor: hasHistory ? 'pointer' : 'default',
                    background: i === 0
                      ? 'rgba(255,214,0,0.05)'
                      : isMe ? 'rgba(0,200,83,0.07)' : 'transparent',
                    boxShadow: i === 0 ? 'inset 3px 0 0 var(--gold)' : 'none',
                  }}
                >
                  {/* Left: position + name */}
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{
                      width: 22, flexShrink: 0,
                      fontSize: i < 3 ? '1.05rem' : '0.82rem',
                      fontWeight: 700,
                      color: i === 0 ? 'var(--gold)' : 'var(--text-muted)',
                      lineHeight: 1,
                    }}>
                      {i < 3 ? MEDALS[i] : i + 1}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
                      {p.favorite_team && LEAGUE_BADGES[p.favorite_team] && (
                        <img
                          src={LEAGUE_BADGES[p.favorite_team]}
                          alt={teamHe(p.favorite_team)}
                          title={teamHe(p.favorite_team)}
                          style={{ width: 18, height: 18, objectFit: 'contain', flexShrink: 0 }}
                        />
                      )}
                      <span style={{
                        fontWeight: isMe ? 700 : 500,
                        fontSize: '0.88rem',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
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
                  </div>

                  {/* Right: stats — fixed-width, equal columns */}
                  <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, gap: 2 }}>
                    <span style={{ width: 34, textAlign: 'center', color: 'var(--green)', fontWeight: 700, fontSize: '0.9rem' }}>
                      {p.wins}
                    </span>
                    <span style={{ width: 34, textAlign: 'center', color: '#f87171', fontWeight: 700, fontSize: '0.9rem' }}>
                      {p.losses}
                    </span>
                    <span style={{ width: 34, textAlign: 'center', color: 'var(--gold)', fontWeight: 700, fontSize: '0.9rem' }}>
                      {p.exactHits}
                    </span>
                    <span style={{
                      width: 64, textAlign: 'center',
                      fontWeight: 800, fontSize: '0.92rem',
                      color: 'rgba(255,255,255,0.92)',
                    }}>
                      {p.bank.toLocaleString()}
                    </span>
                  </div>
                </div>

                {/* Expanded bet history — grouped by round with accordion */}
                {isOpen && hasHistory && (() => {
                  const byRound = new Map<number, Bet[]>();
                  for (const bet of startedBets) {
                    const r = roundMap.get(bet.external_game_id) ?? 0;
                    if (!byRound.has(r)) byRound.set(r, []);
                    byRound.get(r)!.push(bet);
                  }
                  const sortedRounds = [...byRound.keys()].sort((a, b) => b - a);
                  const earned = startedBets.filter(b => b.status === 'won').reduce((s, b) => s + (b.payout ?? 0), 0);

                  return (
                    <div style={{
                      borderTop: '1px solid var(--border)',
                      background: 'rgba(0,0,0,0.25)',
                      padding: '8px 10px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 5,
                    }}>
                      {/* Summary: earned vs bank */}
                      <div style={{ display: 'flex', gap: 10, fontSize: '0.63rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                        <span>רווח מהימורים: <strong style={{ color: 'var(--green)' }}>+{earned} נק׳</strong></span>
                        <span>·</span>
                        <span>בנק: <strong style={{ color: 'var(--text)' }}>{p.bank.toLocaleString()} נק׳</strong></span>
                      </div>

                      {sortedRounds.map(round => {
                        const isRoundOpen = openRounds.has(round);
                        const roundBets = byRound.get(round) ?? [];
                        const rWins = roundBets.filter(b => b.status === 'won').length;
                        const rLosses = roundBets.filter(b => b.status === 'lost').length;
                        return (
                        <div key={round}>
                          {/* Round header — clickable accordion */}
                          <button
                            onClick={e => { e.stopPropagation(); toggleRound(round); }}
                            style={{
                              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              background: 'none', border: 'none',
                              borderBottom: '1px solid rgba(255,255,255,0.06)',
                              padding: '4px 2px', marginBottom: isRoundOpen ? 4 : 0,
                              cursor: 'pointer',
                            }}
                          >
                            <span style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: 0.5 }}>
                              מחזור {round || '?'}
                            </span>
                            <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.6rem', color: 'var(--text-muted)' }}>
                              <span style={{ color: 'var(--green)' }}>✓{rWins}</span>
                              <span style={{ color: '#f87171' }}>✗{rLosses}</span>
                              {isRoundOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                            </span>
                          </button>
                          {isRoundOpen && <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          {roundBets.map(bet => {
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
                                <div style={{ fontSize: '1rem', flexShrink: 0 }}>
                                  {isPending ? '⏳' : exact ? '🎯' : won ? '✅' : '❌'}
                                </div>
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
                                        <span style={{ color: exact ? 'var(--gold)' : 'inherit' }} dir="ltr">
                                          {' '}{bet.exact_home}:{bet.exact_away}
                                        </span>
                                      )}
                                    </span>
                                    {bet.actual_home !== null && !isPending && (
                                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        תוצאה: <span style={{ color: 'var(--text)', fontWeight: 700 }} dir="ltr">{bet.actual_home}:{bet.actual_away}</span>
                                      </span>
                                    )}
                                    {isPending && (
                                      <span style={{ fontSize: '0.63rem', color: 'var(--gold)', fontWeight: 600 }}>
                                        ממתין לתוצאה
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div style={{ flexShrink: 0, textAlign: 'center' }}>
                                  {isPending ? (
                                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)' }}>
                                      —
                                    </div>
                                  ) : (
                                    <div style={{ fontSize: '0.78rem', fontWeight: 800, color: won ? 'var(--green)' : 'var(--text-muted)' }}>
                                      {won ? `+${(bet.payout ?? 0).toLocaleString()}` : '0'}
                                    </div>
                                  )}
                                  <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)' }}>נק׳</div>
                                </div>
                              </div>
                            );
                          })}
                          </div>}
                        </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>

        {/* Round summary card — below table */}
        {roundSummary && (() => {
          const king = roundSummary.players[0];
          const rest = roundSummary.players.slice(1);
          // bubble sizes for ranks 2–6
          const sizes = [66, 56, 48, 40, 33];
          const ptsSizes = ['1.2rem', '1rem', '0.9rem', '0.8rem', '0.7rem'];
          return (
            <div className="card" style={{
              overflow: 'hidden',
              borderColor: 'rgba(255,200,0,0.22)',
              boxShadow: '0 0 24px rgba(255,200,0,0.05)',
            }}>
              {/* Collapsed header */}
              <div
                onClick={() => setSummaryOpen(o => !o)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', cursor: 'pointer' }}
              >
                <span style={{ fontSize: '1.3rem', flexShrink: 0 }}>📊</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: '0.88rem' }}>
                    מחזור {roundSummary.roundNum} — סיכום
                  </div>
                  {king && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      👑 מלך המחזור: <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{king.display_name}</span>
                      {' '}— {king.pts} נק׳ · {king.wins}/{king.wins + king.losses} נכון
                      {king.exact > 0 && ` · 🎯×${king.exact}`}
                    </div>
                  )}
                </div>
                {summaryOpen
                  ? <ChevronUp size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                  : <ChevronDown size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
              </div>

              {/* Expanded body */}
              {summaryOpen && king && (
                <div style={{ borderTop: '1px solid rgba(255,200,0,0.15)' }}>

                  {/* King spotlight */}
                  <div style={{
                    padding: '16px 16px 14px',
                    display: 'flex', alignItems: 'center', gap: 14,
                    background: 'linear-gradient(135deg, rgba(255,200,0,0.1) 0%, rgba(255,130,0,0.05) 100%)',
                    borderBottom: '1px solid rgba(255,200,0,0.12)',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <span style={{ position: 'absolute', right: -8, top: -10, fontSize: '4rem', opacity: 0.07, transform: 'rotate(-15deg)', pointerEvents: 'none' }}>👑</span>
                    {/* Badge + crown */}
                    <div style={{ position: 'relative', flexShrink: 0 }}>
                      {king.favorite_team && LEAGUE_BADGES[king.favorite_team]
                        ? <img src={LEAGUE_BADGES[king.favorite_team]} alt="" width={42} height={42} style={{ borderRadius: '50%', objectFit: 'contain', border: '2px solid var(--gold)', boxShadow: '0 0 14px rgba(255,214,0,0.35)' }} />
                        : <div style={{ width: 42, height: 42, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem', border: '2px solid var(--gold)', boxShadow: '0 0 14px rgba(255,214,0,0.35)' }}>⚽</div>
                      }
                      <span style={{ position: 'absolute', top: -6, right: -6, fontSize: '0.85rem', lineHeight: 1 }}>👑</span>
                    </div>
                    {/* Info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--gold)', letterSpacing: '1.2px', textTransform: 'uppercase', marginBottom: 3 }}>
                        מלך מחזור {roundSummary.roundNum}
                      </div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, lineHeight: 1.1 }}>{king.display_name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {king.wins} נכון מתוך {king.wins + king.losses}
                        {king.exact > 0 && <> · <span style={{ color: 'var(--gold)' }}>🎯 תוצאה מדויקת ×{king.exact}</span></>}
                      </div>
                    </div>
                    {/* Points */}
                    <div style={{ textAlign: 'center', flexShrink: 0 }}>
                      <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--gold)', lineHeight: 1 }}>+{king.pts}</div>
                      <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontWeight: 600, marginTop: 1 }}>נק׳</div>
                    </div>
                  </div>

                  {/* Shrinking bubbles — ranks 2-N */}
                  {rest.length > 0 && (
                    <div style={{
                      padding: '14px 10px 16px',
                      display: 'flex', flexDirection: 'row',
                      alignItems: 'flex-end', justifyContent: 'space-around', gap: 4,
                    }}>
                      {rest.map((p, idx) => {
                        const sz = sizes[idx] ?? 30;
                        const ptsSz = ptsSizes[idx] ?? '0.65rem';
                        const isMe = p.id === me?.id;
                        const teamColor = isMe ? 'var(--green)' : 'var(--text)';
                        const borderColor = isMe ? 'rgba(0,200,83,0.7)' : 'rgba(255,255,255,0.22)';
                        const badge = p.favorite_team ? LEAGUE_BADGES[p.favorite_team] : null;
                        const total = p.wins + p.losses;
                        return (
                          <div key={p.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                            {/* Circle */}
                            <div style={{
                              width: sz, height: sz, borderRadius: '50%',
                              display: 'flex', flexDirection: 'column',
                              alignItems: 'center', justifyContent: 'center',
                              border: `2px solid ${borderColor}`,
                              background: 'rgba(255,255,255,0.05)',
                              position: 'relative', flexShrink: 0,
                              boxShadow: isMe ? '0 0 10px rgba(0,200,83,0.15)' : 'none',
                            }}>
                              {/* Rank badge */}
                              <span style={{
                                position: 'absolute', top: -5, right: -5,
                                background: 'var(--surface2)', border: '1px solid var(--border)',
                                borderRadius: '50%', width: 16, height: 16,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '0.52rem', fontWeight: 800, color: isMe ? 'var(--green)' : 'var(--text-muted)',
                              }}>{idx + 2}</span>
                              {/* Team badge (only for bigger circles) */}
                              {badge && sz >= 48 && (
                                <img src={badge} alt="" width={sz * 0.38} height={sz * 0.38} style={{ objectFit: 'contain', marginBottom: 2 }} />
                              )}
                              <span style={{ fontSize: ptsSz, fontWeight: 800, color: teamColor, lineHeight: 1 }}>+{p.pts}</span>
                              {p.exact > 0 && sz >= 56 && (
                                <span style={{ fontSize: '0.5rem', color: 'var(--gold)', lineHeight: 1, marginTop: 2 }}>🎯×{p.exact}</span>
                              )}
                            </div>
                            {/* Name */}
                            <div style={{ fontSize: sz >= 56 ? '0.72rem' : '0.62rem', fontWeight: 700, color: isMe ? 'var(--green)' : 'var(--text)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                              {p.display_name.length > 6 && sz < 48 ? p.display_name.slice(0, 5) + '…' : p.display_name}
                            </div>
                            {/* Ratio */}
                            <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', textAlign: 'center' }}>{p.wins} מ-{total}</div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

      </div>
    </div>
  );
}
