-- Schéma de l'app Stylup : salons, membres, profils, catalogue personnalisé, sessions clientes, photos.
-- Toutes les tables sont protégées par RLS : chaque compte ne voit que les données de ses salons.

-- Profil d'un compte (créé automatiquement à l'inscription)
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  first_name  text not null default '' check (char_length(first_name) <= 60),
  lang        text not null default 'fr' check (lang in ('fr', 'en', 'it', 'es', 'de')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Établissement : une seule activité par salon
create table public.salons (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  city        text not null check (char_length(city) between 1 and 120),
  trade       text not null check (trade in ('hair', 'nails', 'lashes')),
  created_by  uuid not null default auth.uid() references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Membres d'un salon (le créateur est « owner » ; prêt pour inviter des collaborateurs plus tard)
create table public.salon_members (
  salon_id    uuid not null references public.salons (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  role        text not null default 'owner' check (role in ('owner', 'staff')),
  created_at  timestamptz not null default now(),
  primary key (salon_id, user_id)
);
create index salon_members_user_idx on public.salon_members (user_id);

-- Catalogue : éléments ajoutés par le salon (couleurs maison, coupes femme / homme)
create table public.catalog_items (
  id          uuid primary key default gen_random_uuid(),
  salon_id    uuid not null references public.salons (id) on delete cascade,
  kind        text not null check (kind in ('color', 'cut_f', 'cut_h')),
  name        text not null check (char_length(name) between 1 and 120),
  description text check (char_length(description) <= 240),
  tone        smallint check (tone between 1 and 10),
  reflet      smallint check (reflet between 0 and 8),
  hidden      boolean not null default false,
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint color_has_shade check (kind <> 'color' or (tone is not null and reflet is not null))
);
create index catalog_items_salon_idx on public.catalog_items (salon_id, kind, position);

-- Catalogue : éléments standards masqués par le salon (ex. « tone:1 », « f:shape:pixie »)
create table public.catalog_hidden (
  salon_id    uuid not null references public.salons (id) on delete cascade,
  item_key    text not null check (char_length(item_key) <= 80),
  created_at  timestamptz not null default now(),
  primary key (salon_id, item_key)
);

-- Sessions clientes (photos rangées dans le stockage « session-photos », dossier = id du salon)
create table public.client_sessions (
  id                uuid primary key default gen_random_uuid(),
  salon_id          uuid not null references public.salons (id) on delete cascade,
  created_by        uuid default auth.uid() references auth.users (id) on delete set null,
  client_first_name text check (char_length(client_first_name) <= 60),
  client_gender     text check (client_gender in ('f', 'h', 'n')),
  services          text[] not null default '{}',
  choices           jsonb not null default '{}'::jsonb,
  title             text check (char_length(title) <= 200),
  subtitle          text check (char_length(subtitle) <= 200),
  photo_path        text,
  render_path       text,
  after_path        text,
  rating            smallint check (rating between 1 and 5),
  consent_photo     boolean not null default false,
  created_at        timestamptz not null default now()
);
create index client_sessions_salon_idx on public.client_sessions (salon_id, created_at desc);

-- Salons dont l'utilisateur connecté est membre (utilisé par toutes les règles d'accès)
create or replace function public.my_salon_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$ select salon_id from public.salon_members where user_id = (select auth.uid()) $$;
revoke execute on function public.my_salon_ids() from public, anon;
grant execute on function public.my_salon_ids() to authenticated;

-- Mise à jour automatique de updated_at
create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger salons_touch before update on public.salons for each row execute function public.touch_updated_at();
create trigger catalog_items_touch before update on public.catalog_items for each row execute function public.touch_updated_at();

-- Création du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Le créateur d'un salon en devient automatiquement propriétaire
create or replace function public.handle_new_salon()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.salon_members (salon_id, user_id, role) values (new.id, new.created_by, 'owner') on conflict do nothing;
  return new;
end $$;
revoke execute on function public.handle_new_salon() from public, anon, authenticated;
create trigger on_salon_created after insert on public.salons for each row execute function public.handle_new_salon();

-- Règles d'accès (RLS)
alter table public.profiles        enable row level security;
alter table public.salons          enable row level security;
alter table public.salon_members   enable row level security;
alter table public.catalog_items   enable row level security;
alter table public.catalog_hidden  enable row level security;
alter table public.client_sessions enable row level security;

create policy "profil : lecture du sien"      on public.profiles for select to authenticated using (id = (select auth.uid()));
create policy "profil : modification du sien" on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "salon : lecture si membre"    on public.salons for select to authenticated using (id in (select public.my_salon_ids()) or created_by = (select auth.uid()));
create policy "salon : création"             on public.salons for insert to authenticated with check (created_by = (select auth.uid()));
create policy "salon : modification membre"  on public.salons for update to authenticated using (id in (select public.my_salon_ids())) with check (id in (select public.my_salon_ids()));

create policy "membres : lecture si membre"  on public.salon_members for select to authenticated using (salon_id in (select public.my_salon_ids()));

create policy "catalogue perso : membres" on public.catalog_items for all to authenticated
  using (salon_id in (select public.my_salon_ids())) with check (salon_id in (select public.my_salon_ids()));
create policy "catalogue masqué : membres" on public.catalog_hidden for all to authenticated
  using (salon_id in (select public.my_salon_ids())) with check (salon_id in (select public.my_salon_ids()));
create policy "sessions : membres" on public.client_sessions for all to authenticated
  using (salon_id in (select public.my_salon_ids())) with check (salon_id in (select public.my_salon_ids()));

-- Stockage privé des photos de session : chemin « <salon_id>/<fichier> »
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('session-photos', 'session-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "photos : lecture membres" on storage.objects for select to authenticated
  using (bucket_id = 'session-photos' and (storage.foldername(name))[1] in (select s::text from public.my_salon_ids() s));
create policy "photos : ajout membres" on storage.objects for insert to authenticated
  with check (bucket_id = 'session-photos' and (storage.foldername(name))[1] in (select s::text from public.my_salon_ids() s));
create policy "photos : suppression membres" on storage.objects for delete to authenticated
  using (bucket_id = 'session-photos' and (storage.foldername(name))[1] in (select s::text from public.my_salon_ids() s));
