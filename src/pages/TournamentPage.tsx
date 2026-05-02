import { useState, useEffect, useMemo } from 'react';
import { flagUrl } from '../lib/flagMap';
import { teamHe } from '../lib/teamNames';
import { CalendarDays, LayoutList, CalendarPlus } from 'lucide-react';

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  home_win: number;
  draw: number;
  away_win: number;
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

// ── Calendar ICS download ─────────────────────────────────
function addToCalendar(g: Game) {
  const fmt = (iso: string) => iso.replace(/[-:.]/g, '').slice(0, 15) + 'Z';
  const start = fmt(g.commence_time);
  const end = fmt(new Date(new Date(g.commence_time).getTime() + 2 * 3600000).toISOString());
  const title = `מונדיאל 2026: ${teamHe(g.home_team)} נגד ${teamHe(g.away_team)}`;
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//WorldCup Bets//HE',
    'BEGIN:VEVENT',
    `DTSTART:${start}`, `DTEND:${end}`,
    `SUMMARY:${title}`,
    'DESCRIPTION:FIFA World Cup 2026',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  a.download = `wc2026.ics`;
  a.click();
}

// ── Flag ──────────────────────────────────────────────────
function Flag({ team, size = 28 }: { team: string; size?: number }) {
  const url = flagUrl(team, 'w80');
  if (!url) return <span style={{ fontSize: 16 }}>🏳️</span>;
  return (
    <img
      src={url} alt={team} width={size} height={Math.round(size * 0.65)}
      style={{ borderRadius: 3, objectFit: 'cover', boxShadow: '0 1px 4px rgba(0,0,0,0.4)', flexShrink: 0 }}
    />
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

// ── Schedule view (chronological + group badge + channel) ─
function ScheduleView({ games, groups }: {
  games: Game[];
  groups: Map<string, { teams: string[]; games: Game[] }>;
}) {
  // Map each game ID → group letter
  const gameToGroup = new Map<string, string>();
  for (const [letter, { games: gGames }] of groups) {
    for (const g of gGames) gameToGroup.set(g.id, letter);
  }

  // Group games by calendar day
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
      {byDay.map(([dk, dayGames]) => (
        <div key={dk}>
          <div className="sch-day-hdr">{fmtDayFull(dayGames[0].commence_time)}</div>
          <div className="flex flex-col gap-2">
            {dayGames.map(g => {
              const grp = gameToGroup.get(g.id);
              const ch = getChannel(g.home_team, g.away_team);
              return (
                <div key={g.id} className="sch-row">
                  {/* Top bar: badge + time + channel */}
                  <div className="sch-row-top">
                    {grp && <span className="sch-badge">בית {grp}</span>}
                    <span className="sch-time">{fmtTime(g.commence_time)}</span>
                    {ch && <span className="sch-channel">{ch}</span>}
                  </div>

                  {/* Match row: home | VS | away */}
                  <div className="sch-match">
                    <div className="sch-home">
                      <Flag team={g.home_team} size={28} />
                      <span className="sch-tname">{teamHe(g.home_team)}</span>
                    </div>
                    <span className="sch-vs">VS</span>
                    <div className="sch-away">
                      <span className="sch-tname">{teamHe(g.away_team)}</span>
                      <Flag team={g.away_team} size={28} />
                    </div>
                  </div>

                  {/* Calendar button */}
                  <button className="sch-cal-btn" onClick={() => addToCalendar(g)}>
                    <CalendarPlus size={12} />
                    הוסף ליומן
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Knockout stage */}
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

// ── Standings row ─────────────────────────────────────────
interface Standing {
  team: string; p: number; w: number; d: number; l: number; pts: number;
}

function StandingsView({ groups }: { groups: Map<string, { teams: string[]; games: Game[] }> }) {
  return (
    <div className="flex flex-col gap-4">
      {Array.from(groups.entries()).map(([letter, { teams }]) => {
        const rows: Standing[] = teams.map(t => ({ team: t, p: 0, w: 0, d: 0, l: 0, pts: 0 }));
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

// ── Main ──────────────────────────────────────────────────
export default function TournamentPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'schedule' | 'standings'>('schedule');
  const ODDS_KEY = import.meta.env.VITE_ODDS_API_KEY;

  useEffect(() => {
    fetch(`https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${ODDS_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`)
      .then(r => r.json())
      .then((raw: any[]) => {
        const processed = raw.map(g => {
          const o = extractOdds(g);
          if (!o) return null;
          return { id: g.id, home_team: g.home_team, away_team: g.away_team, commence_time: g.commence_time, ...o };
        }).filter(Boolean) as Game[];
        processed.sort((a, b) => a.commence_time.localeCompare(b.commence_time));
        setGames(processed);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const groups = useMemo(() => inferGroups(games), [games]);
  const daysLeft = Math.max(0, Math.ceil((new Date('2026-06-11').getTime() - Date.now()) / 86400000));

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">🌍</div>
        <div className="bebas text-2xl" style={{ color: 'var(--green)' }}>טוען...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24">
      <header className="hdr">
        <div className="hdr-inner">
          <span className="font-bold">מונדיאל 2026</span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{games.length} משחקים · {groups.size} בתים</span>
        </div>
      </header>

      <div className="page-wrap pt-4">
        {/* Banner */}
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

        {/* Toggle */}
        <div className="trn-toggle">
          <button className={`trn-tog-btn ${view === 'schedule' ? 'trn-tog-on' : ''}`} onClick={() => setView('schedule')}>
            <CalendarDays size={15} />
            לוח משחקים
          </button>
          <button className={`trn-tog-btn ${view === 'standings' ? 'trn-tog-on' : ''}`} onClick={() => setView('standings')}>
            <LayoutList size={15} />
            טבלת בתים
          </button>
        </div>

        {view === 'schedule'
          ? <ScheduleView games={games} groups={groups} />
          : <StandingsView groups={groups} />}
      </div>
    </div>
  );
}
