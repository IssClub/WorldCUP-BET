/**
 * update-scorers.mjs
 * מושך מלכי שערים של ליגת העל מ-365scores
 * רץ פעם ביום אחרי המשחקים ומעדכן טבלת top_scorers בסופאבייס
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY');
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

const API_URL =
  'https://webws.365scores.com/web/stats/' +
  '?appTypeId=5&langId=2&timezoneName=Asia%2FJerusalem' +
  '&userCountryId=6&competitions=42&competitors=&withSeasons=true';

console.log('Fetching top scorers from 365scores...');

const res = await fetch(API_URL, {
  headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json',
    'Referer': 'https://www.365scores.com/he/football/league/premier-league-42/stats',
  },
});

if (!res.ok) {
  console.error('365scores error:', res.status, await res.text());
  process.exit(1);
}

const data = await res.json();

// מצא את קטגוריית השערים
const goalsCategory = data?.stats?.athletesStats?.find(cat => cat.name === 'שערים');

if (!goalsCategory || !Array.isArray(goalsCategory.rows) || goalsCategory.rows.length === 0) {
  console.log('No goals data found — season may not have started yet.');
  console.log('Available categories:', data?.stats?.athletesStats?.map(c => c.name).join(', '));
  process.exit(0);
}

// מצא את ה-typeId של שערים (בד"כ 1) ועזרות
const GOALS_TYPE_ID   = 1;
const ASSISTS_TYPE_ID = 10; // לפי הנתונים שראינו בדיבוג

// מצא קטגוריית עזרות אם קיימת
const assistsCategory = data?.stats?.athletesStats?.find(cat =>
  cat.name?.includes('עזר') || cat.name?.toLowerCase().includes('assist')
);

// בנה map של עזרות לפי entity id
const assistsMap = new Map();
if (assistsCategory) {
  for (const row of assistsCategory.rows) {
    if (row.entity?.id !== undefined) {
      const val = row.stats?.find(s => s.typeId === ASSISTS_TYPE_ID)?.value ?? 0;
      assistsMap.set(row.entity.id, Number(val));
    }
  }
}

// בנה את הרשימה הסופית
const rows = goalsCategory.rows.slice(0, 20).map(row => {
  const goals   = Number(row.stats?.find(s => s.typeId === GOALS_TYPE_ID)?.value ?? 0);
  const assists = assistsMap.get(row.entity?.id) ?? 0;

  // שם הקבוצה — מגיע מ-competitors
  const competitor = data.competitors?.find(c => c.id === row.entity?.competitorId);
  const teamName   = competitor?.name ?? '';

  return {
    id:          String(row.entity?.id),
    player_name: row.entity?.name ?? '',
    team:        teamName,
    goals,
    assists,
    updated_at:  new Date().toISOString(),
  };
});

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
