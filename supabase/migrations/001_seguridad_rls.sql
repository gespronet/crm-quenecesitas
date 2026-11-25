-- 001 · Seguridad: activar RLS en contacts y energia_procesos
--
-- Estado actual: ambas tablas tienen RLS desactivado, así que cualquiera con la clave anon
-- (que va en el frontend) puede leerlas y modificarlas. Contiene nombres, teléfonos, emails y DNI/CIF.
--
-- Comprobado antes de escribir esto:
--  · Últimas 24 h: todas las llamadas a estas tablas vienen de navegadores (el CRM), ninguna de n8n/servidor.
--  · Los 3 usuarios de auth tienen ficha en public.users, así que public.is_crm_user() los deja pasar.
--
-- Después de aplicar: abrir el CRM, cargar Contactos y Energía y crear/editar un proceso.
-- Rollback inmediato si algo falla:
--   alter table public.contacts disable row level security;
--   alter table public.energia_procesos disable row level security;

begin;

alter table public.contacts enable row level security;
alter table public.energia_procesos enable row level security;

create policy crm_users_all on public.contacts
  for all to authenticated
  using (public.is_crm_user())
  with check (public.is_crm_user());

create policy crm_users_all on public.energia_procesos
  for all to authenticated
  using (public.is_crm_user())
  with check (public.is_crm_user());

commit;
