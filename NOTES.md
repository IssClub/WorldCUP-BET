# World Cup Betting App — NOTES

## Stack
- React + Vite + TypeScript + Tailwind
- Supabase (Auth + DB + RLS + Realtime)
- GitHub Actions (auto-settle, pre-game, pre-round, scorers, backup)
- GitHub Pages: https://issclub.github.io/WorldCUP-BET/

## Supabase
- URL: https://thzcfbnvgsabvzzzsudh.supabase.co
- Admin email: issgpt@gmail.com

---

## פיצ'רים קיימים

### ניקוד
- ניחוש כיוון נכון: +3 נקודות
- ניחוש תוצאה מדויקת: +5 נקודות
- טעות / לא הימר: 0 (אין קנסות)

### הקוף 🐒
שחקן וירטואלי שמנחש רנדומלית בכל מחזור. מוגדר ב-profiles כ-"הקוף 🐒".

### Tagline — משפט המוביל
מנצח המחזור (המוביל הכללי אחרי סיום המחזור) מקבל פוש:
- Push: "סיימת את מחזור X במקום הראשון! זה הזמן לכתוב לכל הלוזרים מה אתה חושב 🏆"
- URL בפוש: `?set-tagline=1` → פותח `TaglineModal` ב-App.tsx
- המשפט נשמר ב-`profiles.tagline`
- מוצג בבאנר זהב מעל טבלת הדירוג (LeaderboardPage)
- **כפתור "כתוב/ערוך" מופיע למוביל גם בתוך האפליקציה** (במקרה שפספס את הפוש)
- `settle-games.mjs` → מאפס tagline לכולם → שולח push למוביל → מחזור חדש מתחיל נקי

### Push Notifications
- כל משחק: תוצאה + מה יצא לשחקן
- סוף יום: מיקום בטבלה
- סיכום מחזור + מלך מחזור
- Tagline push למוביל (ראה למעלה)

### ניחושים מיוחדים (special_bets)
- אלוף ליגה, יורדות, מלך שערים — נסגרו במחזור 1

### מלכי שערים
- נשלפים מ-365scores, מתעדכנים פעם ביום (GitHub Action)
- מוצגים בכרטיסיית "ליגה" (TournamentPage)

---

## Scripts
| קובץ | תפקיד |
|------|--------|
| `settle-games.mjs` | סגירת הימורים, עדכון ניקוד, push, tagline push |
| `pre-game.mjs` | הימור אוטומטי לפני kickoff (קוף + שחקנים שלא המרו) |
| `pre-round.mjs` | תזכורת לפני פתיחת מחזור |
| `seed-league-schedule.mjs` | שליפת לוח משחקים מ-TheSportsDB |
| `update-scorers.mjs` | עדכון מלכי שערים מ-365scores (לכל קבוצה בנפרד) |
| `recalculate.mjs` | חישוב מחדש של ניקוד |
| `backup.mjs` | גיבוי יומי |
| `monkey-backfill.mjs` | הכנסת הימורי קוף רטרואקטיביים |

## Workflows
| קובץ | תדירות |
|------|--------|
| `auto-settle.yml` | כל שעה (14:00–02:00 UTC) |
| `pre-game.yml` | לפני kickoff |
| `pre-round.yml` | לפני פתיחת מחזור |
| `update-scorers.yml` | פעם ביום |
| `daily-backup.yml` | פעם ביום |
| `deploy.yml` | על כל push ל-main |

---

## טבלאות מרכזיות
| טבלה | תוכן |
|------|------|
| `profiles` | שחקנים: bank, tagline, favorite_team, role |
| `league_schedule` | משחקים: round_num, kickoff_at, completed, תוצאות |
| `bets` | הימורים: status (pending/won/lost), payout |
| `special_bets` | ניחושי ליגה |
| `top_scorers` | מלכי שערים |
| `push_subscriptions` | מנויי push |
| `settings` | הגדרות: result_points(3), exact_score_points(5) |

---

## ארכיטקטורת Frontend
- `App.tsx` — ניהול tabs, modals (TaglineModal, FavoriteTeamModal), push handler
- `AppModalContext` — context לפתיחת modals מדפים פנימיים (`openTeamModal`, `openTaglineModal`)
- `PlayerPage` — הימורים למחזור הנוכחי
- `MyBetsPage` — היסטוריית ההימורים שלי
- `LeaderboardPage` — טבלת דירוג + tagline banner + היסטוריה per-player
- `TournamentPage` — מלכי שערים + ניחושים מיוחדים

## הערות חשובות
- `round_num` בDB: 1–26 ברצף (אין פערים). הקפיצה שנראתה בעבר (5→8) הייתה כי ה-RPC לא החזיר `external_game_id`, וה-fallback `roundFromKickoff` קיבץ שבועות ביחד
- `get_leaderboard_bets` RPC: **לא מחזיר `external_game_id`** — לכן LeaderboardPage משתמש ב-`teamRoundMap` (home_team|away_team → round_num) לקיבוץ הימורים לפי מחזור
- מחזורים מוצגים ישר לפי `round_num` (1=1, 10=10), ללא remapping
