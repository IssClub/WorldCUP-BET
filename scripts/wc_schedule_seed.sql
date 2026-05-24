-- הרץ את זה ב-Supabase SQL Editor (פעם אחת)
-- מוסיף את 72 משחקי שלב הבתים של מונדיאל 2026

INSERT INTO wc_schedule (id, home_team, away_team, kickoff_at, home_score, away_score, completed) VALUES

-- ── בית A ────────────────────────────────────────────────────
('wc26-A-1','Mexico','South Africa',          '2026-06-11T19:00:00Z', NULL, NULL, false),
('wc26-A-2','South Korea','Czech Republic',   '2026-06-12T02:00:00Z', NULL, NULL, false),
('wc26-A-3','Czech Republic','South Africa',  '2026-06-18T16:00:00Z', NULL, NULL, false),
('wc26-A-4','Mexico','South Korea',           '2026-06-19T01:00:00Z', NULL, NULL, false),
('wc26-A-5','Czech Republic','Mexico',        '2026-06-25T01:00:00Z', NULL, NULL, false),
('wc26-A-6','South Africa','South Korea',     '2026-06-25T01:00:00Z', NULL, NULL, false),

-- ── בית B ────────────────────────────────────────────────────
('wc26-B-1','Canada','Bosnia and Herzegovina','2026-06-12T19:00:00Z', NULL, NULL, false),
('wc26-B-2','Qatar','Switzerland',            '2026-06-13T19:00:00Z', NULL, NULL, false),
('wc26-B-3','Switzerland','Bosnia and Herzegovina','2026-06-18T19:00:00Z', NULL, NULL, false),
('wc26-B-4','Canada','Qatar',                 '2026-06-18T22:00:00Z', NULL, NULL, false),
('wc26-B-5','Switzerland','Canada',           '2026-06-24T19:00:00Z', NULL, NULL, false),
('wc26-B-6','Bosnia and Herzegovina','Qatar', '2026-06-24T19:00:00Z', NULL, NULL, false),

-- ── בית C ────────────────────────────────────────────────────
('wc26-C-1','Brazil','Morocco',               '2026-06-13T22:00:00Z', NULL, NULL, false),
('wc26-C-2','Haiti','Scotland',               '2026-06-14T01:00:00Z', NULL, NULL, false),
('wc26-C-3','Scotland','Morocco',             '2026-06-19T22:00:00Z', NULL, NULL, false),
('wc26-C-4','Brazil','Haiti',                 '2026-06-20T00:30:00Z', NULL, NULL, false),
('wc26-C-5','Scotland','Brazil',              '2026-06-24T22:00:00Z', NULL, NULL, false),
('wc26-C-6','Morocco','Haiti',                '2026-06-24T22:00:00Z', NULL, NULL, false),

-- ── בית D ────────────────────────────────────────────────────
('wc26-D-1','United States','Paraguay',       '2026-06-13T01:00:00Z', NULL, NULL, false),
('wc26-D-2','Australia','Turkey',             '2026-06-14T04:00:00Z', NULL, NULL, false),
('wc26-D-3','United States','Australia',      '2026-06-19T19:00:00Z', NULL, NULL, false),
('wc26-D-4','Turkey','Paraguay',              '2026-06-20T03:00:00Z', NULL, NULL, false),
('wc26-D-5','Turkey','United States',         '2026-06-26T02:00:00Z', NULL, NULL, false),
('wc26-D-6','Paraguay','Australia',           '2026-06-26T02:00:00Z', NULL, NULL, false),

-- ── בית E ────────────────────────────────────────────────────
('wc26-E-1','Germany','Curacao',              '2026-06-14T17:00:00Z', NULL, NULL, false),
('wc26-E-2','Ivory Coast','Ecuador',          '2026-06-14T23:00:00Z', NULL, NULL, false),
('wc26-E-3','Germany','Ivory Coast',          '2026-06-20T20:00:00Z', NULL, NULL, false),
('wc26-E-4','Ecuador','Curacao',              '2026-06-21T00:00:00Z', NULL, NULL, false),
('wc26-E-5','Curacao','Ivory Coast',          '2026-06-25T20:00:00Z', NULL, NULL, false),
('wc26-E-6','Ecuador','Germany',              '2026-06-25T20:00:00Z', NULL, NULL, false),

-- ── בית F ────────────────────────────────────────────────────
('wc26-F-1','Netherlands','Japan',            '2026-06-14T20:00:00Z', NULL, NULL, false),
('wc26-F-2','Sweden','Tunisia',               '2026-06-15T02:00:00Z', NULL, NULL, false),
('wc26-F-3','Netherlands','Sweden',           '2026-06-20T17:00:00Z', NULL, NULL, false),
('wc26-F-4','Tunisia','Japan',                '2026-06-21T04:00:00Z', NULL, NULL, false),
('wc26-F-5','Japan','Sweden',                 '2026-06-25T23:00:00Z', NULL, NULL, false),
('wc26-F-6','Tunisia','Netherlands',          '2026-06-25T23:00:00Z', NULL, NULL, false),

