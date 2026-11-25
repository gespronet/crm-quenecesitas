-- 002 · Fase 1: factura -> contacto + suministro + proceso
--
-- Solo añade columnas, índices y un bucket nuevo. No borra ni cambia datos existentes,
-- salvo rellenar cups_id / contact_id donde la coincidencia es inequívoca.
-- Consolida sobre las tablas que ya existen:
--   contacto   = contacts
--   suministro = energia_cups
--   factura    = energia_facturas
--   proceso    = energia_procesos

begin;

-- ─── Bucket privado para las facturas ─────────────────────────────────────────
-- (facturas-energia es público y energia-documentos tiene una política anon: no se usan para esto)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('energia-facturas', 'energia-facturas', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy crm_energia_facturas on storage.objects
  for all to authenticated
  using (bucket_id = 'energia-facturas' and public.is_crm_user())
  with check (bucket_id = 'energia-facturas' and public.is_crm_user());

-- ─── Suministro (energia_cups) ────────────────────────────────────────────────
alter table public.energia_cups
  add column if not exists contact_id text references public.contacts(id) on delete set null,
  add column if not exists cnae text,
  add column if not exists direccion_fiscal text,
  add column if not exists producto_actual text,
  add column if not exists tipo_producto text not null default 'desconocido'
    check (tipo_producto in ('fijo', 'indexado', 'desconocido')),
  add column if not exists permanencia text not null default 'desconocida'
    check (permanencia in ('sin_permanencia', 'con_permanencia', 'desconocida')),
  add column if not exists permanencia_hasta date,
  add column if not exists fecha_fin_origen text
    check (fecha_fin_origen in ('factura', 'cliente', 'estimada', 'manual')),
  add column if not exists seguimiento text not null default 'ninguno'
    check (seguimiento in ('ninguno', 'vigilancia', 'contratado')),
  add column if not exists seguimiento_desde date,
  add column if not exists consentimiento_seguimiento_at timestamptz;

create index if not exists energia_cups_contact_idx on public.energia_cups (contact_id);
-- Índice NO único por ahora: hay un CUPS duplicado (ES0022000004136418ZQ) que hay que unificar antes.
create index if not exists energia_cups_cups20_idx
  on public.energia_cups ((left(upper(replace(codigo_cups, ' ', '')), 20)));

-- ─── Factura (energia_facturas) ───────────────────────────────────────────────
alter table public.energia_facturas
  add column if not exists archivo_bucket text,
  add column if not exists archivo_path text,
  add column if not exists comercializadora_id uuid references public.energia_comercializadoras(id),
  add column if not exists comercializadora_nombre text,
  add column if not exists producto text,
  add column if not exists lineas jsonb not null default '[]'::jsonb,
  add column if not exists base_imponible numeric,
  add column if not exists iva_importe numeric,
  add column if not exists importe_recurrente numeric,
  add column if not exists lectura_estimada boolean not null default false,
  add column if not exists idioma text,
  add column if not exists confianza numeric,
  add column if not exists extraccion jsonb,
  add column if not exists estado_validacion text not null default 'validada'
    check (estado_validacion in ('pendiente', 'validada', 'descartada')),
  add column if not exists validada_at timestamptz;

-- Las 10 facturas existentes quedan como 'validada'; las nuevas entran como 'pendiente'.
alter table public.energia_facturas alter column estado_validacion set default 'pendiente';

-- Evita cargar dos veces la misma factura de un suministro (comprobado: hoy no hay duplicados).
create unique index if not exists energia_facturas_cups_numero_uq
  on public.energia_facturas (cups_id, numero_factura)
  where numero_factura is not null;

-- ─── Proceso (energia_procesos) ───────────────────────────────────────────────
alter table public.energia_procesos
  add column if not exists cups_id uuid references public.energia_cups(id) on delete set null,
  add column if not exists factura_id uuid references public.energia_facturas(id) on delete set null,
  add column if not exists estudio_id uuid references public.energia_estudios(id) on delete set null;

create index if not exists energia_procesos_cups_idx on public.energia_procesos (cups_id);
create index if not exists energia_procesos_contact_idx on public.energia_procesos (contact_id);
create index if not exists energia_procesos_estado_idx on public.energia_procesos (estado);

-- Enlazar procesos existentes con su suministro por CUPS (si hay duplicados, el más antiguo).
update public.energia_procesos p
   set cups_id = c.id
  from (
    select distinct on (left(upper(replace(codigo_cups, ' ', '')), 20))
           id, left(upper(replace(codigo_cups, ' ', '')), 20) as cups20
      from public.energia_cups
     order by left(upper(replace(codigo_cups, ' ', '')), 20), created_at, id
  ) c
 where p.cups_id is null
   and coalesce(p.cups, '') <> ''
   and left(upper(replace(p.cups, ' ', '')), 20) = c.cups20;

-- Heredar el contacto del proceso cuando el suministro solo tiene un contacto posible.
update public.energia_cups c
   set contact_id = x.contact_id
  from (
    select cups_id, min(contact_id) as contact_id
      from public.energia_procesos
     where cups_id is not null and contact_id is not null
     group by cups_id
    having count(distinct contact_id) = 1
  ) x
 where c.id = x.cups_id and c.contact_id is null;

-- Y, para el resto, por NIF/CIF cuando coincide exactamente con un solo contacto.
update public.energia_cups c
   set contact_id = m.contact_id
  from (
    select c2.id as cups_id, min(k.id) as contact_id
      from public.energia_cups c2
      join public.contacts k
        on upper(replace(coalesce(k.dni_cif, ''), ' ', '')) = upper(replace(c2.nif, ' ', ''))
        or upper(replace(coalesce(k.empresa_cif, ''), ' ', '')) = upper(replace(c2.nif, ' ', ''))
     where c2.contact_id is null and coalesce(c2.nif, '') <> ''
     group by c2.id
    having count(distinct k.id) = 1
  ) m
 where c.id = m.cups_id;

commit;
