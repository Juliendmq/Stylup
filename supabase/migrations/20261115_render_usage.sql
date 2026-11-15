-- Plafond quotidien de rendus (protège la facture tant qu'il n'y a pas de vrais comptes côté serveur)
create table if not exists public.render_usage (
  day   date primary key,
  count integer not null default 0
);
alter table public.render_usage enable row level security; -- aucune règle : seule la fonction serveur y accède

create or replace function public.stylup_bump_usage(max_per_day integer)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  insert into render_usage(day, count) values (current_date, 1)
  on conflict (day) do update set count = render_usage.count + 1
  returning count into n;
  if n > max_per_day then
    update render_usage set count = count - 1 where day = current_date;
    return -1;
  end if;
  return n;
end $$;

revoke execute on function public.stylup_bump_usage(integer) from public, anon, authenticated;
