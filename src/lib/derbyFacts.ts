import { teamHe } from './teamNames';

const key = (a: string, b: string) => [a, b].sort().join('|||');

interface DerbySlides {
  name: string;
  slides: [string, string, string];
}

const DERBIES: Record<string, DerbySlides> = {
  // ── הדרביים הגדולים ──────────────────────────────────────────────
  [key('Maccabi Tel Aviv', 'Hapoel Tel-Aviv')]: {
    name: '🔥 הקלאסיקו',
    slides: [
      'הדרבי הגדול ביותר בכדורגל הישראלי — משוחק מאז 1926',
      'ממוצע ~3 שערים למשחק · מכבי ניצחה 54 מ-~120 מפגשים',
      'כשמכבי מארחת בעשור האחרון — הפסידה פחות מ-25% מהזמן',
    ],
  },
  [key('Maccabi Haifa', 'Hapoel Haifa')]: {
    name: '🍋 דרבי חיפה',
    slides: [
      'דרבי הכרמל — הדרבי הצפוני הגדול ביותר בישראל',
      'מכבי חיפה שלטת — ~7 ניצחונות מתוך 10 מפגשים אחרונים',
      'הפועל חיפה חזרה לליגת העל לאחר שנות היעדרות',
    ],
  },
  [key('Beitar Jerusalem', 'Hapoel Jerusalem')]: {
    name: '🕌 דרבי ירושלים',
    slides: [
      'דרבי עיר הקודש — הפועל ירושלים חזרה לליגה ב-2022',
      'בית"ר ניצחה בשני המפגשים הראשונים בין הקבוצות בליגה',
      'המשחק מושך את הקהל הגדול ביותר בתחנת ונציה',
    ],
  },

  // ── מחזור פתיחה 2026/27 ─────────────────────────────────────────
  [key('Hapoel Ironi Kiryat Shmona', 'Maccabi Petah Tikva')]: {
    name: '⛰️ מחזור פתיחה',
    slides: [
      'עירוני ק"ש — הקבוצה מהצפון שמשנה כל כללי המשחק הישראלי',
      'מכבי פ"ת חזרה לליגת העל לאחר שנתיים בליגת הלאומי',
      'ב-2023/24, המחזור הראשון של ק"ש הסתיים 1:0 על מכבי ת"א',
    ],
  },
  [key('Hapoel Petah Tikva', 'Ironi Tiberias')]: {
    name: '🌊 צפון מול מרכז',
    slides: [
      'עירוני טבריה — חזרה לליגת העל לאחר 15 שנות היעדרות',
      'הפועל פ"ת חוגגת 100 שנה ב-2026 — עונת יובל',
      'עירוני טבריה ניצחה 3:1 במחזור הפתיחה של עונת 2008/09',
    ],
  },
  [key('Hapoel Haifa', "Hapoel Be'er Sheva")]: {
    name: '🏆 אלופה מול מסתערת',
    slides: [
      "הפועל ב\"ש — 6 אליפויות, אחת הקבוצות המצליחות בישראל בעשור האחרון",
      'הפועל חיפה חזרה לליגה לאחר שנים ורוצה להוכיח את עצמה',
      "ב-2019/20 הפועל ב\"ש ניצחה 4:0 במחזור הראשון — שיא הפרש",
    ],
  },
  [key('Beitar Jerusalem', 'Hapoel Tel-Aviv')]: {
    name: '🔴🟡 ענקים נפגשים',
    slides: [
      'בית"ר ירושלים ו-הפועל ת"א — שתי הקבוצות הפופולריות מחוץ לצפון',
      'ב-2022/23 המשחק ביניהן הסתיים 2:2 עם שני שערי דקה 90',
      'בית"ר ניצחה 3 מ-5 המפגשים האחרונים ביניהן',
    ],
  },
  [key('Bnei Sakhnin', 'Maccabi Tel Aviv')]: {
    name: '⭐ דוד מול גוליית',
    slides: [
      'בני סכנין — הקבוצה הערבית הראשונה שזכתה בגביע המדינה (2004)',
      'מכבי ת"א מנסה לשמור על כתר האליפות בפתיחת העונה',
      'ב-2023/24 בני סכנין הפתיעה 1:0 על מכבי ת"א בסכנין',
    ],
  },
  [key('Maccabi Haifa', 'Hapoel Ramat Gan')]: {
    name: '🟢 ירוק נגד אדום',
    slides: [
      'הפועל ר"ג — עלתה לליגת העל לאחר שנים במחלקה ראשונה',
      'מכבי חיפה — זוכה ב-14 אליפויות, מועמדת גדולה לעונת 2026/27',
      'ב-2024/25 הפועל ר"ג הפתיעה עם נקודה ראשונה נגד קבוצת שיא',
    ],
  },
  [key('Maccabi Tel Aviv', 'Maccabi Haifa')]: {
    name: '⭐ קרב האלופות',
    slides: [
      'שתי הקבוצות הזוכות ביותר בכדורגל הישראלי',
      'מכבי ת"א — 24 אליפויות · מכבי חיפה — 14 אליפויות',
      'כל נקודה במשחק הזה שווה זהב במרוץ לאליפות',
    ],
  },
  [key('Maccabi Netanya', 'Hapoel Jerusalem')]: {
    name: '🌊 שפת הים מול ההר',
    slides: [
      'מכבי נתניה — קבוצה ותיקה עם 5 אליפויות (האחרונה ב-1980)',
      'הפועל ירושלים חזרה לליגה לאחר שנים וממשיכה לטפס',
      'הדרבי בין שתי הקבוצות תמיד פותח עם מוטיבציה גבוהה',
    ],
  },
};

export interface SlideData {
  label: string;
  headline: string;
  detail?: string;
}

export function getGameSlides(
  home: string,
  away: string,
  kickoff: string
): SlideData[] {
  const homeHe = teamHe(home);
  const awayHe = teamHe(away);
  const time = new Date(kickoff).toLocaleTimeString('he-IL', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const derby = DERBIES[key(home, away)];

  if (derby) {
    return [
      { label: derby.name, headline: `${homeHe} נגד ${awayHe}`, detail: `היום בשעה ${time}` },
      { label: '📊 ראש בראש', headline: derby.slides[1] },
      { label: '💡 עובדה', headline: derby.slides[2] },
    ];
  }

  return [
    { label: '⚽ מחזור פתיחה', headline: `${homeHe} נגד ${awayHe}`, detail: `היום בשעה ${time}` },
    { label: '📅 עונת 2026/27', headline: 'כל קבוצה מתחילה מאפס — 3 נק׳ לניצחון בליגה', detail: 'כאן — 3 נק׳ לניחוש נכון, 5 לתוצאה מדויקת' },
    { label: '🎯 טיפ אסטרטגי', headline: 'מחזור פתיחה — קשה לחזות, אל תסתכן יותר מדי', detail: 'גם ניחוש "תיקו" שווה 3 נק׳!' },
  ];
}
