-- STAGING ONLY. Review/apply to a non-production project before deployment.
-- Contains no operational data; records only UID, action, scope and request UUID.
begin;
create table public.gita_developer_jobs (
  request_id uuid primary key,
  actor_uid text not null,
  action text not null check (action in ('audit','fix')),
  scope text not null check (scope in ('aplikasi','gita','pwa','blanko','persidangan','analitik','simulasi')),
  state text not null default 'queued' check (state in ('queued','dispatch_uncertain')),
  created_at timestamptz not null default now()
);
alter table public.gita_developer_jobs enable row level security;
revoke all on public.gita_developer_jobs from public, anon, authenticated;
grant select, insert, update on public.gita_developer_jobs to service_role;
create index gita_developer_jobs_created_idx on public.gita_developer_jobs (created_at);
create function public.gita_claim_developer_job(p_uid text, p_id uuid, p_action text, p_scope text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare previous public.gita_developer_jobs; n integer;
begin
  -- Global lock makes concurrent retries and quotas atomic across edge instances.
  perform pg_advisory_xact_lock(719333005);
  select * into previous from public.gita_developer_jobs where request_id = p_id;
  if found then
    if previous.actor_uid <> p_uid or previous.action <> p_action or previous.scope <> p_scope then
      raise exception 'REQUEST_CONFLICT';
    end if;
    return jsonb_build_object('fresh',false,'state',previous.state);
  end if;
  select count(*) into n from public.gita_developer_jobs where created_at >= now() - interval '24 hours';
  if n >= 10 then raise exception 'RATE_LIMITED'; end if;
  select count(*) into n from public.gita_developer_jobs where actor_uid=p_uid and created_at >= now() - interval '24 hours';
  if n >= 3 or exists(select 1 from public.gita_developer_jobs where actor_uid=p_uid and created_at > now() - interval '60 seconds') then
    raise exception 'RATE_LIMITED';
  end if;
  insert into public.gita_developer_jobs(request_id,actor_uid,action,scope) values(p_id,p_uid,p_action,p_scope);
  return jsonb_build_object('fresh',true,'state','queued');
end;
$$;
revoke all on function public.gita_claim_developer_job(text,uuid,text,text) from public, anon, authenticated;
grant execute on function public.gita_claim_developer_job(text,uuid,text,text) to service_role;
commit;
-- Retention: administrators may manually remove metadata older than 30 days.
