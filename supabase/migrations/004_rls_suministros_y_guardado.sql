-- 004 · Desbloquear el guardado de la extracción de facturas
--
-- PROBLEMA
--   energia_cups y energia_facturas solo dejan a los usuarios autenticados ver/crear filas con
--   agente_id = auth.uid(). Ninguna fila existente tiene agente_id (todas NULL) y el CRM no lo
--   rellena, así que desde el CRM no se ve ningún suministro ni factura y cualquier alta falla con
--   "new row violates row-level security policy". Además la detección de CUPS/factura duplicados de
--   extract-invoice (que lee con la sesión del usuario) nunca encuentra nada.
--
-- QUÉ HACE
--   1. Sustituye esas políticas por la misma regla que ya usan contacts y energia_procesos:
--      cualquier usuario del CRM (is_crm_user()).
--   2. Amplía las tarifas admitidas a 6.1TD–6.4TD.
--   3. Crea energia_guardar_extraccion(p): guarda contacto + suministro + factura + proceso en una
--      sola transacción (si algo falla no queda un contacto huérfano). Corre con los permisos del
--      usuario (security invoker), así que respeta RLS. Rellena agente_id con quien guarda.
--
-- QUÉ NO HACE
--   No toca las políticas anon (energia_cups_anon, energia_facturas_anon, bucket facturas-energia):
--   siguen pendientes de decidir porque las usan formularios públicos.

begin;

-- 1 ─── Políticas ───────────────────────────────────────────────────────────────
drop policy if exists energia_cups_propios on public.energia_cups;
create policy energia_cups_crm on public.energia_cups
  for all to authenticated
  using (public.is_crm_user()) with check (public.is_crm_user());

drop policy if exists energia_facturas_propias on public.energia_facturas;
create policy energia_facturas_crm on public.energia_facturas
  for all to authenticated
  using (public.is_crm_user()) with check (public.is_crm_user());

-- 2 ─── Tarifas ─────────────────────────────────────────────────────────────────
alter table public.energia_cups drop constraint if exists energia_cups_tarifa_check;
alter table public.energia_cups add constraint energia_cups_tarifa_check
  check (tarifa in ('2.0TD', '3.0TD', '6.1TD', '6.2TD', '6.3TD', '6.4TD'));

-- 3 ─── Guardado atómico ────────────────────────────────────────────────────────
-- p = {
--   proceso_id: uuid|text,
--   contact_id: text|null,              -- si viene, se usa ese contacto
--   contacto:   {name, tipo_cliente, dni_cif, empresa, empresa_razon_social, empresa_cif, empresa_direccion,
--                direccion, localidad, provincia, codigo_postal, comercial_id},   -- si no hay contact_id
--   suministro: {codigo_cups, titular, nif, direccion, poblacion, provincia, codigo_postal, tarifa, distribuidora,
--                cnae, direccion_fiscal, tipo_cliente, comercializadora_actual_id, producto_actual, tipo_producto,
--                permanencia, permanencia_hasta, fecha_fin_contrato, fecha_fin_origen},
--   factura:    {numero_factura, fecha_factura, periodo_inicio, periodo_fin, dias, importe_total, base_imponible,
--                iva_importe, importe_recurrente, potencias_contratadas, consumos, maximetros, precios, lineas,
--                alquiler_equipo, bono_social, comercializadora_id, comercializadora_nombre, producto,
--                lectura_estimada, idioma, confianza, extraccion, archivo_bucket, archivo_path},
--   proceso:    {cups, tarifa_actual, comercializadora_actual, direccion_suministro, factura_url}
-- }
-- devuelve {contact_id, cups_id, factura_id, contacto_nuevo}
create or replace function public.energia_guardar_extraccion(p jsonb)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  c  jsonb := coalesce(p->'contacto', '{}');
  s  jsonb := coalesce(p->'suministro', '{}');
  f  jsonb := coalesce(p->'factura', '{}');
  pr jsonb := coalesce(p->'proceso', '{}');
  v_contact text := nullif(p->>'contact_id', '');
  v_nuevo   boolean := false;
  v_cups    uuid;
  v_fact    uuid;
  v_c20     text;
