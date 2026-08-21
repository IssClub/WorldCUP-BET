import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { flagUrl } from '../lib/flagMap';
import { teamHe } from '../lib/teamNames';
import { supabase } from '../lib/supabase';
import type { TopScorer, SpecialBet } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { CalendarDays, LayoutList, CalendarPlus, Shirt, BookOpen, Trophy, Star } from 'lucide-react';
import { LEAGUE_BADGES } from '../lib/leagueBadges';
import { LEAGUE_TEAMS } from '../lib/tournamentOdds';

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  home_win: number;
  draw: number;
  away_win: number;
}

interface GameScore { homeScore: number; awayScore: number; completed: boolean }
type ScoreMap = Record<string, GameScore>;

interface LeagueFixture {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  home_score: number | null;
  away_score: number | null;
  completed: boolean;
  round_num: number | null;
}

// שידורים ישראל — עדכן כשתהיה רשימה רשמית
const CHANNEL_MAP: { home: string; away: string; channel: string }[] = [
  // { home: 'Argentina', away: 'France', channel: 'ערוץ 12 + Sport 5' },
];
function getChannel(home: string, away: string): string {
  const m = CHANNEL_MAP.find(c =>
    (c.home === home && c.away === away) || (c.home === away && c.away === home)
  );
  return m?.channel ?? 'Sport 5';
}

// ── Calendar ICS helpers ──────────────────────────────────
function buildIcs(events: string[][], filename: string) {
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WorldCup Bets//HE',
    ...events.map(e => e.join('\r\n')),
    'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = filename;
  a.click();
}
const icsDate = (iso: string) => iso.replace(/[-:.]/g, '').slice(0, 15) + 'Z';
const icsEvent = (kickoff: string, home: string, away: string, desc: string) => [
  'BEGIN:VEVENT',
  `DTSTART:${icsDate(kickoff)}`,
  `DTEND:${icsDate(new Date(new Date(kickoff).getTime() + 2 * 3600000).toISOString())}`,
  `SUMMARY:⚽ ${teamHe(home)} נגד ${teamHe(away)}`,
  `DESCRIPTION:${desc}`,
  'END:VEVENT',
];

function addAllToCalendar(games: Game[]) {
  buildIcs(games.map(g => icsEvent(g.commence_time, g.home_team, g.away_team, 'FIFA World Cup 2026 — שלב הבתים')), 'worldcup2026-groups.ics');
}

// ── Team badge color (fallback for unknown teams) ─────────
function teamColor(team: string): string {
  const palette = ['#e74c3c', '#3498db', '#27ae60', '#9b59b6', '#e67e22', '#16a085', '#2c3e50', '#c0392b'];
  let h = 0;
  for (const c of team) h = ((h << 5) - h + c.charCodeAt(0)) & 0x7fffffff;
  return palette[h % palette.length];
}

// ── Flag ──────────────────────────────────────────────────
function Flag({ team, size = 28 }: { team: string; size?: number }) {
  // 1. Israeli league badge
  const leagueBadge = LEAGUE_BADGES[team];
  if (leagueBadge) {
    return (
      <img
        src={leagueBadge} alt={team} width={size} height={size}
        style={{ borderRadius: 4, objectFit: 'contain', flexShrink: 0 }}
      />
    );
  }
  // 2. National team flag
  const url = flagUrl(team, 'w80');
  if (url) {
    return (
      <img
        src={url} alt={team} width={size} height={Math.round(size * 0.65)}
        style={{ borderRadius: 3, objectFit: 'cover', boxShadow: '0 1px 4px rgba(0,0,0,0.4)', flexShrink: 0 }}
      />
    );
  }
  // 3. Fallback: colored initials
  const label = teamHe(team).slice(0, 2);
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size, height: size,
      background: teamColor(team), borderRadius: 4,
      color: '#fff', fontWeight: 700, fontSize: Math.round(size * 0.38),
      flexShrink: 0, fontFamily: 'system-ui', userSelect: 'none',
    }}>
      {label}
    </span>
  );
}

// ── Time utils ────────────────────────────────────────────
const TZ = 'Asia/Jerusalem';
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const fmtDayFull = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
const dayKey = (iso: string) =>
  new Date(iso).toLocaleDateString('en-CA', { timeZone: TZ });

// ── Odds extraction ───────────────────────────────────────
function extractOdds(g: any): { home_win: number; draw: number; away_win: number } | null {
  const preferred = ['bet365', 'pinnacle', 'unibet_eu', 'betfair_ex_eu', 'marathonbet'];
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
  const t: Record<string, number[]> = { h: [], d: [], a: [] };
  for (const bm of (g.bookmakers || [])) {
    const mkt = bm.markets?.find((m: any) => m.key === 'h2h');
    if (!mkt) continue;
    const h = mkt.outcomes.find((o: any) => o.name === g.home_team);
    const a = mkt.outcomes.find((o: any) => o.name === g.away_team);
    const d = mkt.outcomes.find((o: any) => o.name === 'Draw');
    if (h) t.h.push(h.price); if (a) t.a.push(a.price); if (d) t.d.push(d.price);
  }
  if (!t.h.length) return null;
  const avg = (arr: number[]) => Math.round(arr.reduce((a, b) => a + b, 0) / arr.length * 100) / 100;
  return { home_win: avg(t.h), draw: avg(t.d), away_win: avg(t.a) };
}

