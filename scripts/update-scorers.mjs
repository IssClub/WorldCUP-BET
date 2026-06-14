/**
 * update-scorers.mjs — רץ כל 2 שעות דרך GitHub Actions
 *
 * שולף מלכי שערים של מונדיאל 2026 מ-API-Football (חינמי, 100 קריאות/יום)
 * ומעדכן את טבלת top_scorers בסופאבייס.
 *
 * הרשמה חינמית: https://dashboard.api-football.com/register
 * הגדרה ב-GitHub Secrets: APIFOOTBALL_KEY
 *
 * לאימות מזהה הליגה לפני הטורניר, הרץ:
 *   curl "https://v3.football.api-sports.io/leagues?name=FIFA+World+Cup&type=cup&season=2026" \
 *        -H "x-apisports-key: YOUR_KEY"
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY;
const APIFOOTBALL_KEY  = process.env.APIFOOTBALL_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !APIFOOTBALL_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, APIFOOTBALL_KEY');
  process.exit(1);
}

// מזהה ליגה של מונדיאל בAPI-Football — אמת לפני הטורניר עם הפקודה למעלה
const WC_LEAGUE_ID = 1;
const WC_SEASON    = 2026;

// אל תריץ לפני שהטורניר מתחיל (חוסך קריאות יומיות)
const TOURNAMENT_START = new Date('2026-06-11T18:00:00Z').getTime();
if (Date.now() < TOURNAMENT_START) {
  console.log('Tournament has not started yet — skipping.');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log(`Fetching top scorers (league=${WC_LEAGUE_ID}, season=${WC_SEASON})...`);

const res = await fetch(
  `https://v3.football.api-sports.io/players/topscorers?league=${WC_LEAGUE_ID}&season=${WC_SEASON}`,
  { headers: { 'x-apisports-key': APIFOOTBALL_KEY } }
);

if (!res.ok) {
  console.error('API-Football error:', res.status, await res.text());
  process.exit(1);
}

const data = await res.json();

if (!Array.isArray(data.response)) {
  console.error('Unexpected response:', JSON.stringify(data).slice(0, 300));
  process.exit(1);
}

console.log(`Got ${data.response.length} scorers`);

if (data.response.length === 0) {
  // אבחון: אם ריק, אולי יש שגיאת תוכנית/ליגה/עונה — מודפס ללוג ה-Action
  console.log('results:', data.results);
  console.log('paging:', JSON.stringify(data.paging));
  console.log('errors:', JSON.stringify(data.errors));
}

const rows = data.response.slice(0, 20).map(item => ({
  id:          String(item.player.id),
  player_name: item.player.name,
  team:        item.statistics[0]?.team?.name ?? '',
  goals:       item.statistics[0]?.goals?.total    ?? 0,
  assists:     item.statistics[0]?.goals?.assists  ?? 0,
  updated_at:  new Date().toISOString(),
}));

const { error } = await supabase
  .from('top_scorers')
  .upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('Supabase error:', error.message);
  process.exit(1);
}

console.log(`✅ Updated ${rows.length} top scorers`);
// API-Football quota remaining:
console.log('Requests remaining today:', res.headers.get('x-ratelimit-requests-remaining'));
