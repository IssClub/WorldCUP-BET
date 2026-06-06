/**
 * Auto-settlement script — runs via GitHub Actions cron every 10 min.
 * 1. Fetches completed game scores from The Odds API
 * 2. Settles pending bets, updates player banks
 * 3. Penalizes players who didn't bet on a completed game
 * 4. Sends Web Push notifications (result + penalty)
 * 5. At end of day: sends daily summary push to all players
 */
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY;
const ODDS_API_KEY      = process.env.ODDS_API_KEY;
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !ODDS_API_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:admin@worldcupbet.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// Team name normalization: API might return slightly different names than wc_schedule
const WC_ALIASES = {
  'Türkiye':                    'Turkey',
  "Côte d'Ivoire":              'Ivory Coast',
  'Czechia':                    'Czech Republic',
  'USA':                        'United States',
  'Korea Republic':             'South Korea',
  'Democratic Republic of Congo': 'DR Congo',
  'Congo DR':                   'DR Congo',
  'Curaçao':                    'Curacao',
  'Bosnia & Herzegovina':       'Bosnia and Herzegovina',
};
const wcName = name => WC_ALIASES[name] ?? name;

// Hebrew team names
const HE = {
  'Argentina':'ארגנטינה','Brazil':'ברזיל','France':'צרפת','Germany':'גרמניה',
  'Spain':'ספרד','England':'אנגליה','Portugal':'פורטוגל','Netherlands':'הולנד',
  'United States':'ארה״ב','Mexico':'מקסיקו','Morocco':'מרוקו','Japan':'יפן',
  'Uruguay':'אורוגוואי','Colombia':'קולומביה','Croatia':'קרואטיה','Italy':'איטליה',
  'Belgium':'בלגיה','Denmark':'דנמרק','Switzerland':'שוויץ','Poland':'פולין',
  'Serbia':'סרביה','Turkey':'טורקיה','Senegal':'סנגל','Ecuador':'אקוודור',
  'Canada':'קנדה','Australia':'אוסטרליה','Korea Republic':'קוריאה','Iran':'איראן',
  'Saudi Arabia':'סעודיה','Ghana':'גאנה','Cameroon':'קמרון','Nigeria':'ניגריה',
};
const he = name => HE[name] ?? name;

// ביטויים רנדומליים לזכייה
const WIN_PHRASES = [
  '🏆 אלוף!', '👑 מלך!', '🎯 תותח!', '🔥 מי יכול עליך?',
  '⚡ ה-WINNER של המונדיאל!', '💪 מכה כמו ברזיל!', '🌟 כוכב!',
  '🎉 אגדה חיה!', '🦁 אריה!', '🚀 על הגג!',
];

// ביטויים רנדומליים להפסד
const LOSS_PHRASES = [
  '😅 יהיה בסדר...', '🤦 אאוץ׳', '🙈 לא רואה כלום',
  '💀 רי פי', '🫠 נמס', '🃏 הפעם לא, חבר',
  '⚰️ קבורת ה-100 נקודות', '😬 כואב אבל בונה אופי',
  '🤡 הנביא של... לא', '🌧️ גשם על הפרדה',
];

const randomPhrase = arr => arr[Math.floor(Math.random() * arr.length)];

// Send push to a player (handles expired subscriptions)
async function sendPush(playerId, payload) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return;
  const { data: subs } = await supabase
    .from('push_subscriptions').select('subscription').eq('player_id', playerId);
  if (!subs?.length) return;
  for (const { subscription } of subs) {
    try {
      await webpush.sendNotification(subscription, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        await supabase.from('push_subscriptions')
          .delete().eq('player_id', playerId).filter('subscription', 'eq', subscription);
      }
    }
  }
}

