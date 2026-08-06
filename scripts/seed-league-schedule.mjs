/**
 * seed-league-schedule.mjs
 *
 * מושך את לוח המשחקים של ליגת העל מ-TheSportsDB (חינמי, ללא API key)
 * ומזריע את טבלת league_schedule בסופאבייס.
 *
 * הרץ ידנית מ-GitHub Actions: "Seed league schedule"
 * ניתן להריץ שוב בכל עת כדי לרענן — upsert על external_id.
 *
 * TheSportsDB: https://www.thesportsdb.com
 * Israeli Premier League ID: 4350
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── זיהוי עונה (אוגוסט 2026 → עונה 2026-2027) ──────────────
const now = new Date();
const month = now.getMonth(); // 0-indexed
const seasonYear = month >= 6 ? now.getFullYear() : now.getFullYear() - 1;
const season = `${seasonYear}-${seasonYear + 1}`;

console.log(`Fetching Israeli Premier League (Ligat ha'Al) fixtures`);
console.log(`Season: ${season} | Source: TheSportsDB (free)`);

const LEAGUE_ID = 4350;
const url = `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=${LEAGUE_ID}&s=${season}`;

const res = await fetch(url);
if (!res.ok) {
  console.error('TheSportsDB error:', res.status, await res.text());
  process.exit(1);
}

const data = await res.json();

if (!data.events || !Array.isArray(data.events)) {
  console.warn('No events returned from TheSportsDB for this season.');
  console.warn('The schedule may not be published yet — try again later.');
  console.log('Raw response:', JSON.stringify(data).slice(0, 400));
  process.exit(0);
}

console.log(`Got ${data.events.length} fixtures from TheSportsDB`);

const rows = data.events
  .filter(e => e.strHomeTeam && e.strAwayTeam && e.dateEvent)
  .map(e => {
    // TheSportsDB מחזיר שעה בפורמט HH:MM:SS, ללא timezone — נניח UTC
    const timeStr = e.strTime && e.strTime !== '00:00:00' ? e.strTime : '17:00:00';
    const kickoffRaw = `${e.dateEvent}T${timeStr}Z`;

    const homeScore = (e.intHomeScore !== null && e.intHomeScore !== '')
      ? parseInt(e.intHomeScore) : null;
    const awayScore = (e.intAwayScore !== null && e.intAwayScore !== '')
      ? parseInt(e.intAwayScore) : null;
    const completed = e.strStatus === 'Match Finished'
      || (homeScore !== null && awayScore !== null);

    return {
      external_id: String(e.idEvent),
      home_team:   e.strHomeTeam,
      away_team:   e.strAwayTeam,
      kickoff_at:  new Date(kickoffRaw).toISOString(),
      home_score:  homeScore,
      away_score:  awayScore,
      completed,
      round_num:   e.intRound ? parseInt(e.intRound) : null,
      updated_at:  new Date().toISOString(),
    };
  });

console.log(`Upserting ${rows.length} rows into league_schedule...`);

const { error } = await supabase
  .from('league_schedule')
  .upsert(rows, { onConflict: 'external_id' });

if (error) {
  console.error('Supabase error:', error.message);
  process.exit(1);
}

const completed = rows.filter(r => r.completed).length;
const upcoming  = rows.length - completed;
console.log(`✅ Done: ${completed} completed, ${upcoming} upcoming`);
console.log(`Sample: ${rows[0]?.home_team} vs ${rows[0]?.away_team} on ${rows[0]?.kickoff_at?.slice(0, 10)}`);
