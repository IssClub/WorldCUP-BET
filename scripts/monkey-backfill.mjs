/**
 * monkey-backfill.mjs
 *
 * שותל הימורים רנדומליים לקוף על משחקים שכבר הסתיימו ועדיין אין לו הימור עליהם.
 * ברירת מחדל: מחזור 1 — ניתן לשנות ל-round_num אחר דרך ארגומנט.
 *
 * שימוש:
 *   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/monkey-backfill.mjs [round_num]
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
const roundNum = parseInt(process.argv[2] ?? '1', 10);

console.log(`\n🐒 Monkey backfill — round ${roundNum}\n`);

// ── 1. טען הגדרות ─────────────────────────────────────────
const { data: settings } = await supabase.from('settings').select('*').single();
const USE_BANK   = settings?.use_bank         ?? false;
const BET_AMOUNT = settings?.auto_bet_amount  ?? 10;
const RESULT_PTS = settings?.result_points    ?? 3;
const EXACT_PTS  = settings?.exact_score_points ?? 5;

// ── 2. מצא את הקוף ────────────────────────────────────────
const { data: monkeyProfile } = await supabase
  .from('profiles').select('*').eq('display_name', 'הקוף 🐒').single();

if (!monkeyProfile) {
  console.error('לא נמצא שחקן בשם "🐒 קוף" בפרופילים');
  process.exit(1);
}
console.log(`קוף נמצא: id=${monkeyProfile.id}  בנק=${monkeyProfile.bank}`);

// ── 3. טען משחקים שהסתיימו מהמחזור המבוקש ──────────────
const { data: games } = await supabase
  .from('league_schedule')
  .select('id, home_team, away_team, kickoff_at, home_score, away_score')
  .eq('round_num', roundNum)
  .eq('completed', true)
  .order('kickoff_at');

if (!games?.length) {
  console.log(`אין משחקים שהסתיימו במחזור ${roundNum}`);
  process.exit(0);
}
console.log(`נמצאו ${games.length} משחקים שהסתיימו במחזור ${roundNum}:`);
games.forEach(g => console.log(`  • ${g.home_team} ${g.home_score}:${g.away_score} ${g.away_team}`));

// ── 4. בדוק אילו משחקים כבר יש לקוף הימור עליהם ─────────
const gameIds = games.map(g => g.id);
const { data: existingBets } = await supabase
  .from('bets')
  .select('external_game_id')
  .eq('player_id', monkeyProfile.id)
  .in('external_game_id', gameIds);

const alreadyBet = new Set((existingBets ?? []).map(b => b.external_game_id));
const toProcess = games.filter(g => !alreadyBet.has(g.id));

if (toProcess.length === 0) {
  console.log('\nלקוף כבר יש הימורים על כל המשחקים האלה — לא נעשה כלום.');
  process.exit(0);
}
console.log(`\n${toProcess.length} משחקים ללא הימור — מוסיף...`);

// ── 5. פונקציות עזר ───────────────────────────────────────
function randomPick() {
  return ['home', 'draw', 'away'][Math.floor(Math.random() * 3)];
}

function randomExact(pick) {
  if (pick === 'draw') {
    const n = Math.floor(Math.random() * 4); // 0:0 עד 3:3
    return { home: n, away: n };
  }
  const winner = Math.floor(Math.random() * 4) + 1; // 1–4
  const loser  = Math.floor(Math.random() * winner); // 0 עד winner-1
  return pick === 'home'
    ? { home: winner, away: loser }
    : { home: loser,  away: winner };
}

// ── 6. הכנס הימורים ──────────────────────────────────────
let bankDelta = 0;

for (const game of toProcess) {
  const pick    = randomPick();
  const exact   = randomExact(pick);
  const h       = game.home_score;
  const a       = game.away_score;
  const actual  = h > a ? 'home' : a > h ? 'away' : 'draw';
  const won     = pick === actual;
  const isExact = won && exact.home === h && exact.away === a;
  const payout  = isExact ? EXACT_PTS : won ? RESULT_PTS : 0;
  const status  = won ? 'won' : 'lost';

  const { error } = await supabase.from('bets').insert({
    player_id:        monkeyProfile.id,
    external_game_id: game.id,
    home_team:        game.home_team,
    away_team:        game.away_team,
    kickoff_at:       game.kickoff_at,
    pick,
    amount:           BET_AMOUNT,
    odds_value:       1,
    exact_home:       exact.home,
    exact_away:       exact.away,
    actual_home:      h,
    actual_away:      a,
    status,
    payout,
  });

  if (error) {
    console.error(`  ❌ שגיאה ב-${game.home_team} vs ${game.away_team}:`, error.message);
    continue;
  }

  // חישוב שינוי בנק: ניכוי בהגשה + הוספה בזכייה
  if (USE_BANK) bankDelta -= BET_AMOUNT;
  if (payout > 0) bankDelta += payout;

  const pickHe = pick === 'home' ? game.home_team : pick === 'away' ? game.away_team : 'תיקו';
  console.log(
    `  ✅ ${game.home_team} ${h}:${a} ${game.away_team} — ` +
    `ניחוש: ${pickHe} (${exact.home}:${exact.away}) → ${status} · ${payout} נק׳`
  );
}

// ── 7. עדכן בנק הקוף ──────────────────────────────────────
if (bankDelta !== 0) {
  const newBank = (monkeyProfile.bank ?? 0) + bankDelta;
  await supabase.from('profiles').update({ bank: newBank }).eq('id', monkeyProfile.id);
  console.log(`\nבנק קוף עודכן: ${monkeyProfile.bank} → ${newBank} (${bankDelta >= 0 ? '+' : ''}${bankDelta})`);
} else {
  console.log('\nאין שינוי בבנק (use_bank=false או ללא זכיות)');
}

console.log('\n✅ סיום');