async function main() {
  const now = new Date().toISOString();

  // Step 1: early exit if no pending bets on started games
  const { count } = await supabase
    .from('bets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lte('kickoff_at', now);

  if (!count || count === 0) {
    console.log('No pending bets on started games — nothing to do.');
    await processPushQueue(); // שלח פושים שנשמרו מסגירה ידנית
    await maybeSendDailySummaryFromDB();
    return;
  }

  console.log(`Found ${count} pending bet(s) on started games. Fetching scores...`);

  // Step 2: fetch all players
  const { data: allProfiles } = await supabase
    .from('profiles').select('id, bank, display_name');
  const activePlayers = allProfiles ?? [];
  const bankMap = Object.fromEntries(activePlayers.map(p => [p.id, p.bank]));

  // Step 3: קרא sport keys פעילים מה-settings
  const { data: settings } = await supabase.from('settings').select('sport_keys').single();
  const sportKeys = settings?.sport_keys?.length ? settings.sport_keys : ['soccer_fifa_world_cup'];

  // Step 4: fetch scores from Odds API — לכל sport key פעיל
  const allGames = [];
  for (const sportKey of sportKeys) {
    const res = await fetch(
      `https://api.the-odds-api.com/v4/sports/${sportKey}/scores/?apiKey=${ODDS_API_KEY}&daysFrom=3`
    );
    const games = await res.json();
    if (!Array.isArray(games)) {
      console.error(`Unexpected API response for ${sportKey}:`, JSON.stringify(games).slice(0, 200));
      continue;
    }
    console.log(`[${sportKey}] Got ${games.length} games, ${games.filter(g => g.completed).length} completed`);
    allGames.push(...games);
  }

  const games = allGames;

  // Track today's net change per player (for daily summary)
  const todayChange = {};
  let settledAnyGame = false;

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

    settledAnyGame = true;
    console.log(`Settling: ${game.home_team} ${homeScore}:${awayScore} ${game.away_team} (${bets.length} bets)`);

    // עדכן wc_schedule — כך לוח המשחקים יציג את הציון אוטומטית
    const { error: wcErr } = await supabase.from('wc_schedule')
      .update({ home_score: homeScore, away_score: awayScore, completed: true })
      .eq('home_team', wcName(game.home_team))
      .eq('away_team', wcName(game.away_team));
    if (wcErr) console.log(`  wc_schedule note: ${wcErr.message}`);
    else console.log(`  wc_schedule updated ✓`);

    const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
    const playerData = {}; // playerId -> { payout }

    // ── Settle bets ──
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
        .update({ status: won ? 'won' : 'lost', payout: won ? payout : 0, actual_home: homeScore, actual_away: awayScore })
        .eq('id', bet.id);

      if (!playerData[bet.player_id]) playerData[bet.player_id] = { payout: 0 };
      if (won) playerData[bet.player_id].payout += payout;

      // Track today's change (only wins count)
      if (!todayChange[bet.player_id]) todayChange[bet.player_id] = 0;
      if (won) todayChange[bet.player_id] += payout;
    }

    // Update score for winners only
    for (const [playerId, { payout }] of Object.entries(playerData)) {
      if (payout <= 0) continue;
      const current = bankMap[playerId] ?? 0;
      const newBank = current + payout;
      bankMap[playerId] = newBank;
      await supabase.from('profiles').update({ bank: newBank }).eq('id', playerId);
    }

    // ── Build updated leaderboard for rank display ──
    const updatedProfiles = activePlayers.map(p => ({
      id: p.id,
      bank: bankMap[p.id] ?? p.bank,
    })).sort((a, b) => b.bank - a.bank);
    const rankMap = Object.fromEntries(updatedProfiles.map((p, i) => [p.id, i + 1]));

    // ── Send bet result notifications ──
    for (const [playerId, { payout }] of Object.entries(playerData)) {
      const rank = rankMap[playerId];
      const rankText = rank ? ` · מקום ${rank}` : '';
      const body = payout > 0
        ? `${randomPhrase(WIN_PHRASES)} זכית! ${payout.toLocaleString()} נק׳${rankText}`
        : `${randomPhrase(LOSS_PHRASES)} הפסד — 0 נק׳${rankText}`;
      await sendPush(playerId, {
        title: `⚽ ${he(game.home_team)} ${homeScore}:${awayScore} ${he(game.away_team)}`,
        body,
        url: '/WorldCUP-BET/',
      });
    }
  }

  await applyMissingBetPenalties(games, activePlayers, bankMap, todayChange, settings);
  await maybeSendDailySummary(settledAnyGame, bankMap, activePlayers, todayChange);
  await processPushQueue();
  console.log('Done.');
}