begin
  if not public.is_crm_user() then raise exception 'No autorizado'; end if;
  if nullif(p->>'proceso_id', '') is null then raise exception 'Falta el proceso'; end if;
  v_c20 := left(upper(replace(coalesce(s->>'codigo_cups', ''), ' ', '')), 20);
  if length(v_c20) < 20 then raise exception 'CUPS no válido'; end if;

  -- Contacto
  if v_contact is null then
    if coalesce(trim(c->>'name'), '') = '' then raise exception 'Falta el nombre del contacto'; end if;
    v_contact := gen_random_uuid()::text;
    insert into contacts (id, name, tipo, tipo_cliente, linea, origen, comercial_id, dni_cif, empresa, empresa_razon_social,
                          empresa_cif, empresa_direccion, direccion, localidad, provincia, codigo_postal, created_at)
    values (v_contact, trim(c->>'name'), 'prospecto', coalesce(c->>'tipo_cliente', 'particular'), array['energia'],
            'Factura energía', nullif(c->>'comercial_id', ''), nullif(c->>'dni_cif', ''), nullif(c->>'empresa', ''),
            nullif(c->>'empresa_razon_social', ''), nullif(c->>'empresa_cif', ''), nullif(c->>'empresa_direccion', ''),
            nullif(c->>'direccion', ''), nullif(c->>'localidad', ''), nullif(c->>'provincia', ''),
            nullif(c->>'codigo_postal', ''), to_char(current_date, 'YYYY-MM-DD'));
    v_nuevo := true;
  end if;

  -- Suministro (uno por CUPS: si ya existe se actualiza; un dato vacío no borra el que había)
  select id into v_cups from energia_cups
   where left(upper(replace(codigo_cups, ' ', '')), 20) = v_c20 limit 1;

  if v_cups is null then
    insert into energia_cups (codigo_cups, tipo_suministro, agente_id, contact_id)
    values (upper(replace(s->>'codigo_cups', ' ', '')), 'luz', auth.uid(), v_contact)
    returning id into v_cups;
  end if;

  update energia_cups set
    codigo_cups               = upper(replace(s->>'codigo_cups', ' ', '')),
    titular                   = coalesce(nullif(s->>'titular', ''), titular),
    nif                       = coalesce(nullif(s->>'nif', ''), nif),
    direccion                 = coalesce(nullif(s->>'direccion', ''), direccion),
    poblacion                 = coalesce(nullif(s->>'poblacion', ''), poblacion),
    provincia                 = coalesce(nullif(s->>'provincia', ''), provincia),
    codigo_postal             = coalesce(nullif(s->>'codigo_postal', ''), codigo_postal),
    tarifa                    = coalesce(nullif(s->>'tarifa', ''), tarifa),
    distribuidora             = coalesce(nullif(s->>'distribuidora', ''), distribuidora),
    cnae                      = coalesce(nullif(s->>'cnae', ''), cnae),
    direccion_fiscal          = coalesce(nullif(s->>'direccion_fiscal', ''), direccion_fiscal),
    tipo_cliente              = coalesce(nullif(s->>'tipo_cliente', ''), tipo_cliente),
    tipo_suministro           = 'luz',
    contact_id                = v_contact,
    comercializadora_actual_id= coalesce(nullif(s->>'comercializadora_actual_id', '')::uuid, comercializadora_actual_id),
    producto_actual           = coalesce(nullif(s->>'producto_actual', ''), producto_actual),
    tipo_producto             = coalesce(nullif(s->>'tipo_producto', ''), tipo_producto),
    permanencia               = coalesce(nullif(s->>'permanencia', ''), permanencia),
    permanencia_hasta         = coalesce(nullif(s->>'permanencia_hasta', '')::date, permanencia_hasta),
    fecha_fin_contrato        = coalesce(nullif(s->>'fecha_fin_contrato', '')::date, fecha_fin_contrato),
    fecha_fin_origen          = coalesce(nullif(s->>'fecha_fin_origen', ''), fecha_fin_origen),
    agente_id                 = coalesce(agente_id, auth.uid())
  where id = v_cups;

  -- Factura (el índice único cups_id + numero_factura impide duplicarla)
  insert into energia_facturas (
    cups_id, numero_factura, fecha_factura, periodo_inicio, periodo_fin, dias, importe_total, base_imponible,
    iva_importe, importe_recurrente, potencias_contratadas, consumos, maximetros, precios, lineas, alquiler_equipo,
    bono_social, comercializadora_id, comercializadora_nombre, producto, lectura_estimada, idioma, confianza,
    extraccion, archivo_bucket, archivo_path, estado_validacion, validada_at, agente_id)
  values (
    v_cups, nullif(f->>'numero_factura', ''), nullif(f->>'fecha_factura', '')::date,
    nullif(f->>'periodo_inicio', '')::date, nullif(f->>'periodo_fin', '')::date,
    nullif(nullif(f->>'dias', ''), '0')::int, nullif(f->>'importe_total', '')::numeric,
    nullif(f->>'base_imponible', '')::numeric, nullif(f->>'iva_importe', '')::numeric,
    nullif(f->>'importe_recurrente', '')::numeric,
    coalesce(f->'potencias_contratadas', '{}'), coalesce(f->'consumos', '{}'), coalesce(f->'maximetros', '{}'),
    coalesce(f->'precios', '{}'), coalesce(f->'lineas', '[]'),
    nullif(f->>'alquiler_equipo', '')::numeric, nullif(f->>'bono_social', '')::numeric,
    nullif(f->>'comercializadora_id', '')::uuid, nullif(f->>'comercializadora_nombre', ''), nullif(f->>'producto', ''),
    coalesce((f->>'lectura_estimada')::boolean, false), nullif(f->>'idioma', ''), nullif(f->>'confianza', '')::numeric,
    f->'extraccion', nullif(f->>'archivo_bucket', ''), nullif(f->>'archivo_path', ''),
    'validada', now(), auth.uid())
  returning id into v_fact;

  -- Proceso
  update energia_procesos set
    contact_id              = v_contact,
    cups                    = upper(replace(s->>'codigo_cups', ' ', '')),
    tarifa_actual           = coalesce(nullif(pr->>'tarifa_actual', ''), tarifa_actual),
    comercializadora_actual = coalesce(nullif(pr->>'comercializadora_actual', ''), comercializadora_actual),
    direccion_suministro    = coalesce(nullif(pr->>'direccion_suministro', ''), direccion_suministro),
    factura_url             = coalesce(nullif(pr->>'factura_url', ''), factura_url),
    tipo_suministro         = 'luz',
    cups_id                 = v_cups,
    factura_id              = v_fact
  where id::text = p->>'proceso_id';
  if not found then raise exception 'No se encontró el proceso'; end if;

  return jsonb_build_object('contact_id', v_contact, 'cups_id', v_cups, 'factura_id', v_fact, 'contacto_nuevo', v_nuevo);
end $$;

revoke execute on function public.energia_guardar_extraccion(jsonb) from public, anon;
grant execute on function public.energia_guardar_extraccion(jsonb) to authenticated;

commit;
