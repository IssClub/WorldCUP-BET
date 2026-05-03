import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/supabase';
import { Crown, RefreshCw } from 'lucide-react';

type PlayerStats = Profile & {
  wins: number;
  losses: number;
  profit: number;
  biggestWin: number;
  streak: number;
};

export default function LeaderboardPage() {
  const { profile: me } = useAuth();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [profilesRes, betsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('bank', { ascending: false }),
      supabase.from('bets')
        .select('player_id, status, amount, payout, created_at')
        .neq('status', 'pending')
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true }),
    ]);
    const profiles: Profile[] = profilesRes.data || [];
    const betRows = betsRes.data || [];

    const statsMap: Record<string, {
      wins: number; losses: number; profit: number;
      biggestWin: number; orderedStatuses: string[];
    }> = {};

    for (const b of betRows) {
      if (!statsMap[b.player_id]) statsMap[b.player_id] = { wins: 0, losses: 0, profit: 0, biggestWin: 0, orderedStatuses: [] };
      const s = statsMap[b.player_id];
      s.orderedStatuses.push(b.status);
      if (b.status === 'won') {
        s.wins++;
        s.profit += (b.payout || 0) - b.amount;
        s.biggestWin = Math.max(s.biggestWin, b.payout || 0);
      } else {
        s.losses++;
        s.profit -= b.amount;
      }
    }

    function calcStreak(statuses: string[]): number {
      if (!statuses.length) return 0;
      const last = statuses[statuses.length - 1];
      let count = 0;
      for (let i = statuses.length - 1; i >= 0; i--) {
        if (statuses[i] !== last) break;
        count++;
      }
      return last === 'won' ? count : -count;
    }

    setPlayers(profiles.map(p => {
      const s = statsMap[p.id];
      if (!s) return { ...p, wins: 0, losses: 0, profit: 0, biggestWin: 0, streak: 0 };
      return { ...p, wins: s.wins, losses: s.losses, profit: s.profit, biggestWin: s.biggestWin, streak: calcStreak(s.orderedStatuses) };
    }));
    setLoading(false);
  }

  if (loading) return (
    <div className="flex items-center justify-center" style={{ minHeight: '100dvh' }}>
      <div className="text-5xl animate-pulse">🏆</div>
    </div>
  );

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div className="pb-24" style={{ minHeight: '100dvh' }}>
      <header className="hdr">
        <div className="hdr-inner">
          <span className="font-bold">טבלת דירוג</span>
          <button onClick={load} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      <div className="page-wrap pt-4 flex flex-col gap-3">
        {/* Banner */}
        <div className="ldr-banner">
          <Crown size={32} style={{ color: 'var(--gold)', flexShrink: 0 }} />
          <div>
            <div className="font-bold text-base">דירוג שחקנים</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{players.length} משתתפים · ממוין לפי בנק</div>
          </div>
        </div>

        {/* Top 3 podium */}
        {players.length >= 3 && (
          <div className="ldr-podium">
            <div className="ldr-pod ldr-pod-2">
              <div className="ldr-pod-medal">🥈</div>
              <div className="ldr-pod-name">{players[1].display_name}</div>
              <div className="ldr-pod-bank" style={{ color: '#c0c0c0' }}>{players[1].bank.toLocaleString()}</div>
              <div className="ldr-pod-bar ldr-pod-bar-2" />
            </div>
            <div className="ldr-pod ldr-pod-1">
              <div className="ldr-pod-medal">🥇</div>
              <div className="ldr-pod-name" style={{ fontWeight: 800, color: 'var(--gold)' }}>{players[0].display_name}</div>
              <div className="ldr-pod-bank" style={{ color: 'var(--gold)' }}>{players[0].bank.toLocaleString()}</div>
              <div className="ldr-pod-bar ldr-pod-bar-1" />
            </div>
            <div className="ldr-pod ldr-pod-3">
              <div className="ldr-pod-medal">🥉</div>
              <div className="ldr-pod-name">{players[2].display_name}</div>
              <div className="ldr-pod-bank" style={{ color: '#cd7f32' }}>{players[2].bank.toLocaleString()}</div>
              <div className="ldr-pod-bar ldr-pod-bar-3" />
            </div>
          </div>
        )}

        {/* Full list */}
        <div className="flex flex-col gap-2">
          {players.map((p, i) => {
            const isMe = p.id === me?.id;
            const settled = p.wins + p.losses;
            const winRate = settled > 0 ? Math.round((p.wins / settled) * 100) : null;

            return (
              <div key={p.id} className={`ldr-card ${isMe ? 'ldr-card-me' : ''}`}>
                <div className="ldr-pos">
                  {i < 3
                    ? <span style={{ fontSize: '1.4rem' }}>{MEDALS[i]}</span>
                    : <span className="ldr-pos-num">{i + 1}</span>}
                </div>

                <div className="ldr-info">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="ldr-name">{p.display_name}</span>
                    {isMe && <span className="ldr-me-badge">אתה</span>}
                  </div>
                  {settled > 0 && (
                    <div className="ldr-record">
                      <span style={{ color: 'var(--green)' }}>{p.wins}✓</span>
                      <span style={{ color: 'var(--text-muted)' }}> · </span>
                      <span style={{ color: '#f87171' }}>{p.losses}✗</span>
                      {winRate !== null && <span style={{ color: 'var(--text-muted)' }}> · {winRate}%</span>}
                    </div>
                  )}
                  <div className="ldr-extras">
                    {p.profit !== 0 && (
                      <span className={p.profit > 0 ? 'ldr-profit-pos' : 'ldr-profit-neg'}>
                        {p.profit > 0 ? '+' : ''}{p.profit.toLocaleString()} נק׳
                      </span>
                    )}
                    {p.streak >= 3 && (
                      <span className="ldr-streak-win">🔥 {p.streak} ברצף</span>
                    )}
                    {p.streak <= -3 && (
                      <span className="ldr-streak-lose">❄️ {Math.abs(p.streak)} ברצף</span>
                    )}
                    {p.biggestWin > 0 && (
                      <span className="ldr-biggest-win">⚡ {p.biggestWin.toLocaleString()}</span>
                    )}
                  </div>
                </div>

                <div className="ldr-bank-wrap">
                  <span className="ldr-bank" style={{ color: i === 0 ? 'var(--gold)' : 'var(--green)' }}>
                    {p.bank.toLocaleString()}
                  </span>
                  <span className="ldr-bank-lbl">נק׳</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
