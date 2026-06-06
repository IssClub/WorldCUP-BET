import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import type { Settings, Bet, SpecialBet } from '../lib/supabase';
import { flagUrl } from '../lib/flagMap';
import { teamHe } from '../lib/teamNames';
import { WINNER_ODDS, TOP_SCORER_ODDS } from '../lib/tournamentOdds';
import { CheckCircle2, Zap, RefreshCw, Trophy, Lock } from 'lucide-react';

const BET_AMOUNT = 10; // סכום קבוע לכל הימור

// ── Types ─────────────────────────────────────────────────
type Pick = 'home' | 'draw' | 'away';

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  home_win: number;
  draw: number;
  away_win: number;
  oddsLocked: boolean;
}

interface BetState {
  pick: Pick | null;
  exactHome: string;
  exactAway: string;
}

// ── Flag component ────────────────────────────────────────
function Flag({ team, size = 56 }: { team: string; size?: number }) {
  const url = flagUrl(team, 'w80');
  if (!url) return <span style={{ fontSize: size * 0.6, lineHeight: 1 }}>🏳️</span>;
  return (
    <img
      src={url}
      alt={team}
      width={size}
      height={Math.round(size * 0.6)}
      style={{ borderRadius: 4, objectFit: 'cover', display: 'block', boxShadow: '0 2px 8px rgba(0,0,0,0.4)' }}
    />
  );
}

// ── Time utils ────────────────────────────────────────────
const TZ = 'Asia/Jerusalem';
const dayKey = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });
const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const fmtDateHe = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });

// ── Odds extraction ───────────────────────────────────────
function extractOdds(g: any): { home_win: number; draw: number; away_win: number } | null {
  const preferred = ['bet365', 'pinnacle', 'unibet_eu', 'betfair_ex_eu', 'marathonbet', 'coolbet'];
  for (const key of preferred) {
    const bm = g.bookmakers?.find((b: any) => b.key === key);
    if (!bm) continue;
    const mkt = bm.markets?.find((m: any) => m.key === 'h2h');
    if (!mkt) continue;
    const home = mkt.outcomes.find((o: any) => o.name === g.home_team);
    const away = mkt.outcomes.find((o: any) => o.name === g.away_team);
    const draw = mkt.outcomes.find((o: any) => o.name === 'Draw');
    if (home && away && draw)
      return { home_win: home.price, draw: draw.price, away_win: away.price };
  }
  // average fallback
  const totals: Record<string, number[]> = { home: [], draw: [], away: [] };
  for (const bm of (g.bookmakers || [])) {
    const mkt = bm.markets?.find((m: any) => m.key === 'h2h');
    if (!mkt) continue;
    const home = mkt.outcomes.find((o: any) => o.name === g.home_team);
    const away = mkt.outcomes.find((o: any) => o.name === g.away_team);
    const draw = mkt.outcomes.find((o: any) => o.name === 'Draw');
    if (home) totals.home.push(home.price);
    if (away) totals.away.push(away.price);
    if (draw) totals.draw.push(draw.price);
  }
  if (!totals.home.length) return null;
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 100) / 100;
  return { home_win: avg(totals.home), draw: avg(totals.draw), away_win: avg(totals.away) };
}

