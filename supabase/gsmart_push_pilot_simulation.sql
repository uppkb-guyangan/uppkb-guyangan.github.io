-- Private, separate G-Smart FCM simulation ledger.
-- Never change ETLE source tables, existing baseline or production login.
create table if not exists public.gsmart_push_pilot_simulation(
  event_key text primary key check(event_key like 'gsmart-sim-v1:%'),
  event_type text not null check(event_type in ('blanko','dispute','shipping_processing')),
  status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text
);
alter table public.gsmart_push_pilot_simulation enable row level security;
revoke all on public.gsmart_push_pilot_simulation from public,anon,authenticated;
grant select,insert,update on public.gsmart_push_pilot_simulation to service_role;