// ── קנס גיבוי — שחקנים שלא המרו ולא קיבלו הימור אוטומטי ──
async function applyMissingBetPenalties(games, activePlayers, bankMap, todayChange, settings) {
  const penalty = settings?.penalty ?? 50;
  const completedGames = games.filter(g => g.completed);
  if (!completedGames.length) return;

  for (const game of completedGames) {
    // מי שהמר על המשחק הזה (כל סטטוס)
    const { data: betsForGame } = await supabase
      .from('bets')
      .select('player_id')
      .eq('external_game_id', game.id);

    const bettorIds = new Set((betsForGame ?? []).map(b => b.player_id));

    // מי שלא המר
    const missing = activePlayers.filter(p => !bettorIds.has(p.id));
    if (!missing.length) continue;

    // מי שכבר קיבל קנס על המשחק הזה (idempotency)
    const { data: existingPenalties } = await supabase
      .from('penalties')
      .select('player_id')
      .eq('external_game_id', game.id);

    const alreadyPenalized = new Set((existingPenalties ?? []).map(r => r.player_id));

    for (const player of missing) {
      if (alreadyPenalized.has(player.id)) continue;

      const currentBank = bankMap[player.id] ?? player.bank;
      if (currentBank <= 0) continue; // שחקן שכבר eliminated

      const newBank = Math.max(0, currentBank - penalty);
      bankMap[player.id] = newBank;

      // עדכן בנק
      await supabase.from('profiles').update({ bank: newBank }).eq('id', player.id);

      // רשום קנס
      await supabase.from('penalties').insert({
        player_id: player.id,
        external_game_id: game.id,
        amount: penalty,
      });

      // עדכן שינוי יומי
      if (!todayChange[player.id]) todayChange[player.id] = 0;
      todayChange[player.id] -= penalty;

      // שלח פוש
      await sendPush(player.id, {
        title: '⚠️ קנס אי-הימור',
        body: `לא הימרת על ${he(game.home_team)} נגד ${he(game.away_team)} — קנס של ${penalty} נק׳`,
        url: '/WorldCUP-BET/',
      });

      console.log(`Penalty applied: ${player.id} -${penalty} pts (missed ${game.home_team} vs ${game.away_team})`);
    }
  }
}

