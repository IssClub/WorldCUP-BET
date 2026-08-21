import { useAuth } from '../contexts/AuthContext';

const TEAM_FOOTER: Record<string, { msg: string; heart: string }> = {
  'Maccabi Tel Aviv':           { msg: 'צהוב עולה זה מכבי',            heart: '💛' },
  'Beitar Jerusalem':           { msg: 'יאללה בית״ר',                   heart: '💛' },
  'Hapoel Tel-Aviv':            { msg: 'הנה הם הבאים, השדים האדומים',  heart: '❤️' },
  'Maccabi Haifa':              { msg: 'חיפה חיפה, מכבי שלי',          heart: '💚' },
  "Hapoel Be'er Sheva":         { msg: 'This is Turner',                heart: '❤️' },
  'Hapoel Haifa':               { msg: 'לב אדום על הכרמל',              heart: '❤️' },
  'Hapoel Jerusalem':           { msg: 'ירושלים שלנו, לנצח',           heart: '❤️' },
  'Maccabi Netanya':            { msg: 'נתניה על הגל',                  heart: '💛' },
  'Maccabi Petah Tikva':        { msg: 'ירוק ולבן, לב פתוח',           heart: '💛' },
  'Hapoel Petah Tikva':         { msg: 'הפועל פ״ת — מאה שנה של תשוקה', heart: '❤️' },
  'Hapoel Ironi Kiryat Shmona': { msg: 'ק״ש — גאוות הצפון',            heart: '❤️' },
  'Bnei Sakhnin':               { msg: 'סכנין — לגאווה ולניצחון',      heart: '💚' },
  'Hapoel Ramat Gan':           { msg: 'הפועל ר״ג — לב אדום של המרכז', heart: '❤️' },
  'Ironi Tiberias':             { msg: 'עירוני טבריה — מאגם הכינרת',   heart: '💙' },
};

export default function InfoPage() {
  const { profile } = useAuth();
  const team = profile?.favorite_team ?? null;
  const footer = team ? TEAM_FOOTER[team] : null;

  const sections = [
    {
      icon: '🏦',
      title: 'ניקוד — איך זה עובד',
      items: [
        'ניחוש כיוון נכון (בית / תיקו / חוץ) = +3 נק׳',
        'ניחוש תוצאה מדויקת = +5 נק׳',
        'ניחוש שגוי = 0 נק׳ (לא מפסיד נקודות!)',
      ],
    },
    {
      icon: '⚽',
      title: 'הימור על משחק',
      items: [
        'בחר ניצחון בית / תיקו / ניצחון חוץ',
        'הימורים נסגרים עם תחילת המשחק',
        'ניתן לבטל הימור לפני תחילת המשחק',
        'שכחת להמר? המערכת תכניס עבורך הימור רנדומלי בתחילת המשחק',
      ],
    },
    {
      icon: '🏆',
      title: 'ניחושי ליגה (מיוחדים)',
      items: [
        'ניחוש אלוף הליגה — נסגר במחזור הראשון',
        'ניחוש שתי הקבוצות היורדות — נסגר במחזור הראשון',
        'ניחוש מלך השערים — נסגר במחזור הראשון',
        'ניחוש נכון = בונוס נקודות בסוף העונה',
        'אין ניכוי נקודות על ניחוש שגוי',
      ],
    },
    {
      icon: '🐒',
      title: 'הקוף',
      items: [
        'שחקן וירטואלי בשם "🐒 קוף" מתחרה עם כולם',
        'הקוף מנחש רנדומלית לפני כל משחק',
        'בסוף העונה — האם הצלחת לנצח את הקוף?',
      ],
    },
    {
      icon: '📊',
      title: 'טבלת הדירוג',
      items: [
        'הדירוג נקבע לפי סך הנקודות שנצברו',
        '✓ = מספר ניחושי כיוון נכונים',
        '✗ = מספר ניחושי כיוון שגויים',
        '🎯 = מספר תוצאות מדויקות',
        'שיוויון בנקודות — מכריע: 🎯 (מי שתפס יותר בולים)',
      ],
    },
    {
      icon: '📅',
      title: 'על הטורניר',
      items: [
        'ליגת העל הישראלית — עונת 2026/27',
        '14 קבוצות — 26 מחזורים בעונה הסדירה + פליאוף עליון ותחתון',
        'כל מחזור — 7 משחקים להמר עליהם',
        'בחר את קבוצת הלב שלך ושנה את מראה האפליקציה',
      ],
    },
  ];

  return (
    <div className="min-h-screen pb-24">
      <header className="hdr">
        <div className="hdr-inner">
          <span className="font-bold">מידע וחוקים</span>
          <span style={{ fontSize: '1.2rem' }}>📖</span>
        </div>
      </header>
      <div className="hdr-spacer" />

      <div className="page-wrap pt-4 flex flex-col gap-4">
        <div className="info-banner">
          <span style={{ fontSize: '2.5rem' }}>⚽</span>
          <div>
            <div className="font-bold text-base">ליגת העל 2026/27</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>מדריך למשתתף — קרא לפני שמתחיל</div>
          </div>
        </div>

        {sections.map(s => (
          <div key={s.title} className="info-card">
            <div className="info-card-title">
              <span>{s.icon}</span>
              <span>{s.title}</span>
            </div>
            <ul className="info-list">
              {s.items.map((item, i) => (
                <li key={i} className="info-item">
                  <span className="info-dot" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <div className="info-footer">
          {footer ? `${footer.msg} ${footer.heart}` : 'בהצלחה לכולם! ⚽'}
        </div>
      </div>
    </div>
  );
}
