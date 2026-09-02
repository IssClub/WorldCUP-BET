import { useState, useEffect, useMemo, useRef, useCallback, useReducer } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Settings, Bet } from '../lib/supabase';
import { LEAGUE_BADGES } from '../lib/leagueBadges';
import { teamHe } from '../lib/teamNames';
import { CheckCircle2, Lock, Trash2 } from 'lucide-react';
import AppHeader from '../components/AppHeader';

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
  postponed?: boolean;
}

interface BetState {
  exactHome: string;
  exactAway: string;
}

interface PublicBet {
  display_name: string;
  exact_home: number | null;
  exact_away: number | null;
  pick: 'home' | 'draw' | 'away';
}

// ── Live scores ───────────────────────────────────────────
interface LiveScore {
  homeScore: number;
  awayScore: number;
  minute: string;      // "45'", "הפסקה", "סופי"
  statusGroup: number; // 2=live, 3=halfTime, 4=finished
}

const LIVE_POLL_MS = 45_000;
const GAME_WINDOW_MS = 2.5 * 60 * 60 * 1000;

// מיפוי שמות עברית (365scores) לאנגלית (DB) — כולל חלופות כתיב
const HE_TO_EN: Record<string, string> = {
  'עירוני קרית שמונה':  'Hapoel Ironi Kiryat Shmona',
  'הפועל ירושלים':      'Hapoel Jerusalem',
  'הפועל רמת גן':       'Hapoel Ramat Gan',
  'מכבי פתח תקוה':      'Maccabi Petah Tikva',
  'מכבי פתח תקווה':     'Maccabi Petah Tikva',
  'עירוני טבריה':       'Ironi Tiberias',
  'הפועל פתח תקוה':     'Hapoel Petah Tikva',
  'הפועל פתח תקווה':    'Hapoel Petah Tikva',
  'הפועל באר שבע':      "Hapoel Be'er Sheva",
  'הפועל חיפה':         'Hapoel Haifa',
  'הפועל תל אביב':      'Hapoel Tel-Aviv',
  'בני סכנין':          'Bnei Sakhnin',
  'בית"ר ירושלים':      'Beitar Jerusalem',
  'מכבי נתניה':         'Maccabi Netanya',
  'מכבי תל אביב':       'Maccabi Tel Aviv',
  'מכבי חיפה':          'Maccabi Haifa',
};

