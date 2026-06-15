/**
 * update-live-scores.mjs — רץ כל 10 דקות (בפועל לפי GitHub) דרך GitHub Actions
 *
 * שולף תוצאות משחקים של מונדיאל 2026 מ-football-data.org (אותו טוקן חינמי
 * כמו update-scorers.mjs) ומעדכן את טבלת live_scores בסופאבייס.
 * הדף הראשי קורא מהטבלה הזו — לא קורא ל-API החיצוני בכלל.
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

// אל תריץ לפני שהטורניר מתחיל (חוסך קריאות)
const TOURNAMENT_START = new Date('2026-06-11T18:00:00Z').getTime();
if (Date.now() < TOURNAMENT_START) {
  console.log('Tournament has not started yet — skipping.');
  process.exit(0);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// טווח: מאתמול עד מחר — מספיק לכסות "תוצאות לייב" ומשחקים שהסתיימו לאחרונה
const today = new Date();
const dateFrom = new Date(today.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const dateTo   = new Date(today.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

console.log(`Fetching matches from football-data.org (${dateFrom} → ${dateTo})...`);

const res = await fetch(
  `https://api.football-data.org/v4/competitions/WC/matches?dateFrom=${dateFrom}&dateTo=${dateTo}`,
  { headers: { 'X-Auth-Token': FOOTBALL_DATA_TOKEN } }
);

if (!res.ok) {
  console.error('football-data.org error:', res.status, await res.text());
  process.exit(1);
}

const data = await res.json();

if (!Array.isArray(data.matches)) {
  console.error('Unexpected response:', JSON.stringify(data).slice(0, 300));
  process.exit(1);
}

console.log(`Got ${data.matches.length} matches`);

const rows = data.matches.map(m => ({
  id:          String(m.id),
  home_team:   m.homeTeam?.name ?? '',
  away_team:   m.awayTeam?.name ?? '',
  home_score:  m.score?.fullTime?.home ?? null,
  away_score:  m.score?.fullTime?.away ?? null,
  status:      m.status,
  kickoff_at:  m.utcDate,
  updated_at:  new Date().toISOString(),
}));

const { error } = await supabase
  .from('live_scores')
  .upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('Supabase error:', error.message);
  process.exit(1);
}

console.log(`✅ Updated ${rows.length} live scores`);
console.log('Requests remaining:', res.headers.get('x-requests-available-minute'));
