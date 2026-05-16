# מונדיאל הימורים — סטטוס פרויקט
**עודכן:** 3 מאי 2026  
**URL:** https://issclub.github.io/WorldCUP-BET/  
**Stack:** React + TypeScript + Vite → GitHub Pages | Supabase (Auth + DB) | Web Push (VAPID)

---

## מה נבנה עד היום ✅

### תשתית
| מה | איפה |
|---|---|
| Auth: הרשמה + כניסה + קוד הזמנה | `LoginPage.tsx`, `lib/auth.ts` |
| הרשמה דורשת קוד הזמנה (כולל אדמין: issgpt@gmail.com) | `LoginPage.tsx` |
| RLS ב-Supabase לטבלאות: bets, special_bets, profiles | `supabase_bets.sql`, `supabase_special_bets_rls.sql` |
| Deploy אוטומטי ל-GitHub Pages בכל push | `.github/workflows/deploy.yml` |

### מסכים (Tabs)
| Tab | מה יש |
|---|---|
| **הימורים** (PlayerPage) | רשימת משחקי היום מה-Odds API, בחירת קבוצה + סכום + ניחוש תוצאה מדויקת |
| **הימורים** | כרטיסיית "ניחושי טורניר" — ניחוש זוכה + מלך שערים (נעלת ב-11/6) |
| **טורניר** (TournamentPage) | לוח זמנים, ניקוד בתים, תוצאות — הכל מה-Odds API |
| **טבלה** (LeaderboardPage) | דירוג + נק' + רווח/הפסד + רצף + זכייה הכי גדולה |
| **שלי** (MyBetsPage) | כל ההימורים שלי + ניחושי טורניר + סטטיסטיקות |
| **ניהול** (AdminPage — אדמין בלבד) | הזמנות / שחקנים / הגדרות / נתונים / שערים / תוצאות |

### אוטומציה (GitHub Actions)
| Workflow | מה עושה | מתי רץ |
|---|---|---|
| `deploy.yml` | בונה ומעלה ל-GitHub Pages | כל push ל-main |
| `auto-settle.yml` | סוגר הימורים + קנס אי-הימור + push יומי | כל 30 דקות |
| `test-push.yml` | שולח push לכל המנויים (בדיקה) | ידנית בלבד |

### Push Notifications
- VAPID keys מוגדרים ב-Supabase Secrets
- Modal (לא banner) — מופיע 800ms אחרי כניסה
- טבלת `push_subscriptions` ב-Supabase
- הודעות: תוצאת משחק / קנס אי-הימור / סיכום יום / בדיקה ידנית

### כללי משחק שמומשו
- בנק פתיחה קבוע לכל שחקן (מוגדר בהגדרות)
- מינימום / מקסימום הימור (מוגדר בהגדרות)
- קנס אי-הימור (מוגדר בהגדרות)
- שחקן עם בנק 0 — מסך "eliminated" (לא יכול להמר)
- ניחוש תוצאה מדויקת = בונוס ×1.5 על הזכייה

---

## מה עדיין חסר 🔴🟡🟢

### 🔴 קריטי (לפני 11/6)

| # | מה חסר | למה קריטי |
|---|---|---|
| 1 | **סגירת ניחושי טורניר** — אין ממשק לאדמין לסמן מי זכה הטורניר / מי מלך שערים, ולחלק נקודות | בלי זה הניחושי טורניר הם רק תצוגה, אין להם ערך |
| 2 | **משחקי מונדיאל ב-API** — לוודא שה-Odds API מחזיר משחקים (אחרת שחקנים לא יכולים להמר) | זו הליבה של האפליקציה |
| 3 | **הסרת debug** — קופסת האבחון הכחולה ב"שלי" — כרגע מוסתרת (אין שגיאה), אבל הקוד עדיין שם | נראה לא מקצועי אם תופיע |

### 🟡 חשוב (לפני תחילת הטורניר)

| # | מה חסר | הסבר |
|---|---|---|
| 4 | **בנק חדש בסוף שלב הבתים** — לפי הכללים שחקנים מקבלים הזדמנות שנייה אחרי שלב הבתים | כרגע אין מנגנון אוטומטי לזה |
| 5 | **ניהול שחקנים מורחב** — האדמין לא יכול לערוך יתרת בנק ידנית | שימושי לתיקון שגיאות |
| 6 | **שחזור סיסמה** — אין "שכחתי סיסמה" | שחקן שישכח סיסמה — תקוע |

### 🟢 נחמד לקיים (בהמשך)

| # | מה חסר | הסבר |
|---|---|---|
| 7 | עדכון בזמן אמת (Supabase realtime) — כרגע רק בריענון | נוחות |
| 8 | היסטוריית בנק לשחקן | מעניין אבל לא חיוני |
| 9 | לוח משחקים מלא גם כשה-API ריק | fallback מהDB אם API לא מחזיר |

---

## מבנה טכני מלא

### Supabase — טבלאות
| טבלה | שימוש |
|---|---|
| `profiles` | שחקנים (id=auth.uid, display_name, role, bank) |
| `bets` | הימורים על משחקים (external_game_id מה-Odds API) |
| `special_bets` | ניחוש זוכה + מלך שערים (player_id, type, prediction, status) |
| `invites` | קודי הזמנה |
| `settings` | הגדרות מערכת (starting_bank, min_bet, max_bet, no_bet_penalty) |
| `push_subscriptions` | מנויי push (player_id, subscription) |
| `top_scorers` | רשימת מלכי שערים (ניהול ידני ע"י אדמין) |
| `games` | קיים בסכמה אבל **לא בשימוש כרגע** |
| `odds` | קיים בסכמה אבל **לא בשימוש כרגע** |

### קבצים מרכזיים
| קובץ | תפקיד |
|---|---|
| `src/lib/supabase.ts` | חיבור Supabase + כל ה-Types |
| `src/lib/auth.ts` | signIn / signUp / getProfile |
| `src/lib/teamNames.ts` | שמות קבוצות בעברית |
| `src/lib/flagMap.ts` | URLs לדגלים |
| `src/lib/tournamentOdds.ts` | יחסי הימור קשיחים לכל 48 קבוצות + 30 שחקנים |
| `scripts/settle-games.mjs` | סגירת הימורים + קנסות + push (GitHub Actions) |
| `scripts/test-push.mjs` | שליחת push בדיקה ידנית |

### External API
- **The Odds API** (`api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/`)
  - `/odds/` → משחקים + יחסים (PlayerPage)
  - `/scores/` → תוצאות (TournamentPage)
  - `/outrights/` → זוכה + מלך שערים (PlayerPage — fallback לנתונים קשיחים)

---

## דברים לזכור
- **Admin email:** issgpt@gmail.com (מוגדר ב-`lib/auth.ts`)
- **Tournament start:** 11 יוני 2026 — special bets נעלות בתאריך זה
- **Timezone:** Asia/Jerusalem בכל מקום
- **CSS variables:** `--green`, `--gold`, `--text`, `--text-muted`, `--surface`, `--border`
- **ניחושי טורניר:** אין שדה `amount` ב-special_bets — נקודות פיצוי צריך להחליט (טרם הוחלט)
