/**
 * update-live-scores.mjs — runs via GitHub Actions cron
 *
 * Fetches match scores from The Odds API for all sport_keys configured
 * in the Settings table, then upserts into live_scores in Supabase.
 * The frontend reads from live_scores only — never calls external APIs.
 *
 * Uses the same ODDS_API_KEY already set up for settle-games.mjs.
 * No additional secrets or API registrations needed.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !ODDS_API_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, ODDS_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Read active sport_keys from Settings
const { data: settings } = await supabase.from('settings').select('sport_keys').single();
const sportKeys = settings?.sport_keys?.length
  ? settings.sport_keys
  : ['soccer_fifa_world_cup'];

console.log(`Active sport keys: ${sportKeys.join(', ')}`);

const allRows = [];

for (const sportKey of sportKeys) {
  console.log(`Fetching scores for ${sportKey}...`);

  const url =
    `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/` +
    `?apiKey=${ODDS_API_KEY}&daysFrom=3`;

  const res = await fetch(url);

  if (!res.ok) {
    console.error(`Odds API error for ${sportKey}: ${res.status}`, await res.text());
    continue;
  }

  const games = await res.json();

  if (!Array.isArray(games)) {
    console.error(`Unexpected response for ${sportKey}:`, JSON.stringify(games).slice(0, 200));
    continue;
  }

  const completed = games.filter(g => g.completed).length;
  const live = games.filter(g => !g.completed && g.scores?.length).length;
  console.log(`[${sportKey}] ${games.length} games — ${completed} finished, ${live} live`);

  for (const g of games) {
    const homeScore = g.completed
      ? parseInt(g.scores?.find(s => s.name === g.home_team)?.score ?? '-1')
      : null;
    const awayScore = g.completed
      ? parseInt(g.scores?.find(s => s.name === g.away_team)?.score ?? '-1')
      : null;

    let status;
    if (g.completed) {
      status = 'FINISHED';
    } else if (g.scores?.length) {
      status = 'IN_PLAY';
    } else {
      status = 'SCHEDULED';
    }

    allRows.push({
      id:         g.id,
      home_team:  g.home_team,
      away_team:  g.away_team,
      home_score: homeScore !== null && homeScore >= 0 ? homeScore : null,
      away_score: awayScore !== null && awayScore >= 0 ? awayScore : null,
      status,
      stage:      null,
      matchday:   null,
      kickoff_at: g.commence_time,
      updated_at: new Date().toISOString(),
    });
  }
}

if (!allRows.length) {
  console.log('No games returned by API — nothing to store.');
  process.exit(0);
}

const { error } = await supabase
  .from('live_scores')
  .upsert(allRows, { onConflict: 'id' });

if (error) {
  console.error('Supabase upsert error:', error.message);
  process.exit(1);
}

console.log(`✅ Upserted ${allRows.length} rows into live_scores`);