// ── GameCard ──────────────────────────────────────────────
function GameCard({ game, settings, bet, existingBet, isStarted, onChange }: {
  game: Game;
  settings: Settings;
  bet: BetState;
  existingBet: Bet | null;
  isStarted: boolean;
  onChange: (b: Partial<BetState>) => void;
}) {
  const odds: Record<Pick, number> = { home: game.home_win, draw: game.draw, away: game.away_win };

  // ── No locked odds yet ──
  if (!game.oddsLocked && !existingBet) {
    return (
      <div className="gc gc-locked">
        <div className="gc-teams">
          <div className="gc-team">
            <Flag team={game.home_team} />
            <span className="gc-tname">{teamHe(game.home_team)}</span>
          </div>
          <div className="gc-mid">
            <span className="gc-time">{fmtTime(game.commence_time)}</span>
            <span className="gc-vs">VS</span>
          </div>
          <div className="gc-team">
            <Flag team={game.away_team} />
            <span className="gc-tname">{teamHe(game.away_team)}</span>
          </div>
        </div>
        <div className="gc-lock-msg">
          <Lock size={13} />
          <span>יחסים ייפתחו 48 שעות לפני המשחק</span>
        </div>
      </div>
    );
  }

  // תוצאה מדויקת בלבד — ניחוש הכיוון נגזר אוטומטית
  const hasScore = bet.exactHome !== '' && bet.exactAway !== '';
  const derivedPick: Pick | null = hasScore
    ? (parseInt(bet.exactHome) > parseInt(bet.exactAway) ? 'home'
      : parseInt(bet.exactHome) < parseInt(bet.exactAway) ? 'away' : 'draw')
    : null;
  const derivedOdds = derivedPick ? odds[derivedPick] : null;
  const potential = derivedOdds ? Math.floor(BET_AMOUNT * derivedOdds) : 0;
  const bonusPotential = potential > 0 ? Math.floor(potential * 1.5) : 0;
  const derivedLabel = derivedPick === 'home' ? `ניצחון ${teamHe(game.home_team).slice(0, 9)}`
    : derivedPick === 'away' ? `ניצחון ${teamHe(game.away_team).slice(0, 9)}`
    : derivedPick === 'draw' ? 'תיקו' : null;

  // ── Started & no bet ──
  if (isStarted && !existingBet) {
    return (
      <div className="gc gc-locked">
        <div className="gc-teams">
          <div className="gc-team">
            <Flag team={game.home_team} />
            <span className="gc-tname">{teamHe(game.home_team)}</span>
          </div>
          <div className="gc-mid">
            <span className="gc-time">{fmtTime(game.commence_time)}</span>
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

  // ── Already bet ──
  if (existingBet) {
    const pot = Math.floor(existingBet.amount * existingBet.odds_value);
    const bonusPot = Math.floor(pot * 1.5);
    const pickDir = existingBet.pick === 'home' ? teamHe(existingBet.home_team)
      : existingBet.pick === 'away' ? teamHe(existingBet.away_team) : 'תיקו';
    return (
      <div className="gc gc-done">
        <div className="gc-teams">
          <div className="gc-team">
            <Flag team={game.home_team} />
            <span className="gc-tname">{teamHe(game.home_team)}</span>
          </div>
          <div className="gc-mid">
            <span className="gc-time">{fmtTime(game.commence_time)}</span>
            <span className="gc-vs">VS</span>
          </div>
          <div className="gc-team">
            <Flag team={game.away_team} />
            <span className="gc-tname">{teamHe(game.away_team)}</span>
          </div>
        </div>
        <div className="gc-submitted">
          <CheckCircle2 size={14} />
          {existingBet.exact_home !== null
            ? <span className="gc-exact-badge">⚡ {existingBet.exact_home}:{existingBet.exact_away}</span>
            : <span>{pickDir} × {existingBet.odds_value.toFixed(2)}</span>
          }
          <span className="gc-submitted-sep">→</span>
          <span style={{ color: 'var(--green)', fontWeight: 700 }}>{pot}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 11, margin: '0 2px' }}>/</span>
          <span style={{ color: 'var(--gold)', fontWeight: 700 }}>🎯{bonusPot} נק׳</span>
        </div>
      </div>
    );
  }

  // ── Betting card ──
  return (
    <div className={`gc ${hasScore ? 'gc-picked' : ''}`}>
      {/* Teams */}
      <div className="gc-teams">
        <div className="gc-team">
          <Flag team={game.home_team} />
          <span className="gc-tname">{teamHe(game.home_team)}</span>
        </div>
        <div className="gc-mid">
          <span className="gc-time">{fmtTime(game.commence_time)}</span>
          <span className="gc-vs">VS</span>
        </div>
        <div className="gc-team">
          <Flag team={game.away_team} />
          <span className="gc-tname">{teamHe(game.away_team)}</span>
        </div>
      </div>

      {/* 1X2 — יחסים + הדגשה אוטומטית לפי תוצאה */}
      <div className="gc-odds-row">
        {(['home', 'draw', 'away'] as Pick[]).map(p => {
          const label = p === 'draw' ? 'X'
            : p === 'home' ? teamHe(game.home_team).slice(0, 7)
            : teamHe(game.away_team).slice(0, 7);
          return (
            <div key={p} className={`gc-odds-cell ${derivedPick === p ? 'gc-odds-active' : ''}`}>
              <span className="gc-odds-val">{odds[p].toFixed(2)}</span>
            </div>
          );
        })}
      </div>

      {/* Score inputs — הפעולה הראשית */}
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

      {/* פוטנציאל — מופיע אחרי מילוי תוצאה */}
      {hasScore && (
        <div className="gc-potential fade-in" style={{ marginTop: 10 }}>
          <Zap size={13} style={{ color: 'var(--gold)' }} />
          <span className="gc-pot-label">כיוון נכון</span>
          <span className="gc-pot-val">{potential}</span>
          <span className="gc-pot-u">נק׳</span>
          <span style={{ color: 'var(--border)', margin: '0 2px' }}>|</span>
          <span className="gc-pot-label">🎯 מדויק</span>
          <span className="gc-pot-val" style={{ color: 'var(--gold)' }}>{bonusPotential}</span>
          <span className="gc-pot-u">נק׳</span>
        </div>
      )}
    </div>
  );
}

