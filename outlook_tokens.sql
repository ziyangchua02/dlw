-- Run this in Supabase SQL Editor
-- https://supabase.com/dashboard/project/trcmkjwdeknygktjmsfx/sql/new

create table if not exists outlook_tokens (
  id              bigserial primary key,
  user_id         uuid not null unique,          -- matches profiles.user_id
  access_token    text not null,
  refresh_token   text not null,
  expires_at      timestamptz not null,           -- when access_token expires
  email           text,                           -- the Outlook account email
  created_at      timestamptz default now()
);

alter table outlook_tokens disable row level security;
