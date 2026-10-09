-- Isolated G-Smart push pilot; no existing table or policy modified.
create table if not exists public.gsmart_push_pilot_cursor(
  id text primary key check(id='pilot'),
  snapshot jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.gsmart_push_pilot_delivery(
  event_key text primary key,
  event_type text not null check(event_type in ('blanko','dispute','shipping_processing')),
  case_id uuid not null,
  title text not null,
  body text not null,
  status text not null default 'pending' check(status in ('pending','sending','sent','failed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz,
  last_error text
);
create index if not exists gsmart_push_pilot_delivery_pending_idx
  on public.gsmart_push_pilot_delivery(created_at) where status='pending';
alter table public.gsmart_push_pilot_cursor enable row level security;
alter table public.gsmart_push_pilot_delivery enable row level security;
revoke all on public.gsmart_push_pilot_cursor from public,anon,authenticated;
revoke all on public.gsmart_push_pilot_delivery from public,anon,authenticated;
grant select,insert,update on public.gsmart_push_pilot_cursor to service_role;
grant select,insert,update on public.gsmart_push_pilot_delivery to service_role;