// ── WC 2026 Teams for winner prediction ───────────────────
const WC_TEAMS = [
  'Argentina','Brazil','Colombia','Uruguay','Ecuador','Venezuela','Chile','Peru',
  'Spain','France','Germany','England','Portugal','Netherlands','Belgium','Croatia',
  'Switzerland','Denmark','Poland','Serbia','Turkey','Austria','Georgia','Scotland',
  'Romania','Slovakia','Czech Republic','Albania',
  'United States','Canada','Mexico','Panama','Costa Rica','Honduras','Jamaica',
  'Japan','Korea Republic','Iran','Australia','Saudi Arabia','Uzbekistan','Jordan','Iraq','China','Indonesia',
  'Morocco','Nigeria','Egypt','Senegal','Ivory Coast','South Africa','DR Congo','Mali','Cameroon','Algeria',
  'New Zealand',
].sort((a, b) => {
  const ha = (teamHe(a) || a), hb = (teamHe(b) || b);
  return ha.localeCompare(hb, 'he');
});

const TOURNAMENT_START = new Date('2026-06-11T00:00:00');
const WC_TEAM_SET = new Set(WC_TEAMS.map(t => t.toLowerCase()));

type OddsItem = { name: string; price: number };

function avgOddsFromEvent(ev: any): OddsItem[] {
  const map: Record<string, number[]> = {};
  for (const bm of ev.bookmakers ?? []) {
    for (const mkt of bm.markets ?? []) {
      for (const o of mkt.outcomes ?? []) {
        if (!map[o.name]) map[o.name] = [];
        map[o.name].push(o.price);
      }
    }
  }
  return Object.entries(map)
    .map(([name, ps]) => ({ name, price: +(ps.reduce((a, b) => a + b, 0) / ps.length).toFixed(2) }))
    .sort((a, b) => a.price - b.price);
}