// ── Group inference (BFS connected components) ────────────
function inferGroups(games: Game[]): Map<string, { teams: string[]; games: Game[] }> {
  const adj = new Map<string, Set<string>>();
  for (const g of games) {
    if (!adj.has(g.home_team)) adj.set(g.home_team, new Set());
    if (!adj.has(g.away_team)) adj.set(g.away_team, new Set());
    adj.get(g.home_team)!.add(g.away_team);
    adj.get(g.away_team)!.add(g.home_team);
  }
  const visited = new Set<string>();
  const components: string[][] = [];
  for (const team of adj.keys()) {
    if (visited.has(team)) continue;
    const component: string[] = [];
    const queue = [team];
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      component.push(curr);
      for (const neighbor of (adj.get(curr) ?? [])) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    components.push(component);
  }
  components.sort((a, b) => {
    const aDate = games.find(g => a.includes(g.home_team) && a.includes(g.away_team))?.commence_time ?? '';
    const bDate = games.find(g => b.includes(g.home_team) && b.includes(g.away_team))?.commence_time ?? '';
    return aDate.localeCompare(bDate);
  });
  const letters = 'ABCDEFGHIJKL'.split('');
  const result = new Map<string, { teams: string[]; games: Game[] }>();
  components.forEach((teams, i) => {
    const letter = letters[i] ?? `${i + 1}`;
    const grpGames = games
      .filter(g => teams.includes(g.home_team) && teams.includes(g.away_team))
      .sort((a, b) => a.commence_time.localeCompare(b.commence_time));
    result.set(letter, { teams, games: grpGames });
  });
  return result;
}

