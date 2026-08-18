/**
 * seed-league-schedule.mjs
 *
 * מושך לוח משחקים מ-TheSportsDB ומעדכן את league_schedule.
 *
 * כאשר TheSportsDB מפרסם שעות אמיתיות:
 *   - משחקים שנזרעו ידנית (external_id מתחיל ב-csv_) → מתעדכן kickoff_at + external_id
 *   - משחקים חדשים שעוד לא קיימים → נוספים
 *
 * מיפוי: home_team + away_team ייחודי לכל העונה (ליגה רגילה, לא גביע)
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── זיהוי עונה ──────────────────────────────────────────────
const now   = new Date();
const month = now.getMonth(); // 0-indexed
const yr    = month >= 6 ? now.getFullYear() : now.getFullYear() - 1;
const season = `${yr}-${yr + 1}`;

console.log(`Fetching Israeli Premier League fixtures — season ${season}`);

const LEAGUE_ID = 4644;
const url = `https://www.thesportsdb.com/api/v1/json/3/eventsseason.php?id=${LEAGUE_ID}&s=${season}`;

const res = await fetch(url);
if (!res.ok) {
  console.error('TheSportsDB error:', res.status, await res.text());
  process.exit(1);
}

const data = await res.json();

if (!data.events || !Array.isArray(data.events)) {
  console.warn('No events from TheSportsDB for this season — try again later.');
  console.log('Raw:', JSON.stringify(data).slice(0, 400));
  process.exit(0);
}

console.log(`Got ${data.events.length} fixtures from TheSportsDB`);

// ── בנה רשימת שורות מ-TheSportsDB ──────────────────────────
const incoming = data.events
  .filter(e => e.strHomeTeam && e.strAwayTeam && e.dateEvent)
  .map(e => {
    const timeStr    = e.strTime && e.strTime !== '00:00:00' ? e.strTime : '17:00:00';
    const kickoffRaw = `${e.dateEvent}T${timeStr}Z`;
    const homeScore  = (e.intHomeScore !== null && e.intHomeScore !== '')
      ? parseInt(e.intHomeScore) : null;
    const awayScore  = (e.intAwayScore !== null && e.intAwayScore !== '')
      ? parseInt(e.intAwayScore) : null;
    const completed  = e.strStatus === 'Match Finished'
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

// ── טען את כל השורות הקיימות מהדאטהבייס ──────────────────
const { data: existing, error: fetchErr } = await supabase
  .from('league_schedule')
  .select('id, home_team, away_team, external_id, completed');

if (fetchErr) {
  console.error('Failed to fetch existing rows:', fetchErr.message);
  process.exit(1);
}

// מיפוי: "home|away" → { id, external_id, completed }
const existingMap = new Map(
  (existing ?? []).map(r => [`${r.home_team}|${r.away_team}`, r])
);

// ── חלק לעדכון (מיפוי נמצא) מול הוספה (חדש) ─────────────
const toUpdate = [];
const toUpsert = [];

for (const row of incoming) {
  const key     = `${row.home_team}|${row.away_team}`;
  const current = existingMap.get(key);

  if (current) {
    // אל תדרוס תוצאה שכבר סגרנו (settled) — רק עדכן kickoff + external_id אם השורה מ-CSV
    const isCsvRow = current.external_id?.startsWith('csv_');
    if (isCsvRow) {
      // עדכן הכל — זו שורה שנזרעה ידנית בלי שעה אמיתית
      toUpdate.push({ dbId: current.id, ...row });
    } else if (!current.completed) {
      // שורת TheSportsDB קיימת שעדיין לא הסתיימה — עדכן kickoff בלבד
      toUpdate.push({ dbId: current.id, kickoff_at: row.kickoff_at, updated_at: row.updated_at });
    }
    // אם הסתיים — אל תיגע בתוצאה (settle-games.mjs מטפל בזה)
  } else {
    toUpsert.push(row);
  }
}

console.log(`${toUpdate.length} rows to update (kickoff times sync)`);
console.log(`${toUpsert.length} rows to insert (new fixtures)`);

// ── עדכן שורות קיימות ─────────────────────────────────────
let updatedCount = 0;
for (const { dbId, ...fields } of toUpdate) {
  const { error } = await supabase
    .from('league_schedule')
    .update(fields)
    .eq('id', dbId);
  if (error) console.warn(`Update failed for id=${dbId}:`, error.message);
  else updatedCount++;
}

// ── הוסף שורות חדשות ──────────────────────────────────────
let insertedCount = 0;
if (toUpsert.length) {
  const { error } = await supabase
    .from('league_schedule')
    .upsert(toUpsert, { onConflict: 'external_id' });
  if (error) {
    console.error('Upsert error:', error.message);
    process.exit(1);
  }
  insertedCount = toUpsert.length;
}

const completed = incoming.filter(r => r.completed).length;
console.log(`✅ Done: updated=${updatedCount}, inserted=${insertedCount}, completed=${completed}`);
