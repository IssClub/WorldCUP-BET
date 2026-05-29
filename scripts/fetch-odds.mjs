/**
 * fetch-odds.mjs — רץ כל שעה דרך GitHub Actions
 *
 * שולף יחסים מ-The Odds API עבור משחקים ב-48 השעות הקרובות
 * ושומר אותם ב-locked_odds בסופאבייס.
 * ברגע ששמר יחס — לא מעדכן אותו שוב.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ODDS_API_KEY = process.env.ODDS_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !ODDS_API_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// סדר עדיפות לבתי הימורים
const BOOKMAKERS = ['bet365', 'pinnacle', 'unibet_eu', 'betfair_ex_eu', 'marathonbet', 'coolbet'];

function extractOdds(game) {
  // נסה לפי סדר עדיפות
  for (const bm of BOOKMAKERS) {
    const book = game.bookmakers?.find(b => b.key === bm);
    if (!book) continue;
    const market = book.markets?.find(m => m.key === 'h2h');
    if (!market?.outcomes?.length) continue;
    const home = market.outcomes.find(o => o.name === game.home_team)?.price;
    const away = market.outcomes.find(o => o.name === game.away_team)?.price;
    const draw = market.outcomes.find(o => o.name === 'Draw')?.price;
    if (home && away && draw) {
      return { home_win: home, draw_win: draw, away_win: away, source: bm };
    }
  }

  // fallback — ממוצע כל בתי ההימורים
  const prices = { home: [], draw: [], away: [] };
  for (const book of (game.bookmakers ?? [])) {
    const market = book.markets?.find(m => m.key === 'h2h');
    if (!market?.outcomes?.length) continue;
    const home = market.outcomes.find(o => o.name === game.home_team)?.price;
    const away = market.outcomes.find(o => o.name === game.away_team)?.price;
    const draw = market.outcomes.find(o => o.name === 'Draw')?.price;
    if (home) prices.home.push(home);
    if (away) prices.away.push(away);
    if (draw) prices.draw.push(draw);
  }
  if (prices.home.length === 0) return null;

  const avg = arr => parseFloat((arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2));
  return {
    home_win: avg(prices.home),
    draw_win: avg(prices.draw),
    away_win: avg(prices.away),
    source: 'average',
  };
}

async function main() {
  const now = Date.now();

  // קרא sport keys פעילים מה-settings
  const { data: settings } = await supabase.from('settings').select('sport_keys').single();
  const sportKeys = settings?.sport_keys?.length ? settings.sport_keys : ['soccer_fifa_world_cup'];

  console.log(`Active sport keys: ${sportKeys.join(', ')}`);

  const commenceTimeTo = new Date(now + 48 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const cutoff = now + 48 * 60 * 60 * 1000;

  let totalInserted = 0;

  for (const sportKey of sportKeys) {
    console.log(`\nFetching odds for ${sportKey}...`);
    console.log(`Window: now → ${commenceTimeTo}`);

    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/odds/?apiKey=${ODDS_API_KEY}&regions=eu&markets=h2h&oddsFormat=decimal&commenceTimeTo=${commenceTimeTo}`
    );

    if (!res.ok) {
      console.error(`API error for ${sportKey}:`, res.status, await res.text());
      continue;
    }

    const games = await res.json();
    if (!Array.isArray(games)) {
      console.error(`Unexpected API response for ${sportKey}:`, JSON.stringify(games).slice(0, 200));
      continue;
    }

    console.log(`Got ${games.length} games from API`);

    const upcoming = games.filter(g => {
      const t = new Date(g.commence_time).getTime();
      return t > now && t < cutoff;
    });

    console.log(`${upcoming.length} games in next 48h`);
    if (upcoming.length === 0) continue;

    const ids = upcoming.map(g => g.id);
    const { data: existing } = await supabase
      .from('locked_odds')
      .select('external_game_id')
      .in('external_game_id', ids);

    const lockedIds = new Set((existing ?? []).map(r => r.external_game_id));
    const toInsert = upcoming.filter(g => !lockedIds.has(g.id));

    console.log(`${lockedIds.size} already locked, ${toInsert.length} new to lock`);

    for (const game of toInsert) {
      const odds = extractOdds(game);
      if (!odds) {
        console.log(`No odds found for ${game.home_team} vs ${game.away_team} — skipping`);
        continue;
      }

      const { error } = await supabase.from('locked_odds').insert({
        external_game_id: game.id,
        home_team: game.home_team,
        away_team: game.away_team,
        kickoff_at: game.commence_time,
        home_win: odds.home_win,
        draw_win: odds.draw_win,
        away_win: odds.away_win,
      });

      if (error) {
        if (error.code === '23505') {
          console.log(`Already locked (race): ${game.home_team} vs ${game.away_team}`);
        } else {
          console.error(`Error inserting ${game.home_team} vs ${game.away_team}:`, error.message);
        }
      } else {
        console.log(
          `Locked: ${game.home_team} vs ${game.away_team} ` +
          `(${odds.source}) H:${odds.home_win} D:${odds.draw_win} A:${odds.away_win}`
        );
        totalInserted++;
      }
    }
  }

  console.log(`\nDone. Locked ${totalInserted} new game(s) total.`);
}

main().catch(e => { console.error(e); process.exit(1); });