// ── WC Schedule view (chronological + group badge + channel) ──
function ScheduleView({ games, groups, scoreMap }: {
  games: Game[];
  groups: Map<string, { teams: string[]; games: Game[] }>;
  scoreMap: ScoreMap;
}) {
  const gameToGroup = new Map<string, string>();
  for (const [letter, { games: gGames }] of groups) {
    for (const g of gGames) gameToGroup.set(g.id, letter);
  }

  const byDay = useMemo(() => {
    const map = new Map<string, Game[]>();
    const sorted = [...games].sort((a, b) => a.commence_time.localeCompare(b.commence_time));
    for (const g of sorted) {
      const k = dayKey(g.commence_time);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(g);
    }
    return Array.from(map.entries());
  }, [games]);

  if (byDay.length === 0) return (
    <div className="card p-8 text-center mt-4">
      <div className="text-4xl mb-3">📅</div>
      <div className="font-bold">אין משחקים בלוח</div>
      <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>המונדיאל מתחיל ב-11 ביוני 2026</div>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <button className="sch-cal-all-btn" onClick={() => addAllToCalendar(games)}>
        <CalendarPlus size={15} />
        הוסף את כל המשחקים ליומן
      </button>

      {byDay.map(([dk, dayGames]) => (
        <div key={dk}>
          <div className="sch-day-hdr">{fmtDayFull(dayGames[0].commence_time)}</div>
          <div className="flex flex-col gap-2">
            {dayGames.map(g => {
              const grp = gameToGroup.get(g.id);
              const ch = getChannel(g.home_team, g.away_team);
              return (
                <div key={g.id} className="sch-row">
                  <div className="sch-row-top">
                    {grp && <span className="sch-badge">בית {grp}</span>}
                    <span className="sch-time">{fmtTime(g.commence_time)}</span>
                    {ch && <span className="sch-channel">{ch}</span>}
                  </div>

                  <div className="sch-match">
                    <div className="sch-home">
                      <Flag team={g.home_team} size={28} />
                      <span className="sch-tname">{teamHe(g.home_team)}</span>
                    </div>
                    {(() => {
                      const sc = scoreMap[g.id];
                      if (sc) return (
                        <div className="sch-score">
                          <span className="sch-score-num">{sc.homeScore}</span>
                          <span className="sch-score-sep">:</span>
                          <span className="sch-score-num">{sc.awayScore}</span>
                          {sc.completed && <span className="sch-score-ft">סיים</span>}
                          {!sc.completed && <span className="sch-score-live">חי</span>}
                        </div>
                      );
                      const now = new Date();
                      if (new Date(g.commence_time) <= now) return <span className="sch-vs">🔴</span>;
                      return <span className="sch-vs">VS</span>;
                    })()}
                    <div className="sch-away">
                      <span className="sch-tname">{teamHe(g.away_team)}</span>
                      <Flag team={g.away_team} size={28} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="sch-knockout">
        <div className="sch-knockout-title">🏆 שלב הנוק-אאוט</div>
        {[
          { stage: 'סיבוב 32', dates: '29 יוני – 3 יולי', games: 16 },
          { stage: 'שמינית גמר', dates: '6–9 יולי', games: 8 },
          { stage: 'רבע גמר', dates: '12–13 יולי', games: 4 },
          { stage: 'חצי גמר', dates: '16–17 יולי', games: 2 },
          { stage: 'גמר', dates: '19 יולי · מטה לייף', games: 1 },
        ].map(s => (
          <div key={s.stage} className="sch-ko-row">
            <span className="sch-ko-stage">{s.stage}</span>
            <span className="sch-ko-dates">{s.dates}</span>
            <span className="sch-ko-tbd">TBD × {s.games}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── League Schedule view — מחוזר, auto-scroll, כפתור צף ──
function LeagueScheduleView() {
  const [fixtures, setFixtures] = useState<LeagueFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJump, setShowJump] = useState(false);
  const roundRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    supabase.from('league_schedule').select('*').order('kickoff_at')
      .then(({ data }) => { setFixtures((data ?? []) as LeagueFixture[]); setLoading(false); });

    const ch = supabase.channel('league_sch_view')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_schedule' }, payload => {
        const updated = payload.new as LeagueFixture;
        setFixtures(prev => {
          const idx = prev.findIndex(f => f.id === updated.id);
          if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
          return [...prev, updated].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
        });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  // קבוצה לפי מחזור
  const byRound = useMemo(() => {
    const map = new Map<number, LeagueFixture[]>();
    for (const f of fixtures) {
      const r = f.round_num ?? 0;
      if (!map.has(r)) map.set(r, []);
      map.get(r)!.push(f);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a - b);
  }, [fixtures]);

  // המחזור הנוכחי — ראשון עם משחק שלא הסתיים, או האחרון אם הכל נגמר
  const currentRound = useMemo(() => {
    const now = new Date();
    for (const [r, rFix] of byRound) {
      if (rFix.some(f => !f.completed || new Date(f.kickoff_at) > now)) return r;
    }
    return byRound[byRound.length - 1]?.[0] ?? 1;
  }, [byRound]);

  // scroll למחזור הנוכחי אחרי טעינה
  useEffect(() => {
    if (loading || byRound.length === 0) return;
    const el = roundRefs.current.get(currentRound);
    if (el) setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
  }, [loading, currentRound, byRound.length]);

  // IntersectionObserver על המחזור הנוכחי — מציג כפתור "חזרה" כשהוא מחוץ למסך
  const setCurrentRoundRef = useCallback((el: HTMLDivElement | null) => {
    if (observerRef.current) observerRef.current.disconnect();
    if (!el) return;
    roundRefs.current.set(currentRound, el);
    observerRef.current = new IntersectionObserver(
      ([entry]) => setShowJump(!entry.isIntersecting),
      { threshold: 0.05 }
    );
    observerRef.current.observe(el);
  }, [currentRound]);

  const scrollToCurrent = () => {
    const el = roundRefs.current.get(currentRound);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const fmtRoundDate = (rFix: LeagueFixture[]) => {
    const sorted = [...rFix].sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
    return new Date(sorted[0].kickoff_at).toLocaleDateString('he-IL', {
      weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ,
    });
  };

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>טוען...</div>;

  if (byRound.length === 0) return (
    <div className="card p-8 text-center mt-4">
      <div className="text-4xl mb-3">📅</div>
      <div className="font-bold">אין לוח משחקים</div>
      <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
        הפעל "Seed league schedule" ב-GitHub Actions כדי לטעון את לוח המשחקים
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-6" style={{ position: 'relative' }}>
      {byRound.map(([round, rFix]) => {
        const isCurrent = round === currentRound;
        return (
          <div
            key={round}
            ref={isCurrent ? setCurrentRoundRef : el => { if (el) roundRefs.current.set(round, el); }}
          >
            <div className="sch-day-hdr" style={isCurrent ? { color: 'var(--accent)' } : {}}>
              <span style={{ fontWeight: 700 }}>מחזור {round}</span>
              <span style={{ marginRight: 8, fontSize: '0.8rem', opacity: 0.75 }}>
                — {fmtRoundDate(rFix)}
              </span>
              {isCurrent && (
                <span style={{
                  marginRight: 8, fontSize: '0.65rem', background: 'var(--accent)',
                  color: '#fff', borderRadius: 10, padding: '1px 7px',
                }}>נוכחי</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              {rFix.map(f => (
                <div key={f.id} className="sch-row">
                  <div className="sch-row-top">
                    <span className="sch-time">{fmtDayFull(f.kickoff_at)} · {fmtTime(f.kickoff_at)}</span>
                  </div>
                  <div className="sch-match">
                    <div className="sch-home">
                      <Flag team={f.home_team} size={28} />
                      <span className="sch-tname">{teamHe(f.home_team)}</span>
                    </div>
                    {f.completed && f.home_score !== null ? (
                      <div className="sch-score">
                        <span className="sch-score-num">{f.home_score}</span>
                        <span className="sch-score-sep">:</span>
                        <span className="sch-score-num">{f.away_score}</span>
                        <span className="sch-score-ft">סיים</span>
                      </div>
                    ) : (
                      <span className="sch-vs">VS</span>
                    )}
                    <div className="sch-away">
                      <span className="sch-tname">{teamHe(f.away_team)}</span>
                      <Flag team={f.away_team} size={28} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {/* כפתור צף — חזרה למחזור הנוכחי */}
      {showJump && (
        <button
          onClick={scrollToCurrent}
          style={{
            position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
            background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 20,
            padding: '8px 18px', fontWeight: 700, fontSize: '0.85rem',
            boxShadow: '0 4px 16px rgba(0,0,0,0.35)', cursor: 'pointer', zIndex: 100,
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          📍 מחזור {currentRound} — נוכחי
        </button>
      )}
    </div>
  );
}

// ── Top Scorers view ──────────────────────────────────────
function TopScorersView() {
  const [scorers, setScorers] = useState<TopScorer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('top_scorers').select('*').order('goals', { ascending: false })
      .then(({ data }) => { setScorers((data as TopScorer[]) || []); setLoading(false); });
  }, []);

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>טוען...</div>;

  if (scorers.length === 0) return (
    <div className="card p-10 text-center mt-4">
      <div className="text-5xl mb-4">👟</div>
      <div className="font-bold text-lg">אין נתוני מלכי שערים</div>
      <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>סטטיסטיקות יופיעו כאן עם תחילת המשחקים</div>
    </div>
  );

  return (
    <div className="trn-group-card">
      <div className="trn-standings-hdr">
        <span className="trn-group-letter">מלכי השערים</span>
      </div>
      <table className="trn-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="trn-th-team">שחקן</th>
            <th>שע׳</th>
            <th>בישולים</th>
          </tr>
        </thead>
        <tbody>
          {scorers.map((s, i) => (
            <tr key={s.id} className={i === 0 ? 'scorer-first' : ''}>
              <td className="trn-td-pos">{i + 1}</td>
              <td className="trn-td-team">
                <Flag team={s.team} size={20} />
                <div>
                  <div style={{ fontWeight: 600 }}>{s.player_name}</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>{teamHe(s.team)}</div>
                </div>
              </td>
              <td style={{ color: 'var(--gold)', fontWeight: 700 }}>{s.goals}</td>
              <td style={{ color: 'var(--text-muted)' }}>{s.assists}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Standings row interface ───────────────────────────────
interface Standing {
  team: string; p: number; w: number; d: number; l: number; pts: number; gf: number; ga: number;
}

// ── WC Group Standings view ───────────────────────────────
function StandingsView({ groups, scoreMap }: {
  groups: Map<string, { teams: string[]; games: Game[] }>;
  scoreMap: ScoreMap;
}) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from(groups.entries()).map(([letter, { teams, games: grpGames }]) => {
        const rows: Standing[] = teams.map(t => ({ team: t, p: 0, w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0 }));

        for (const g of grpGames) {
          const sc = scoreMap[g.id];
          if (!sc || !sc.completed) continue;
          const home = rows.find(r => r.team === g.home_team);
          const away = rows.find(r => r.team === g.away_team);
          if (!home || !away) continue;
          home.p++; away.p++;
          home.gf += sc.homeScore; home.ga += sc.awayScore;
          away.gf += sc.awayScore; away.ga += sc.homeScore;
          if (sc.homeScore > sc.awayScore) { home.w++; home.pts += 3; away.l++; }
          else if (sc.awayScore > sc.homeScore) { away.w++; away.pts += 3; home.l++; }
          else { home.d++; away.d++; home.pts++; away.pts++; }
        }

        rows.sort((a, b) => b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf);

        return (
          <div key={letter} className="trn-group-card">
            <div className="trn-standings-hdr">
              <span className="trn-group-letter">בית {letter}</span>
            </div>
            <table className="trn-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th className="trn-th-team">נבחרת</th>
                  <th>מ׳</th>
                  <th>נ׳</th>
                  <th>ת׳</th>
                  <th>ה׳</th>
                  <th className="trn-th-pts">נק׳</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.team} className={i < 2 ? 'trn-tr-qualify' : ''}>
                    <td className="trn-td-pos">{i + 1}</td>
                    <td className="trn-td-team">
                      <Flag team={r.team} size={20} />
                      <span>{teamHe(r.team)}</span>
                    </td>
                    <td>{r.p}</td>
                    <td>{r.w}</td>
                    <td>{r.d}</td>
                    <td>{r.l}</td>
                    <td className="trn-td-pts">{r.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="trn-qualify-note">🟢 שני הראשונים עולים לשלב הנוק-אאוט</div>
          </div>
        );
      })}
    </div>
  );
}

// ── League Standings — כל הקבוצות + Realtime ─────────────
function LeagueStandingsView() {
  // טוענים את כל השורות (לא רק completed) — כדי לדעת מי שייך לליגה
  const [fixtures, setFixtures] = useState<LeagueFixture[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('league_schedule').select('*').order('kickoff_at')
      .then(({ data }) => { setFixtures((data ?? []) as LeagueFixture[]); setLoading(false); });

    // Realtime: עדכון אוטומטי ברגע שתוצאה נכנסת
    const ch = supabase.channel('league_standings_rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'league_schedule' }, payload => {
        const updated = payload.new as LeagueFixture;
        setFixtures(prev => {
          const idx = prev.findIndex(f => f.id === updated.id);
          if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n; }
          return [...prev, updated];
        });
      }).subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const standings = useMemo((): Standing[] => {
    // כל קבוצה שמופיעה בכל משחק (גם עתידי) — מקבלת שורה בטבלה
    const map = new Map<string, Standing>();
    for (const f of fixtures) {
      for (const t of [f.home_team, f.away_team]) {
        if (!map.has(t)) map.set(t, { team: t, p: 0, w: 0, d: 0, l: 0, pts: 0, gf: 0, ga: 0 });
      }
    }
    // חישוב נקודות רק ממשחקים שהסתיימו
    for (const f of fixtures) {
      if (!f.completed || f.home_score === null || f.away_score === null) continue;
      const h = map.get(f.home_team)!;
      const a = map.get(f.away_team)!;
      h.p++; a.p++;
      h.gf += f.home_score; h.ga += f.away_score;
      a.gf += f.away_score; a.ga += f.home_score;
      if (f.home_score > f.away_score) { h.w++; h.pts += 3; a.l++; }
      else if (f.away_score > f.home_score) { a.w++; a.pts += 3; h.l++; }
      else { h.d++; a.d++; h.pts++; a.pts++; }
    }
    return [...map.values()].sort((a, b) =>
      b.pts - a.pts || (b.gf - b.ga) - (a.gf - a.ga) || b.gf - a.gf
    );
  }, [fixtures]);

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>טוען...</div>;

  if (fixtures.length === 0) return (
    <div className="card p-8 text-center mt-4">
      <div className="text-4xl mb-3">📊</div>
      <div className="font-bold">לוח המשחקים טרם נטען</div>
      <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
        הפעל "Seed league schedule" ב-GitHub Actions
      </div>
    </div>
  );

  return (
    <div className="trn-group-card">
      <div className="trn-standings-hdr">
        <span className="trn-group-letter">טבלת הליגה 2026/27</span>
      </div>
      <table className="trn-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="trn-th-team">קבוצה</th>
            <th>מ׳</th>
            <th>נ׳</th>
            <th>ת׳</th>
            <th>ה׳</th>
            <th>הפרש</th>
            <th className="trn-th-pts">נק׳</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((r, i) => {
            const isChampion  = i === 0;
            const isConf      = i === 1;
            const isRelegated = i >= standings.length - 2;
            const rowStyle = isChampion
              ? { background: 'rgba(52,152,219,0.10)', borderRight: '3px solid #3498db' }
              : isConf
              ? { background: 'rgba(39,174,96,0.08)', borderRight: '3px solid #27ae60' }
              : isRelegated
              ? { background: 'rgba(231,76,60,0.07)', borderRight: '3px solid #e74c3c' }
              : {};
            return (
              <tr key={r.team} style={rowStyle}>
                <td className="trn-td-pos">{i + 1}</td>
                <td className="trn-td-team">
                  <Flag team={r.team} size={20} />
                  <span>{teamHe(r.team)}</span>
                </td>
                <td>{r.p}</td>
                <td>{r.w}</td>
                <td>{r.d}</td>
                <td>{r.l}</td>
                <td style={{ color: r.gf - r.ga > 0 ? 'var(--accent)' : r.gf - r.ga < 0 ? '#e74c3c' : 'var(--text-muted)' }}>
                  {r.gf - r.ga > 0 ? '+' : ''}{r.gf - r.ga}
                </td>
                <td className="trn-td-pts">{r.pts}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '6px 12px 8px', textAlign: 'right', lineHeight: 1.8 }}>
        <span style={{ color: '#3498db' }}>■</span> מקום 1 — אלופה + מוקדמות ליגת אלופות
        {'  ·  '}
        <span style={{ color: '#27ae60' }}>■</span> מקום 2 — מוקדמות קונפרנס ליג
        {'  ·  '}
        <span style={{ color: '#e74c3c' }}>■</span> 2 אחרונים — ירידה
      </div>
    </div>
  );
}

// ── Knockout bracket ──────────────────────────────────────
interface KnockoutMatch {
  id: string;
  home_team: string;
  away_team: string;
  home_score: number | null;
  away_score: number | null;
  status: string;
  stage: string;
  kickoff_at: string;
}

const STAGE_ORDER = ['ROUND_OF_32', 'ROUND_OF_16', 'QUARTER_FINALS', 'SEMI_FINALS', 'FINAL', 'THIRD_PLACE'];
const STAGE_HE: Record<string, string> = {
  ROUND_OF_32:    'סיבוב 32',
  ROUND_OF_16:    'שמינית גמר',
  QUARTER_FINALS: 'רבע גמר',
  SEMI_FINALS:    'חצי גמר',
  FINAL:          'גמר',
  THIRD_PLACE:    'מקום שלישי',
};
const KNOCKOUT_STAGES = new Set(STAGE_ORDER);
const isLive = (s: string) => s === 'IN_PLAY' || s === 'PAUSED';
const isFinished = (s: string) => s === 'FINISHED';
const isTbd = (name: string) => !name || name === 'TBD';

function KnockoutMatchCard({ m }: { m: KnockoutMatch }) {
  const live = isLive(m.status);
  const done = isFinished(m.status);
  const timeStr = new Date(m.kickoff_at).toLocaleString('he-IL', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: TZ,
  });

  return (
    <div className="ko-match-card">
      <div className="ko-match-inner">
        <div className="ko-team ko-team-home">
          {!isTbd(m.home_team) && <Flag team={m.home_team} size={22} />}
          <span className={`ko-team-name ${isTbd(m.home_team) ? 'ko-tbd' : ''}`}>
            {isTbd(m.home_team) ? 'ממתין לתוצאה' : teamHe(m.home_team)}
          </span>
        </div>

        <div className="ko-center">
          {(done || live) && m.home_score !== null ? (
            <div className="ko-score">
              <span>{m.home_score}</span>
              <span className="ko-score-sep">:</span>
              <span>{m.away_score}</span>
            </div>
          ) : (
            <div className="ko-time">{timeStr}</div>
          )}
          {live && <div className="ko-live-badge"><span className="live-dot" />חי</div>}
          {done && <div className="ko-done-badge">סופי</div>}
        </div>

        <div className="ko-team ko-team-away">
          <span className={`ko-team-name ${isTbd(m.away_team) ? 'ko-tbd' : ''}`}>
            {isTbd(m.away_team) ? 'ממתין לתוצאה' : teamHe(m.away_team)}
          </span>
          {!isTbd(m.away_team) && <Flag team={m.away_team} size={22} />}
        </div>
      </div>
    </div>
  );
}

function KnockoutBracketView() {
  const [matches, setMatches] = useState<KnockoutMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStage, setActiveStage] = useState('');

  useEffect(() => {
    supabase
      .from('live_scores')
      .select('*')
      .then(({ data }) => {
        const ko = ((data ?? []) as KnockoutMatch[]).filter(m => KNOCKOUT_STAGES.has(m.stage));
        ko.sort((a, b) => a.kickoff_at.localeCompare(b.kickoff_at));
        setMatches(ko);
        const stages = STAGE_ORDER.filter(s => ko.some(m => m.stage === s));
        if (stages.length) {
          const current = stages.find(s => ko.some(m => m.stage === s && !isFinished(m.status)));
          setActiveStage(current ?? stages[stages.length - 1]);
        }
        setLoading(false);
      });
  }, []);

  const availableStages = STAGE_ORDER.filter(s => matches.some(m => m.stage === s));
  const stageMatches = matches.filter(m => m.stage === activeStage);

  function addKnockoutToCalendar() {
    const upcoming = matches.filter(m => !isFinished(m.status) && !isTbd(m.home_team) && !isTbd(m.away_team));
    if (!upcoming.length) { alert('אין משחקי נוקאאוט עתידיים ידועים עדיין'); return; }
    buildIcs(upcoming.map(m => icsEvent(m.kickoff_at, m.home_team, m.away_team, `FIFA World Cup 2026 — ${STAGE_HE[m.stage] ?? m.stage}`)), 'worldcup2026-knockout.ics');
  }

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>טוען...</div>;

  if (!availableStages.length) return (
    <div className="card p-10 text-center mt-4">
      <div className="text-5xl mb-4">🏆</div>
      <div className="font-bold text-lg">שלב הנוקאאוט טרם החל</div>
      <div className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>הטבלה תתמלא אוטומטית עם התקדמות הטורניר</div>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <button className="sch-cal-all-btn" onClick={addKnockoutToCalendar}>
        <CalendarPlus size={15} />
        הוסף משחקי נוקאאוט ליומן
      </button>

      <div className="ko-stage-tabs">
        {availableStages.map(s => (
          <button
            key={s}
            className={`ko-stage-tab ${activeStage === s ? 'ko-stage-tab-on' : ''}`}
            onClick={() => setActiveStage(s)}
          >
            {STAGE_HE[s] ?? s}
          </button>
        ))}
      </div>

      <div className={`ko-grid ko-grid-${stageMatches.length <= 2 ? 'small' : 'large'}`}>
        {stageMatches.map(m => <KnockoutMatchCard key={m.id} m={m} />)}
      </div>
    </div>
  );
}

// ── Season Predictions view ───────────────────────────────
const PREDICTIONS_DEADLINE = new Date('2026-08-22T17:00:00Z'); // 20:00 ישראל

function PredictionCard({
  icon, title, isOpen, existing, msg, children,
}: {
  icon: string;
  title: string;
  isOpen: boolean;
  existing: { label: string; status: string } | null;
  msg?: string;
  children?: React.ReactNode;
}) {
  const statusColor = existing?.status === 'won' ? 'var(--green)' : existing?.status === 'lost' ? '#f87171' : 'var(--gold)';
  const statusLabel = existing?.status === 'won' ? '✓ זכייה' : existing?.status === 'lost' ? '✗ הפסד' : '⏳ ממתין';
  return (
    <div className="card p-4" style={{ border: '1px solid var(--border)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: '1.25rem' }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{title}</span>
      </div>
      {existing ? (
        <div style={{ padding: '10px 14px', borderRadius: 8, background: 'var(--surface2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{existing.label}</span>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: statusColor }}>{statusLabel}</span>
        </div>
      ) : isOpen ? (
        children
      ) : (
        <div style={{ textAlign: 'center', padding: '16px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          🔒 לא הוגש ניחוש
        </div>
      )}
      {msg && (
        <div style={{
          marginTop: 8, fontSize: '0.82rem', padding: '6px 12px', borderRadius: 8,
          background: msg.startsWith('✓') ? 'rgba(0,200,83,0.1)' : 'rgba(248,113,113,0.1)',
          color: msg.startsWith('✓') ? 'var(--green)' : '#f87171',
          border: `1px solid ${msg.startsWith('✓') ? 'rgba(0,200,83,0.2)' : 'rgba(248,113,113,0.2)'}`,
        }}>
          {msg}
        </div>
      )}
    </div>
  );
}

function SeasonPredictionsView() {
  const { profile } = useAuth();
  const [existingBets, setExistingBets] = useState<SpecialBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [winnerPick, setWinnerPick] = useState('');
  const [relegated1, setRelegated1] = useState('');
  const [relegated2, setRelegated2] = useState('');
  const [scorerPick, setScorerPick] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Record<string, string>>({});

  const isOpen = new Date() < PREDICTIONS_DEADLINE;
  const deadlineStr = PREDICTIONS_DEADLINE.toLocaleString('he-IL', {
    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
    timeZone: 'Asia/Jerusalem',
  });

  useEffect(() => {
    if (!profile) return;
    supabase.from('special_bets').select('*').eq('player_id', profile.id)
      .then(({ data }) => {
        setExistingBets((data as SpecialBet[]) || []);
        setLoading(false);
      });
  }, [profile?.id]);

  async function refreshBets() {
    if (!profile) return;
    const { data } = await supabase.from('special_bets').select('*').eq('player_id', profile.id);
    setExistingBets((data as SpecialBet[]) || []);
  }

  function showMsg(key: string, text: string) {
    setMsgs(m => ({ ...m, [key]: text }));
    setTimeout(() => setMsgs(m => ({ ...m, [key]: '' })), 3500);
  }

  async function submitSingle(type: SpecialBet['type'], prediction: string) {
    if (!profile || !prediction) return;
    setSubmitting(type);
    const { error } = await supabase.from('special_bets').insert({
      player_id: profile.id, type, prediction, status: 'pending',
    });
    if (error) showMsg(type, '❌ שגיאה: ' + error.message);
    else { await refreshBets(); showMsg(type, '✓ נשמר!'); }
    setSubmitting(null);
  }

  async function submitRelegated() {
    if (!profile || !relegated1 || !relegated2 || relegated1 === relegated2) return;
    setSubmitting('relegated');
    const { error } = await supabase.from('special_bets').insert([
      { player_id: profile.id, type: 'relegated', prediction: relegated1, status: 'pending' },
      { player_id: profile.id, type: 'relegated', prediction: relegated2, status: 'pending' },
    ]);
    if (error) showMsg('relegated', '❌ שגיאה: ' + error.message);
    else { await refreshBets(); showMsg('relegated', '✓ נשמר!'); }
    setSubmitting(null);
  }

  if (loading) return <div className="text-center py-8" style={{ color: 'var(--text-muted)' }}>טוען...</div>;

  const winnerBet    = existingBets.find(b => b.type === 'winner');
  const relegatedBets = existingBets.filter(b => b.type === 'relegated');
  const scorerBet    = existingBets.find(b => b.type === 'top_scorer');

  const selectStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8,
    background: 'var(--surface2)', border: '1px solid var(--border)',
    color: 'var(--text)', fontSize: '0.9rem',
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Deadline banner */}
      <div style={{
        padding: '12px 16px', borderRadius: 10, textAlign: 'center',
        background: isOpen ? 'rgba(0,200,83,0.05)' : 'rgba(248,113,113,0.05)',
        border: `1px solid ${isOpen ? 'rgba(0,200,83,0.2)' : 'rgba(248,113,113,0.2)'}`,
      }}>
        {isOpen
          ? <div style={{ fontWeight: 700, color: 'var(--green)', fontSize: '0.9rem' }}>ניחושי עונה פתוחים ✓</div>
          : <div style={{ fontWeight: 700, color: '#f87171', fontSize: '0.9rem' }}>ניחושי העונה נסגרו 🔒</div>
        }
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
          {isOpen ? 'נסגרים: ' : 'נסגרו: '}{deadlineStr}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
          ניחוש נכון = בונוס נקודות קבוע · אין ניכוי על שגוי
        </div>
      </div>

      {/* אלוף הליגה */}
      <PredictionCard
        icon="🏆"
        title="אלוף הליגה"
        isOpen={isOpen}
        existing={winnerBet ? { label: teamHe(winnerBet.prediction), status: winnerBet.status } : null}
        msg={msgs['winner']}
      >
        <select style={selectStyle} value={winnerPick} onChange={e => setWinnerPick(e.target.value)}>
          <option value="">— בחר קבוצה —</option>
          {LEAGUE_TEAMS.map(t => (
            <option key={t} value={t}>{teamHe(t)}</option>
          ))}
        </select>
        <button
          className="btn-primary" style={{ width: '100%', marginTop: 8, fontSize: '0.85rem' }}
          disabled={!winnerPick || submitting === 'winner'}
          onClick={() => submitSingle('winner', winnerPick)}
        >
          {submitting === 'winner' ? 'שומר...' : 'שמור ניחוש'}
        </button>
      </PredictionCard>

      {/* יורדות */}
      <PredictionCard
        icon="📉"
        title="יורדות לליגה א׳ (2 קבוצות)"
        isOpen={isOpen}
        existing={relegatedBets.length > 0 ? {
          label: relegatedBets.map(b => teamHe(b.prediction)).join(' + '),
          status: relegatedBets[0].status,
        } : null}
        msg={msgs['relegated']}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <select style={selectStyle} value={relegated1} onChange={e => setRelegated1(e.target.value)}>
            <option value="">— קבוצה ראשונה —</option>
            {LEAGUE_TEAMS.map(t => (
              <option key={t} value={t} disabled={t === relegated2}>{teamHe(t)}</option>
            ))}
          </select>
          <select style={selectStyle} value={relegated2} onChange={e => setRelegated2(e.target.value)}>
            <option value="">— קבוצה שנייה —</option>
            {LEAGUE_TEAMS.map(t => (
              <option key={t} value={t} disabled={t === relegated1}>{teamHe(t)}</option>
            ))}
          </select>
          <button
            className="btn-primary" style={{ width: '100%', fontSize: '0.85rem' }}
            disabled={!relegated1 || !relegated2 || relegated1 === relegated2 || submitting === 'relegated'}
            onClick={submitRelegated}
          >
            {submitting === 'relegated' ? 'שומר...' : 'שמור ניחוש'}
          </button>
        </div>
      </PredictionCard>

      {/* מלך השערים */}
      <PredictionCard
        icon="👟"
        title="מלך השערים"
        isOpen={isOpen}
        existing={scorerBet ? { label: scorerBet.prediction, status: scorerBet.status } : null}
        msg={msgs['top_scorer']}
      >
        <input
          style={{ ...selectStyle, outline: 'none' }}
          placeholder="שם השחקן (כתיב חופשי)"
          value={scorerPick}
          onChange={e => setScorerPick(e.target.value)}
          maxLength={60}
          dir="auto"
        />
        <button
          className="btn-primary" style={{ width: '100%', marginTop: 8, fontSize: '0.85rem' }}
          disabled={!scorerPick.trim() || submitting === 'top_scorer'}
          onClick={() => submitSingle('top_scorer', scorerPick.trim())}
        >
          {submitting === 'top_scorer' ? 'שומר...' : 'שמור ניחוש'}
        </button>
      </PredictionCard>
    </div>
  );
}

// ── Rules view ────────────────────────────────────────────
const RULES_SECTIONS = [
  { icon: '🏦', title: 'ניקוד — איך זה עובד', items: [
    'ניחוש כיוון נכון (בית / תיקו / חוץ) = +3 נק׳',
    'ניחוש תוצאה מדויקת = +5 נק׳',
    'ניחוש שגוי = 0 נק׳ (לא מפסיד נקודות!)',
  ]},
  { icon: '⚽', title: 'הימור על משחק', items: [
    'בחר ניצחון בית / תיקו / ניצחון חוץ',
    'הימורים נסגרים עם תחילת המשחק',
    'ניתן לבטל הימור לפני תחילת המשחק',
    'שכחת להמר? המערכת תכניס עבורך הימור רנדומלי בתחילת המשחק',
  ]},
  { icon: '🏆', title: 'ניחושי ליגה (מיוחדים)', items: [
    'ניחוש אלוף הליגה — נסגר במחזור הראשון',
    'ניחוש שתי הקבוצות היורדות — נסגר במחזור הראשון',
    'ניחוש מלך השערים — נסגר במחזור הראשון',
    'ניחוש נכון = בונוס נקודות בסוף העונה',
    'אין ניכוי נקודות על ניחוש שגוי',
  ]},
  { icon: '🐒', title: 'הקוף', items: [
    'שחקן וירטואלי בשם "🐒 קוף" מתחרה עם כולם',
    'הקוף מנחש רנדומלית לפני כל משחק',
    'בסוף העונה — האם הצלחת לנצח את הקוף?',
  ]},
  { icon: '📊', title: 'טבלת הדירוג', items: [
    'הדירוג נקבע לפי סך הנקודות שנצברו',
    '✓ = מספר ניחושי כיוון נכונים',
    '✗ = מספר ניחושי כיוון שגויים',
    '🎯 = מספר תוצאות מדויקות',
    'שיוויון בנקודות — מכריע: 🎯 (מי שתפס יותר בולים)',
  ]},
  { icon: '📅', title: 'על הטורניר', items: [
    'ליגת העל הישראלית — עונת 2026/27',
    '14 קבוצות — 26 מחזורים בעונה הסדירה + פליאוף עליון ותחתון',
    'כל מחזור — 7 משחקים להמר עליהם',
    'בחר את קבוצת הלב שלך ושנה את מראה האפליקציה',
  ]},
];

const TEAM_FOOTER: Record<string, { msg: string; heart: string }> = {
  'Maccabi Tel Aviv':          { msg: 'צהוב עולה זה מכבי',            heart: '💛' },
  'Beitar Jerusalem':          { msg: 'יאללה בית״ר',                   heart: '💛' },
  'Hapoel Tel-Aviv':           { msg: 'הנה הם הבאים, השדים האדומים',  heart: '❤️' },
  'Maccabi Haifa':             { msg: 'חיפה חיפה, מכבי שלי',          heart: '💚' },
  "Hapoel Be'er Sheva":        { msg: 'This is Turner',                heart: '❤️' },
  'Hapoel Haifa':              { msg: 'לב אדום על הכרמל',              heart: '❤️' },
  'Hapoel Jerusalem':          { msg: 'ירושלים שלנו, לנצח',           heart: '❤️' },
  'Maccabi Netanya':           { msg: 'נתניה על הגל',                  heart: '💛' },
  'Maccabi Petah Tikva':       { msg: 'ירוק ולבן, לב פתוח',           heart: '💛' },
  'Hapoel Petah Tikva':        { msg: 'הפועל פ״ת — מאה שנה של תשוקה', heart: '❤️' },
  'Hapoel Ironi Kiryat Shmona':{ msg: 'ק״ש — גאוות הצפון',            heart: '❤️' },
  'Bnei Sakhnin':              { msg: 'סכנין — לגאווה ולניצחון',      heart: '💚' },
  'Hapoel Ramat Gan':          { msg: 'הפועל ר״ג — לב אדום של המרכז', heart: '❤️' },
  'Ironi Tiberias':            { msg: 'עירוני טבריה — מאגם הכינרת',   heart: '💙' },
};

function RulesView() {
  const { profile } = useAuth();
  const team = profile?.favorite_team ?? null;
  const footer = team ? TEAM_FOOTER[team] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="info-banner">
        <span style={{ fontSize: '2.5rem' }}>⚽</span>
        <div>
          <div className="font-bold text-base">ליגת העל 2026/27</div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>מדריך למשתתף — קרא לפני שמתחיל</div>
        </div>
      </div>
      {RULES_SECTIONS.map(s => (
        <div key={s.title} className="info-card">
          <div className="info-card-title"><span>{s.icon}</span><span>{s.title}</span></div>
          <ul className="info-list">
            {s.items.map((item, i) => (
              <li key={i} className="info-item"><span className="info-dot" /><span>{item}</span></li>
            ))}
          </ul>
        </div>
      ))}
      <div className="info-footer">
        {footer ? `${footer.msg} ${footer.heart}` : 'בהצלחה לכולם! ⚽'}
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────
export default function TournamentPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [scoreMap, setScoreMap] = useState<ScoreMap>({});
  const [loading, setLoading] = useState(true);
  const [isLeagueMode, setIsLeagueMode] = useState(false);
  const [view, setView] = useState<'schedule' | 'standings' | 'knockout' | 'scorers' | 'rules' | 'predictions'>('schedule');

  useEffect(() => {
    async function load() {
      const { data: s } = await supabase.from('settings').select('sport_keys').single();
      const keys: string[] = s?.sport_keys ?? ['soccer_fifa_world_cup'];
      const league = !keys.includes('soccer_fifa_world_cup');
      setIsLeagueMode(league);

      if (!league) {
        const { data } = await supabase.from('wc_schedule').select('*').order('kickoff_at');
        const rows = data ?? [];
        setGames(rows.map((g: any) => ({
          id: g.id,
          home_team: g.home_team,
          away_team: g.away_team,
          commence_time: g.kickoff_at,
          home_win: 0, draw: 0, away_win: 0,
        })));
        const map: ScoreMap = {};
        for (const g of rows) {
          if (g.home_score !== null && g.away_score !== null) {
            map[g.id] = { homeScore: g.home_score, awayScore: g.away_score, completed: g.completed ?? false };
          }
        }
        setScoreMap(map);
      }
      setLoading(false);
    }
    load();
  }, []);

  const groups = useMemo(() => inferGroups(games), [games]);
  const daysLeft = Math.max(0, Math.ceil((new Date('2026-06-11').getTime() - Date.now()) / 86400000));

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">⚽</div>
        <div className="bebas text-2xl" style={{ color: 'var(--green)' }}>טוען...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24">
      <header className="hdr">
        <div className="hdr-inner">
          <span className="font-bold">{isLeagueMode ? 'ליגת העל' : 'מונדיאל 2026'}</span>
          {!isLeagueMode && (
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {games.length} משחקים · {groups.size} בתים
            </span>
          )}
        </div>
      </header>
      <div className="hdr-spacer" />

      <div className="page-wrap pt-4">
        {/* Banner */}
        {isLeagueMode ? (
          <div className="trn-banner">
            <span className="trn-banner-icon">⚽</span>
            <div>
              <div className="font-bold text-sm">ליגת העל {(() => { const y = new Date().getFullYear(); const m = new Date().getMonth(); const s = m >= 6 ? y : y - 1; return `${s}/${String(s + 1).slice(2)}`; })()}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>הליגה הישראלית לכדורגל</div>
            </div>
          </div>
        ) : (
          <div className="trn-banner">
            <span className="trn-banner-icon">🏆</span>
            <div>
              <div className="font-bold text-sm">FIFA World Cup 2026</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>ארה״ב, קנדה ומקסיקו · יוני–יולי 2026</div>
            </div>
            <div className="trn-days-left">
              <span className="trn-days-num">{daysLeft}</span>
              <span className="trn-days-lbl">ימים</span>
            </div>
          </div>
        )}

        {/* Tab toggle */}
        <div className="trn-toggle">
          <button className={`trn-tog-btn ${view === 'schedule' ? 'trn-tog-on' : ''}`} onClick={() => setView('schedule')}>
            <CalendarDays size={15} />
            לוח
          </button>
          <button className={`trn-tog-btn ${view === 'standings' ? 'trn-tog-on' : ''}`} onClick={() => setView('standings')}>
            <LayoutList size={15} />
            {isLeagueMode ? 'טבלה' : 'בתים'}
          </button>
          {!isLeagueMode && (
            <button className={`trn-tog-btn ${view === 'knockout' ? 'trn-tog-on' : ''}`} onClick={() => setView('knockout')}>
              <Trophy size={15} />
              נוקאאוט
            </button>
          )}
          <button className={`trn-tog-btn ${view === 'scorers' ? 'trn-tog-on' : ''}`} onClick={() => setView('scorers')}>
            <Shirt size={15} />
            שערים
          </button>
          <button className={`trn-tog-btn ${view === 'rules' ? 'trn-tog-on' : ''}`} onClick={() => setView('rules')}>
            <BookOpen size={15} />
            חוקים
          </button>
          {isLeagueMode && (
            <button className={`trn-tog-btn ${view === 'predictions' ? 'trn-tog-on' : ''}`} onClick={() => setView('predictions')}>
              <Star size={15} />
              ניחושי עונה
            </button>
          )}
        </div>

        {view === 'schedule' && (
          isLeagueMode
            ? <LeagueScheduleView />
            : <ScheduleView games={games} groups={groups} scoreMap={scoreMap} />
        )}
        {view === 'standings' && (
          isLeagueMode
            ? <LeagueStandingsView />
            : <StandingsView groups={groups} scoreMap={scoreMap} />
        )}
        {view === 'knockout' && !isLeagueMode && <KnockoutBracketView />}
        {view === 'scorers' && <TopScorersView />}
        {view === 'rules' && <RulesView />}
        {view === 'predictions' && isLeagueMode && <SeasonPredictionsView />}
      </div>
    </div>
  );
}
