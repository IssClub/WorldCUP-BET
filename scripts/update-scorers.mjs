/**
 * update-scorers.mjs — רץ כל 2 שעות דרך GitHub Actions
 *
 * שולף מלכי שערים של מונדיאל 2026 מ-football-data.org (חינמי, 10 קריאות/דקה,
 * כולל את ה-World Cup ב-tier החינמי — בניגוד ל-API-Football שלא מכיל עונת 2026 בתוכנית החינמית)
 * ומעדכן את טבלת top_scorers בסופאבייס.
 *
 * הרשמה חינמית: https://www.football-data.org/client/register
 * הגדרה ב-GitHub Secrets: FOOTBALL_DATA_TOKEN
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL        = process.env.SUPABASE_URL;
const SUPABASE_KEY        = process.env.SUPABASE_SERVICE_KEY;
const FOOTBALL_DATA_TOKEN = process.env.FOOTBALL_DATA_TOKEN;

if (!SUPABASE_URL || !SUPABASE_KEY || !FOOTBALL_DATA_TOKEN) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, FOOTBALL_DATA_TOKEN');
  process.exit(1);
}

// אל תריץ לפני שהטורניר מתחיל (חוסך קריאות יומיות)
const TOURNAMENT_START = new Date('2026-06-11T18:00:00Z').getTime();
if (Date.now() < TOURNAMENT_START) {
  console.log('Tournament has not started yet — skipping.');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

console.log('Fetching top scorers from football-data.org (competition=WC)...');

const res = await fetch(
  'https://api.football-data.org/v4/competitions/WC/scorers?limit=20',
  { headers: { 'X-Auth-Token': FOOTBALL_DATA_TOKEN } }
);

if (!res.ok) {
  console.error('football-data.org error:', res.status, await res.text());
  process.exit(1);
}

const data = await res.json();

if (!Array.isArray(data.scorers)) {
  console.error('Unexpected response:', JSON.stringify(data).slice(0, 300));
  process.exit(1);
}

console.log(`Got ${data.scorers.length} scorers`);

const rows = data.scorers.slice(0, 20).map(item => ({
  id:          String(item.player.id),
  player_name: item.player.name,
  team:        item.team?.name ?? '',
  goals:       item.goals ?? 0,
  assists:     item.assists ?? 0,
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
// football-data.org מחזיר את המגבלה הנותרת בכותרות:
console.log('Requests remaining:', res.headers.get('x-requests-available-minute'));
