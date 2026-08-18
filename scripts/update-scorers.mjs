/**
 * update-scorers.mjs
 * שולף מלכי שערים של ליגת העל מ-API-Football (api-sports.io)
 * רץ פעם ביום אחרי המשחקים ומעדכן טבלת top_scorers בסופאבייס
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_KEY  = process.env.SUPABASE_SERVICE_KEY;
const APISPORTS_KEY = process.env.APISPORTS_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !APISPORTS_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY, APISPORTS_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// רץ רק במצב ליגה (לא מונדיאל)
const { data: settings } = await supabase.from('settings').select('sport_keys').single();
const sportKeys = settings?.sport_keys ?? ['soccer_fifa_world_cup'];
if (sportKeys.includes('soccer_fifa_world_cup')) {
  console.log('World Cup mode — skipping league scorers.');
  process.exit(0);
}

// ליגת העל = league 271, עונה 2026 (שנת פתיחה)
const LEAGUE_ID = 271;
const SEASON    = 2026;

console.log(`Fetching top scorers — league ${LEAGUE_ID}, season ${SEASON}...`);

const res = await fetch(
  `https://v3.football.api-sports.io/players/topscorers?league=${LEAGUE_ID}&season=${SEASON}`,
  { headers: { 'x-apisports-key': APISPORTS_KEY } }
);

if (!res.ok) {
  console.error('API-Football error:', res.status, await res.text());
  process.exit(1);
}

const data = await res.json();

// הצג מגבלת קריאות נותרת
const remaining = res.headers.get('x-ratelimit-requests-remaining');
console.log(`Requests remaining today: ${remaining ?? 'unknown'}`);

if (!Array.isArray(data.response)) {
  console.error('Unexpected response:', JSON.stringify(data).slice(0, 300));
  process.exit(1);
}

if (data.response.length === 0) {
  console.log('No scorers returned yet — season may not have started or data not available.');
  process.exit(0);
}

console.log(`Got ${data.response.length} scorers`);

const rows = data.response.slice(0, 20).map(item => ({
  id:          String(item.player.id),
  player_name: item.player.name,
  team:        item.statistics[0]?.team?.name ?? '',
  goals:       item.statistics[0]?.goals?.total  ?? 0,
  assists:     item.statistics[0]?.goals?.assists ?? 0,
  updated_at:  new Date().toISOString(),
}));

// הצג top 5 לצורך לוג
rows.slice(0, 5).forEach((r, i) =>
  console.log(`  ${i + 1}. ${r.player_name} (${r.team}) — ${r.goals} שערים`)
);

const { error } = await supabase
  .from('top_scorers')
  .upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('Supabase error:', error.message);
  process.exit(1);
}

console.log(`✅ Updated ${rows.length} top scorers`);