function useLiveScores(games: Game[]): Map<string, LiveScore> {
  const [scores, setScores] = useState<Map<string, LiveScore>>(new Map());
  const timerRef = useRef<number | null>(null);

  const fetchScores = useCallback(async () => {
    const now = Date.now();
    const hasActive = games.some(g => {
      const t = new Date(g.kickoff_at).getTime();
      return !g.completed && t <= now && now <= t + GAME_WINDOW_MS;
    });
    if (!hasActive) return;

    const d = new Date();
    const today = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    try {
      const res = await fetch(
        `https://webws.365scores.com/web/games/?appTypeId=5&langId=2&timezoneName=Asia%2FJerusalem&userCountryId=6&competitions=42&startDate=${today}&endDate=${today}`,
        { headers: { Accept: 'application/json' } }
      );
      const data = await res.json();
      const map = new Map<string, LiveScore>();
      for (const g365 of (data.games ?? [])) {
        if ((g365.statusGroup ?? 1) < 2) continue; // עדיין לא התחיל
        const t365 = new Date(g365.startTime).getTime();
        const enHome = HE_TO_EN[g365.homeCompetitor?.name] ?? g365.homeCompetitor?.name ?? '';
        const enAway = HE_TO_EN[g365.awayCompetitor?.name] ?? g365.awayCompetitor?.name ?? '';
        // התאמה ראשית: שם קבוצה + שעה (±60 דק')
        let local = games.find(g =>
          !g.completed &&
          Math.abs(new Date(g.kickoff_at).getTime() - t365) <= 60 * 60_000 &&
          ((g.home_team === enHome && g.away_team === enAway) ||
           (g.home_team === enAway && g.away_team === enHome))
        );
        // fallback: שעה בלבד (±30 דק') אם ההתאמה לפי שם נכשלה
        if (!local) local = games.find(g =>
          !g.completed && Math.abs(new Date(g.kickoff_at).getTime() - t365) <= 30 * 60_000
        );
        if (!local) continue;
        // בדוק אם הקבוצות הפוכות — אם כן, הפוך את הניקוד
        const inverted = local.home_team === enAway && local.away_team === enHome;
        const score365Home = g365.homeCompetitor?.score ?? 0;
        const score365Away = g365.awayCompetitor?.score ?? 0;
        const sg = g365.statusGroup;
        // 365scores: 2=מחצית ראשונה, 3=מחצית שנייה, 4=סופי, 5=הפסקה
        const minute =
          sg === 4 ? 'סופי'   :
          sg === 5 ? 'הפסקה' :
          g365.gameTimeDisplay ? g365.gameTimeDisplay : 'חי';
        map.set(local.id, {
          homeScore: inverted ? score365Away : score365Home,
          awayScore: inverted ? score365Home : score365Away,
          minute,
          statusGroup: sg,
        });
      }
      setScores(map);
    } catch { /* silent fail — show nothing */ }
  }, [games]);

  useEffect(() => {
    fetchScores();
    timerRef.current = window.setInterval(fetchScores, LIVE_POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [fetchScores]);

  return scores;
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
  return <span style={{ fontSize: size * 0.6, lineHeight: 1 }}>🏳️</span>;
}

// ── Time utils ────────────────────────────────────────────
const TZ = 'Asia/Jerusalem';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const fmtDateHe = (iso: string) => {
  const d = new Date(iso);
  const weekday = d.toLocaleDateString('he-IL', { weekday: 'long', timeZone: TZ });
  const [y, m, day] = d.toLocaleDateString('en-CA', { timeZone: TZ }).split('-');
  return `${weekday}, ${day}/${m}/${y.slice(2)}`;
};

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
  homeRef, awayRef, onHomeComplete, onAwayComplete, expanded, onExpand, publicBets, liveScore, onCancelBet }: {
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
  expanded?: boolean;
  onExpand?: () => void;
  publicBets?: PublicBet[] | null;
  liveScore?: LiveScore | null;
  onCancelBet?: () => void;
}) {
  const hasScore = bet.exactHome !== '' && bet.exactAway !== '';
  const isCompleted = game.completed && game.home_score !== null && game.away_score !== null;
  const canExpand = isStarted && onExpand != null;

  // shared outer wrapper
  const teamSide = (side: 'home' | 'away') => (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, minWidth: 0 }}>
      <Flag team={side === 'home' ? game.home_team : game.away_team} size={44} />
      <span className="gc-tname">{teamHe(side === 'home' ? game.home_team : game.away_team)}</span>
    </div>
  );

  const expandPanel = expanded && (
    <div style={{ background: 'var(--surface2)', borderRadius: '0 0 14px 14px', padding: '8px 14px 10px', borderTop: '1px solid var(--border)' }}>
      {publicBets == null ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '4px 0' }}>טוען...</div>
      ) : publicBets.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 13, padding: '4px 0' }}>אין הימורים</div>
      ) : (
        publicBets.map((pb, i) => (
          <div key={i} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '5px 0',
            borderBottom: i < publicBets.length - 1 ? '1px solid var(--border)' : 'none',
          }}>
            <span style={{ fontSize: 13, color: 'var(--text)' }}>{pb.display_name}</span>
            <span dir="ltr" style={{ fontSize: 14, fontWeight: 700, fontFamily: "'Bebas Neue', cursive", letterSpacing: 1 }}>
              {pb.exact_away ?? '?'}:{pb.exact_home ?? '?'}
            </span>
          </div>
        ))
      )}
    </div>
  );

  // ── Settled bet ──
  if (existingBet && (existingBet.status === 'won' || existingBet.status === 'lost')) {
    const won = existingBet.status === 'won';
    const card = (
      <div className={`gc ${won ? 'gc-done' : ''}`} style={{ padding: '12px 14px', opacity: won ? 1 : 0.75, borderRadius: expanded ? '14px 14px 0 0' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {teamSide('home')}
          <div style={{ textAlign: 'center', padding: '0 6px', minWidth: 90 }}>
            {isCompleted
              ? <div dir="ltr" style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 22, letterSpacing: 2, color: 'var(--text)' }}>
                  {game.away_score} : {game.home_score}
                </div>
              : <div className="gc-time">{fmtTime(game.kickoff_at)}</div>
            }
            <div dir="ltr" style={{ fontSize: 13, color: won ? 'var(--green)' : '#f87171', fontWeight: 700, marginTop: 2 }}>
              {won ? '✓' : '✗'} {existingBet.exact_away}:{existingBet.exact_home} → {won ? `+${existingBet.payout ?? 0}` : '0'} נק׳
            </div>
            {canExpand && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{expanded ? '▲ סגור' : '▼ ניחושי כולם'}</div>}
          </div>
          {teamSide('away')}
        </div>
      </div>
    );
    if (canExpand) return <div onClick={onExpand} style={{ cursor: 'pointer' }}>{card}{expandPanel}</div>;
    return card;
  }

  // ── Pending bet ──
  if (existingBet) {
    const isLiveNow = liveScore && liveScore.statusGroup <= 3;
    const canCancelHere = !isStarted && onCancelBet != null;
    const card = (
      <div className="gc gc-done" style={{ padding: '12px 14px', borderRadius: expanded ? '14px 14px 0 0' : undefined }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {teamSide('home')}
          <div style={{ textAlign: 'center', padding: '0 6px', minWidth: 90 }}>
            {liveScore ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 2 }}>
                  {isLiveNow && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />}
                  <span style={{ fontSize: 11, color: isLiveNow ? '#ef4444' : 'var(--text-muted)', fontWeight: 700 }}>{liveScore.minute}</span>
                </div>
                <div dir="ltr" style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 26, letterSpacing: 2, color: 'var(--text)', lineHeight: 1 }}>
                  {liveScore.awayScore} : {liveScore.homeScore}
                </div>
              </>
            ) : (
              <div className="gc-time">{fmtTime(game.kickoff_at)}</div>
            )}
            <div dir="ltr" style={{ fontSize: 13, fontWeight: 700, color: 'var(--green)', marginTop: 3 }}>
              ⚡ {existingBet.exact_away}:{existingBet.exact_home}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
              <span style={{ color: 'var(--green)' }}>✓</span> {resultPts} | 🎯 {exactPts} נק׳
            </div>
            {canExpand && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>{expanded ? '▲ סגור' : '▼ ניחושי כולם'}</div>}
            {canCancelHere && (
              <button
                onClick={e => { e.stopPropagation(); onCancelBet!(); }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  marginTop: 5, padding: '3px 8px', borderRadius: 6,
                  border: '1px dashed rgba(248,113,113,0.4)',
                  background: 'rgba(248,113,113,0.07)',
                  color: '#f87171', fontSize: '0.68rem',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={10} />
                בטל
              </button>
            )}
          </div>
          {teamSide('away')}
        </div>
      </div>
    );
    if (canExpand) return <div onClick={onExpand} style={{ cursor: 'pointer' }}>{card}{expandPanel}</div>;
    return card;
  }

  // ── Completed, no bet ──
  if (isCompleted) {
    return (
      <div className="gc" style={{ padding: '12px 14px', opacity: 0.65 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {teamSide('home')}
          <div style={{ textAlign: 'center', padding: '0 6px', minWidth: 90 }}>
            <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 24, letterSpacing: 2 }}>
              {game.away_score} : {game.home_score}
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
    const isLiveNow = liveScore && liveScore.statusGroup <= 3;
    const card = (
      <div className="gc gc-locked" style={{ padding: '12px 14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {teamSide('home')}
          <div style={{ textAlign: 'center', padding: '0 6px', minWidth: 80 }}>
            {liveScore ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 2 }}>
                  {isLiveNow && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1.2s infinite' }} />}
                  <span style={{ fontSize: 11, color: isLiveNow ? '#ef4444' : 'var(--text-muted)', fontWeight: 700 }}>{liveScore.minute}</span>
                </div>
                <div dir="ltr" style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 26, letterSpacing: 2, color: 'var(--text)', lineHeight: 1 }}>
                  {liveScore.awayScore} : {liveScore.homeScore}
                </div>
              </>
            ) : (
              <>
                <Lock size={16} style={{ color: 'var(--text-muted)', margin: '0 auto 2px' }} />
                <div className="gc-time">{fmtTime(game.kickoff_at)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>נסגרו</div>
              </>
            )}
          </div>
          {teamSide('away')}
        </div>
        {canExpand && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3, textAlign: 'center' }}>{expanded ? '▲ סגור' : '▼ ניחושי כולם'}</div>}
      </div>
    );
    if (canExpand) return <div onClick={onExpand} style={{ cursor: 'pointer' }}>{card}{expandPanel}</div>;
    return card;
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
              <span style={{ color: 'var(--green)' }}>✓</span> {resultPts} | 🎯 {exactPts} נק׳
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
  const [postponedPrev, setPostponedPrev] = useState<Game[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [existingBets, setExistingBets] = useState<Bet[]>([]);
  const [bets, setBets] = useState<Record<string, BetState>>({});
  const [currentRound, setCurrentRound] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [expandedGame, setExpandedGame] = useState<string | null>(null);
  const [gameBets, setGameBets] = useState<Record<string, PublicBet[]>>({});
  const [error, setError] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  const liveScores = useLiveScores([...games, ...postponedPrev]);

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
      const incompleteActive = incomplete.filter(g => !g.postponed);
      const nextRound = incompleteActive.length > 0
        ? Math.min(...incompleteActive.map(g => g.round_num ?? 99))
        : (incomplete.length > 0 ? Math.min(...incomplete.map(g => g.round_num ?? 99)) : null);
      const roundGames = nextRound !== null
        ? allGames.filter(g => g.round_num === nextRound)
        : [];
      const postponed = allGames.filter(g => g.postponed && !g.completed && g.round_num !== nextRound);
      setGames(roundGames);
      setPostponedPrev(postponed);
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

  // Ordered list of games still open for betting (includes postponed from prev rounds)
  const bettableGameIds = useMemo(() =>
    [...games, ...postponedPrev]
      .filter(g => !g.completed
        && (g.postponed || new Date(g.kickoff_at).getTime() > Date.now() + CUTOFF_MS)
        && !existingBets.find(e => e.external_game_id === g.id))
      .map(g => g.id),
    [games, postponedPrev, existingBets]
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

  const readyBets = useMemo(() => [...games, ...postponedPrev].filter(g => {
    if (g.completed) return false;
    if (!g.postponed && new Date(g.kickoff_at).getTime() <= Date.now() + CUTOFF_MS) return false;
    const b = bets[g.id];
    return b != null && b.exactHome !== '' && b.exactAway !== ''
      && !existingBets.find(e => e.external_game_id === g.id);
  }), [games, postponedPrev, bets, existingBets]);

  async function cancelBet(bet: Bet) {
    if (!profile) return;
    const { error: delErr } = await supabase.from('bets').delete().eq('id', bet.id);
    if (delErr) { alert('שגיאה בביטול: ' + delErr.message); return; }
    if (settings?.use_bank) {
      await supabase.from('profiles').update({ bank: profile.bank + bet.amount }).eq('id', profile.id);
      await refresh();
    }
    setExistingBets(prev => prev.filter(b => b.id !== bet.id));
  }

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

  async function toggleGameBets(gameId: string) {
    if (expandedGame === gameId) { setExpandedGame(null); return; }
    setExpandedGame(gameId);
    if (gameBets[gameId]) return;
    const { data } = await supabase
      .from('bets')
      .select('exact_home, exact_away, pick, profiles:player_id(display_name)')
      .eq('external_game_id', gameId);
    if (data) {
      const mapped: PublicBet[] = data.map((b: any) => ({
        display_name: b.profiles?.display_name ?? '?',
        exact_home: b.exact_home,
        exact_away: b.exact_away,
        pick: b.pick,
      }));
      setGameBets(prev => ({ ...prev, [gameId]: mapped }));
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

      <AppHeader title="הימורים" onRefresh={loadData} />
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
                    isStarted={!game.postponed && new Date(game.kickoff_at).getTime() <= Date.now() + CUTOFF_MS}
                    onChange={upd => updateBet(game.id, upd)}
                    homeRef={el => homeRefs.current.set(game.id, el)}
                    awayRef={el => awayRefs.current.set(game.id, el)}
                    onHomeComplete={() => handleAutoFocus(game.id, 'home')}
                    onAwayComplete={() => handleAutoFocus(game.id, 'away')}
                    expanded={expandedGame === game.id}
                    onExpand={() => toggleGameBets(game.id)}
                    publicBets={gameBets[game.id] ?? null}
                    liveScore={liveScores.get(game.id) ?? null}
                    onCancelBet={() => { const eb = existingBets.find(b => b.external_game_id === game.id); if (eb) cancelBet(eb); }}
                  />
                ))}
              </div>
            </div>
          ))
        )}

        {error && <div className="err-banner">{error}</div>}

        {/* ── נדחים ממחזורים קודמים ── */}
        {postponedPrev.length > 0 && (() => {
          const byRound: Record<number, Game[]> = {};
          for (const g of postponedPrev) {
            const r = g.round_num ?? 0;
            if (!byRound[r]) byRound[r] = [];
            byRound[r].push(g);
          }
          return (
            <div style={{ marginTop: 24 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginBottom: 8, letterSpacing: 1 }}>
                🔄 משחקים נדחים
              </div>
              {Object.entries(byRound).sort(([a],[b]) => Number(a)-Number(b)).map(([round, rGames]) => (
                <div key={round}>
                  <div className="day-row" style={{ opacity: 0.7 }}>
                    <span className="day-dot" />
                    <span className="day-title">מחזור {round} (נדחה)</span>
                  </div>
                  {/* group by date within each postponed round */}
                  {(() => {
                    const byDay: { day: string; games: Game[] }[] = [];
                    for (const g of rGames) {
                      const k = dayKey(g.kickoff_at);
                      let grp = byDay.find(x => x.day === k);
                      if (!grp) { grp = { day: k, games: [] }; byDay.push(grp); }
                      grp.games.push(g);
                    }
                    return byDay.map(dayGrp => (
                      <div key={dayGrp.day}>
                        <div className="day-row" style={{ opacity: 0.55 }}>
                          <span className="day-dot" />
                          <span className="day-date">{fmtDateHe(dayGrp.games[0].kickoff_at)}</span>
                        </div>
                        <div className="games-list">
                          {dayGrp.games.map(game => (
                            <div key={game.id} style={{ position: 'relative' }}>
                              <div style={{
                                position: 'absolute', top: 8, right: 8, zIndex: 2,
                                background: '#f59e0b', color: '#000', fontSize: 10, fontWeight: 700,
                                padding: '2px 7px', borderRadius: 20, letterSpacing: 0.5,
                              }}>נדחה</div>
                              <GameCard
                                game={game}
                                resultPts={resultPts}
                                exactPts={exactPts}
                                bet={getBet(game.id)}
                                existingBet={existingBets.find(b => b.external_game_id === game.id) ?? null}
                                isStarted={false}
                                onChange={upd => updateBet(game.id, upd)}
                                homeRef={el => homeRefs.current.set(game.id, el)}
                                awayRef={el => awayRefs.current.set(game.id, el)}
                                onHomeComplete={() => handleAutoFocus(game.id, 'home')}
                                onAwayComplete={() => handleAutoFocus(game.id, 'away')}
                                expanded={false}
                                onExpand={undefined}
                                publicBets={null}
                                onCancelBet={() => { const eb = existingBets.find(b => b.external_game_id === game.id); if (eb) cancelBet(eb); }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              ))}
            </div>
          );
        })()}
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
