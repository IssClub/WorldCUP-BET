-- הרשאות לטבלת ניחושי טורניר
-- הרץ את זה ב-Supabase → SQL Editor

-- וודא ש-RLS מופעל
alter table special_bets enable row level security;

-- מחק פוליסות קיימות כדי להתחיל מחדש (במקרה שיש פוליסות עם שגיאות)
drop policy if exists "שחקן קורא ניחושי טורניר שלו" on special_bets;
drop policy if exists "שחקן מוסיף ניחוש טורניר" on special_bets;
drop policy if exists "שחקן מעדכן ניחוש טורניר" on special_bets;
drop policy if exists "אדמין קורא הכל" on special_bets;
drop policy if exists "Players can view own special bets" on special_bets;
drop policy if exists "Players can manage own special bets" on special_bets;

-- פוליסת קריאה — שחקן רואה רק את שלו
create policy "שחקן קורא ניחושי טורניר שלו" on special_bets
  for select using (auth.uid() = player_id);

-- פוליסת הוספה/עדכון — שחקן מוסיף/מעדכן רק שלו
create policy "שחקן מוסיף ניחוש טורניר" on special_bets
  for insert with check (auth.uid() = player_id);

create policy "שחקן מעדכן ניחוש טורניר" on special_bets
  for update using (auth.uid() = player_id) with check (auth.uid() = player_id);

-- פוליסת אדמין — קריאת הכל
create policy "אדמין קורא הכל" on special_bets
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
