-- Add category column to events (Church / Track)

alter table public.events
  add column if not exists category text not null default 'church';

alter table public.events
  drop constraint if exists events_category_check;

alter table public.events
  add constraint events_category_check
  check (category in ('church', 'track'));

create index if not exists events_category_idx
  on public.events (category);
