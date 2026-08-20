export default function InfoPage() {
  const sections = [
    {
      icon: '🏦',
      title: 'ניקוד — איך זה עובד',
      items: [
        'ניחוש כיוון נכון (בית / תיקו / חוץ) = +3 נק׳',
        'ניחוש תוצאה מדויקת = +5 נק׳',
        'ניחוש שגוי = 0 נק׳ (לא מפסיד נקודות!)',
        'לא המרת = 0 נק׳ — הזדמנות שהוחמצה',
        'הנקודות מצטברות לאורך כל העונה',
      ],
    },
    {
      icon: '⚽',
      title: 'הימור על משחק',
      items: [
        'בחר ניצחון בית / תיקו / ניצחון חוץ',
        'ניתן גם לנחש תוצאה מדויקת (לא חובה) — 5 נק׳ במקום 3',
        'הימורים נסגרים עם תחילת המשחק',
        'ניתן לבטל הימור לפני תחילת המשחק',
        'שכחת? מערכת אוטומטית תמר עבורך לפני הקיקאוף',
      ],
    },
    {
      icon: '🏆',
      title: 'ניחושי ליגה (מיוחדים)',
      items: [
        'ניחוש אלוף הליגה — נפתח בתחילת העונה',
        'ניחוש שתי הקבוצות היורדות — נפתח בתחילת העונה',
        'ניחוש מלך השערים — נפתח בתחילת העונה',
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
        'שיוויון בנקודות — מכריע: ✓ → 🎯',
      ],
    },
    {
      icon: '📅',
      title: 'על הטורניר',
      items: [
        'ליגת העל הישראלית — עונת 2026/27',
        '14 קבוצות, 26 מחזורים בשלב העונה הסדירה',
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
        {/* Banner */}
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
          בהצלחה לכולם! ⚽
        </div>
      </div>
    </div>
  );
}
