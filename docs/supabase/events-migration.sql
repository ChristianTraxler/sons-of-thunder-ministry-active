-- Calendar of Events table
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  event_date  date not null,
  start_time  time,
  end_time    time,
  location    text,
  description text,
  link_url    text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists events_event_date_idx
  on public.events (event_date);

alter table public.events enable row level security;

-- Public read
drop policy if exists "events_public_read" on public.events;
create policy "events_public_read"
  on public.events
  for select
  to anon, authenticated
  using (true);

-- Authenticated write
drop policy if exists "events_auth_insert" on public.events;
create policy "events_auth_insert"
  on public.events
  for insert
  to authenticated
  with check (true);

drop policy if exists "events_auth_update" on public.events;
create policy "events_auth_update"
  on public.events
  for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "events_auth_delete" on public.events;
create policy "events_auth_delete"
  on public.events
  for delete
  to authenticated
  using (true);

-- Keep updated_at current
create or replace function public.events_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.events_set_updated_at();
