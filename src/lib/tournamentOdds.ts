/**
 * ליגת העל 2026/27 — רשימת קבוצות לניחושי עונה
 * אין יחסים — הבונוס קבוע (special_bet_stake) לכל ניחוש נכון
 */

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
  'Hapoel Ramat Gan',
  'Ironi Tiberias',
];

// backward compat — לא בשימוש יותר, נשמר כדי לא לשבור imports ישנים
export const WINNER_ODDS:     { name: string; price: number }[]                  = [];
export const TOP_SCORER_ODDS: { name: string; team: string; price: number }[]    = [];
export const RELEGATED_ODDS:  { name: string; price: number }[]                  = [];
export const LEAGUE_WINNER_ODDS = WINNER_ODDS;
export const LEAGUE_SCORER_ODDS = TOP_SCORER_ODDS;
