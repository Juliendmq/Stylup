-- Garde-fous du rendu IA (fonctions réservées au rôle service, non appelables depuis l'app) : chaque appel est réservé AVANT d'appeler Gemini, dans une transaction verrouillée,
-- en vérifiant 4 plafonds (compte : par minute et par jour ; global : par jour et par mois).
-- Un rendu en échec est « remboursé » (il ne compte plus). Seule la fonction serveur (service_role) y accède.

create table public.render_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'ok', 'error')),
  created_at  timestamptz not null default now()
);
create index render_events_user_time on public.render_events (user_id, created_at desc);
create index render_events_time on public.render_events (created_at desc);
alter table public.render_events enable row level security; -- aucune règle : invisible depuis l'app



create or replace function public.stylup_reserve_render(
  p_user uuid, lim_user_minute int, lim_user_day int, lim_global_day int, lim_global_month int)
returns table (ok boolean, reason text, event_id uuid, user_left int, global_left int)
language plpgsql security definer set search_path = ''
as $$
declare
  t_day   timestamptz := date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
  t_month timestamptz := date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris';
  n_user_min int; n_user_day int; n_glob_day int; n_glob_month int; new_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext('stylup_render_quota'));
  select count(*) filter (where created_at > now() - interval '1 minute' and user_id = p_user),
         count(*) filter (where created_at >= t_day and user_id = p_user),
         count(*) filter (where created_at >= t_day),
         count(*)
    into n_user_min, n_user_day, n_glob_day, n_glob_month
    from public.render_events where created_at >= t_month and status <> 'error';
  if n_glob_month >= lim_global_month then return query select false, 'monthly_limit', null::uuid, 0, 0; return; end if;
  if n_glob_day   >= lim_global_day   then return query select false, 'daily_limit',   null::uuid, 0, 0; return; end if;
  if n_user_day   >= lim_user_day     then return query select false, 'user_limit',    null::uuid, 0, lim_global_day - n_glob_day; return; end if;
  if n_user_min   >= lim_user_minute  then return query select false, 'minute_limit',  null::uuid, lim_user_day - n_user_day, lim_global_day - n_glob_day; return; end if;
  insert into public.render_events (user_id) values (p_user) returning id into new_id;
  return query select true, null::text, new_id, lim_user_day - n_user_day - 1, least(lim_global_day - n_glob_day, lim_global_month - n_glob_month) - 1;
end $$;

create or replace function public.stylup_finish_render(p_event uuid, p_ok boolean)
returns void language sql security definer set search_path = ''
as $$ update public.render_events set status = case when p_ok then 'ok' else 'error' end where id = p_event $$;

-- Quota restant d'un compte, sans rien réserver (affichage dans l'app)
create or replace function public.stylup_render_quota(p_user uuid, lim_user_day int, lim_global_day int, lim_global_month int)
returns table (user_left int, global_left int)
language sql stable security definer set search_path = ''
as $$
  with b as (select date_trunc('day', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' as d,
                    date_trunc('month', now() at time zone 'Europe/Paris') at time zone 'Europe/Paris' as m),
  c as (select count(*) filter (where e.created_at >= b.d and e.user_id = p_user) as ud,
               count(*) filter (where e.created_at >= b.d) as gd, count(*) as gm
          from public.render_events e, b where e.created_at >= b.m and e.status <> 'error')
  select greatest(0, lim_user_day - ud)::int, greatest(0, least(lim_global_day - gd, lim_global_month - gm))::int from c
$$;

revoke all on function public.stylup_reserve_render(uuid, int, int, int, int) from public, anon, authenticated;
revoke all on function public.stylup_finish_render(uuid, boolean) from public, anon, authenticated;
revoke all on function public.stylup_render_quota(uuid, int, int, int) from public, anon, authenticated;
grant execute on function public.stylup_reserve_render(uuid, int, int, int, int) to service_role;
grant execute on function public.stylup_finish_render(uuid, boolean) to service_role;
grant execute on function public.stylup_render_quota(uuid, int, int, int) to service_role;

