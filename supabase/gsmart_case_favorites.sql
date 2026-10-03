-- G-Smart: watched/favorite cases per Firebase user
create table if not exists public.gsmart_case_favorites (
  user_uid text not null,
  case_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_uid, case_id)
);

create index if not exists gsmart_case_favorites_user_created_idx
  on public.gsmart_case_favorites (user_uid, created_at desc);

alter table public.gsmart_case_favorites enable row level security;

grant select, insert, delete on public.gsmart_case_favorites to anon, authenticated;

drop policy if exists favorites_select_own on public.gsmart_case_favorites;
create policy favorites_select_own
on public.gsmart_case_favorites for select
to public
using (user_uid = coalesce(auth.jwt() ->> 'sub',''));

drop policy if exists favorites_insert_own on public.gsmart_case_favorites;
create policy favorites_insert_own
on public.gsmart_case_favorites for insert
to public
with check (user_uid = coalesce(auth.jwt() ->> 'sub',''));

drop policy if exists favorites_delete_own on public.gsmart_case_favorites;
create policy favorites_delete_own
on public.gsmart_case_favorites for delete
to public
using (user_uid = coalesce(auth.jwt() ->> 'sub',''));
