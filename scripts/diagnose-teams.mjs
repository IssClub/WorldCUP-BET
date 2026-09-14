/**
 * diagnose-teams.mjs
 * מדפיס את שמות הקבוצות שיש בDB לעומת מה שמגיע מ-365scores
 * שימוש: node scripts/diagnose-teams.mjs
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
const norm = s => s.toLowerCase().replace(/[-']/g, ' ').replace(/\s+/g, ' ').trim();

const HE_TO_EN = {
  'מכבי תל אביב':      'Maccabi Tel Aviv',
  'מכבי חיפה':         'Maccabi Haifa',
  'עירוני קרית שמונה': 'Hapoel Ironi Kiryat Shmona',
  'הפועל ירושלים':     'Hapoel Jerusalem',
  'הפועל רמת גן':      'Hapoel Ramat Gan',
  'מכבי פתח תקוה':     'Maccabi Petah Tikva',
  'עירוני טבריה':      'Ironi Tiberias',
  'הפועל פתח תקוה':    'Hapoel Petah Tikva',
  'הפועל באר שבע':     "Hapoel Be'er Sheva",
  'הפועל חיפה':        'Hapoel Haifa',
  'הפועל תל אביב':     'Hapoel Tel-Aviv',
  'בני סכנין':         'Bnei Sakhnin',
  'בית"ר ירושלים':     'Beitar Jerusalem',
  'מכבי נתניה':        'Maccabi Netanya',
};

// ── DB ────────────────────────────────────────────────────────
const { data: rows } = await supabase
  .from('league_schedule')
  .select('home_team, away_team, round_num, completed')
  .order('kickoff_at')
  .limit(30);

console.log('\n📋 שמות קבוצות ב-DB:');
const dbNames = new Set();
for (const r of rows ?? []) {
  dbNames.add(r.home_team);
  dbNames.add(r.away_team);
}
[...dbNames].sort().forEach(n => console.log(`  DB: "${n}"  →  norm: "${norm(n)}"`));

// ── 365scores ─────────────────────────────────────────────────
const d = new Date();
const today = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
const seasonYr = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1;
const startDate = `01/08/${seasonYr}`;
const res = await fetch(
  `https://webws.365scores.com/web/games/?appTypeId=5&langId=2&timezoneName=Asia%2FJerusalem&userCountryId=6&competitions=42&startDate=${startDate}&endDate=${today}`,
  { headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', Referer: 'https://www.365scores.com/' } }
);
const data = await res.json();
const names365 = new Set();
for (const g of data.games ?? []) {
  if (g.homeCompetitor?.name) names365.add(g.homeCompetitor.name);
  if (g.awayCompetitor?.name) names365.add(g.awayCompetitor.name);
}

console.log('\n🌐 שמות קבוצות ב-365scores (עברית → מופה לאנגלית → norm):');
[...names365].sort().forEach(he => {
  const en = HE_TO_EN[he] ?? `❌ לא במפה: ${he}`;
  console.log(`  "${he}" → "${en}"  →  norm: "${typeof en === 'string' ? norm(en) : '?'}"`);
});

// ── השוואה ────────────────────────────────────────────────────
console.log('\n🔍 התאמה:');
const dbNormSet = new Set([...dbNames].map(n => norm(n)));
for (const he of [...names365].sort()) {
  const en = HE_TO_EN[he];
  if (!en) { console.log(`  ❌ "${he}" — לא ב-HE_TO_EN`); continue; }
  const n = norm(en);
  console.log(`  ${dbNormSet.has(n) ? '✅' : '❌ לא נמצא ב-DB!'} "${en}" (norm: "${n}")`);
}
