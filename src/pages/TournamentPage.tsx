import { useState, useEffect } from 'react';
import { flagUrl } from '../lib/flagMap';

interface Game {
  id: string;
  home_team: string;
  away_team: string;
  commence_time: string;
  home_win: number;
  draw: number;
  away_win: number;
}

function Flag({ team, size = 40 }: { team: string; size?: number }) {
  const url = flagUrl(team, 'w80');
  if (!url) return <span style={{ fontSize: 20 }}>🏳️</span>;
  return (
    <img src={url} alt={team} width={size} height={Math.round(size * 0.6)}
      style={{ borderRadius: 3, objectFit: 'cover', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
  );
}

const TZ = 'Asia/Jerusalem';

function groupByDay(games: Game[]): Map<string, Game[]> {
  const map = new Map<string, Game[]>();
  for (const g of games) {
    const key = new Date(g.commence_time).toLocaleDateString('en-CA', { timeZone: TZ });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(g);
  }
  return map;
}

function fmtDayLabel(isoDate: string): string {
  const date = new Date(isoDate + 'T12:00:00');
  return date.toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit', timeZone: TZ });
}

function isToday(isoDate: string): boolean {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  return isoDate === today;
}

function isPast(isoDate: string): boolean {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  return isoDate < today;
}

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

export default function TournamentPage() {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
        processed.sort((a, b) => new Date(a.commence_time).getTime() - new Date(b.commence_time).getTime());
        setGames(processed);
      })
      .catch(() => setError('שגיאה בטעינת המשחקים'))
      .finally(() => setLoading(false));
  }, []);

  const byDay = groupByDay(games);
  const days = Array.from(byDay.keys()).sort();

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="text-5xl mb-4 animate-pulse">🌍</div>
        <div className="bebas text-2xl" style={{ color: 'var(--green)' }}>טוען משחקים...</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <header className="hdr">
        <div className="hdr-inner">
          <span className="font-bold">מונדיאל 2026</span>
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{games.length} משחקים</span>
        </div>
      </header>

      <div className="page-wrap pt-4">
        {/* Summary */}
        <div className="trn-banner">
          <span className="trn-banner-icon">🏆</span>
          <div>
            <div className="font-bold">FIFA World Cup 2026</div>
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>ארה״ב, קנדה ומקסיקו · 11 יוני – 19 יולי 2026</div>
          </div>
          <div className="trn-days-left">
            <span className="trn-days-num">{Math.max(0, Math.ceil((new Date('2026-06-11').getTime() - Date.now()) / 86400000))}</span>
            <span className="trn-days-lbl">ימים</span>
          </div>
        </div>

        {error && <div className="err-banner mt-3">{error}</div>}

        {/* Games by day */}
        <div className="flex flex-col gap-1 mt-4">
          {days.map(day => {
            const dayGames = byDay.get(day)!;
            const today = isToday(day);
            const past = isPast(day);

            return (
              <div key={day} className="trn-day-group">
                {/* Day header */}
                <div className={`trn-day-hdr ${today ? 'trn-day-hdr-today' : ''}`}>
                  {today && <span className="trn-today-dot" />}
                  <span className={today ? 'trn-day-today-label' : ''}>{fmtDayLabel(day)}</span>
                  <span className="trn-game-count">{dayGames.length} משחקים</span>
                </div>

                {/* Games */}
                <div className="flex flex-col gap-2 mb-4">
                  {dayGames.map(g => (
                    <div key={g.id} className={`trn-game ${past ? 'trn-game-past' : ''} ${today ? 'trn-game-today' : ''}`}>
                      {/* Teams row */}
                      <div className="trn-teams">
                        <div className="trn-team">
                          <Flag team={g.home_team} size={36} />
                          <span className="trn-tname">{g.home_team}</span>
                        </div>
                        <div className="trn-mid">
                          <span className="trn-time">{fmtTime(g.commence_time)}</span>
                          <span className="trn-vs">VS</span>
                        </div>
                        <div className="trn-team trn-team-away">
                          <span className="trn-tname">{g.away_team}</span>
                          <Flag team={g.away_team} size={36} />
                        </div>
                      </div>

                      {/* Odds row */}
                      <div className="trn-odds">
                        <div className="trn-odd">
                          <span className="trn-odd-lbl">{g.home_team.split(' ').pop()}</span>
                          <span className="trn-odd-val">{g.home_win.toFixed(2)}</span>
                        </div>
                        <div className="trn-odd trn-odd-draw">
                          <span className="trn-odd-lbl">תיקו</span>
                          <span className="trn-odd-val">{g.draw.toFixed(2)}</span>
                        </div>
                        <div className="trn-odd">
                          <span className="trn-odd-lbl">{g.away_team.split(' ').pop()}</span>
                          <span className="trn-odd-val">{g.away_win.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
