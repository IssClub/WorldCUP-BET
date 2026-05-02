import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Profile } from '../lib/supabase';
import { Crown, RefreshCw } from 'lucide-react';

type PlayerStats = Profile & { wins: number; losses: number };

export default function LeaderboardPage() {
  const { profile: me } = useAuth();
  const [players, setPlayers] = useState<PlayerStats[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    const [profilesRes, betsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('bank', { ascending: false }),
      supabase.from('bets').select('player_id, status').neq('status', 'pending').neq('status', 'cancelled'),
    ]);
    const profiles: Profile[] = profilesRes.data || [];
    const betRows = betsRes.data || [];

    const statsMap: Record<string, { wins: number; losses: number }> = {};
    for (const b of betRows) {
      if (!statsMap[b.player_id]) statsMap[b.player_id] = { wins: 0, losses: 0 };
      if (b.status === 'won') statsMap[b.player_id].wins++;
      else statsMap[b.player_id].losses++;
    }

    setPlayers(profiles.map(p => ({ ...p, ...(statsMap[p.id] ?? { wins: 0, losses: 0 }) })));
    setLoading(false);
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-5xl animate-pulse">🏆</div>
    </div>
  );

  const MEDALS = ['🥇', '🥈', '🥉'];

  return (
    <div className="min-h-screen pb-24">
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
            {/* 2nd */}
            <div className="ldr-pod ldr-pod-2">
              <div className="ldr-pod-medal">🥈</div>
              <div className="ldr-pod-name">{players[1].display_name}</div>
              <div className="ldr-pod-bank" style={{ color: '#c0c0c0' }}>{players[1].bank.toLocaleString()}</div>
              <div className="ldr-pod-bar ldr-pod-bar-2" />
            </div>
            {/* 1st */}
            <div className="ldr-pod ldr-pod-1">
              <div className="ldr-pod-medal">🥇</div>
              <div className="ldr-pod-name" style={{ fontWeight: 800, color: 'var(--gold)' }}>{players[0].display_name}</div>
              <div className="ldr-pod-bank" style={{ color: 'var(--gold)' }}>{players[0].bank.toLocaleString()}</div>
              <div className="ldr-pod-bar ldr-pod-bar-1" />
            </div>
            {/* 3rd */}
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
                      <span style={{ color: 'var(--green)' }}>{p.wins} זכיות</span>
                      <span style={{ color: 'var(--text-muted)' }}> · </span>
                      <span style={{ color: '#f87171' }}>{p.losses} הפסדים</span>
                      {winRate !== null && <span style={{ color: 'var(--text-muted)' }}> · {winRate}%</span>}
                    </div>
                  )}
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
