import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export type Profile = {
  id: string;
  display_name: string;
  role: 'admin' | 'player';
  bank: number;
  created_at: string;
};

export type Invite = {
  id: string;
  code: string;
  created_by: string;
  used_by: string | null;
  used_at: string | null;
  expires_at: string | null;
  created_at: string;
};

export type Game = {
  id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  stage: string;
  status: 'upcoming' | 'live' | 'finished';
  external_id: string | null;
};

export type Odds = {
  id: string;
  game_id: string;
  home_win: number;
  draw: number;
  away_win: number;
  source: string;
  fetched_at: string;
  approved_by: string | null;
};

export type Bet = {
  id: string;
  player_id: string;
  external_game_id: string;
  home_team: string;
  away_team: string;
  kickoff_at: string;
  pick: 'home' | 'draw' | 'away';
  amount: number;
  odds_value: number;
  exact_home: number | null;
  exact_away: number | null;
  status: 'pending' | 'won' | 'lost' | 'cancelled';
  payout: number | null;
  created_at: string;
};

export type Settings = {
  id: number;
  starting_bank: number;
  min_bet: number;
  max_bet: number;
  no_bet_penalty: number;
};
