-- Fonction d'aide des règles RLS rangée hors de l'API publique (non appelable via /rest/v1/rpc)
create schema if not exists private;
grant usage on schema private to authenticated;
alter function public.my_salon_ids() set schema private;
