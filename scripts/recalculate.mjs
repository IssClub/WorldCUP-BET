/**
 * Recalculate all scores from raw bet data + league_schedule results.
 * Use when scoring gets corrupted or settlement had a bug.
 *
 * Usage:
 *   node scripts/recalculate.mjs           — dry run (shows what would change)
 *   node scripts/recalculate.mjs --apply   — applies changes to DB
 *
 * From project root:
 *   cd "C:\Alon\Claude\Worldcup betting\extracted\worldcup-betting"
 *   node scripts/recalculate.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env.local
try {
  const lines = readFileSync(resolve(process.cwd(), '.env.local'), 'utf-8').split('\n');
  for (const line of lines) {
    const m = line.match(/^\s*([\w.]+)\s*=\s*(.*)?\s*$/);
    if (m) process.env[m[1]] = m[2]?.replace(/^["']|["']$/g, '') ?? '';
  }
} catch {}

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;
const DRY_RUN = !process.argv.includes('--apply');

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing SUPABASE_URL / SUPABASE_SERVICE_KEY'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

if (DRY_RUN) console.log('🔍 DRY RUN — לא נשמר כלום. הוסף --apply להחיל שינויים.\n');
else         console.log('⚠️  APPLY MODE — שינויים יישמרו ל-DB!\n');

async function main() {
  // קרא הגדרות
  const { data: settings } = await supabase.from('settings').select('result_points, exact_score_points').single();
  const resultPts = settings?.result_points ?? 3;
  const exactPts  = settings?.exact_score_points ?? 5;
  console.log(`הגדרות ניקוד: כיוון נכון = ${resultPts} נק׳ | תוצאה מדויקת = ${exactPts} נק׳\n`);

  // קרא את כל ההימורים שנסגרו
  const { data: bets } = await supabase
    .from('bets')
    .select('id, player_id, pick, exact_home, exact_away, actual_home, actual_away, status, payout')
    .in('status', ['won', 'lost']);

  if (!bets?.length) { console.log('אין הימורים סגורים.'); return; }
  console.log(`נמצאו ${bets.length} הימורים סגורים.\n`);

  // חשב מחדש לכל הימור
  let changed = 0;
  const playerPoints = {};

  for (const bet of bets) {
    const h = bet.actual_home, a = bet.actual_away;
    if (h === null || a === null) continue;

    const winner = h > a ? 'home' : h < a ? 'away' : 'draw';
    const won = bet.pick === winner;
    const isExact = won && bet.exact_home !== null && bet.exact_home === h
                        && bet.exact_away !== null && bet.exact_away === a;
    const newPayout = isExact ? exactPts : won ? resultPts : 0;
    const newStatus = won ? 'won' : 'lost';

    if (!playerPoints[bet.player_id]) playerPoints[bet.player_id] = 0;
    playerPoints[bet.player_id] += newPayout;

    if (newPayout !== bet.payout || newStatus !== bet.status) {
      changed++;
      console.log(`  הימור ${bet.id.slice(0,8)}: ${bet.status}/${bet.payout} → ${newStatus}/${newPayout} נק׳`);
      if (!DRY_RUN) {
        await supabase.from('bets')
          .update({ status: newStatus, payout: newPayout })
          .eq('id', bet.id);
      }
    }
  }

  console.log(`\nהימורים שישתנו: ${changed}`);

  // חשב בנק לכל שחקן
  const { data: profiles } = await supabase.from('profiles').select('id, display_name, bank');
  console.log('\n--- ניקוד מחושב לעומת ניקוד נוכחי ---');
  let bankChanged = 0;
  for (const p of (profiles ?? [])) {
    const calculated = playerPoints[p.id] ?? 0;
    const diff = calculated - p.bank;
    const marker = diff !== 0 ? ` ← שונה ב-${diff > 0 ? '+' : ''}${diff}` : '';
    console.log(`  ${p.display_name}: נוכחי ${p.bank} | מחושב ${calculated}${marker}`);
    if (diff !== 0) {
      bankChanged++;
      if (!DRY_RUN) {
        await supabase.from('profiles').update({ bank: calculated }).eq('id', p.id);
      }
    }
  }

  if (DRY_RUN) {
    console.log(`\n${bankChanged} שחקנים עם ניקוד שונה מהמחושב.`);
    console.log('להחיל שינויים: node scripts/recalculate.mjs --apply');
  } else {
    console.log(`\n✓ עודכנו ${changed} הימורים ו-${bankChanged} שחקנים.`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