// ── Special bets (winner + top scorer) ───────────────────
function SpecialBetsCard({ playerId }: { playerId: string }) {
  const [winner, setWinner] = useState('');
  const [topScorer, setTopScorer] = useState('');
  const [existing, setExisting] = useState<SpecialBet[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [winnerOdds, setWinnerOdds] = useState<OddsItem[]>([]);
  const [scorerOdds, setScorerOdds] = useState<(OddsItem & { team?: string })[]>([]);
  const isLocked = new Date() >= TOURNAMENT_START;

  useEffect(() => { load(); fetchOdds(); }, [playerId]);

  async function load() {
    const { data } = await supabase.from('special_bets').select('*').eq('player_id', playerId);
    if (!data) return;
    setExisting(data as SpecialBet[]);
    const w = data.find(d => d.type === 'winner');
    const t = data.find(d => d.type === 'top_scorer');
    if (w) setWinner(w.prediction);
    if (t) setTopScorer(t.prediction);
  }

  async function fetchOdds() {
    // Load hardcoded fallbacks immediately so there's always data
    setWinnerOdds(WINNER_ODDS);
    setScorerOdds(TOP_SCORER_ODDS.map(s => ({ name: s.name, price: s.price, team: s.team })));

    try {
      const key = import.meta.env.VITE_ODDS_API_KEY;
      if (!key) return;
      const res = await fetch(
        `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/outrights/?apiKey=${key}&regions=eu&oddsFormat=decimal`
      );
      if (!res.ok) return;
      const events: any[] = await res.json();
      if (!Array.isArray(events) || !events.length) return;
      let gotWinner = false, gotScorer = false;
      for (const ev of events) {
        const odds = avgOddsFromEvent(ev);
        if (!odds.length) continue;
        const countryHits = odds.filter(o => WC_TEAM_SET.has(o.name.toLowerCase())).length;
        if (!gotWinner && countryHits / odds.length > 0.4) {
          setWinnerOdds(odds);
          gotWinner = true;
        } else if (!gotScorer && odds.length >= 10) {
          // Merge API scorer list with our team data
          const merged = odds.slice(0, 30).map(o => {
            const known = TOP_SCORER_ODDS.find(s => s.name === o.name);
            return { name: o.name, price: o.price, team: known?.team ?? '' };
          });
          setScorerOdds(merged);
          gotScorer = true;
        }
      }
    } catch {}
  }

  async function save() {
    if (isLocked || (!winner && !topScorer)) return;
    setSaving(true);
    const upserts = [];
    if (winner) upserts.push({ player_id: playerId, type: 'winner', prediction: winner, status: 'pending' });
    if (topScorer) upserts.push({ player_id: playerId, type: 'top_scorer', prediction: topScorer, status: 'pending' });
    await supabase.from('special_bets').upsert(upserts, { onConflict: 'player_id,type' });
    await load();
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  const winnerBet = existing.find(e => e.type === 'winner');
  const scorerBet = existing.find(e => e.type === 'top_scorer');

  // Build winner options: if we got live odds use them (sorted by price), else fallback to WC_TEAMS
  const winnerOptions: OddsItem[] = winnerOdds.length > 0
    ? winnerOdds
    : WC_TEAMS.map(t => ({ name: t, price: 0 }));

  return (
    <div className="special-card">
      <div className="special-card-hdr">
        <div className="flex items-center gap-2">
          <Trophy size={16} style={{ color: 'var(--gold)' }} />
          <span className="font-bold text-sm">ניחושי טורניר</span>
        </div>
        {isLocked
          ? <span className="special-locked"><Lock size={11} /> נסגר</span>
          : <span className="special-deadline">נסגר ב-11.6 · ללא ניכוי נקודות</span>}
      </div>

      <div className="special-fields">
        {/* Winner */}
        <div className="special-field">
          <label className="special-label">🏆 מי יזכה בטורניר? {winnerOdds.length > 0 && <span style={{fontWeight:400,color:'var(--text-muted)'}}>· ממוין לפי סיכוי</span>}</label>
          {isLocked
            ? <div className="special-val">
                {winnerBet
                  ? <>
                      {teamHe(winnerBet.prediction)}
                      {(() => { const o = winnerOdds.find(x => x.name === winnerBet.prediction); return o ? <span className="special-odds-tag">×{o.price}</span> : null; })()}
                    </>
                  : '—'}
              </div>
            : <select className="special-select" value={winner} onChange={e => setWinner(e.target.value)}>
                <option value="">בחר נבחרת...</option>
                {winnerOptions.map(o => (
                  <option key={o.name} value={o.name}>
                    {teamHe(o.name)}{o.price > 0 ? `  ×${o.price}` : ''}
                  </option>
                ))}
              </select>}
        </div>

        {/* Top scorer */}
        <div className="special-field">
          <label className="special-label">👟 מי יהיה מלך השערים? {scorerOdds.length > 0 && <span style={{fontWeight:400,color:'var(--text-muted)'}}>· ממוין לפי סיכוי</span>}</label>
          {isLocked
            ? <div className="special-val">
                {scorerBet
                  ? <>
                      {scorerBet.prediction}
                      {(() => { const o = scorerOdds.find(x => x.name === scorerBet.prediction); return o ? <span className="special-odds-tag">×{o.price}</span> : null; })()}
                    </>
                  : '—'}
              </div>
            : scorerOdds.length > 0
              ? <select className="special-select" value={topScorer} onChange={e => setTopScorer(e.target.value)}>
                  <option value="">בחר שחקן...</option>
                  {scorerOdds.map(o => (
                    <option key={o.name} value={o.name}>
                      {o.name}{o.team ? ` (${teamHe(o.team)})` : ''}{'  '}×{o.price}
                    </option>
                  ))}
                </select>
              : <input
                  className="special-input"
                  value={topScorer}
                  onChange={e => setTopScorer(e.target.value)}
                  placeholder="שם השחקן..."
                />}
        </div>
      </div>

      {!isLocked && (
        <button className="special-save" onClick={save} disabled={saving || (!winner && !topScorer)}>
          {saved ? '✓ נשמר!' : saving ? 'שומר...' : 'שמור ניחושים'}
        </button>
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [justSubmitted, setJustSubmitted] = useState(false);

  const ODDS_KEY = import.meta.env.VITE_ODDS_API_KEY;

  useEffect(() => { loadData(); }, []);

  async function loadData() {
    setLoading(true);
    setError('');
    try {
      // שאילתות Supabase — תמיד חייבות לעבוד
      const [settingsRes, betsRes, customGamesRes] = await Promise.all([
        supabase.from('settings').select('*').single(),
        supabase.from('bets').select('*').eq('player_id', profile!.id),
        supabase.from('custom_games').select('*')
          .gte('kickoff_at', new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()),
      ]);

      if (settingsRes.data) setSettings(settingsRes.data);
      if (betsRes.data) setExistingBets(betsRes.data as Bet[]);

      // משחקים מותאמים — תמיד מוצגים גם אם WC API נכשל
      const customProcessed: Game[] = ((customGamesRes as any).data ?? []).map((cg: any) => ({
        id: cg.id,
        home_team: cg.home_team,
        away_team: cg.away_team,
        commence_time: cg.kickoff_at,
        home_win: Number(cg.home_win),
        draw: Number(cg.draw_win),
        away_win: Number(cg.away_win),
        oddsLocked: true,
      }));

      // WC API — נכשלה? ממשיכים עם custom בלבד
      let wcProcessed: Game[] = [];
      try {
        const gamesRes = await fetch(
          `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${ODDS_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`
        );
        if (gamesRes.ok) {
          const raw: any[] = await gamesRes.json();
          const gameIds = raw.map(g => g.id);
          const { data: lockedOdds } = await supabase
            .from('locked_odds').select('*').in('external_game_id', gameIds);
          const lockedMap = new Map(
            (lockedOdds ?? []).map(lo => [lo.external_game_id, lo])
          );
          wcProcessed = raw.map(g => {
            const locked = lockedMap.get(g.id);
            if (locked) {
              return {
                id: g.id, home_team: g.home_team, away_team: g.away_team,
                commence_time: g.commence_time,
                home_win: Number(locked.home_win), draw: Number(locked.draw_win),
                away_win: Number(locked.away_win), oddsLocked: true,
              };
            }
            return {
              id: g.id, home_team: g.home_team, away_team: g.away_team,
              commence_time: g.commence_time,
              home_win: 0, draw: 0, away_win: 0, oddsLocked: false,
            };
          }) as Game[];
        }
      } catch { /* WC API failed — showing custom games only */ }

      setGames([...customProcessed, ...wcProcessed]);
    } catch {
      setError('שגיאה בטעינת המשחקים');
    } finally {
      setLoading(false);
    }
  }

  // Group games by day, find active day
  const gamesByDay = useMemo(() => {
    const map = new Map<string, Game[]>();
    for (const g of games) {
      const k = dayKey(g.commence_time);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(g);
    }
    return map;
  }, [games]);

  const today = todayKey();
  const todayGames = gamesByDay.get(today) || [];
  const firstDay = games[0] ? dayKey(games[0].commence_time) : null;
  const activeDay = todayGames.length > 0 ? today : firstDay;
  const activeGames = activeDay ? (gamesByDay.get(activeDay) || []) : [];

  function getBet(id: string): BetState {
    return bets[id] ?? { pick: null, amount: settings?.min_bet ?? 50, exactHome: '', exactAway: '' };
  }

  function updateBet(id: string, upd: Partial<BetState>) {
    setBets(prev => ({ ...prev, [id]: { ...getBet(id), ...upd } }));
  }

  // סגירת הימורים 5 דקות לפני kickoff
  const CUTOFF_MS = 5 * 60 * 1000;
  const readyBets = activeGames.filter(g => {
    if (!g.oddsLocked) return false;
    if (new Date(g.commence_time).getTime() <= Date.now() + CUTOFF_MS) return false;
    const b = bets[g.id];
    return b != null && b.exactHome !== '' && b.exactAway !== '' && !existingBets.find(e => e.external_game_id === g.id);
  });

  async function submitBets() {
    if (!profile || !settings || readyBets.length === 0) return;
    setSubmitting(true);
    setError('');
    const insertedBetIds: string[] = [];
    try {
      for (const g of readyBets) {
        const b = bets[g.id];
        const h = parseInt(b.exactHome), a = parseInt(b.exactAway);
        const derivedPick: Pick = h > a ? 'home' : h < a ? 'away' : 'draw';
        const oddsVal = derivedPick === 'home' ? g.home_win : derivedPick === 'draw' ? g.draw : g.away_win;
        const { data: inserted, error: insertErr } = await supabase.from('bets').insert({
          player_id: profile.id,
          external_game_id: g.id,
          home_team: g.home_team,
          away_team: g.away_team,
          kickoff_at: g.commence_time,
          pick: derivedPick,
          amount: BET_AMOUNT,
          odds_value: oddsVal,
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


  // ── Loading ──
  if (loading) return (
    <div className="pitch-bg flex items-center justify-center" style={{ minHeight: '100dvh' }}>
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">⚽</div>
        <div className="bebas text-3xl" style={{ color: 'var(--green)' }}>טוען משחקים...</div>
        <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>מביאים יחסים עדכניים</div>
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
        {/* ── ניחושי טורניר ── */}
        {profile && <SpecialBetsCard playerId={profile.id} />}


        {/* ── Day header ── */}
        {activeGames.length > 0 && (
          <div className="day-row">
            <span className="day-dot" />
            <span className="day-title">
              {activeDay === today ? 'משחקי היום' : 'משחקים קרובים'}
            </span>
            <span className="day-date">{fmtDateHe(activeGames[0].commence_time)}</span>
          </div>
        )}

        {/* ── Games ── */}
        {activeGames.length === 0 ? (
          <div className="card p-10 text-center mt-2">
            <div className="text-5xl mb-4">⚽</div>
            {(() => {
              const now = new Date();
              const tournamentStart = new Date('2026-06-11');
              const tournamentEnd   = new Date('2026-07-20');
              const duringTournament = now >= tournamentStart && now <= tournamentEnd;
              return duringTournament ? (
                <>
                  <div className="font-bold text-lg mb-1">משחקי היום החלו</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    אין הימורים פתוחים כרגע — עבור ללשונית מונדיאל לתוצאות
                  </div>
                </>
              ) : (
                <>
                  <div className="font-bold text-lg mb-1">אין משחקים בקרוב</div>
                  <div className="text-sm" style={{ color: 'var(--text-muted)' }}>המונדיאל מתחיל ב-11 ביוני 2026</div>
                </>
              );
            })()}
          </div>
        ) : (
          <div className="games-list">
            {activeGames.map(game => (
              <GameCard
                key={game.id}
                game={game}
                settings={settings!}
                bet={getBet(game.id)}
                existingBet={existingBets.find(b => b.external_game_id === game.id) ?? null}
                isStarted={new Date(game.commence_time).getTime() <= Date.now() + CUTOFF_MS}
                onChange={upd => updateBet(game.id, upd)}
              />
            ))}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="err-banner">{error}</div>
        )}
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
              <button className="submit-btn" onClick={submitBets} disabled={submitting || readyBets.length === 0}>
                {submitting
                  ? 'שולח...'
                  : readyBets.length === 0
                    ? 'הזן תוצאה לפחות להימור אחד'
                    : `שלח ${readyBets.length} הימור${readyBets.length !== 1 ? 'ים' : ''}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
