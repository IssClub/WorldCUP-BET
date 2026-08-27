-- Hide other players' special bets until the predictions window closes.
-- Deadline: 2026-08-29 20:59 UTC (= 23:59 Israel time)

-- Drop any existing select policy on special_bets so we can replace it cleanly.
DROP POLICY IF EXISTS "special_bets_select" ON special_bets;
DROP POLICY IF EXISTS "Users can view all special bets" ON special_bets;
DROP POLICY IF EXISTS "Allow read special_bets" ON special_bets;

-- New policy: own row always readable; other players' rows only after deadline.
CREATE POLICY "special_bets_select" ON special_bets
  FOR SELECT
  USING (
    player_id = auth.uid()
    OR NOW() >= TIMESTAMPTZ '2026-08-29 20:59:00+00'
  );
