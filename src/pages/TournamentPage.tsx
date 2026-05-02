import { useState, useEffect, useMemo } from 'react';
import { flagUrl } from '../lib/flagMap';
import { CalendarDays, LayoutList } from 'lucide-react';

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  home_win: number;
  draw: number;
  away_win: number;
}

// ── Flag ──────────────────────────────────────────────────
function Flag({ team, size = 32 }: { team: string; size?: number }) {
  const url = flagUrl(team, 'w80');
  if (!url) return <span style={{ fontSize: 18 }}>🏳️</span>;
  return <img src={url} alt={team} width={size} height={Math.round(size * 0.65)}
    style={{ borderRadius: 3, objectFit: 'cover', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />;
}

// ── Time utils ────────────────────────────────────────────
const TZ = 'Asia/Jerusalem';
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
const fmtDateShort = (iso: string) =>
  new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'short', timeZone: TZ });

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

// ── Group inference ───────────────────────────────────────
function inferGroups(games: Game[]): Map<string, { teams: string[]; games: Game[] }> {
  const adj = new Map<string, Set<string>>();
  for (const g of games) {
    if (!adj.has(g.home_team)) adj.set(g.home_team, new Set());
    if (!adj.has(g.away_team)) adj.set(g.away_team, new Set());
    adj.get(g.home_team)!.add(g.away_team);
    adj.get(g.away_team)!.add(g.home_team);
  }

  const visited = new Set<string>();
  const groups: string[][] = [];

  // find cliques of 4 (each plays all 3 others)
  for (const [team, opps] of adj) {
    if (visited.has(team) || opps.size < 3) continue;
    const candidates = [team, ...Array.from(opps)];
    // try all combos of 4 from candidates
    const tryGroup = (members: string[]): boolean =>
      members.every(t => members.filter(x => x !== t).every(x => adj.get(t)?.has(x)));

    const group = candidates.slice(0, 4);
    if (group.length === 4 && tryGroup(group)) {
      groups.push(group);
      group.forEach(t => visited.add(t));
    }
  }

  // Sort each group's teams by first game date
  for (const g of groups) {
    g.sort((a, b) => {
      const aGame = games.find(x => x.home_team === a || x.away_team === a);
      const bGame = games.find(x => x.home_team === b || x.away_team === b);
      return (aGame?.commence_time ?? '').localeCompare(bGame?.commence_time ?? '');
    });
  }

  // Sort groups by earliest game
  groups.sort((a, b) => {
    const aDate = games.find(g => a.includes(g.home_team) && a.includes(g.away_team))?.commence_time ?? '';
    const bDate = games.find(g => b.includes(g.home_team) && b.includes(g.away_team))?.commence_time ?? '';
    return aDate.localeCompare(bDate);
  });

  const letters = 'ABCDEFGHIJKL'.split('');
  const result = new Map<string, { teams: string[]; games: Game[] }>();
  groups.forEach((teams, i) => {
    const letter = letters[i] ?? `${i + 1}`;
    const grpGames = games
      .filter(g => teams.includes(g.home_team) && teams.includes(g.away_team))
      .sort((a, b) => a.commence_time.localeCompare(b.commence_time));
    result.set(letter, { teams, games: grpGames });
  });

  return result;
}

// ── Standing row (all 0 until we track results) ───────────
interface Standing {
  team: string; p: number; w: number; d: number; l: number; pts: number;
}

// ── Schedule view ─────────────────────────────────────────
function ScheduleView({ groups }: { groups: Map<string, { teams: string[]; games: Game[] }> }) {
  const [open, setOpen] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3">
      {Array.from(groups.entries()).map(([letter, { teams, games }]) => {
        const isOpen = open === letter;
        return (
          <div key={letter} className="trn-group-card">
            {/* Group header */}
            <button className="trn-group-hdr" onClick={() => setOpen(isOpen ? null : letter)}>
              <span className="trn-group-letter">בית {letter}</span>
              <div className="trn-group-flags">
                {teams.map(t => <Flag key={t} team={t} size={24} />)}
              </div>
              <span className="trn-group-arrow">{isOpen ? '▲' : '▼'}</span>
            </button>

            {/* Games */}
            {isOpen && (
              <div className="trn-group-body fade-in">
                {games.map(g => (
                  <div key={g.id} className="trn-row">
                    <div className="trn-row-date">{fmtDateShort(g.commence_time)}<br />{fmtTime(g.commence_time)}</div>
                    <div className="trn-row-home">
                      <span className="trn-row-tname">{g.home_team}</span>
                      <Flag team={g.home_team} size={28} />
                    </div>
                    <div className="trn-row-odds">
                      <span className="trn-row-odd">{g.home_win.toFixed(2)}</span>
                      <span className="trn-row-odd trn-row-draw">{g.draw.toFixed(2)}</span>
                      <span className="trn-row-odd">{g.away_win.toFixed(2)}</span>
                    </div>
                    <div className="trn-row-away">
                      <Flag team={g.away_team} size={28} />
                      <span className="trn-row-tname">{g.away_team}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Standings view ────────────────────────────────────────
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
                      <Flag team={r.team} size={22} />
                      <span>{r.team}</span>
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
          ? <ScheduleView groups={groups} />
          : <StandingsView groups={groups} />}
      </div>
    </div>
  );
}
