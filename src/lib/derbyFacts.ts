import { teamHe } from './teamNames';

const key = (a: string, b: string) => [a, b].sort().join('|||');

interface DerbySlides {
  name: string;
  slides: [string, string, string];
}

const DERBIES: Record<string, DerbySlides> = {
  [key('Maccabi Tel Aviv', 'Hapoel Tel-Aviv')]: {
    name: '🔥 הקלאסיקו',
    slides: [
      'הדרבי הגדול ביותר בכדורגל הישראלי — משוחק מאז 1926',
      'ממוצע ~3 שערים למשחק · מכבי ניצחה 54 מ-~120 מפגשים בליגה',
      'בעשור האחרון — כשמכבי מארחת, הפסידה פחות מ-25% מהמשחקים',
    ],
  },
  [key('Maccabi Haifa', 'Hapoel Haifa')]: {
    name: '🍋 דרבי חיפה',
    slides: [
      'דרבי הכרמל — הדרבי הצפוני הגדול ביותר',
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
  [key('Maccabi Tel Aviv', 'Maccabi Haifa')]: {
    name: '⭐ קרב האלופות',
    slides: [
      'שתי הקבוצות הזוכות ביותר בכדורגל הישראלי',
      'מכבי ת"א — 24 אליפויות · מכבי חיפה — 14 אליפויות',
      'כל נקודה במשחק הזה שווה זהב במרוץ לאליפות',
    ],
  },
  [key('Beitar Jerusalem', 'Maccabi Tel Aviv')]: {
    name: '👑 קרב הגדולים',
    slides: [
      'שתי הקבוצות הפופולריות ביותר בישראל',
      'בית"ר — 6 אליפויות · מכבי ת"א — 24 אליפויות',
      'הביקוש לכרטיסים תמיד עולה על ההיצע',
    ],
  },
  [key('Hapoel Tel-Aviv', 'Maccabi Haifa')]: {
    name: '⚔️ צפון מול מרכז',
    slides: [
      'שתי הקבוצות הזוכות ביותר מחוץ לירושלים בשתי ערי המרכז',
      'מכבי חיפה ניצחה ב-3 מתוך 5 מפגשים אחרונים',
      'הפועל ת"א מחפשת לאלוף את הגליל',
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
    { label: '⚽ המשחק', headline: `${homeHe} נגד ${awayHe}`, detail: `היום בשעה ${time}` },
    { label: '🏆 ניקוד', headline: 'ניחוש נכון = 3 נק׳', detail: 'תוצאה מדויקת = 5 נק׳' },
    { label: '🎯 טיפ', headline: 'אל תשכח לנחש תוצאה מדויקת', detail: 'שני נק׳ בונוס!' },
  ];
}
