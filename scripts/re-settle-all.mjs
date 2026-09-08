/**
 * re-settle-all.mjs
 *
 * מביא תוצאות סופיות מ-365scores ומשווה לDB.
 * אם יש אי-התאמה — מתקן league_schedule + bets + bank.
 *
 * Dry run (ברירת מחדל): מדפיס מה ישתנה, ללא שינוי בDB.
 * Apply mode: node re-settle-all.mjs --apply
 */
import { createClient } from '@supabase/supabase-js';

const APPLY = process.argv.includes('--apply');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing env vars'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

const norm = s => s.toLowerCase().replace(/[-']/g, ' ').replace(/\s+/g, ' ').trim();

function monthChunks(start, end) {
  const chunks = [];
  let cur = new Date(start);
  while (cur <= end) {
    const e = new Date(cur);
    e.setMonth(e.getMonth() + 1);
    e.setDate(e.getDate() - 1);
    chunks.push({ s: new Date(cur), e: e > end ? new Date(end) : e });
    cur.setMonth(cur.getMonth() + 1);
  }
  return chunks;
}
const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;

async function main() {
  console.log(APPLY ? '🔧 APPLY MODE — שינויים יבוצעו בDB' : '🔍 DRY RUN — לא יבוצע שום שינוי');
  console.log('');

  // הגדרות
  const { data: settings } = await supabase.from('settings').select('result_points, exact_score_points').single();
  const resultPts = settings?.result_points ?? 3;
  const exactPts  = settings?.exact_score_points ?? 5;

  // כל השחקנים + בנק
  const { data: profiles } = await supabase.from('profiles').select('id, display_name, bank');
  const bankMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.bank ?? 0]));
  const nameMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p.display_name]));

  // כל ה-league_schedule
  const { data: dbRows } = await supabase
    .from('league_schedule')
    .select('id, home_team, away_team, home_score, away_score, completed, round_num');

  // מפה: norm(home)|norm(away) → row
  const dbMap = new Map((dbRows ?? []).map(r => [`${norm(r.home_team)}|${norm(r.away_team)}`, r]));

  // שלוף מ-365scores
  const now   = new Date();
  const month = now.getMonth();
  const yr    = month >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const seasonStart = new Date(`${yr}-08-01`);

  let games365 = [];
  for (const { s, e } of monthChunks(seasonStart, now)) {
    const url = `https://webws.365scores.com/web/games/?appTypeId=5&langId=2` +
      `&timezoneName=Asia%2FJerusalem&userCountryId=6&competitions=42` +
      `&startDate=${fmt(s)}&endDate=${fmt(e)}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json', Referer: 'https://www.365scores.com/' },
    });
    if (!res.ok) { console.warn(`365scores: HTTP ${res.status}`); continue; }
    const data = await res.json();
    games365 = games365.concat(data.games ?? []);
    await new Promise(r => setTimeout(r, 300));
  }

  const finished = games365.filter(g => g.statusGroup === 4);
  console.log(`365scores: ${finished.length} משחקים שהסתיימו\n`);

  // בנק-דלתות לצבירה לפני כתיבה
  const bankDelta = {}; // playerId → delta

  let changesCount = 0;

  for (const g of finished) {
    const homeHe = g.homeCompetitor?.name;
    const awayHe = g.awayCompetitor?.name;
    const hs365  = g.homeCompetitor?.score;
    const as365  = g.awayCompetitor?.score;
    if (!homeHe || !awayHe || hs365 == null || as365 == null) continue;

    const homeEn = HE_TO_EN[homeHe] ?? homeHe;
    const awayEn = HE_TO_EN[awayHe] ?? awayHe;

    // חפש ב-DB — ישיר ואז הפוך
    let dbRow   = dbMap.get(`${norm(homeEn)}|${norm(awayEn)}`);
    let flipped = false;
    if (!dbRow) {
      dbRow   = dbMap.get(`${norm(awayEn)}|${norm(homeEn)}`);
      flipped = !!dbRow;
    }

    if (!dbRow) {
      console.log(`⚠️  לא נמצא בDB: ${homeHe} vs ${awayHe}`);
      continue;
    }

    // ניקוד נכון מנקודת מבט ה-DB
    const correctHome = flipped ? as365 : hs365;
    const correctAway = flipped ? hs365 : as365;

    // בדוק הימורים
    const { data: bets } = await supabase
      .from('bets').select('*')
      .eq('external_game_id', dbRow.id)
      .in('status', ['won', 'lost', 'pending']);

    const scoresOk = dbRow.home_score === correctHome && dbRow.away_score === correctAway && dbRow.completed;

    // חשב שינויים בהימורים
    const winner = correctHome > correctAway ? 'home' : correctAway > correctHome ? 'away' : 'draw';
    const betChanges = [];

    for (const bet of (bets ?? [])) {
      const won     = bet.pick === winner;
      const isExact = won && bet.exact_home === correctHome && bet.exact_away === correctAway;
      const newPayout = isExact ? exactPts : (won ? resultPts : 0);
      const oldPayout = bet.payout ?? 0;
      const newStatus = won ? 'won' : 'lost';

      const statusOk  = bet.status === newStatus;
      const payoutOk  = oldPayout === newPayout;
      const actualOk  = bet.actual_home === correctHome && bet.actual_away === correctAway;

      if (!statusOk || !payoutOk || !actualOk) {
        betChanges.push({ bet, newStatus, newPayout, oldPayout, delta: newPayout - oldPayout });
      }
    }

    if (scoresOk && betChanges.length === 0) continue;

    changesCount++;
    const flipNote = flipped ? ' (הפוך ב-365)' : '';
    console.log(`📋 מחזור ${dbRow.round_num} | ${dbRow.home_team} vs ${dbRow.away_team}${flipNote}`);

    if (!scoresOk) {
      console.log(`   תוצאה: ${dbRow.home_score ?? '?'}:${dbRow.away_score ?? '?'} → ${correctHome}:${correctAway}`);
    }

    for (const { bet, newStatus, newPayout, oldPayout, delta } of betChanges) {
      const name = nameMap[bet.player_id] ?? bet.player_id;
      const sign = delta >= 0 ? `+${delta}` : `${delta}`;
      console.log(`   ${name}: pick=${bet.pick} | ${bet.status}(${oldPayout}נק') → ${newStatus}(${newPayout}נק') [${sign}]`);
      bankDelta[bet.player_id] = (bankDelta[bet.player_id] ?? 0) + delta;
    }

    if (APPLY) {
      // עדכן league_schedule
      await supabase.from('league_schedule')
        .update({ home_score: correctHome, away_score: correctAway, completed: true })
        .eq('id', dbRow.id);

      // עדכן הימורים
      for (const { bet, newStatus, newPayout } of betChanges) {
        await supabase.from('bets')
          .update({ status: newStatus, payout: newPayout, actual_home: correctHome, actual_away: correctAway })
          .eq('id', bet.id);
      }
    }
  }

  // עדכן בנקים בבת אחת
  if (Object.keys(bankDelta).length > 0) {
    console.log('\n💰 שינויי ניקוד:');
    for (const [pid, delta] of Object.entries(bankDelta)) {
      const oldBank = bankMap[pid] ?? 0;
      const newBank = oldBank + delta;
      const sign = delta >= 0 ? `+${delta}` : `${delta}`;
      console.log(`   ${nameMap[pid]}: ${oldBank} → ${newBank} (${sign})`);
      if (APPLY) {
        await supabase.from('profiles').update({ bank: newBank }).eq('id', pid);
      }
    }
  }

  console.log('');
  if (changesCount === 0) {
    console.log('✅ הכל תקין — אין שינויים נדרשים.');
  } else if (APPLY) {
    console.log(`✅ תוקן: ${changesCount} משחקים.`);
  } else {
    console.log(`🔍 ${changesCount} משחקים לתיקון — הרץ עם --apply לביצוע.`);
  }
}

main().catch(e => { console.error(e); process.exit(1); });
