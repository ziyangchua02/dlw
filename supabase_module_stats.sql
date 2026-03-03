-- Create the module_stats table
create table if not exists module_stats (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  module_code   text not null,
  attendance    int not null default 0,
  performance   int not null default 0,
  assignments   int not null default 0,
  quizzes       int not null default 0,
  lab           int not null default 0,
  exam          int not null default 0,
  mastery       int not null default 0,
  unique (user_id, module_code)
);

-- Enable Row Level Security
alter table module_stats enable row level security;

-- Users can only read/write their own rows
create policy "Users can read own stats"
  on module_stats for select
  using (auth.uid() = user_id);

create policy "Users can upsert own stats"
  on module_stats for insert
  with check (auth.uid() = user_id);

create policy "Users can update own stats"
  on module_stats for update
  using (auth.uid() = user_id);
