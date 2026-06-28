/**
 * init-schedule.mjs — סקריפט חד-פעמי
 * מושך את לוח משחקי המונדיאל מה-API ושומר בסופאבייס.
 * עולה 72 קרדיטים. מריצים פעם אחת.
 * הרצה: node scripts/init-schedule.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const ODDS_API_KEY  = process.env.ODDS_API_KEY   || process.env.VITE_ODDS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !ODDS_API_KEY) {
  console.error('Missing env vars. Set SUPABASE_URL, SUPABASE_SERVICE_KEY, ODDS_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const res = await fetch(
  `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal`
);

if (!res.ok) {
  console.error('API error:', res.status, await res.text());
  process.exit(1);
}

const games = await res.json();
console.log(`Got ${games.length} games from API`);

const rows = games.map(g => ({
  id:         g.id,
  home_team:  g.home_team,
  away_team:  g.away_team,
  kickoff_at: g.commence_time,
  home_score: null,
  away_score: null,
  completed:  false,
}));

const { error } = await supabase
  .from('wc_schedule')
  .upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('Supabase error:', error.message);
  process.exit(1);
}

console.log(`✅ Inserted ${rows.length} games into wc_schedule`);
console.log('Remaining API credits:', res.headers.get('x-requests-remaining'));
