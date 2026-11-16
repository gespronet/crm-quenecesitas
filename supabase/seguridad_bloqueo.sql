-- ═══ Bloqueo de seguridad · CRM Qué necesitas hoy ═══
-- Ejecutar SOLO cuando el CRM nuevo (login con Supabase Auth) esté subido a Hostinger.

-- 1) Tablas del CRM: solo usuarios del CRM con sesión iniciada
do $$
declare t text;
begin
  foreach t in array array[
    'activity_durations','alarm_contract_docs_adt','alarm_contracts','alarm_contracts_adt','auction_clients','auction_documents',
    'auction_interactions','auctions','collaborators','contacts','contratos_arras','daily_notes','deals','documents','energia_procesos',
    'energy_contract_docs','energy_contracts','energy_invoices','energy_studies','interactions','mandatos','npl_activos','npl_assets',
    'npl_investors','npl_portfolio_investors','npl_portfolios','products','properties','property_documents','property_photos',
    'quote_items','quotes','schedules','subasta_users','supply_points','tasks','telefonia_contratos','venta_directa','weekly_goals',
    'weekly_plans','weekly_template_blocks','weekly_templates',
    'energia_cups','energia_documentos','energia_estudios','energia_facturas','energia_proceso_contratacion','energia_retrocomision',
    'energia_comercializadoras','energia_ofertas','web_leads']
  loop
    execute format('alter table public.%I enable row level security', t);
    perform 1;
    -- borrar políticas anteriores (todas eran abiertas)
    declare p record; begin
      for p in select policyname from pg_policies where schemaname='public' and tablename=t loop
        execute format('drop policy %I on public.%I', p.policyname, t);
      end loop;
    end;
    execute format('create policy crm_acceso on public.%I for all to authenticated using (public.is_crm_user() or public.is_erp_user()) with check (public.is_crm_user() or public.is_erp_user())', t);
  end loop;
end $$;

-- Web pública: solo fotos de inmuebles publicados (los datos van por la vista properties_web)
create policy web_fotos on public.property_photos for select to anon
  using (exists (select 1 from public.properties p where p.id::text = property_photos.property_id::text and p.publicado_web));
-- Catálogos de energía de solo lectura para la web
create policy web_catalogo on public.energia_ofertas for select to anon using (true);
create policy web_catalogo on public.energia_comercializadoras for select to anon using (true);

-- 2) Usuarios: sin contraseñas en la base de datos; solo admin/socio gestionan el equipo
alter table public.users enable row level security;
do $$ declare p record; begin for p in select policyname from pg_policies where schemaname='public' and tablename='users' loop execute format('drop policy %I on public.users', p.policyname); end loop; end $$;
create policy users_ver on public.users for select to authenticated using (public.is_crm_user());
create policy users_gestion on public.users for all to authenticated
  using (public.crm_role() in ('admin','socio')) with check (public.crm_role() in ('admin','socio'));
create policy users_propio on public.users for update to authenticated
  using (auth_id = auth.uid()) with check (auth_id = auth.uid() and role = (select u.role from public.users u where u.auth_id = auth.uid()));
alter table public.users drop column if exists password;

-- 3) ERP de Gespronet (gn_*): solo la cuenta del ERP
do $$ declare p record; begin
  for p in select tablename, policyname from pg_policies where schemaname='public' and tablename like 'gn\_%' and qual = 'true' loop
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
    execute format('create policy erp_acceso on public.%I for all to authenticated using (public.is_erp_user()) with check (public.is_erp_user())', p.tablename);
  end loop;
end $$;

-- 4) Funciones: nada ejecutable por visitantes anónimos
do $$ declare f record; begin
  for f in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' loop
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated, service_role', f.sig);
  end loop;
end $$;

-- 5) Almacenamiento
drop policy if exists "Permitir lectura documentos" on storage.objects;
drop policy if exists "Permitir borrado documentos" on storage.objects;
drop policy if exists "Permitir lectura energy" on storage.objects;
drop policy if exists "Permitir subida documentos" on storage.objects;
drop policy if exists "Lectura publica documentos" on storage.objects;
drop policy if exists "Permitir lectura publica fotos" on storage.objects;
drop policy if exists "energia_docs_storage_anon" on storage.objects;
drop policy if exists "Allow anon select" on storage.objects;
drop policy if exists "Allow anon update" on storage.objects;
create policy crm_documentos on storage.objects for all to authenticated
  using (bucket_id in ('documentos','energia-documentos','facturas-energia','presupuestos-pdf') and public.is_crm_user())
  with check (bucket_id in ('documentos','energia-documentos','facturas-energia','presupuestos-pdf') and public.is_crm_user());
create policy web_fotos_inmuebles on storage.objects for select to anon
  using (bucket_id = 'documentos' and name like 'properties/%/fotos/%');
