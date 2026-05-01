-- טבלת הימורים
create table if not exists bets (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references profiles(id) on delete cascade not null,
  external_game_id text not null,
  home_team text not null,
  away_team text not null,
  kickoff_at timestamptz not null,
  pick text not null check (pick in ('home', 'draw', 'away')),
  amount integer not null check (amount > 0),
  odds_value numeric(5,2) not null,
  exact_home integer,
  exact_away integer,
  status text not null default 'pending' check (status in ('pending', 'won', 'lost', 'cancelled')),
  payout integer,
  created_at timestamptz default now(),
  unique(player_id, external_game_id)
);

-- הרשאות
alter table bets enable row level security;

create policy "שחקן קורא הימורים שלו" on bets
  for select using (auth.uid() = player_id);

create policy "שחקן מוסיף הימור" on bets
  for insert with check (auth.uid() = player_id);

create policy "אדמין קורא הכל" on bets
  for select using (
    exists (select 1 from profiles where id = auth.uid() and role = 'admin')
  );