// ── Daily summary push ────────────────────────────────────
async function maybeSendDailySummary(justSettled, bankMap = {}, activePlayers = [], todayChange = {}) {
  if (!justSettled) return;

  // Check if any pending bets remain for today (Israel time)
  const israelDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const dayStart = israelDate + 'T00:00:00';
  const dayEnd   = israelDate + 'T23:59:59';

  const { count: pendingToday } = await supabase
    .from('bets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gte('kickoff_at', dayStart)
    .lte('kickoff_at', dayEnd);

  if (pendingToday && pendingToday > 0) {
    console.log(`${pendingToday} pending bets remain today — skipping daily summary.`);
    return;
  }

  console.log('All games for today settled — sending daily summary push...');

  // Final rankings
  const sorted = activePlayers
    .map(p => ({ id: p.id, bank: bankMap[p.id] ?? p.bank }))
    .sort((a, b) => b.bank - a.bank);
  const rankMap = Object.fromEntries(sorted.map((p, i) => [p.id, i + 1]));
  const total = sorted.length;

  for (const player of activePlayers) {
    const rank = rankMap[player.id];
    const bank = bankMap[player.id] ?? player.bank;
    const change = todayChange[player.id] ?? 0;
    const changeStr = change > 0
      ? `+${change.toLocaleString()} נק׳ היום`
      : change < 0
        ? `${change.toLocaleString()} נק׳ היום`
        : 'ללא שינוי היום';

    await sendPush(player.id, {
      title: `📊 סיכום יום · מקום ${rank} מתוך ${total}`,
      body: `${changeStr} | יתרה: ${bank.toLocaleString()} נק׳`,
      url: '/WorldCUP-BET/',
    });
  }
}

// ── Push queue (for manually settled games) ───────────────
// מחזיר כמה פושים נשלחו
async function processPushQueue() {
  const { data: pending } = await supabase
    .from('push_queue').select('*').eq('sent', false).order('created_at');
  if (!pending?.length) return 0;
  console.log(`Processing ${pending.length} queued push notification(s)...`);
  for (const item of pending) {
    await sendPush(item.player_id, { title: item.title, body: item.body, url: '/WorldCUP-BET/' });
    await supabase.from('push_queue')
      .update({ sent: true, sent_at: new Date().toISOString() }).eq('id', item.id);
  }
  return pending.length;
}

// ── Daily summary after manual settlement ─────────────────
// גרסה שקוראת את נתוני הבנק ישירות מה-DB (למקרה של סגירה ידנית)
async function maybeSendDailySummaryFromDB() {
  const israelDate = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jerusalem' });
  const dayStart = israelDate + 'T00:00:00';
  const dayEnd   = israelDate + 'T23:59:59';

  const { count: pendingToday } = await supabase
    .from('bets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .gte('kickoff_at', dayStart)
    .lte('kickoff_at', dayEnd);

  if (pendingToday && pendingToday > 0) {
    console.log(`${pendingToday} pending bets remain today — skipping daily summary.`);
    return;
  }

  // בדוק שיש בכלל משחקים היום (כדי לא לשלוח סיכום ביום ריק)
  const { count: gamesCount } = await supabase
    .from('bets')
    .select('id', { count: 'exact', head: true })
    .gte('kickoff_at', dayStart)
    .lte('kickoff_at', dayEnd);

  if (!gamesCount || gamesCount === 0) return;

  console.log('All games for today settled (manual) — sending daily summary push...');

  const { data: allProfiles } = await supabase
    .from('profiles').select('id, bank, display_name');
  const activePlayers = (allProfiles ?? []).filter(p => p.bank > 0);
  const sorted = [...activePlayers].sort((a, b) => b.bank - a.bank);
  const rankMap = Object.fromEntries(sorted.map((p, i) => [p.id, i + 1]));
  const total = sorted.length;

  // חישוב שינוי יומי מהימורים שנסגרו היום
  const { data: todayBets } = await supabase
    .from('bets')
    .select('player_id, amount, payout, status')
    .gte('kickoff_at', dayStart)
    .lte('kickoff_at', dayEnd)
    .in('status', ['won', 'lost']);

  const todayChange = {};
  for (const bet of (todayBets ?? [])) {
    if (!todayChange[bet.player_id]) todayChange[bet.player_id] = 0;
    todayChange[bet.player_id] += bet.status === 'won'
      ? (bet.payout - bet.amount)
      : -bet.amount;
  }

  for (const player of activePlayers) {
    const rank = rankMap[player.id];
    const change = todayChange[player.id] ?? 0;
    const changeStr = change > 0
      ? `+${change.toLocaleString()} נק׳ היום`
      : change < 0
        ? `${change.toLocaleString()} נק׳ היום`
        : 'ללא שינוי היום';

    await sendPush(player.id, {
      title: `📊 סיכום יום · מקום ${rank} מתוך ${total}`,
      body: `${changeStr} | יתרה: ${player.bank.toLocaleString()} נק׳`,
      url: '/WorldCUP-BET/',
    });
  }
}

main().catch(err => { console.error(err); process.exit(1); });
