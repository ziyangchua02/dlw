-- ── 1. Add user_id column to module_items ──────────────────────────────────
alter table module_items
  add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- ── 2. Copy existing rows for every current user ────────────────────────────
-- This duplicates the existing shared rows so every existing user gets their
-- own copy. New users created after this point will get nothing (empty dashboard).
do $$
declare
  u record;
  existing_rows record;
begin
  for u in select id from auth.users loop
    -- Only seed if this user has no items yet
    if not exists (select 1 from module_items where user_id = u.id) then
      for existing_rows in
        select module_code, title, type, due_date, status
        from module_items
        where user_id is null
      loop
        insert into module_items (user_id, module_code, title, type, due_date, status)
        values (u.id, existing_rows.module_code, existing_rows.title, existing_rows.type, existing_rows.due_date, existing_rows.status);
      end loop;
    end if;
  end loop;
end $$;

-- ── 3. Delete the original shared (user_id = null) rows ─────────────────────
delete from module_items where user_id is null;

-- ── 4. Make user_id required going forward ──────────────────────────────────
alter table module_items
  alter column user_id set not null;

-- ── 5. Enable RLS ────────────────────────────────────────────────────────────
alter table module_items enable row level security;

-- Drop old permissive policies if any exist
drop policy if exists "Allow all" on module_items;
drop policy if exists "Users can read own items" on module_items;
drop policy if exists "Users can insert own items" on module_items;
drop policy if exists "Users can update own items" on module_items;
drop policy if exists "Users can delete own items" on module_items;

-- Users can only see/edit their own rows
create policy "Users can read own items"
  on module_items for select using (auth.uid() = user_id);

create policy "Users can insert own items"
  on module_items for insert with check (auth.uid() = user_id);

create policy "Users can update own items"
  on module_items for update using (auth.uid() = user_id);

create policy "Users can delete own items"
  on module_items for delete using (auth.uid() = user_id);
