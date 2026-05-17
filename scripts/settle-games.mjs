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
    await maybeSendDailySummary(false);
    return;
  }

  console.log(`Found ${count} pending bet(s) on started games. Fetching scores...`);

  // Step 2: fetch all active players (bank > 0, they're still in the game)
  const { data: allProfiles } = await supabase
    .from('profiles').select('id, bank, display_name');
  const activePlayers = (allProfiles ?? []).filter(p => p.bank > 0);
  const bankMap = Object.fromEntries(activePlayers.map(p => [p.id, p.bank]));

  // Step 4: fetch scores from Odds API
  const res = await fetch(
    `https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/scores/?apiKey=${ODDS_API_KEY}&daysFrom=3`
  );
  const games = await res.json();

  if (!Array.isArray(games)) {
    console.error('Unexpected API response:', JSON.stringify(games).slice(0, 200));
    return;
  }

  console.log(`Got ${games.length} games, ${games.filter(g => g.completed).length} completed`);

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

    const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
    const playerData = {}; // playerId -> { payout, lostAmount }

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
        .update({ status: won ? 'won' : 'lost', payout: won ? payout : 0 })
        .eq('id', bet.id);

      if (!playerData[bet.player_id]) playerData[bet.player_id] = { payout: 0, lostAmount: 0 };
      if (won) playerData[bet.player_id].payout += payout;
      else playerData[bet.player_id].lostAmount += bet.amount;

      // Track today's change
      if (!todayChange[bet.player_id]) todayChange[bet.player_id] = 0;
      todayChange[bet.player_id] += won ? (payout - bet.amount) : -bet.amount;
    }

    // Update winner banks
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
    for (const [playerId, { payout, lostAmount }] of Object.entries(playerData)) {
      const rank = rankMap[playerId];
      const rankText = rank ? ` · מקום ${rank}` : '';
      const body = payout > 0
        ? `${randomPhrase(WIN_PHRASES)} זכית! ${payout.toLocaleString()} נק׳${rankText}`
        : `${randomPhrase(LOSS_PHRASES)} הפסדת ${lostAmount.toLocaleString()} נק׳${rankText}`;
      await sendPush(playerId, {
        title: `⚽ ${he(game.home_team)} ${homeScore}:${awayScore} ${he(game.away_team)}`,
        body,
        url: '/WorldCUP-BET/',
      });
    }
  }

  await maybeSendDailySummary(settledAnyGame, bankMap, activePlayers, todayChange);
  await processPushQueue();
  console.log('Done.');
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
async function processPushQueue() {
  const { data: pending } = await supabase
    .from('push_queue').select('*').eq('sent', false).order('created_at');
  if (!pending?.length) return;
  console.log(`Processing ${pending.length} queued push notification(s)...`);
  for (const item of pending) {
    await sendPush(item.player_id, { title: item.title, body: item.body, url: '/WorldCUP-BET/' });
    await supabase.from('push_queue')
      .update({ sent: true, sent_at: new Date().toISOString() }).eq('id', item.id);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
