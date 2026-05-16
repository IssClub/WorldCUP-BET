/**
 * pre-game.mjs — רץ כל 5 דקות דרך GitHub Actions
 *
 * חלון תזכורת (13–18 דקות לפני): שולח push לשחקנים שלא המרו
 * חלון הימור-אוטומטי (3–8 דקות לפני): ממר רנדומלי לשחקנים שלא המרו + קוף
 */
import { createClient } from '@supabase/supabase-js';
import webpush from 'web-push';

const SUPABASE_URL      = process.env.SUPABASE_URL;
const SUPABASE_KEY      = process.env.SUPABASE_SERVICE_KEY;
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:admin@worldcupbet.app', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

// שמות עברית
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
  const now = Date.now();

  // חלון תזכורת: 13–18 דקות לפני kickoff
  const reminderFrom = new Date(now + 13 * 60 * 1000).toISOString();
  const reminderTo   = new Date(now + 18 * 60 * 1000).toISOString();

  // חלון הימור-אוטומטי: 3–8 דקות לפני kickoff (סגירת הימורים ב-5 דקות)
  const autoFrom = new Date(now + 3 * 60 * 1000).toISOString();
  const autoTo   = new Date(now + 8 * 60 * 1000).toISOString();

  // הגדרות
  const { data: settings } = await supabase.from('settings').select('*').single();
  const autoAmount = settings?.auto_bet_amount ?? 50;

  // כל השחקנים הפעילים (bank > 0)
  const { data: allProfiles } = await supabase
    .from('profiles').select('id, display_name, bank');
  const activePlayers = (allProfiles ?? []).filter(p => p.bank > 0);

  // ── חלון תזכורת ────────────────────────────────────────────
  const { data: reminderGames } = await supabase
    .from('locked_odds')
    .select('*')
    .gt('kickoff_at', reminderFrom)
    .lt('kickoff_at', reminderTo);

  for (const game of (reminderGames ?? [])) {
    // בדוק אם כבר נשלחה תזכורת למשחק הזה
    const { data: alreadySent } = await supabase
      .from('game_reminders')
      .select('external_game_id')
      .eq('external_game_id', game.external_game_id)
      .maybeSingle();

    if (alreadySent) continue;

    // מי כבר המר על המשחק?
    const { data: existingBets } = await supabase
      .from('bets')
      .select('player_id')
      .eq('external_game_id', game.external_game_id)
      .neq('status', 'cancelled');

    const bettorIds = new Set((existingBets ?? []).map(b => b.player_id));

    // שלח תזכורת לשחקנים שלא המרו (לא כולל הקוף)
    const nonBettors = activePlayers.filter(
      p => !bettorIds.has(p.id) && p.display_name !== '🐒 קוף'
    );

    console.log(`Reminder: ${game.home_team} vs ${game.away_team} — ${nonBettors.length} non-bettors to notify`);

    for (const player of nonBettors) {
      await sendPush(player.id, {
        title: '⏰ 15 דקות למשחק!',
        body: `${he(game.home_team)} נגד ${he(game.away_team)} — מהר לפני שהסגירה!`,
        url: '/WorldCUP-BET/',
      });
    }

    // סמן שנשלחה תזכורת
    await supabase.from('game_reminders').insert({ external_game_id: game.external_game_id });
  }

  // ── חלון הימור-אוטומטי ──────────────────────────────────────
  const { data: autoGames } = await supabase
    .from('locked_odds')
    .select('*')
    .gt('kickoff_at', autoFrom)
    .lt('kickoff_at', autoTo);

  for (const game of (autoGames ?? [])) {
    // מי כבר המר?
    const { data: existingBets } = await supabase
      .from('bets')
      .select('player_id')
      .eq('external_game_id', game.external_game_id)
      .neq('status', 'cancelled');

    const bettorIds = new Set((existingBets ?? []).map(b => b.player_id));

    // שחקנים שצריכים הימור אוטומטי: לא המרו + יש להם מספיק נקודות
    const needsBet = activePlayers.filter(
      p => !bettorIds.has(p.id) && p.bank >= autoAmount
    );

    if (needsBet.length === 0) continue;

    console.log(`Auto-bet: ${game.home_team} vs ${game.away_team} — ${needsBet.length} players`);

    const picks = ['home', 'draw', 'away'];

    for (const player of needsBet) {
      const randomPick = picks[Math.floor(Math.random() * 3)];
      const oddsValue = randomPick === 'home' ? Number(game.home_win)
        : randomPick === 'draw' ? Number(game.draw_win)
        : Number(game.away_win);
      const isMonkey = player.display_name === '🐒 קוף';

      // הכנס הימור
      const { error: betErr } = await supabase.from('bets').insert({
        player_id: player.id,
        external_game_id: game.external_game_id,
        home_team: game.home_team,
        away_team: game.away_team,
        kickoff_at: game.kickoff_at,
        pick: randomPick,
        amount: autoAmount,
        odds_value: oddsValue,
        exact_home: null,
        exact_away: null,
        status: 'pending',
      });

      if (betErr) {
        console.error(`Error auto-betting for ${player.display_name}:`, betErr.message);
        continue;
      }

      // הורד מהבנק
      await supabase.from('profiles')
        .update({ bank: player.bank - autoAmount })
        .eq('id', player.id);

      const pickHe = randomPick === 'home' ? he(game.home_team)
        : randomPick === 'away' ? he(game.away_team) : 'תיקו';

      console.log(
        `Auto-bet placed: ${player.display_name} → ${randomPick} (${pickHe}) ` +
        `on ${game.home_team} vs ${game.away_team} (${autoAmount} pts @ ${oddsValue})`
      );

      // שלח התראה לשחקן אנושי (לא לקוף)
      if (!isMonkey) {
        await sendPush(player.id, {
          title: '🤖 הימור אוטומטי!',
          body: `הימרנו ${autoAmount} נק׳ על ${pickHe} — ${he(game.home_team)} נגד ${he(game.away_team)}`,
          url: '/WorldCUP-BET/',
        });
      }
    }
  }

  console.log('Done.');
}

main().catch(e => { console.error(e); process.exit(1); });
