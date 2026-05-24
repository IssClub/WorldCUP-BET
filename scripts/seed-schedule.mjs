/**
 * seed-schedule.mjs — סקריפט חד-פעמי
 * מוסיף את לוח משחקי המונדיאל 2026 (72 משחקי שלב הבתים) ל-wc_schedule.
 * הנתונים סטטיים — לא שורף קרדיטים מה-API.
 * הרצה: node scripts/seed-schedule.mjs
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL  || process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing env vars. Set SUPABASE_URL + SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// כל הזמנים המרומזים ל-UTC (EDT = UTC-4 בקיץ)
const games = [
  // ── בית A ─────────────────────────────────────────────
  { id: 'wc26-A-1', home_team: 'Mexico',       away_team: 'South Africa',      kickoff_at: '2026-06-11T19:00:00Z' },
  { id: 'wc26-A-2', home_team: 'South Korea',  away_team: 'Czech Republic',    kickoff_at: '2026-06-12T02:00:00Z' },
  { id: 'wc26-A-3', home_team: 'Czech Republic',away_team: 'South Africa',     kickoff_at: '2026-06-18T16:00:00Z' },
  { id: 'wc26-A-4', home_team: 'Mexico',       away_team: 'South Korea',       kickoff_at: '2026-06-19T01:00:00Z' },
  { id: 'wc26-A-5', home_team: 'Czech Republic',away_team: 'Mexico',           kickoff_at: '2026-06-25T01:00:00Z' },
  { id: 'wc26-A-6', home_team: 'South Africa', away_team: 'South Korea',       kickoff_at: '2026-06-25T01:00:00Z' },

  // ── בית B ─────────────────────────────────────────────
  { id: 'wc26-B-1', home_team: 'Canada',       away_team: 'Bosnia and Herzegovina', kickoff_at: '2026-06-12T19:00:00Z' },
  { id: 'wc26-B-2', home_team: 'Qatar',        away_team: 'Switzerland',       kickoff_at: '2026-06-13T19:00:00Z' },
  { id: 'wc26-B-3', home_team: 'Switzerland',  away_team: 'Bosnia and Herzegovina', kickoff_at: '2026-06-18T19:00:00Z' },
  { id: 'wc26-B-4', home_team: 'Canada',       away_team: 'Qatar',             kickoff_at: '2026-06-18T22:00:00Z' },
  { id: 'wc26-B-5', home_team: 'Switzerland',  away_team: 'Canada',            kickoff_at: '2026-06-24T19:00:00Z' },
  { id: 'wc26-B-6', home_team: 'Bosnia and Herzegovina', away_team: 'Qatar',   kickoff_at: '2026-06-24T19:00:00Z' },

  // ── בית C ─────────────────────────────────────────────
  { id: 'wc26-C-1', home_team: 'Brazil',       away_team: 'Morocco',           kickoff_at: '2026-06-13T22:00:00Z' },
  { id: 'wc26-C-2', home_team: 'Haiti',        away_team: 'Scotland',          kickoff_at: '2026-06-14T01:00:00Z' },
  { id: 'wc26-C-3', home_team: 'Scotland',     away_team: 'Morocco',           kickoff_at: '2026-06-19T22:00:00Z' },
  { id: 'wc26-C-4', home_team: 'Brazil',       away_team: 'Haiti',             kickoff_at: '2026-06-20T00:30:00Z' },
  { id: 'wc26-C-5', home_team: 'Scotland',     away_team: 'Brazil',            kickoff_at: '2026-06-24T22:00:00Z' },
  { id: 'wc26-C-6', home_team: 'Morocco',      away_team: 'Haiti',             kickoff_at: '2026-06-24T22:00:00Z' },

  // ── בית D ─────────────────────────────────────────────
  { id: 'wc26-D-1', home_team: 'United States', away_team: 'Paraguay',         kickoff_at: '2026-06-13T01:00:00Z' },
  { id: 'wc26-D-2', home_team: 'Australia',    away_team: 'Turkey',            kickoff_at: '2026-06-14T04:00:00Z' },
  { id: 'wc26-D-3', home_team: 'United States', away_team: 'Australia',        kickoff_at: '2026-06-19T19:00:00Z' },
  { id: 'wc26-D-4', home_team: 'Turkey',       away_team: 'Paraguay',          kickoff_at: '2026-06-20T03:00:00Z' },
  { id: 'wc26-D-5', home_team: 'Turkey',       away_team: 'United States',     kickoff_at: '2026-06-26T02:00:00Z' },
  { id: 'wc26-D-6', home_team: 'Paraguay',     away_team: 'Australia',         kickoff_at: '2026-06-26T02:00:00Z' },

  // ── בית E ─────────────────────────────────────────────
  { id: 'wc26-E-1', home_team: 'Germany',      away_team: 'Curacao',           kickoff_at: '2026-06-14T17:00:00Z' },
  { id: 'wc26-E-2', home_team: 'Ivory Coast',  away_team: 'Ecuador',           kickoff_at: '2026-06-14T23:00:00Z' },
  { id: 'wc26-E-3', home_team: 'Germany',      away_team: 'Ivory Coast',       kickoff_at: '2026-06-20T20:00:00Z' },
  { id: 'wc26-E-4', home_team: 'Ecuador',      away_team: 'Curacao',           kickoff_at: '2026-06-21T00:00:00Z' },
  { id: 'wc26-E-5', home_team: 'Curacao',      away_team: 'Ivory Coast',       kickoff_at: '2026-06-25T20:00:00Z' },
  { id: 'wc26-E-6', home_team: 'Ecuador',      away_team: 'Germany',           kickoff_at: '2026-06-25T20:00:00Z' },

  // ── בית F ─────────────────────────────────────────────
  { id: 'wc26-F-1', home_team: 'Netherlands',  away_team: 'Japan',             kickoff_at: '2026-06-14T20:00:00Z' },
  { id: 'wc26-F-2', home_team: 'Sweden',       away_team: 'Tunisia',           kickoff_at: '2026-06-15T02:00:00Z' },
  { id: 'wc26-F-3', home_team: 'Netherlands',  away_team: 'Sweden',            kickoff_at: '2026-06-20T17:00:00Z' },
  { id: 'wc26-F-4', home_team: 'Tunisia',      away_team: 'Japan',             kickoff_at: '2026-06-21T04:00:00Z' },
  { id: 'wc26-F-5', home_team: 'Japan',        away_team: 'Sweden',            kickoff_at: '2026-06-25T23:00:00Z' },
  { id: 'wc26-F-6', home_team: 'Tunisia',      away_team: 'Netherlands',       kickoff_at: '2026-06-25T23:00:00Z' },

  // ── בית G ─────────────────────────────────────────────
  { id: 'wc26-G-1', home_team: 'Belgium',      away_team: 'Egypt',             kickoff_at: '2026-06-15T19:00:00Z' },
  { id: 'wc26-G-2', home_team: 'Iran',         away_team: 'New Zealand',       kickoff_at: '2026-06-16T01:00:00Z' },
  { id: 'wc26-G-3', home_team: 'Belgium',      away_team: 'Iran',              kickoff_at: '2026-06-21T19:00:00Z' },
  { id: 'wc26-G-4', home_team: 'New Zealand',  away_team: 'Egypt',             kickoff_at: '2026-06-22T01:00:00Z' },
  { id: 'wc26-G-5', home_team: 'Egypt',        away_team: 'Iran',              kickoff_at: '2026-06-27T03:00:00Z' },
  { id: 'wc26-G-6', home_team: 'New Zealand',  away_team: 'Belgium',           kickoff_at: '2026-06-27T03:00:00Z' },

  // ── בית H ─────────────────────────────────────────────
  { id: 'wc26-H-1', home_team: 'Spain',        away_team: 'Cape Verde',        kickoff_at: '2026-06-15T16:00:00Z' },
  { id: 'wc26-H-2', home_team: 'Saudi Arabia', away_team: 'Uruguay',           kickoff_at: '2026-06-15T22:00:00Z' },
  { id: 'wc26-H-3', home_team: 'Spain',        away_team: 'Saudi Arabia',      kickoff_at: '2026-06-21T16:00:00Z' },
  { id: 'wc26-H-4', home_team: 'Uruguay',      away_team: 'Cape Verde',        kickoff_at: '2026-06-21T22:00:00Z' },
  { id: 'wc26-H-5', home_team: 'Cape Verde',   away_team: 'Saudi Arabia',      kickoff_at: '2026-06-27T00:00:00Z' },
  { id: 'wc26-H-6', home_team: 'Uruguay',      away_team: 'Spain',             kickoff_at: '2026-06-27T00:00:00Z' },

  // ── בית I ─────────────────────────────────────────────
  { id: 'wc26-I-1', home_team: 'France',       away_team: 'Senegal',           kickoff_at: '2026-06-16T19:00:00Z' },
  { id: 'wc26-I-2', home_team: 'Iraq',         away_team: 'Norway',            kickoff_at: '2026-06-16T22:00:00Z' },
  { id: 'wc26-I-3', home_team: 'France',       away_team: 'Iraq',              kickoff_at: '2026-06-22T21:00:00Z' },
  { id: 'wc26-I-4', home_team: 'Norway',       away_team: 'Senegal',           kickoff_at: '2026-06-23T00:00:00Z' },
  { id: 'wc26-I-5', home_team: 'Norway',       away_team: 'France',            kickoff_at: '2026-06-26T19:00:00Z' },
  { id: 'wc26-I-6', home_team: 'Senegal',      away_team: 'Iraq',              kickoff_at: '2026-06-26T19:00:00Z' },

  // ── בית J ─────────────────────────────────────────────
  { id: 'wc26-J-1', home_team: 'Argentina',    away_team: 'Algeria',           kickoff_at: '2026-06-17T01:00:00Z' },
  { id: 'wc26-J-2', home_team: 'Austria',      away_team: 'Jordan',            kickoff_at: '2026-06-17T04:00:00Z' },
  { id: 'wc26-J-3', home_team: 'Argentina',    away_team: 'Austria',           kickoff_at: '2026-06-22T17:00:00Z' },
  { id: 'wc26-J-4', home_team: 'Jordan',       away_team: 'Algeria',           kickoff_at: '2026-06-23T03:00:00Z' },
  { id: 'wc26-J-5', home_team: 'Algeria',      away_team: 'Austria',           kickoff_at: '2026-06-28T02:00:00Z' },
  { id: 'wc26-J-6', home_team: 'Jordan',       away_team: 'Argentina',         kickoff_at: '2026-06-28T02:00:00Z' },

  // ── בית K ─────────────────────────────────────────────
  { id: 'wc26-K-1', home_team: 'Portugal',     away_team: 'DR Congo',          kickoff_at: '2026-06-17T17:00:00Z' },
  { id: 'wc26-K-2', home_team: 'Uzbekistan',   away_team: 'Colombia',          kickoff_at: '2026-06-18T02:00:00Z' },
  { id: 'wc26-K-3', home_team: 'Portugal',     away_team: 'Uzbekistan',        kickoff_at: '2026-06-23T17:00:00Z' },
  { id: 'wc26-K-4', home_team: 'Colombia',     away_team: 'DR Congo',          kickoff_at: '2026-06-24T02:00:00Z' },
  { id: 'wc26-K-5', home_team: 'Colombia',     away_team: 'Portugal',          kickoff_at: '2026-06-27T23:30:00Z' },
  { id: 'wc26-K-6', home_team: 'DR Congo',     away_team: 'Uzbekistan',        kickoff_at: '2026-06-27T23:30:00Z' },

  // ── בית L ─────────────────────────────────────────────
  { id: 'wc26-L-1', home_team: 'England',      away_team: 'Croatia',           kickoff_at: '2026-06-17T20:00:00Z' },
  { id: 'wc26-L-2', home_team: 'Ghana',        away_team: 'Panama',            kickoff_at: '2026-06-17T23:00:00Z' },
  { id: 'wc26-L-3', home_team: 'England',      away_team: 'Ghana',             kickoff_at: '2026-06-23T20:00:00Z' },
  { id: 'wc26-L-4', home_team: 'Panama',       away_team: 'Croatia',           kickoff_at: '2026-06-23T23:00:00Z' },
  { id: 'wc26-L-5', home_team: 'Panama',       away_team: 'England',           kickoff_at: '2026-06-27T21:00:00Z' },
  { id: 'wc26-L-6', home_team: 'Croatia',      away_team: 'Ghana',             kickoff_at: '2026-06-27T21:00:00Z' },
];

const rows = games.map(g => ({
  id:          g.id,
  home_team:   g.home_team,
  away_team:   g.away_team,
  kickoff_at:  g.kickoff_at,
  home_score:  null,
  away_score:  null,
  completed:   false,
}));

const { error } = await supabase
  .from('wc_schedule')
  .upsert(rows, { onConflict: 'id' });

if (error) {
  console.error('Supabase error:', error.message);
  process.exit(1);
}

console.log(`✅ Inserted ${rows.length} group-stage games into wc_schedule`);
console.log('Groups: A–L, dates: Jun 11 – Jun 27, 2026');
