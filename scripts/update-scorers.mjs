/**
 * update-scorers.mjs
 * מושך מלכי שערים של ליגת העל מ-365scores — לכל הקבוצות
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

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json',
  'Referer': 'https://www.365scores.com/he/football/league/premier-league-42/stats',
};

function buildUrl(competitorId = '') {
  return (
    'https://webws.365scores.com/web/stats/' +
    `?appTypeId=5&langId=2&timezoneName=Asia%2FJerusalem` +
    `&userCountryId=6&competitions=42&competitors=${competitorId}&withSeasons=true`
  );
}

function parseStats(data) {
  const athletesStats = data?.stats?.athletesStats;
  const statsList = Array.isArray(athletesStats)
    ? athletesStats
    : Array.isArray(athletesStats?.tables) ? athletesStats.tables
    : Array.isArray(athletesStats?.items)  ? athletesStats.items
    : Array.isArray(athletesStats?.list)   ? athletesStats.list
    : [];
  const goalsCategory   = statsList.find(c => c.name === 'שערים'   || c.title === 'שערים');
  const assistsCategory = statsList.find(c => c.name === 'בישולים' || c.title === 'בישולים');
  return { goalsCategory, assistsCategory, competitors: data.competitors ?? [] };
}

// שלב 1: שלוף את רשימת הקבוצות מהקריאה הכללית
console.log('Fetching team list from 365scores...');
const overallRes = await fetch(buildUrl(), { headers: HEADERS });
if (!overallRes.ok) {
  console.error('365scores error:', overallRes.status);
  process.exit(1);
}
const overallData = await overallRes.json();
const allCompetitors = overallData.competitors ?? [];
console.log(`Found ${allCompetitors.length} teams`);

if (allCompetitors.length === 0) {
  console.log('No teams found — exiting.');
  process.exit(0);
}

// שלב 2: לכל קבוצה — שלוף שערים ובישולים
const allGoals   = new Map(); // id → row data
const allAssists = new Map(); // id → assists count

for (const team of allCompetitors) {
  process.stdout.write(`  Fetching ${team.name}... `);
  try {
    const res = await fetch(buildUrl(team.id), { headers: HEADERS });
    if (!res.ok) { console.log(`HTTP ${res.status} — skip`); continue; }
    const data = await res.json();
    const { goalsCategory, assistsCategory, competitors } = parseStats(data);

    // אסוף בישולים
    for (const row of (assistsCategory?.rows ?? [])) {
      if (row.entity?.id == null) continue;
      const val = Number(row.stats?.[0]?.value ?? 0);
      if (val > 0) allAssists.set(row.entity.id, val);
    }

    // אסוף שערים
    let count = 0;
    for (const row of (goalsCategory?.rows ?? [])) {
      if (row.entity?.id == null) continue;
      const goals = Number(row.stats?.[0]?.value ?? 0);
      if (goals === 0) continue;
      const comp = competitors.find(c => c.id === row.entity?.competitorId);
      allGoals.set(row.entity.id, {
        id:          String(row.entity.id),
        player_name: row.entity.name ?? '',
        team:        comp?.name ?? team.name,
        goals,
        entity:      row.entity,
      });
      count++;
    }
    console.log(`${count} scorers`);
  } catch (e) {
    console.log(`error: ${e.message}`);
  }
  // המתנה קצרה בין קריאות
  await new Promise(r => setTimeout(r, 300));
}

// שלב 3: בנה שורות סופיות עם בישולים
const rows = [...allGoals.values()].map(p => ({
  id:          p.id,
  player_name: p.player_name,
  team:        p.team,
  goals:       p.goals,
  assists:     allAssists.get(Number(p.id)) ?? 0,
  updated_at:  new Date().toISOString(),
})).sort((a, b) => b.goals - a.goals || b.assists - a.assists);

console.log(`\nTotal scorers: ${rows.length}`);
rows.slice(0, 5).forEach((r, i) =>
  console.log(`  ${i + 1}. ${r.player_name} (${r.team}) — ${r.goals} שע' ${r.assists} בישולים`)
);

// שלב 4: מחק ישן, הכנס חדש
const { error: delErr } = await supabase.from('top_scorers').delete().neq('id', '__never__');
if (delErr) { console.error('Delete error:', delErr.message); process.exit(1); }

const { error } = await supabase.from('top_scorers').insert(rows);
if (error) { console.error('Supabase error:', error.message); process.exit(1); }

console.log(`✅ Updated ${rows.length} top scorers`);
