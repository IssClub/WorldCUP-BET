import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Settings, Bet } from '../lib/supabase';
import { flagUrl } from '../lib/flagMap';
import { LEAGUE_BADGES } from '../lib/leagueBadges';
import { teamHe } from '../lib/teamNames';
import { CheckCircle2, RefreshCw, Lock } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────
type Pick = 'home' | 'draw' | 'away';

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  round_num: number | null;
  completed: boolean;
  home_score: number | null;
  away_score: number | null;
}

interface BetState {
  exactHome: string;
  exactAway: string;
}

// ── Flag component ────────────────────────────────────────
function Flag({ team, size = 44 }: { team: string; size?: number }) {
  const badge = LEAGUE_BADGES[team];
  if (badge) {
    return (
      <img src={badge} alt={team} width={size} height={size}
        style={{ borderRadius: 6, objectFit: 'contain', display: 'block', flexShrink: 0 }} />
    );
  }
  const url = flagUrl(team, 'w80');
  if (!url) return <span style={{ fontSize: size * 0.6, lineHeight: 1 }}>🏳️</span>;
  return (
    <img src={url} alt={team} width={size} height={Math.round(size * 0.6)}
      style={{ borderRadius: 4, objectFit: 'cover', display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
    />
  );
}

// ── Time utils ────────────────────────────────────────────
const TZ = 'Asia/Jerusalem';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const fmtDateHe = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });

// ── Score input (compact) ─────────────────────────────────
const scoreInputStyle: React.CSSProperties = {
  width: 52, height: 52, fontSize: '1.65rem', fontWeight: 800,
  borderRadius: 12, border: '2px solid var(--border)',
  background: 'rgba(255,255,255,0.06)', color: 'var(--text)',
  textAlign: 'center', outline: 'none', display: 'block',
  MozAppearance: 'textfield',
};

