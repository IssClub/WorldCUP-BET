/**
 * Daily backup script — exports critical tables to backups/YYYY-MM-DD.json
 * Run via GitHub Actions nightly, or manually.
 */
import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync } from 'fs';
import { resolve } from 'path';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing env vars'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function fetchAll(table, select = '*') {
  const { data, error } = await supabase.from(table).select(select).order('created_at');
  if (error) { console.error(`Error fetching ${table}:`, error.message); return []; }
  return data ?? [];
}

async function main() {
  const date = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  console.log(`Backing up data for ${date}...`);

  const [bets, profiles, specialBets, leagueSchedule] = await Promise.all([
    fetchAll('bets'),
    fetchAll('profiles'),
    fetchAll('special_bets'),
    fetchAll('league_schedule'),
  ]);

  const backup = {
    exported_at: new Date().toISOString(),
    date,
    summary: {
      bets: bets.length,
      profiles: profiles.length,
      special_bets: specialBets.length,
      league_schedule: leagueSchedule.length,
    },
    data: { bets, profiles, special_bets: specialBets, league_schedule: leagueSchedule },
  };

  const dir = resolve(process.cwd(), 'backups');
  mkdirSync(dir, { recursive: true });
  const file = resolve(dir, `${date}.json`);
  writeFileSync(file, JSON.stringify(backup, null, 2), 'utf-8');

  console.log(`✓ Backup saved: backups/${date}.json`);
  console.log(`  Bets: ${bets.length} | Players: ${profiles.length} | Special: ${specialBets.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
