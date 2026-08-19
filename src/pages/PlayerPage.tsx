import { useState, useEffect, useMemo } from 'react';
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
function Flag({ team, size = 56 }: { team: string; size?: number }) {
  const badge = LEAGUE_BADGES[team];
  if (badge) {
    return (
      <img src={badge} alt={team} width={size} height={size}
        style={{ borderRadius: 4, objectFit: 'contain', display: 'block' }} />
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

// ── GameCard ──────────────────────────────────────────────
function GameCard({ game, resultPts, exactPts, bet, existingBet, isStarted, onChange }: {
  game: Game;
  resultPts: number;
  exactPts: number;
  bet: BetState;
  existingBet: Bet | null;
  isStarted: boolean;
  onChange: (b: Partial<BetState>) => void;
}) {
  const hasScore = bet.exactHome !== '' && bet.exactAway !== '';
  const isCompleted = game.completed && game.home_score !== null && game.away_score !== null;

  // ── Settled bet (won or lost) ──
  if (existingBet && (existingBet.status === 'won' || existingBet.status === 'lost')) {
    const won = existingBet.status === 'won';
    return (
      <div className={`gc ${won ? 'gc-done' : 'gc-locked'}`}>
        <div className="gc-teams">
          <div className="gc-team">
            <Flag team={game.home_team} />
            <span className="gc-tname">{teamHe(game.home_team)}</span>
          </div>
          <div className="gc-mid">
            {isCompleted
              ? <span className="gc-time" style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700 }}>{game.home_score}:{game.away_score}</span>
              : <span className="gc-time">{fmtTime(game.kickoff_at)}</span>
            }
            <span className="gc-vs">{isCompleted ? 'סופי' : 'VS'}</span>
          </div>
          <div className="gc-team">
            <Flag team={game.away_team} />
            <span className="gc-tname">{teamHe(game.away_team)}</span>
          </div>
        </div>
        <div className="gc-submitted">
          {won
            ? <span style={{ color: 'var(--green)' }}>✓ ניחשת {existingBet.exact_home}:{existingBet.exact_away}</span>
            : <span style={{ color: '#f87171' }}>✗ ניחשת {existingBet.exact_home}:{existingBet.exact_away}</span>
          }
          <span className="gc-submitted-sep">→</span>
          <span style={{ color: won ? 'var(--green)' : '#f87171', fontWeight: 700 }}>
            {won ? `+${existingBet.payout ?? 0} נק׳` : '0 נק׳'}
          </span>
        </div>
      </div>
    );
  }

  // ── Pending bet ──
  if (existingBet) {
    return (
      <div className="gc gc-done">
        <div className="gc-teams">
          <div className="gc-team">
            <Flag team={game.home_team} />
            <span className="gc-tname">{teamHe(game.home_team)}</span>
          </div>
          <div className="gc-mid">
            <span className="gc-time">{fmtTime(game.kickoff_at)}</span>
            <span className="gc-vs">VS</span>
          </div>
          <div className="gc-team">
            <Flag team={game.away_team} />
            <span className="gc-tname">{teamHe(game.away_team)}</span>
          </div>
        </div>
        <div className="gc-submitted">
          <CheckCircle2 size={14} />
          <span className="gc-exact-badge">⚡ {existingBet.exact_home}:{existingBet.exact_away}</span>
          <span className="gc-submitted-sep">→</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>כיוון </span>
          <span style={{ color: 'var(--green)', fontWeight: 700 }}>{resultPts}</span>
          <span style={{ color: 'var(--border)', margin: '0 3px' }}>|</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>🎯 מדויק </span>
          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{exactPts} נק׳</span>
        </div>
      </div>
    );
  }

  // ── Completed game (no bet) ──
  if (isCompleted) {
    return (
      <div className="gc gc-locked">
        <div className="gc-teams">
          <div className="gc-team">
            <Flag team={game.home_team} />
            <span className="gc-tname">{teamHe(game.home_team)}</span>
          </div>
          <div className="gc-mid">
            <span className="gc-time" style={{ color: 'var(--text)', fontSize: 20, fontWeight: 700 }}>{game.home_score}:{game.away_score}</span>
            <span className="gc-vs">סופי</span>
          </div>
          <div className="gc-team">
            <Flag team={game.away_team} />
            <span className="gc-tname">{teamHe(game.away_team)}</span>
          </div>
        </div>
        <div className="gc-lock-msg" style={{ color: 'var(--text-muted)' }}>לא הימרת על משחק זה</div>
      </div>
    );
  }

  // ── Game started, no bet ──
  if (isStarted) {
    return (
      <div className="gc gc-locked">
        <div className="gc-teams">
          <div className="gc-team">
            <Flag team={game.home_team} />
            <span className="gc-tname">{teamHe(game.home_team)}</span>
          </div>
          <div className="gc-mid">
            <span className="gc-time">{fmtTime(game.kickoff_at)}</span>
            <span className="gc-vs">VS</span>
          </div>
          <div className="gc-team">
            <Flag team={game.away_team} />
            <span className="gc-tname">{teamHe(game.away_team)}</span>
          </div>
        </div>
        <div className="gc-lock-msg">
          <Lock size={13} />
          <span>ההימורים נסגרו</span>
        </div>
      </div>
    );
  }

  // ── Open for betting ──
  return (
    <div className={`gc ${hasScore ? 'gc-picked' : ''}`}>
      <div className="gc-teams">
        <div className="gc-team">
          <Flag team={game.home_team} />
          <span className="gc-tname">{teamHe(game.home_team)}</span>
        </div>
        <div className="gc-mid">
          <span className="gc-time">{fmtTime(game.kickoff_at)}</span>
          <span className="gc-vs">VS</span>
        </div>
        <div className="gc-team">
          <Flag team={game.away_team} />
          <span className="gc-tname">{teamHe(game.away_team)}</span>
        </div>
      </div>

      <div className="gc-exact-inputs gc-score-primary">
        <div className="gc-exact-team"><Flag team={game.home_team} size={32} /></div>
        <input
          type="number" min="0" max="20" inputMode="numeric"
          className="gc-score-input gc-score-lg"
          value={bet.exactHome}
          onChange={e => onChange({ exactHome: e.target.value })}
          placeholder="?"
        />
        <span className="gc-score-colon">:</span>
        <input
          type="number" min="0" max="20" inputMode="numeric"
          className="gc-score-input gc-score-lg"
          value={bet.exactAway}
          onChange={e => onChange({ exactAway: e.target.value })}
          placeholder="?"
        />
        <div className="gc-exact-team"><Flag team={game.away_team} size={32} /></div>
      </div>

      {hasScore && (
        <div className="gc-amount fade-in">
          <div className="gc-potential">
            <span className="gc-pot-label">כיוון נכון</span>
            <span className="gc-pot-val">{resultPts}</span>
            <span className="gc-pot-u">נק׳</span>
            <span style={{ color: 'var(--border)', margin: '0 4px' }}>|</span>
            <span className="gc-pot-label">🎯 מדויק</span>
            <span className="gc-pot-val" style={{ color: 'var(--gold)' }}>{exactPts}</span>
            <span className="gc-pot-u">נק׳</span>
          </div>
        </div>
      )}
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
