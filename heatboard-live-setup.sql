-- HeatBoard live sync: eenmalige Supabase-setup.
-- Voer dit script uit in de SQL Editor van je Supabase-project.
-- De app gebruikt event sourcing: elke split/undo/dnf/start/reset is een rij.

create table if not exists public.heatboard_events (
  id bigserial primary key,
  code text not null,
  type text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

-- Snel ophalen van de historie van een sessie (op code, in volgorde)
create index if not exists heatboard_events_code_id_idx
  on public.heatboard_events (code, id);

-- De app gebruikt de anon key rechtstreeks: open insert/select policies
alter table public.heatboard_events enable row level security;

create policy "heatboard anon insert" on public.heatboard_events
  for insert to anon with check (true);

create policy "heatboard anon select" on public.heatboard_events
  for select to anon using (true);

-- Realtime: nieuwe events direct naar alle verbonden apparaten pushen
alter publication supabase_realtime add table public.heatboard_events;