-- ── בית G ────────────────────────────────────────────────────
('wc26-G-1','Belgium','Egypt',                '2026-06-15T19:00:00Z', NULL, NULL, false),
('wc26-G-2','Iran','New Zealand',             '2026-06-16T01:00:00Z', NULL, NULL, false),
('wc26-G-3','Belgium','Iran',                 '2026-06-21T19:00:00Z', NULL, NULL, false),
('wc26-G-4','New Zealand','Egypt',            '2026-06-22T01:00:00Z', NULL, NULL, false),
('wc26-G-5','Egypt','Iran',                   '2026-06-27T03:00:00Z', NULL, NULL, false),
('wc26-G-6','New Zealand','Belgium',          '2026-06-27T03:00:00Z', NULL, NULL, false),

-- ── בית H ────────────────────────────────────────────────────
('wc26-H-1','Spain','Cape Verde',             '2026-06-15T16:00:00Z', NULL, NULL, false),
('wc26-H-2','Saudi Arabia','Uruguay',         '2026-06-15T22:00:00Z', NULL, NULL, false),
('wc26-H-3','Spain','Saudi Arabia',           '2026-06-21T16:00:00Z', NULL, NULL, false),
('wc26-H-4','Uruguay','Cape Verde',           '2026-06-21T22:00:00Z', NULL, NULL, false),
('wc26-H-5','Cape Verde','Saudi Arabia',      '2026-06-27T00:00:00Z', NULL, NULL, false),
('wc26-H-6','Uruguay','Spain',                '2026-06-27T00:00:00Z', NULL, NULL, false),

-- ── בית I ────────────────────────────────────────────────────
('wc26-I-1','France','Senegal',               '2026-06-16T19:00:00Z', NULL, NULL, false),
('wc26-I-2','Iraq','Norway',                  '2026-06-16T22:00:00Z', NULL, NULL, false),
('wc26-I-3','France','Iraq',                  '2026-06-22T21:00:00Z', NULL, NULL, false),
('wc26-I-4','Norway','Senegal',               '2026-06-23T00:00:00Z', NULL, NULL, false),
('wc26-I-5','Norway','France',                '2026-06-26T19:00:00Z', NULL, NULL, false),
('wc26-I-6','Senegal','Iraq',                 '2026-06-26T19:00:00Z', NULL, NULL, false),

-- ── בית J ────────────────────────────────────────────────────
('wc26-J-1','Argentina','Algeria',            '2026-06-17T01:00:00Z', NULL, NULL, false),
('wc26-J-2','Austria','Jordan',               '2026-06-17T04:00:00Z', NULL, NULL, false),
('wc26-J-3','Argentina','Austria',            '2026-06-22T17:00:00Z', NULL, NULL, false),
('wc26-J-4','Jordan','Algeria',               '2026-06-23T03:00:00Z', NULL, NULL, false),
('wc26-J-5','Algeria','Austria',              '2026-06-28T02:00:00Z', NULL, NULL, false),
('wc26-J-6','Jordan','Argentina',             '2026-06-28T02:00:00Z', NULL, NULL, false),

-- ── בית K ────────────────────────────────────────────────────
('wc26-K-1','Portugal','DR Congo',            '2026-06-17T17:00:00Z', NULL, NULL, false),
('wc26-K-2','Uzbekistan','Colombia',          '2026-06-18T02:00:00Z', NULL, NULL, false),
('wc26-K-3','Portugal','Uzbekistan',          '2026-06-23T17:00:00Z', NULL, NULL, false),
('wc26-K-4','Colombia','DR Congo',            '2026-06-24T02:00:00Z', NULL, NULL, false),
('wc26-K-5','Colombia','Portugal',            '2026-06-27T23:30:00Z', NULL, NULL, false),
('wc26-K-6','DR Congo','Uzbekistan',          '2026-06-27T23:30:00Z', NULL, NULL, false),

-- ── בית L ────────────────────────────────────────────────────
('wc26-L-1','England','Croatia',              '2026-06-17T20:00:00Z', NULL, NULL, false),
('wc26-L-2','Ghana','Panama',                 '2026-06-17T23:00:00Z', NULL, NULL, false),
('wc26-L-3','England','Ghana',                '2026-06-23T20:00:00Z', NULL, NULL, false),
('wc26-L-4','Panama','Croatia',               '2026-06-23T23:00:00Z', NULL, NULL, false),
('wc26-L-5','Panama','England',               '2026-06-27T21:00:00Z', NULL, NULL, false),
('wc26-L-6','Croatia','Ghana',                '2026-06-27T21:00:00Z', NULL, NULL, false)

ON CONFLICT (id) DO NOTHING;