// ── GameCard ──────────────────────────────────────────────
function GameCard({ game, resultPts, exactPts, bet, existingBet, isStarted, onChange,
  homeRef, awayRef, onHomeComplete, onAwayComplete }: {
  game: Game;
  resultPts: number;
  exactPts: number;
  bet: BetState;
  existingBet: Bet | null;
  isStarted: boolean;
  onChange: (b: Partial<BetState>) => void;
  homeRef?: (el: HTMLInputElement | null) => void;
  awayRef?: (el: HTMLInputElement | null) => void;
  onHomeComplete: () => void;
  onAwayComplete: () => void;
}) {
  const hasScore = bet.exactHome !== '' && bet.exactAway !== '';
  const isCompleted = game.completed && game.home_score !== null && game.away_score !== null;

  // shared outer wrapper
  const teamSide = (side: 'home' | 'away') => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 0 }}>
      <Flag team={side === 'home' ? game.home_team : game.away_team} size={44} />
      <span className="gc-tname">{teamHe(side === 'home' ? game.home_team : game.away_team)}</span>
    </div>
  );

  // ── Settled bet ──
  if (existingBet && (existingBet.status === 'won' || existingBet.status === 'lost')) {
    const won = existingBet.status === 'won';
    return (
      <div className={`gc ${won ? 'gc-done' : ''}`} style={{ padding: '12px 14px', opacity: won ? 1 : 0.75 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {teamSide('home')}
          <div style={{ textAlign: 'center', padding: '0 6px', minWidth: 90 }}>
            {isCompleted
              ? <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 22, letterSpacing: 2, color: 'var(--text)' }}>
                  {game.home_score} : {game.away_score}
                </div>
              : <div className="gc-time">{fmtTime(game.kickoff_at)}</div>
            }
            <div style={{ fontSize: 13, color: won ? 'var(--green)' : '#f87171', fontWeight: 700, marginTop: 2 }}>
              {won ? '✓' : '✗'} {existingBet.exact_home}:{existingBet.exact_away} → {won ? `+${existingBet.payout ?? 0}` : '0'} נק׳
            </div>
          </div>
          {teamSide('away')}
        </div>
      </div>
    );
  }

  // ── Pending bet ──
  if (existingBet) {
    return (
      <div className="gc gc-done" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {teamSide('home')}
          <div style={{ textAlign: 'center', padding: '0 6px', minWidth: 90 }}>
            <div className="gc-time">{fmtTime(game.kickoff_at)}</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--green)', marginTop: 2 }}>
              ⚡ {existingBet.exact_home}:{existingBet.exact_away}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              {resultPts} | 🎯{exactPts} נק׳
            </div>
          </div>
          {teamSide('away')}
        </div>
      </div>
    );
  }

  // ── Completed, no bet ──
  if (isCompleted) {
    return (
      <div className="gc" style={{ padding: '12px 14px', opacity: 0.65 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {teamSide('home')}
          <div style={{ textAlign: 'center', padding: '0 6px', minWidth: 90 }}>
            <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 24, letterSpacing: 2 }}>
              {game.home_score} : {game.away_score}
            </div>
            <div className="gc-time">סופי</div>
          </div>
          {teamSide('away')}
        </div>
      </div>
    );
  }

  // ── Game started, no bet ──
  if (isStarted) {
    return (
      <div className="gc gc-locked" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {teamSide('home')}
          <div style={{ textAlign: 'center', padding: '0 6px', minWidth: 80 }}>
            <Lock size={16} style={{ color: 'var(--text-muted)', margin: '0 auto 2px' }} />
            <div className="gc-time">{fmtTime(game.kickoff_at)}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>נסגרו</div>
          </div>
          {teamSide('away')}
        </div>
      </div>
    );
  }

  // ── Open for betting ──
  return (
    <div className={`gc ${hasScore ? 'gc-picked' : ''}`} style={{ padding: '12px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {teamSide('home')}

        {/* Score inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '0 4px' }}>
          <span className="gc-time">{fmtTime(game.kickoff_at)}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              ref={homeRef}
              type="number" min="0" max="20" inputMode="numeric"
              style={{ ...scoreInputStyle, borderColor: bet.exactHome !== '' ? 'var(--input-accent)' : 'var(--border)' }}
              value={bet.exactHome}
              placeholder="?"
              onChange={e => {
                const val = e.target.value;
                onChange({ exactHome: val });
                if (val.length === 1) onHomeComplete();
              }}
            />
            <span style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--text-muted)', lineHeight: 1 }}>:</span>
            <input
              ref={awayRef}
              type="number" min="0" max="20" inputMode="numeric"
              style={{ ...scoreInputStyle, borderColor: bet.exactAway !== '' ? 'var(--input-accent)' : 'var(--border)' }}
              value={bet.exactAway}
              placeholder="?"
              onChange={e => {
                const val = e.target.value;
                onChange({ exactAway: val });
                if (val.length === 1) onAwayComplete();
              }}
            />
          </div>
          {hasScore && (
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {resultPts} נק׳ | 🎯 {exactPts} נק׳
            </span>
          )}
        </div>

        {teamSide('away')}
      </div>
    </div>
  );
}

// ── PlayerPage ────────────────────────────────────────────
export default function PlayerPage() {
  const { profile, refresh } = useAuth();
  const [games, setGames] = useState<Game[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [existingBets, setExistingBets] = useState<Bet[]>([]);
  const [bets, setBets] = useState<Record<string, BetState>>({});
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  // ── Input refs for auto-focus ──────────────────────────
  const homeRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());
  const awayRefs = useRef<Map<string, HTMLInputElement | null>>(new Map());

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      const [settingsRes, betsRes, schedRes] = await Promise.all([
        supabase.from('settings').select('*').single(),
        supabase.from('bets').select('*').eq('player_id', profile!.id),
        supabase.from('league_schedule').select('*').order('kickoff_at'),
      ]);

      if (settingsRes.data) setSettings(settingsRes.data as Settings);
      if (betsRes.data) setExistingBets(betsRes.data as Bet[]);

      const allGames = (schedRes.data ?? []) as Game[];
      const incomplete = allGames.filter(g => !g.completed);
      const nextRound = incomplete.length > 0
        ? Math.min(...incomplete.map(g => g.round_num ?? 99))
        : null;
      const roundGames = nextRound !== null
        ? allGames.filter(g => g.round_num === nextRound)
        : [];
      setGames(roundGames);
      setCurrentRound(nextRound);
    } catch {
      setError('שגיאה בטעינת המשחקים');
    } finally {
      setLoading(false);
    }
  }

  function getBet(id: string): BetState {
    return bets[id] ?? { exactHome: '', exactAway: '' };
  }
  function updateBet(id: string, upd: Partial<BetState>) {
    setBets(prev => ({ ...prev, [id]: { ...getBet(id), ...upd } }));
  }

  const CUTOFF_MS = 5 * 60 * 1000;

  // Ordered list of games still open for betting
  const bettableGameIds = useMemo(() =>
    games
      .filter(g => !g.completed
        && new Date(g.kickoff_at).getTime() > Date.now() + CUTOFF_MS
        && !existingBets.find(e => e.external_game_id === g.id))
      .map(g => g.id),
    [games, existingBets]
  );

  const handleAutoFocus = useCallback((gameId: string, field: 'home' | 'away') => {
    if (field === 'home') {
      setTimeout(() => awayRefs.current.get(gameId)?.focus(), 50);
    } else {
      const idx = bettableGameIds.indexOf(gameId);
      if (idx >= 0 && idx < bettableGameIds.length - 1) {
        setTimeout(() => homeRefs.current.get(bettableGameIds[idx + 1])?.focus(), 50);
      }
    }
  }, [bettableGameIds]);

  const readyBets = useMemo(() => games.filter(g => {
    if (g.completed) return false;
    if (new Date(g.kickoff_at).getTime() <= Date.now() + CUTOFF_MS) return false;
    const b = bets[g.id];
    return b != null && b.exactHome !== '' && b.exactAway !== ''
      && !existingBets.find(e => e.external_game_id === g.id);
  }), [games, bets, existingBets]);

  async function submitBets() {
    if (!profile || readyBets.length === 0) return;
    setSubmitting(true);
    setError('');
    const insertedBetIds: string[] = [];
    try {
      for (const g of readyBets) {
        const b = bets[g.id];
        const h = parseInt(b.exactHome), a = parseInt(b.exactAway);
        const derivedPick: Pick = h > a ? 'home' : h < a ? 'away' : 'draw';
        const { data: inserted, error: insertErr } = await supabase.from('bets').insert({
          player_id: profile.id,
          external_game_id: g.id,
          home_team: g.home_team,
          away_team: g.away_team,
          kickoff_at: g.kickoff_at,
          pick: derivedPick,
          amount: 1,
          odds_value: 1,
          exact_home: h,
          exact_away: a,
          status: 'pending',
        }).select('id').single();
        if (insertErr) throw new Error(insertErr.message);
        if (inserted?.id) insertedBetIds.push(inserted.id);
      }
      await Promise.all([refresh(), loadData()]);
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 3000);
    } catch (e: any) {
      if (insertedBetIds.length > 0) {
        await supabase.from('bets').delete().in('id', insertedBetIds);
      }
      setError('שגיאה: ' + (e?.message ?? 'נסה שוב'));
    } finally {
      setSubmitting(false);
    }
  }

  const resultPts = settings?.result_points ?? 3;
  const exactPts = settings?.exact_score_points ?? 5;

  const gameGroups = useMemo(() => {
    const groups: { day: string; games: Game[] }[] = [];
    for (const g of games) {
      const k = dayKey(g.kickoff_at);
      let grp = groups.find(x => x.day === k);
      if (!grp) { grp = { day: k, games: [] }; groups.push(grp); }
      grp.games.push(g);
    }
    return groups;
  }, [games]);

  if (loading) return (
    <div className="pitch-bg flex items-center justify-center" style={{ minHeight: '100dvh' }}>
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">⚽</div>
        <div className="bebas text-3xl" style={{ color: 'var(--green)' }}>טוען משחקים...</div>
      </div>
    </div>
  );

  return (
    <div className="pitch-bg pb-48" style={{ minHeight: '100dvh' }}>

      {/* ── Header ── */}
      <header className="hdr">
        <div className="hdr-inner">
          <span className="font-bold tracking-wide">הימורים</span>
          <div className="flex items-center gap-3">
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{profile?.display_name}</span>
            <button onClick={() => loadData()} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              <RefreshCw size={14} />
            </button>
          </div>
        </div>
      </header>
      <div className="hdr-spacer" />

      <div className="page-wrap">
        {/* ── Round banner ── */}
        {currentRound !== null && (
          <div className="day-row" style={{ marginBottom: 4 }}>
            <span className="day-dot" />
            <span className="day-title">מחזור {currentRound}</span>
          </div>
        )}

        {/* ── Games ── */}
        {gameGroups.length === 0 ? (
          <div className="card p-10 text-center mt-2">
            <div className="text-5xl mb-4">⚽</div>
            <div className="font-bold text-lg mb-1">אין משחקים פתוחים</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
              לא נמצאו משחקים בלוח. צור קשר עם האדמין.
            </div>
          </div>
        ) : (
          gameGroups.map(grp => (
            <div key={grp.day}>
              <div className="day-row">
                <span className="day-dot" />
                <span className="day-date">{fmtDateHe(grp.games[0].kickoff_at)}</span>
              </div>
              <div className="games-list">
                {grp.games.map(game => (
                  <GameCard
                    key={game.id}
                    game={game}
                    resultPts={resultPts}
                    exactPts={exactPts}
                    bet={getBet(game.id)}
                    existingBet={existingBets.find(b => b.external_game_id === game.id) ?? null}
                    isStarted={new Date(game.kickoff_at).getTime() <= Date.now() + CUTOFF_MS}
                    onChange={upd => updateBet(game.id, upd)}
                    homeRef={el => homeRefs.current.set(game.id, el)}
                    awayRef={el => awayRefs.current.set(game.id, el)}
                    onHomeComplete={() => handleAutoFocus(game.id, 'home')}
                    onAwayComplete={() => handleAutoFocus(game.id, 'away')}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        {error && <div className="err-banner">{error}</div>}
      </div>

      {/* ── Submit bar ── */}
      {(readyBets.length > 0 || justSubmitted) && (
        <div className="submit-bar">
          <div className="page-wrap">
            {justSubmitted ? (
              <div className="success-banner">
                <CheckCircle2 size={18} />
                <span>ההימורים נשלחו בהצלחה!</span>
              </div>
            ) : (
              <button className="submit-btn" onClick={submitBets} disabled={submitting}>
                {submitting
                  ? 'שולח...'
                  : `שלח ${readyBets.length} הימור${readyBets.length !== 1 ? 'ים' : ''}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
