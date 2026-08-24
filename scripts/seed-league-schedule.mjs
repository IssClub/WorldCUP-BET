/**
 * seed-league-schedule.mjs
 *
 * מושך לוח משחקים מ-365scores ומעדכן את league_schedule.
 * 365scores מפרסם שעות אמיתיות מוקדם יותר מ-TheSportsDB.
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

// ── מיפוי עברית → אנגלית ──────────────────────────────────
// שמות הקבוצות בDB הם אנגלית (מ-TheSportsDB המקורי)
const HE_TO_EN = {
  'מכבי תל אביב':      'Maccabi Tel Aviv',
  'מכבי חיפה':         'Maccabi Haifa',
  'עירוני קרית שמונה': 'Hapoel Ironi Kiryat Shmona',
  'הפועל ירושלים':     'Hapoel Jerusalem',
  'הפועל רמת גן':      'Hapoel Ramat Gan',
  'מכבי פתח תקוה':     'Maccabi Petah Tikva',
  'מכבי פתח תקווה':    'Maccabi Petah Tikva',
  'עירוני טבריה':      'Ironi Tiberias',
  'הפועל פתח תקוה':    'Hapoel Petah Tikva',
  'הפועל פתח תקווה':   'Hapoel Petah Tikva',
  'הפועל באר שבע':     "Hapoel Be'er Sheva",
  'הפועל חיפה':        'Hapoel Haifa',
  'הפועל תל אביב':     'Hapoel Tel-Aviv',
  'בני סכנין':         'Bnei Sakhnin',
  'בית"ר ירושלים':     'Beitar Jerusalem',
  'מכבי נתניה':        'Maccabi Netanya',
};

// ── זיהוי עונה ──────────────────────────────────────────────
const now   = new Date();
const month = now.getMonth(); // 0-indexed
const yr    = month >= 6 ? now.getFullYear() : now.getFullYear() - 1;

const seasonStartDate = new Date(`${yr}-08-01`);
const seasonEndDate   = new Date(`${yr + 1}-05-31`);

const fmt365 = d =>
  `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

console.log(`Fetching Israeli Premier League fixtures from 365scores — season ${yr}/${yr+1}`);

// ── שלוף משחקים מ-365scores בחלקים חודשיים ─────────────────
// 365scores מגביל טווח תאריכים — יותר מ~30 יום מחזיר 0 תוצאות.
// שולפים חודש-חודש מתחילת העונה ועד סופה.
function monthChunks(start, end) {
  const chunks = [];
  let cur = new Date(start);
  while (cur <= end) {
    const chunkEnd = new Date(cur);
    chunkEnd.setMonth(chunkEnd.getMonth() + 1);
    chunkEnd.setDate(chunkEnd.getDate() - 1);
    chunks.push({ s: new Date(cur), e: chunkEnd > end ? new Date(end) : chunkEnd });
    cur.setMonth(cur.getMonth() + 1);
  }
  return chunks;
}

let allGames = [];
for (const { s, e } of monthChunks(seasonStartDate, seasonEndDate)) {
  const url =
    `https://webws.365scores.com/web/games/?appTypeId=5&langId=2` +
    `&timezoneName=Asia%2FJerusalem&userCountryId=6&competitions=42` +
    `&startDate=${fmt365(s)}&endDate=${fmt365(e)}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
      Referer: 'https://www.365scores.com/',
    },
  });
  if (!res.ok) {
    console.warn(`365scores HTTP ${res.status} for range ${fmt365(s)}-${fmt365(e)}`);
    continue;
  }
  const data = await res.json();
  const games = data.games ?? [];
  console.log(`  ${fmt365(s)} → ${fmt365(e)}: ${games.length} games`);
  allGames = allGames.concat(games);
  // pause קצר בין בקשות
  await new Promise(r => setTimeout(r, 300));
}

if (allGames.length === 0) {
  console.warn('No games returned from 365scores — aborting.');
  process.exit(0);
}

console.log(`Total: ${allGames.length} games from 365scores`);

// ── בנה רשימת שורות מ-365scores ────────────────────────────
const normalize = name =>
  name.toLowerCase().replace(/[-']/g, ' ').replace(/\s+/g, ' ').trim();

const incoming = allGames
  .filter(g => g.homeCompetitor?.name && g.awayCompetitor?.name && g.startTime && g.roundNum)
  .map(g => {
    const homeHe = g.homeCompetitor.name;
    const awayHe = g.awayCompetitor.name;
    const homeEn = HE_TO_EN[homeHe] ?? homeHe;
    const awayEn = HE_TO_EN[awayHe] ?? awayHe;

    const homeScore = (g.homeCompetitor.score !== undefined && g.homeCompetitor.score >= 0)
      ? g.homeCompetitor.score : null;
    const awayScore = (g.awayCompetitor.score !== undefined && g.awayCompetitor.score >= 0)
      ? g.awayCompetitor.score : null;
    const completed = homeScore !== null && awayScore !== null
      && new Date(g.startTime) < now;

    return {
      external_id: `365_${g.id}`,
      home_team:   homeEn,
      away_team:   awayEn,
      kickoff_at:  new Date(g.startTime).toISOString(),
      home_score:  homeScore,
      away_score:  awayScore,
      completed,
      round_num:   g.roundNum,
      updated_at:  new Date().toISOString(),
    };
  });

console.log(`Parsed ${incoming.length} valid fixtures`);

// ── טען את כל השורות הקיימות מהדאטהבייס ──────────────────
const { data: existing, error: fetchErr } = await supabase
  .from('league_schedule')
  .select('id, home_team, away_team, external_id, completed, kickoff_at');

if (fetchErr) {
  console.error('Failed to fetch existing rows:', fetchErr.message);
  process.exit(1);
}

// מיפוי: "home_normalized|away_normalized" → { id, external_id, completed }
const existingMap = new Map(
  (existing ?? []).map(r => [
    `${normalize(r.home_team)}|${normalize(r.away_team)}`, r
  ])
);

// ── חלק לעדכון מול הוספה ──────────────────────────────────
const toUpdate = [];
const toUpsert = [];

for (const row of incoming) {
  const key     = `${normalize(row.home_team)}|${normalize(row.away_team)}`;
  const current = existingMap.get(key);

  if (current) {
    if (!current.completed) {
      const update = {
        kickoff_at:  row.kickoff_at,
        round_num:   row.round_num,
        external_id: row.external_id,   // עדכן גם external_id ל-365scores
        updated_at:  row.updated_at,
      };
      if (row.completed && row.home_score !== null && row.away_score !== null) {
        update.home_score = row.home_score;
        update.away_score = row.away_score;
        update.completed  = true;
      }
      toUpdate.push({ dbId: current.id, home: row.home_team, away: row.away_team, ...update });
    }
  } else {
    toUpsert.push(row);
  }
}

console.log(`${toUpdate.length} rows to update, ${toUpsert.length} to insert`);

// ── עדכן שורות קיימות ─────────────────────────────────────
let updatedCount = 0;
for (const { dbId, home, away, ...fields } of toUpdate) {
  const { error } = await supabase
    .from('league_schedule')
    .update(fields)
    .eq('id', dbId);
  if (error) console.warn(`Update failed for ${home} vs ${away}:`, error.message);
  else {
    updatedCount++;
    if (fields.completed) console.log(`  ✅ settled: ${home} ${fields.home_score}-${fields.away_score} ${away}`);
    else console.log(`  ⏰ time: ${home} vs ${away} → ${fields.kickoff_at}`);
  }
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

const completedCount = incoming.filter(r => r.completed).length;
console.log(`✅ Done: updated=${updatedCount}, inserted=${insertedCount}, completed=${completedCount}`);
