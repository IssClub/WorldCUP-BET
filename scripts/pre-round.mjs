/**
 * Pre-round notification script — runs every hour via GitHub Actions.
 * If a round starts in the next 60-90 minutes, sends each player
 * a personalized reminder showing how many games they haven't bet on yet.
 */
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY;
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) { console.error('Missing env vars'); process.exit(1); }

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:admin@worldcupbet.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

const REMINDER_PHRASES = [
  '⏰ אל תשכח להמר לפני שמאוחר מדי!',
  '🏃 רוץ תהמר! הדלת עומדת להיסגר',
  '⚡ שעה אחרונה — עכשיו או לעולם לא',
  '🎯 אל תתן למחזור לעבור בלעדיך',
  '🔔 הימורים נסגרים בקרוב — אתה בפנים?',
  '⚠️ פחות משעה! אל תפספס',
];
const rand = arr => arr[Math.floor(Math.random() * arr.length)];

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
  const now = new Date();
  const windowStart = new Date(now.getTime() + 55 * 60 * 1000).toISOString();  // בעוד 55 דקות
  const windowEnd   = new Date(now.getTime() + 90 * 60 * 1000).toISOString();  // בעוד 90 דקות

  // מצא משחקים שמתחילים בחלון הזה ועדיין לא הסתיימו
  const { data: upcomingGames } = await supabase
    .from('league_schedule')
    .select('id, external_id, home_team, away_team, kickoff_at, round_num')
    .eq('completed', false)
    .gte('kickoff_at', windowStart)
    .lte('kickoff_at', windowEnd)
    .order('kickoff_at');

  if (!upcomingGames?.length) {
    console.log('No games starting in the next 55-90 min — nothing to do.');
    return;
  }

  // מצא את המחזור שמתחיל
  const roundNums = [...new Set(upcomingGames.map(g => g.round_num).filter(Boolean))];
  const firstGame = upcomingGames[0];
  const kickoffTime = new Date(firstGame.kickoff_at).toLocaleTimeString('he-IL', {
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem'
  });

  console.log(`Round(s) ${roundNums.join(',')} starting around ${kickoffTime} — sending reminders.`);

  // מצא את כל המשחקים של המחזורים האלה (לא רק אלה שמתחילים עכשיו)
  const { data: allRoundGames } = await supabase
    .from('league_schedule')
    .select('id, external_id, home_team, away_team')
    .in('round_num', roundNums)
    .eq('completed', false);

  const allExternalIds = (allRoundGames ?? []).map(g => g.external_id).filter(Boolean);

  // מצא את כל השחקנים
  const { data: players } = await supabase.from('profiles').select('id, display_name');

  for (const player of (players ?? [])) {
    // כמה משחקים עדיין לא הימר עליהם?
    const { data: existingBets } = await supabase
      .from('bets')
      .select('external_game_id')
      .eq('player_id', player.id)
      .in('external_game_id', allExternalIds);

    const bettedIds = new Set((existingBets ?? []).map(b => b.external_game_id));
    const missing = allExternalIds.filter(id => !bettedIds.has(id)).length;

    if (missing === 0) {
      console.log(`${player.display_name}: all bets placed — skipping.`);
      continue;
    }

    const roundStr = roundNums.length === 1 ? `מחזור ${roundNums[0]}` : 'המחזור';
    const missStr = missing === 1 ? 'משחק אחד' : `${missing} משחקים`;

    await sendPush(player.id, {
      title: `⏰ ${roundStr} מתחיל ב-${kickoffTime}`,
      body: `עוד לא הימרת על ${missStr}! ${rand(REMINDER_PHRASES)}`,
      url: '/WorldCUP-BET/',
    });

    console.log(`Reminder sent to ${player.display_name} (${missing} unbetted games).`);
  }

  console.log('Pre-round reminders done.');
}

main().catch(err => { console.error(err); process.exit(1); });
