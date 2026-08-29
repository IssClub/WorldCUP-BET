/**
 * game-window.mjs
 *
 * מחשב האם "עכשיו" נמצא בחלון זמן רלוונטי לגבי לוח המשחקים.
 * כותב outputs ל-$GITHUB_OUTPUT לשימוש ב-workflow steps.
 *
 * Outputs:
 *   IN_SETTLE_WINDOW  — true אם צריך לבדוק תוצאות
 *   IN_ODDS_WINDOW    — true אם צריך לנעול יחסים
 *   IN_PREGAME_WINDOW — true אם צריך לשלוח תזכורות והימור אוטומטי
 *   GAMES_TODAY       — מספר משחקים שנמצאו בחלון הבדיקה
 *
 * חלוני זמן:
 *   Odds:    first_kickoff - 3h  → first_kickoff (לפני שמשחקים מתחילים)
 *   Pregame: first_kickoff - 2h  → first_kickoff + 15min
 *   Settle:  first_kickoff + 90min → last_kickoff + 3h (תוצאות זמינות)
 */
import { createClient } from '@supabase/supabase-js';
import { appendFileSync } from 'fs';

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);

const now = new Date();

// חלון בדיקה: 4 שעות אחורה עד 5 שעות קדימה
// כולל משחקים שהתחילו ועוד לא הסתיימו + משחקים שעומדים להתחיל
const lookBack  = new Date(now.getTime() - 4 * 60 * 60 * 1000);
const lookAhead = new Date(now.getTime() + 5 * 60 * 60 * 1000);

const { data: games, error } = await supabase
  .from('league_schedule')
  .select('kickoff_at, completed')
  .gte('kickoff_at', lookBack.toISOString())
  .lte('kickoff_at', lookAhead.toISOString())
  .order('kickoff_at');

if (error) {
  console.error('DB error:', error.message);
  process.exit(1);
}

if (!games?.length) {
  // fallback: even outside the window, settle if there are pending bets on started games
  const { count: unsettled } = await supabase
    .from('bets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lte('kickoff_at', now.toISOString());

  if (unsettled && unsettled > 0) {
    console.log(`No games in window but ${unsettled} pending bet(s) on started games — forcing settle.`);
    setOutput('IN_SETTLE_WINDOW',  'true');
    setOutput('IN_ODDS_WINDOW',    'false');
    setOutput('IN_PREGAME_WINDOW', 'false');
    setOutput('GAMES_TODAY',       String(unsettled));
    process.exit(0);
  }

  console.log(`No games between ${lookBack.toISOString()} and ${lookAhead.toISOString()} — nothing to do.`);
  setOutput('IN_SETTLE_WINDOW',  'false');
  setOutput('IN_ODDS_WINDOW',    'false');
  setOutput('IN_PREGAME_WINDOW', 'false');
  setOutput('GAMES_TODAY',       '0');
  process.exit(0);
}

const kickoffTimes = games.map(g => new Date(g.kickoff_at).getTime());
const firstKickoff = Math.min(...kickoffTimes);
const lastKickoff  = Math.max(...kickoffTimes);
const nowMs        = now.getTime();

// ── הגדרת חלונות ──────────────────────────────────────────

// Settle: first_kickoff + 90min → last_kickoff + 8h (מרחב לעיכוב seed + כל משחק)
const settleStart = firstKickoff + 90  * 60 * 1000;
const settleEnd   = ceilToHour(lastKickoff + 8 * 60 * 60 * 1000);

// Odds: first_kickoff - 3h → first_kickoff + 15min
const oddsStart = firstKickoff - 3 * 60 * 60 * 1000;
const oddsEnd   = firstKickoff + 15 * 60 * 1000;

// Pre-game: first_kickoff - 2h → last_kickoff + 45min
// החלון מכסה את כל המשחקים ביום, כך ש-pre-game.mjs יכול להמר אוטומטית
// גם על משחקים שהתחילו אחרי החלון הראשון.
const pregameStart = firstKickoff - 2 * 60 * 60 * 1000;
const pregameEnd   = lastKickoff  + 45 * 60 * 1000;

const inSettleWindow = nowMs >= settleStart && nowMs <= settleEnd;
const inOddsWindow   = nowMs >= oddsStart   && nowMs <= oddsEnd;

// בדוק אם יש משחקים שהתחילו ב-12 שעות האחרונות ועדיין לא הסתיימו —
// במקרה כזה pre-game.mjs צריך לרוץ כדי לשים הימורים אוטומטיים.
const autoLookback = new Date(now.getTime() - 12 * 60 * 60 * 1000);
const { count: activeStarted } = await supabase
  .from('league_schedule')
  .select('id', { count: 'exact', head: true })
  .eq('completed', false)
  .eq('postponed', false)
  .gte('kickoff_at', autoLookback.toISOString())
  .lte('kickoff_at', now.toISOString());
const hasStartedGames = (activeStarted ?? 0) > 0;

const inPregameWindow = (nowMs >= pregameStart && nowMs <= pregameEnd) || hasStartedGames;

// ── דיווח ─────────────────────────────────────────────────
const fmt = ms => new Date(ms).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
console.log(`Games found: ${games.length}`);
console.log(`First kickoff : ${fmt(firstKickoff)}`);
console.log(`Last  kickoff : ${fmt(lastKickoff)}`);
console.log(`Settle window : ${fmt(settleStart)} → ${fmt(settleEnd)}   [${inSettleWindow ? '✅ IN' : '⏭ OUT'}]`);
console.log(`Odds window   : ${fmt(oddsStart)}  → ${fmt(oddsEnd)}   [${inOddsWindow ? '✅ IN' : '⏭ OUT'}]`);
console.log(`Pregame window: ${fmt(pregameStart)} → ${fmt(pregameEnd)}   [${inPregameWindow ? '✅ IN' : '⏭ OUT'}]`);
console.log(`Now           : ${fmt(nowMs)}`);

setOutput('IN_SETTLE_WINDOW',  String(inSettleWindow));
setOutput('IN_ODDS_WINDOW',    String(inOddsWindow));
setOutput('IN_PREGAME_WINDOW', String(inPregameWindow));
setOutput('GAMES_TODAY',       String(games.length));

// ── helpers ───────────────────────────────────────────────
function ceilToHour(ms) {
  const d = new Date(ms);
  if (d.getMinutes() === 0 && d.getSeconds() === 0) return ms;
  d.setMinutes(0, 0, 0);
  return d.getTime() + 60 * 60 * 1000; // עיגול לשעה הבאה
}

function setOutput(key, value) {
  console.log(`  >> ${key}=${value}`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${key}=${value}\n`);
  }
}
