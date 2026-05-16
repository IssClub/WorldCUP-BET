-- =====================================================
-- Supabase Setup v2 — World Cup Betting 2026
-- הרץ את זה בעורך ה-SQL של Supabase
-- =====================================================

-- ── locked_odds ───────────────────────────────────────────
-- שומר יחסים פעם אחת לכל משחק — לא מתעדכן אחרי כן
CREATE TABLE IF NOT EXISTS locked_odds (
  external_game_id text PRIMARY KEY,
  home_team        text        NOT NULL,
  away_team        text        NOT NULL,
  kickoff_at       timestamptz NOT NULL,
  home_win         numeric(5,2) NOT NULL,
  draw_win         numeric(5,2) NOT NULL,
  away_win         numeric(5,2) NOT NULL,
  locked_at        timestamptz DEFAULT now()
);

ALTER TABLE locked_odds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read locked odds" ON locked_odds;
CREATE POLICY "Public read locked odds" ON locked_odds
  FOR SELECT USING (true);

-- ── game_reminders ────────────────────────────────────────
-- מונע שליחת push תזכורת פעמיים לאותו משחק
CREATE TABLE IF NOT EXISTS game_reminders (
  external_game_id text PRIMARY KEY,
  sent_at          timestamptz DEFAULT now()
);

-- ── auto_bet_amount in settings ───────────────────────────
-- גובה ההימור האוטומטי (ברירת מחדל 50 נק')
ALTER TABLE settings
  ADD COLUMN IF NOT EXISTS auto_bet_amount integer NOT NULL DEFAULT 50;
