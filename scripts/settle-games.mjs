﻿/**
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
const APISPORTS_KEY     = process.env.APISPORTS_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_KEY');
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

// Hebrew team names — ליגת העל + מדינות (למקרה מצב WC)
const HE = {
  // ── ליגת העל הישראלית ──
  'Maccabi Tel Aviv':              'מכבי ת"א',
  'Maccabi Haifa':                 'מכבי חיפה',
  'Beitar Jerusalem':              'בית"ר י-ם',
  'Hapoel Tel Aviv':               'הפועל ת"א',
  'Hapoel Tel-Aviv':               'הפועל ת"א',
  "Hapoel Be'er Sheva":            'הפועל ב"ש',
  'Hapoel Beer Sheva':             'הפועל ב"ש',
  'Hapoel Beer-Sheva':             'הפועל ב"ש',
  'Hapoel Jerusalem':              'הפועל י-ם',
  'Hapoel Haifa':                  'הפועל חיפה',
  'Hapoel Ironi Kiryat Shmona':   'עירוני ק"ש',
  'Ironi Kiryat Shmona':           'עירוני ק"ש',
  'Hapoel Ramat Gan':              'הפועל ר"ג',
  'Hapoel Ramat-Gan':              'הפועל ר"ג',
  'Hapoel Ramat Gan Givatayim':   'הפועל ר"ג גבעתיים',
  'Bnei Sakhnin':                  'בני סכנין',
  'Maccabi Petah Tikva':           'מכבי פ"ת',
  'Maccabi Petah-Tikva':           'מכבי פ"ת',
  'Maccabi Netanya':               'מכבי נתניה',
  'Hapoel Petah Tikva':            'הפועל פ"ת',
  'Ironi Tiberias':                'עירוני טבריה',
  'Bnei Yehuda':                   'בני יהודה',
  'FC Ashdod':                     'א.ס. אשדוד',
  'MS Ashdod':                     'א.ס. אשדוד',
  'Maccabi Bnei Raina':            'מכבי בני ריינה',
  'Bnei Raina':                    'בני ריינה',
  'Hapoel Nof Hagalil':            'הפועל נוף הגליל',
  'Ironi Nof Hagalil':             'עירוני נוף הגליל',
  'Hapoel Hadera':                 'הפועל חדרה',
  'Maccabi Umm al-Fahm':           'מכבי אום אל-פחם',
  'Ironi Tel Aviv':                'עירוני ת"א',
  // ── מדינות (WC) ──
  'Argentina':'ארגנטינה','Brazil':'ברזיל','France':'צרפת','Germany':'גרמניה',
  'Spain':'ספרד','England':'אנגליה','Portugal':'פורטוגל','Netherlands':'הולנד',
  'United States':'ארה״ב','USA':'ארה״ב','Mexico':'מקסיקו','Morocco':'מרוקו',
  'Japan':'יפן','Uruguay':'אורוגוואי','Colombia':'קולומביה','Croatia':'קרואטיה',
  'Italy':'איטליה','Belgium':'בלגיה','Denmark':'דנמרק','Switzerland':'שוויץ',
  'Poland':'פולין','Serbia':'סרביה','Turkey':'טורקיה','Senegal':'סנגל',
  'Ecuador':'אקוודור','Canada':'קנדה','Australia':'אוסטרליה',
  'Korea Republic':'ק. הדרומית','Iran':'איראן','Saudi Arabia':'סעודיה',
  'Ghana':'גאנה','Cameroon':'קמרון','Nigeria':'ניגריה',
};
const he = name => HE[name] ?? name;

// ביטויים רנדומליים לזכייה בודדת
const WIN_PHRASES = [
  '🔥 כן! ניחשת נכון', '✅ עוד אחת לקופה', '💪 הכדורגל הכיר אותך היום',
  '👊 בול כיוון!', '📈 נקודות בבנק', '🎯 ידעת מה אתה עושה',
];

// ביטויים רנדומליים להפסד בודד
const LOSS_PHRASES = [
  '😬 הפעם לא', '🙈 נסית, לא הצליח', '💨 אוויר', '🃏 כדורגל הוא אכזרי',
  '😮‍💨 גם המומחים טועים', '🌧️ יהיה בסדר', '🤷 ככה זה',
];

// ביטויים לתוצאה מדויקת (בול!)
const EXACT_PHRASES = [
  '🎯 BULLSEYE! ניחשת בדיוק!', '🔮 אתה לא בן אדם — אתה נביא',
  '💥 בול מדויק! איך עשית את זה?', '🤯 תוצאה מדויקת! הממשלה צריכה לדעת על זה',
  '🏹 פגעת בול!', '👁️ ראית את זה מראש?',
];

// ביטויים לסיכום מחזור אישי — מחזור מעולה (כל/כמעט כל הניחושים נכונים)
const ROUND_GREAT = [
  'אתה פשוט על גל אחר 🔥', 'כולם יסתכלו עליך בטבלה וישאלו מי זה 👑',
  'אתה לא מנחש — אתה יודע 🔮', 'עוד מחזור כזה ואנחנו בודקים אם יש לך קשרים 🕵️',
  'הטבלה הכירה אותך היום 📈', 'מחזור מושלם. גם השכן מקנא 😎',
];

// ביטויים לסיכום מחזור — מחזור סביר
const ROUND_GOOD = [
  'לא רע בכלל — ממשיך להיות מאיים 📊', 'חצי נביא, חצי אדם רגיל 🤷',
  'מחזור סביר. שומרים על הראש 👍', 'מכבד, ממשיך, לא מוותר 💪',
  'ציון מעבר — עם פוטנציאל 📝',
];

// ביטויים לסיכום מחזור — מחזור גרוע
const ROUND_BAD = [
  'המחזור הבא? בטח. כנראה. אולי 😅', 'הכדורגל לא אשם, הניחושים כן 🙈',
  'גם ליאונל טעה פעם... ב-2003... אולי 🫠', 'נמסת. אבל אנחנו אוהבים אותך בכל זאת ❤️',
  'הניסיון עם, ההצלחה — פחות 🃏', 'היה מחזור. זה בטוח ⚰️',
];

// ביטויים לסיכום מחזור — קטסטרופה (0 נכון)
const ROUND_TERRIBLE = [
  '0 מתוך הכל. הישג נדיר. ממש נדיר 🤡', 'סטטיסטית, מה שקרה לך לא אמור לקרות 📉',
  'גם מטבע היה מנחש יותר טוב 🎲', 'הכדורגל לא אשם. אף אחד לא אשם. חוץ מהניחושים 💀',
  '0/הכל — אתה בהחלט ייחודי 🥲',
];

// ביטויים למלך המחזור (נשלח לכולם)
const KING_PHRASES = [
  (n, p) => `${n} שלט עם ${p} נק׳. שאר האנשים: סתם היו שם 😏`,
  (n, p) => `${n} — ${p} נק׳. יש לו מידע פנים? הרשויות בודקות 🕵️`,
  (n, p) => `${n} (${p} נק׳) שוב? בשלב מסוים זה כבר מביך לאחרים 👑`,
  (n, p) => `${n} עם ${p} נק׳. הוא בודק תוצאות מהעתיד 🔮`,
  (n, p) => `${n} ניצח את כולם במחזור — ${p} נק׳. שאלות? אין שאלות 🏆`,
];

const randomPhrase = arr => arr[Math.floor(Math.random() * arr.length)];
const randomKingPhrase = (name, pts) => KING_PHRASES[Math.floor(Math.random() * KING_PHRASES.length)](name, pts);

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
      if ([401, 404, 410].includes(err.statusCode)) {
        await supabase.from('push_subscriptions')
          .delete().eq('player_id', playerId).filter('subscription', 'eq', subscription);
        console.warn(`  Removed invalid subscription for player ${playerId} (${err.statusCode})`);
      }
    }
  }
}

async function main() {
  const now = new Date();
  const nowIso = now.toISOString();

  // ── Step 0: בדוק אם אנחנו בחלון משחק פעיל לפי league_schedule ──
  // (חוסך קריאות Odds API בימים ללא משחקים)
  const { data: settingsCheck } = await supabase.from('settings').select('sport_keys').single();
  const sportKeysCheck = settingsCheck?.sport_keys ?? ['soccer_fifa_world_cup'];
  const isLeague = !sportKeysCheck.includes('soccer_fifa_world_cup');

  if (isLeague) {
    const windowStart = new Date(now.getTime() - 3 * 60 * 60 * 1000).toISOString(); // 3 שעות אחורה
    const windowEnd   = new Date(now.getTime() + 15 * 60 * 1000).toISOString();      // 15 דקות קדימה
    const { count: inWindow } = await supabase
      .from('league_schedule')
      .select('id', { count: 'exact', head: true })
      .eq('completed', false)
      .gte('kickoff_at', windowStart)
      .lte('kickoff_at', windowEnd);

    if (!inWindow || inWindow === 0) {
      // fallback: אם יש הימורים ממתינים על משחקים שהתחילו — עדיין צריך לסגור
      const { count: pendingOld } = await supabase
        .from('bets').select('id', { count: 'exact', head: true })
        .eq('status', 'pending').lte('kickoff_at', now.toISOString());
      if (!pendingOld || pendingOld === 0) {
        console.log('Not in active match window and no pending bets — skipping.');
        await processPushQueue();
        await maybeSendDailySummaryFromDB();
        return;
      }
      console.log(`Not in window but ${pendingOld} pending bet(s) on started games — continuing to settle.`);
    } else {
      console.log(`In match window: ${inWindow} active game(s) found.`);
    }
  }

  // ── Step 1: early exit if no pending bets on started games ──
  const { count } = await supabase
    .from('bets')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending')
    .lte('kickoff_at', nowIso);

  if (!count || count === 0) {
    console.log('No pending bets on started games — nothing to do.');
    await processPushQueue(); // שלח פושים שנשמרו מסגירה ידנית
    await maybeSendDailySummaryFromDB();
    return;
  }

  console.log(`Found ${count} pending bet(s) on started games. Fetching scores...`);

  // Step 2: fetch all players (nowIso already defined above)
  const { data: allProfiles } = await supabase
    .from('profiles').select('id, bank, display_name');
  const activePlayers = allProfiles ?? [];
  const bankMap = Object.fromEntries(activePlayers.map(p => [p.id, p.bank]));

  // Step 3: קרא settings
  const { data: settings } = await supabase.from('settings').select('sport_keys, use_bank, no_bet_penalty, result_points, exact_score_points').single();
  const sportKeys = settings?.sport_keys?.length ? settings.sport_keys : ['soccer_fifa_world_cup'];
  const useBank = settings?.use_bank ?? false;
  const resultPts = settings?.result_points ?? 3;
  const exactPts = settings?.exact_score_points ?? 5;

  // Step 4: fetch completed game scores
  const allGames = [];
  const isLeagueSport = !sportKeys.includes('soccer_fifa_world_cup');

  if (isLeagueSport) {
    // ── League mode: read scores from league_schedule ──
    // seed-league-schedule.mjs (TheSportsDB) already populates home_score/away_score/completed.
    // No external API needed here — just look for completed rows with pending bets.
    const { data: completedRows } = await supabase
      .from('league_schedule')
      .select('id, home_team, away_team, kickoff_at, home_score, away_score')
      .eq('completed', true)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);

    console.log(`League schedule: ${completedRows?.length ?? 0} completed games with scores`);

    for (const row of (completedRows ?? [])) {
      allGames.push({
        id:            row.id,
        _scheduleId:   row.id,
        home_team:     row.home_team,
        away_team:     row.away_team,
        commence_time: row.kickoff_at,
        completed:     true,
        scores: [
          { name: row.home_team, score: String(row.home_score) },
          { name: row.away_team, score: String(row.away_score) },
        ],
      });
    }

  } else {
    // ── WC mode: use Odds API ──
    if (!ODDS_API_KEY) {
      console.error('ODDS_API_KEY not set');
      return;
    }
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
  }

  const games = allGames;

  // Track today's net change per player (for daily summary)
  const todayChange = {};
  let settledAnyGame = false;
  const settledExternalIds = []; // for round summary

  for (const game of games) {
    if (!game.completed) continue;

    const homeScore = parseInt(game.scores?.find(s => s.name === game.home_team)?.score ?? '-1');
    const awayScore = parseInt(game.scores?.find(s => s.name === game.away_team)?.score ?? '-1');
    if (homeScore < 0 || awayScore < 0) continue;

    // בליגה: game._scheduleId = league_schedule.id (UUID) — כבר נפתר בשלב 4
    // בWC: game.id = Odds API ID = wc_schedule.id
    let betGameId = game._scheduleId ?? game.id;

    // Get pending bets for this game
    const { data: bets, error } = await supabase
      .from('bets').select('*')
      .eq('external_game_id', betGameId)
      .eq('status', 'pending');

    if (error) { console.error('Bets fetch error:', error.message); continue; }
    if (!bets?.length) continue;

    settledAnyGame = true;
    settledExternalIds.push(game.id);
    console.log(`Settling: ${game.home_team} ${homeScore}:${awayScore} ${game.away_team} (${bets.length} bets)`);

    // עדכן טבלת הלוח המתאימה למצב
    if (sportKeys.includes('soccer_fifa_world_cup')) {
      // WC mode — עדכן wc_schedule עם פילטר תאריך למניעת בעיית double-leg
      const gameDate = game.commence_time ? game.commence_time.slice(0, 10) : null;
      let wcQuery = supabase.from('wc_schedule')
        .update({ home_score: homeScore, away_score: awayScore, completed: true })
        .eq('home_team', wcName(game.home_team))
        .eq('away_team', wcName(game.away_team));
      if (gameDate) {
        wcQuery = wcQuery
          .gte('kickoff_at', gameDate + 'T00:00:00Z')
          .lte('kickoff_at', gameDate + 'T23:59:59Z');
      }
      const { error: wcErr } = await wcQuery;
      if (wcErr) console.log(`  wc_schedule note: ${wcErr.message}`);
      else console.log(`  wc_schedule updated ✓`);
    } else {
      // League mode — עדכן league_schedule לפי id (UUID)
      const { error: lsErr } = await supabase.from('league_schedule')
        .update({ home_score: homeScore, away_score: awayScore, completed: true, postponed: false })
        .eq('id', game._scheduleId);
      if (lsErr) console.log(`  league_schedule note: ${lsErr.message}`);
      else console.log(`  league_schedule updated ✓`);
    }

    const winner = homeScore > awayScore ? 'home' : awayScore > homeScore ? 'away' : 'draw';
    const playerPayouts = {}; // playerId -> payout

    // ── Settle bets ──
    for (const bet of bets) {
      const won = bet.pick === winner;
      const isExact = won && bet.exact_home !== null && bet.exact_home === homeScore && bet.exact_away === awayScore;
      const payout = isExact ? exactPts : (won ? resultPts : 0);
      await supabase.from('bets')
        .update({ status: won ? 'won' : 'lost', payout, actual_home: homeScore, actual_away: awayScore })
        .eq('id', bet.id);

      if (payout > 0) playerPayouts[bet.player_id] = (playerPayouts[bet.player_id] ?? 0) + payout;

      if (!todayChange[bet.player_id]) todayChange[bet.player_id] = 0;
      todayChange[bet.player_id] += payout;
    }

    // Update bank (pure accumulation — only add points for wins)
    for (const [playerId, payout] of Object.entries(playerPayouts)) {
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
    for (const bet of bets) {
      const payout = playerPayouts[bet.player_id] ?? 0;
      const rank = rankMap[bet.player_id];
      const rankText = rank ? ` · מקום ${rank}` : '';
      const isExact = bet.pick === winner
        && bet.exact_home !== null && bet.exact_home === homeScore
        && bet.exact_away !== null && bet.exact_away === awayScore;
      const body = isExact
        ? `${randomPhrase(EXACT_PHRASES)} +${payout} נק׳${rankText}`
        : payout > 0
          ? `${randomPhrase(WIN_PHRASES)} +${payout.toLocaleString()} נק׳${rankText}`
          : `${randomPhrase(LOSS_PHRASES)} 0 נק׳${rankText}`;
      await sendPush(bet.player_id, {
        title: `⚽ ${he(game.home_team)} ${homeScore}:${awayScore} ${he(game.away_team)}`,
        body,
        url: '/WorldCUP-BET/',
      });
    }
  }

  await applyMissingBetPenalties(games, activePlayers, bankMap, todayChange, settings, sportKeys);
  await maybeSendDailySummary(settledAnyGame, bankMap, activePlayers, todayChange);
  await maybeSendRoundSummary(settledExternalIds);
  await processPushQueue();
  console.log('Done.');
}

// ── Round summary — נשלח כשמחזור שלם מסתיים ────────────────
async function maybeSendRoundSummary(settledExternalIds) {
  if (!settledExternalIds.length) return;

  // מצא את מספרי המחזורים של המשחקים שנסגרו (settledExternalIds = league_schedule.id UUIDs)
  const { data: settledRows } = await supabase
    .from('league_schedule')
    .select('round_num')
    .in('id', settledExternalIds);

  const roundNums = [...new Set((settledRows ?? []).map(r => r.round_num).filter(Boolean))];
  if (!roundNums.length) return;

  const { data: allProfiles } = await supabase.from('profiles').select('id, display_name, bank');
  const profileMap = Object.fromEntries((allProfiles ?? []).map(p => [p.id, p]));

  for (const roundNum of roundNums) {
    // בדוק אם כל משחקי המחזור הסתיימו
    const { count: total } = await supabase
      .from('league_schedule')
      .select('id', { count: 'exact', head: true })
      .eq('round_num', roundNum);
    const { count: done } = await supabase
      .from('league_schedule')
      .select('id', { count: 'exact', head: true })
      .eq('round_num', roundNum)
      .eq('completed', true);
    if (total !== done) {
      console.log(`Round ${roundNum}: ${done}/${total} complete — skipping summary.`);
      continue;
    }

    console.log(`Round ${roundNum} fully complete — sending round summary.`);

    // מצא את ה-IDs של כל משחקי המחזור (league_schedule.id = UUIDs = bets.external_game_id בליגה)
    const { data: roundGames } = await supabase
      .from('league_schedule')
      .select('id')
      .eq('round_num', roundNum);
    const roundGameIds = (roundGames ?? []).map(g => g.id).filter(Boolean);

    // מצא את כל ההימורים של המחזור
    const { data: roundBets } = await supabase
      .from('bets')
      .select('player_id, status, payout, exact_home, exact_away, actual_home, actual_away')
      .in('external_game_id', roundGameIds)
      .in('status', ['won', 'lost']);

    // חישוב סטטיסטיקה לכל שחקן
    const playerStats = {};
    for (const bet of (roundBets ?? [])) {
      if (!playerStats[bet.player_id]) playerStats[bet.player_id] = { won: 0, lost: 0, pts: 0, exact: 0 };
      const s = playerStats[bet.player_id];
      if (bet.status === 'won') {
        s.won++;
        s.pts += bet.payout ?? 0;
        if (bet.exact_home !== null && bet.exact_home === bet.actual_home &&
            bet.exact_away !== null && bet.exact_away === bet.actual_away) s.exact++;
      } else {
        s.lost++;
      }
    }

    // מלך המחזור
    const sorted = Object.entries(playerStats).sort(([,a],[,b]) => b.pts - a.pts);
    const [kingId, kingStats] = sorted[0] ?? [];
    const kingName = profileMap[kingId]?.display_name ?? '???';

    // שלח סיכום אישי לכל שחקן
    for (const [playerId, s] of Object.entries(playerStats)) {
      const total = s.won + s.lost;
      const ratio = total > 0 ? s.won / total : 0;
      let phrase;
      if (s.won === 0) phrase = randomPhrase(ROUND_TERRIBLE);
      else if (ratio >= 0.8 && total >= 4) phrase = randomPhrase(ROUND_GREAT);
      else if (ratio >= 0.5) phrase = randomPhrase(ROUND_GOOD);
      else phrase = randomPhrase(ROUND_BAD);

      const exactStr = s.exact > 0 ? ` 🎯×${s.exact}` : '';
      await sendPush(playerId, {
        title: `📊 מחזור ${roundNum} — ${s.won}/${total} נכון · +${s.pts} נק׳`,
        body: `${phrase}${exactStr}`,
        url: '/WorldCUP-BET/',
      });
    }

    // שלח "מלך המחזור" לכולם
    if (kingId && (kingStats?.pts ?? 0) > 0) {
      const kingBody = randomKingPhrase(kingName, kingStats.pts);
      for (const profile of (allProfiles ?? [])) {
        if (profile.id === kingId) continue; // המלך כבר קיבל את ה-glory בסיכום האישי
        await sendPush(profile.id, {
          title: `👑 מלך מחזור ${roundNum}`,
          body: kingBody,
          url: '/WorldCUP-BET/',
        });
      }
      // למלך עצמו — הודעה מיוחדת
      await sendPush(kingId, {
        title: `👑 אתה מלך מחזור ${roundNum}!`,
        body: `${kingStats.pts} נק׳ — יותר מכולם. ${randomPhrase(ROUND_GREAT)}`,
        url: '/WorldCUP-BET/',
      });
    }

    // פוש מיוחד למוביל הטבלה הכוללת — כדי שיכתוב ציטוט
    const overallLeader = (allProfiles ?? []).sort((a, b) => (b.bank ?? 0) - (a.bank ?? 0))[0];
    if (overallLeader) {
      await sendPush(overallLeader.id, {
        title: 'כל הכבוד, אתה מוביל! 🏆',
        body: `סיימת את מחזור ${roundNum} במקום הראשון! זה הזמן לכתוב לכל הלוזרים מה אתה חושב 🏆`,
        url: '/WorldCUP-BET/?set-tagline=1',
      });
      console.log(`Tagline push sent to overall leader: ${overallLeader.display_name}`);
    }

    console.log(`Round ${roundNum} summary sent. King: ${kingName} (${kingStats?.pts} pts)`);
  }
}

// ── קנס גיבוי — שחקנים שלא המרו ────────────────────────────
async function applyMissingBetPenalties(games, activePlayers, bankMap, todayChange, settings, sportKeys) {
  if (!settings?.use_bank) return;
  const penalty = settings?.no_bet_penalty ?? 50;
  const completedGames = games.filter(g => g.completed);
  if (!completedGames.length) return;

  for (const game of completedGames) {
    // בליגה: game._scheduleId = league_schedule.id (UUID) — כבר נפתר בשלב 4
    const betGameId = game._scheduleId ?? game.id;

    // מי שהמר על המשחק הזה (כל סטטוס)
    const { data: betsForGame } = await supabase
      .from('bets')
      .select('player_id')
      .eq('external_game_id', betGameId);

    const bettorIds = new Set((betsForGame ?? []).map(b => b.player_id));

    // מי שלא המר
    const missing = activePlayers.filter(p => !bettorIds.has(p.id));
    if (!missing.length) continue;

    // מי שכבר קיבל קנס על המשחק הזה (idempotency)
    const { data: existingPenalties } = await supabase
      .from('penalties')
      .select('player_id')
      .eq('external_game_id', betGameId);

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
        external_game_id: betGameId,
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

  const { data: settings } = await supabase.from('settings').select('use_bank').single();
  const useBank = settings?.use_bank ?? false;

  const { data: allProfiles } = await supabase
    .from('profiles').select('id, bank, display_name');
  const activePlayers = useBank ? (allProfiles ?? []).filter(p => p.bank > 0) : (allProfiles ?? []);
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
      ? (useBank ? (bet.payout - bet.amount) : bet.payout)
      : 0; // הפסד = 0 שינוי נטו (ההמרה הוחזרה)
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
