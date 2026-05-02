/**
 * Auto-settlement script — runs via GitHub Actions cron every 10 min.
 * Fetches completed game scores from The Odds API, settles pending bets,
 * updates player banks, and sends Web Push notifications.
 */
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const SUPABASE_URL     = process.env.SUPABASE_URL;
const SUPABASE_KEY     = process.env.SUPABASE_SERVICE_KEY;
const ODDS_API_KEY     = process.env.ODDS_API_KEY;
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY= process.env.VAPID_PRIVATE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !ODDS_API_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:admin@worldcupbet.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Hebrew team names (subset for notification display)
const HE = {
  'Argentina':'ארגנטינה','Brazil':'ברזיל','France':'צרפת','Germany':'גרמניה',
  'Spain':'ספרד','England':'אנגליה','Portugal':'פורטוגל','Netherlands':'הולנד',
  'United States':'ארה״ב','Mexico':'מקסיקו','Morocco':'מרוקו','Japan':'יפן',
  'Uruguay':'אורוגוואי','Colombia':'קולומביה','Croatia':'קרואטיה','Italy':'איטליה',
};
const he = name => HE[name] ?? name;

async function main() {
  // Step 1: check if there are any pending bets on games that have already kicked off.
  // If not — exit immediately without touching the Odds API.
  const now = new Date().toISOString();
  const { count } = await supabase
    .from('bets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lte('kickoff_at', now);

  if (!count || count === 0) {
    console.log('No pending bets on started games — nothing to do.');
    return;
  }

  console.log(`Found ${count} pending bet(s) on started games. Fetching scores...`);

  const res = await fetch(
    `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/scores/?apiKey=${ODDS_API_KEY}&daysFrom=3`
  );
  const games = await res.json();

  if (!Array.isArray(games)) {
    console.error('Unexpected API response:', JSON.stringify(games).slice(0, 200));
    return;
  }

  console.log(`Got ${games.length} games, ${games.filter(g => g.completed).length} completed`);

  for (const game of games) {
    if (!game.completed) continue;

    const homeScore = parseInt(game.scores?.find(s => s.name === game.home_team)?.score ?? '-1');
    const awayScore = parseInt(game.scores?.find(s => s.name === game.away_team)?.score ?? '-1');
    if (homeScore < 0 || awayScore < 0) continue;

    // Get pending bets for this game
    const { data: bets, error } = await supabase
      .from('bets').select('*')
      .eq('external_game_id', game.id)
      .eq('status', 'pending');

    if (error) { console.error('Bets fetch error:', error.message); continue; }
    if (!bets?.length) continue;

    console.log(`Settling: ${game.home_team} ${homeScore}:${awayScore} ${game.away_team} (${bets.length} bets)`);

    const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';

    // Per-player results
    const playerData = {}; // playerId -> { payout, lost }

    for (const bet of bets) {
      const won = bet.pick === winner;
      let payout = 0;

      if (won) {
        payout = Math.floor(bet.amount * bet.odds_value);
        if (bet.exact_home !== null && bet.exact_home === homeScore && bet.exact_away === awayScore) {
          payout = Math.floor(payout * 1.5);
        }
      }

      await supabase.from('bets')
        .update({ status: won ? 'won' : 'lost', payout: won ? payout : 0 })
        .eq('id', bet.id);

      if (!playerData[bet.player_id]) playerData[bet.player_id] = { payout: 0, lost: 0 };
      if (won) playerData[bet.player_id].payout += payout;
      else playerData[bet.player_id].lost += bet.amount;
    }

    // Update player banks
    for (const [playerId, { payout }] of Object.entries(playerData)) {
      if (payout <= 0) continue;
      const { data: prof } = await supabase.from('profiles').select('bank').eq('id', playerId).single();
      if (prof) {
        await supabase.from('profiles').update({ bank: prof.bank + payout }).eq('id', playerId);
      }
    }

    // Get updated leaderboard rank
    const { data: profiles } = await supabase
      .from('profiles').select('id, bank').order('bank', { ascending: false });
    const rankMap = {};
    profiles?.forEach((p, i) => { rankMap[p.id] = i + 1; });

    // Send push notifications
    if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      for (const [playerId, { payout, lost }] of Object.entries(playerData)) {
        const { data: subs } = await supabase
          .from('push_subscriptions').select('subscription').eq('player_id', playerId);
        if (!subs?.length) continue;

        const rank = rankMap[playerId];
        const rankText = rank ? ` · מקום ${rank} בטבלה` : '';
        const body = payout > 0
          ? `✅ זכית! +${payout.toLocaleString()} נק׳${rankText}`
          : `❌ הפסדת ${lost.toLocaleString()} נק׳${rankText}`;

        const payload = JSON.stringify({
          title: `⚽ ${he(game.home_team)} ${homeScore}:${awayScore} ${he(game.away_team)}`,
          body,
          url: '/WorldCUP-BET/',
        });

        for (const { subscription } of subs) {
          try {
            await webpush.sendNotification(subscription, payload);
          } catch (err) {
            if (err.statusCode === 410 || err.statusCode === 404) {
              await supabase.from('push_subscriptions')
                .delete().eq('player_id', playerId).filter('subscription', 'eq', subscription);
            }
          }
        }
      }
    }
  }

  console.log('Done.');
}

main().catch(err => { console.error(err); process.exit(1); });
