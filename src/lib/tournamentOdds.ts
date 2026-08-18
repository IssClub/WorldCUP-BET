/**
 * ליגת העל 2026/27 — יחסים לניחושי עונה
 * מקור: הערכות מצטברות מבתי הימורים לפני פתיחת העונה
 */

export interface OddsEntry  { name: string; price: number }
export interface ScorerEntry { name: string; team: string; price: number }

// ── 16 קבוצות הליגה (שמות בדיוק כמו ב-DB) ──────────────
export const LEAGUE_TEAMS: string[] = [
  'Maccabi Tel Aviv',
  'Maccabi Haifa',
  "Hapoel Be'er Sheva",
  'Beitar Jerusalem',
  'Hapoel Jerusalem',
  'Hapoel Tel-Aviv',
  'Hapoel Haifa',
  'Bnei Sakhnin',
  'Hapoel Ironi Kiryat Shmona',
  'Hapoel Petah Tikva',
  'Maccabi Netanya',
  'Maccabi Petah Tikva',
  'Bnei Yehuda',
  'Hapoel Ramat Gan',
  'Hapoel Hadera',
  'Ironi Tiberias',
];

// ── יחסים לאלוף הליגה ────────────────────────────────────
export const LEAGUE_WINNER_ODDS: OddsEntry[] = [
  { name: 'Maccabi Tel Aviv',           price: 2.00 },
  { name: 'Maccabi Haifa',              price: 3.50 },
  { name: "Hapoel Be'er Sheva",         price: 4.50 },
  { name: 'Beitar Jerusalem',           price: 6.00 },
  { name: 'Hapoel Jerusalem',           price: 9.00 },
  { name: 'Hapoel Tel-Aviv',            price: 12.00 },
  { name: 'Hapoel Haifa',               price: 17.00 },
  { name: 'Bnei Sakhnin',              price: 25.00 },
  { name: 'Hapoel Ironi Kiryat Shmona', price: 34.00 },
  { name: 'Hapoel Petah Tikva',         price: 34.00 },
  { name: 'Maccabi Netanya',            price: 41.00 },
  { name: 'Maccabi Petah Tikva',        price: 51.00 },
  { name: 'Bnei Yehuda',               price: 67.00 },
  { name: 'Hapoel Ramat Gan',           price: 81.00 },
  { name: 'Hapoel Hadera',              price: 81.00 },
  { name: 'Ironi Tiberias',            price: 101.00 },
];

// ── יחסים לירידה לליגה א׳ (כל קבוצה בנפרד) ──────────────
// סיכויים לסיים בשני המקומות האחרונים
export const RELEGATED_ODDS: OddsEntry[] = [
  { name: 'Ironi Tiberias',            price: 2.00 },
  { name: 'Hapoel Ramat Gan',           price: 2.50 },
  { name: 'Hapoel Hadera',              price: 3.00 },
  { name: 'Maccabi Petah Tikva',        price: 3.00 },
  { name: 'Bnei Yehuda',               price: 3.50 },
  { name: 'Maccabi Netanya',            price: 4.00 },
  { name: 'Hapoel Petah Tikva',         price: 5.00 },
  { name: 'Bnei Sakhnin',              price: 6.00 },
  { name: 'Hapoel Ironi Kiryat Shmona', price: 7.00 },
  { name: 'Hapoel Haifa',               price: 8.00 },
  { name: 'Hapoel Tel-Aviv',            price: 10.00 },
  { name: 'Hapoel Jerusalem',           price: 13.00 },
  { name: 'Beitar Jerusalem',           price: 17.00 },
  { name: "Hapoel Be'er Sheva",         price: 21.00 },
  { name: 'Maccabi Haifa',              price: 26.00 },
  { name: 'Maccabi Tel Aviv',           price: 34.00 },
];

// ── יחסים למלך השערים ────────────────────────────────────
// שחקנים בולטים ב-2026/27 (יעודכן עם תחילת העונה)
export const LEAGUE_SCORER_ODDS: ScorerEntry[] = [
  { name: 'אוסמה ח׳לאילה',   team: 'Maccabi Tel Aviv',   price: 3.50 },
  { name: 'אנדרסון לופס',    team: 'Maccabi Haifa',      price: 4.00 },
  { name: 'שי מוצ׳י',        team: "Hapoel Be'er Sheva", price: 4.50 },
  { name: 'עומר אצילי',      team: "Hapoel Be'er Sheva", price: 5.00 },
  { name: 'שגיב יחזקאל',     team: 'Beitar Jerusalem',   price: 5.50 },
  { name: 'דולב חזיזה',      team: 'Maccabi Haifa',      price: 6.00 },
  { name: 'שון וייסמן',      team: "Hapoel Be'er Sheva", price: 6.00 },
  { name: 'אהרון שונפלד',    team: 'Hapoel Jerusalem',   price: 7.00 },
  { name: 'מוחמד אבו פאני',  team: 'Maccabi Tel Aviv',   price: 8.00 },
  { name: 'ערן זהבי',        team: 'Hapoel Tel-Aviv',    price: 9.00 },
  { name: 'בן שרגאי',        team: 'Hapoel Haifa',       price: 11.00 },
  { name: 'סבוריט',          team: "Hapoel Be'er Sheva", price: 12.00 },
  { name: 'שחר פינגר',       team: 'Beitar Jerusalem',   price: 13.00 },
  { name: 'מוחמד ח׳לאילה',   team: 'Bnei Sakhnin',      price: 15.00 },
  { name: 'ניר ביטון',       team: 'Maccabi Haifa',      price: 17.00 },
];

// ── backward compat (לקוד ישן שמשתמש בשמות המונדיאל) ─────
export const WINNER_ODDS     = LEAGUE_WINNER_ODDS;
export const TOP_SCORER_ODDS = LEAGUE_SCORER_ODDS;
