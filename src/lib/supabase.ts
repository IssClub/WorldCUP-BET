import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://thzcfbnvgsabvzzzsudh.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoemNmYm52Z3NhYnZ6enpzdWRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc2Mjg4MDcsImV4cCI6MjA5MzIwNDgwN30.DWYsvvj5Oa35Yz6rt7-kwTOr0VnsxPtl1We9HwiOY2c';

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
  game_id: string;
  odds_id: string;
  pick: 'home' | 'draw' | 'away';
  amount: number;
  odds_value: number;
  status: 'pending' | 'won' | 'lost' | 'cancelled';
  payout: number | null;
  is_auto: boolean;
  created_at: string;
};

export type Settings = {
  id: number;
  starting_bank: number;
  min_bet: number;
  max_bet: number;
  no_bet_penalty: number;
};
