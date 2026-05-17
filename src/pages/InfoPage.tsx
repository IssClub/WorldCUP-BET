export default function InfoPage() {
  const sections = [
    {
      icon: '🏦',
      title: 'בנק נקודות',
      items: [
        'כל שחקן מתחיל עם 1,000 נקודות',
        'ניחוש נכון = כפל לפי יחסי הסיכויים',
        'ניחוש שגוי = הפסד סכום ההימור',
        'יתרה 0 = פרישה מהמשחק',
      ],
    },
    {
      icon: '⚽',
      title: 'הימור רגיל',
      items: [
        'בחר ניצחון בית / תיקו / ניצחון חוץ',
        'קבע כמה נקודות להמר (מינימום 50, מקסימום 500)',
        'הימורים נסגרים עם תחילת המשחק',
        'ניתן לבטל הימור לפני תחילת המשחק',
      ],
    },
    {
      icon: '🎯',
      title: 'בונוס תוצאה מדויקת',
      items: [
        'ניחוש תוצאה מדויקת מוסיף בונוס ×1.5',
        'הבונוס מחושב על הרווח הסופי',
        'דוגמה: 100 × 2.00 = 200 נק׳, עם בונוס = 300 נק׳',
        'חובה לנחש גם את הכיוון (ניצחון/תיקו) נכון',
      ],
    },
    {
      icon: '🏆',
      title: 'ניחושי טורניר',
      items: [
        'ניחוש זוכה הטורניר — נפתח עד 11 ביוני',
        'ניחוש מלך השערים — נפתח עד 11 ביוני',
        'ניחוש נכון = בונוס 500 נקודות',
        'אין ניכוי נקודות על ניחוש שגוי',
      ],
    },
    {
      icon: '📅',
      title: 'לוח זמנים',
      items: [
        'שלב הבתים: 11 יוני – 2 יולי 2026',
        'סיבוב 32: 29 יוני – 3 יולי',
        'שמינית גמר: 6–9 יולי',
        'רבע גמר: 12–13 יולי',
        'חצי גמר: 16–17 יולי',
        'גמר: 19 יולי — מטה לייף, ניו ג׳רזי',
      ],
    },
    {
      icon: '🌍',
      title: 'על הטורניר',
      items: [
        '48 נבחרות, 12 בתים של 4 קבוצות',
        'המארחות: ארה״ב, קנדה, מקסיקו',
        '104 משחקים סה״כ',
        'שני הראשונים בכל בית + 8 הטובים ביותר מקום שלישי עולים',
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
          <span style={{ fontSize: '2.5rem' }}>🌍</span>
          <div>
            <div className="font-bold text-base">FIFA World Cup 2026</div>
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
