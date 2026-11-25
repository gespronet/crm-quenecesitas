-- 003 · Unificar el CUPS duplicado ES0022000004136418ZQ
--
-- Hay dos fichas del mismo suministro (una con espacios), creadas con 40 min de diferencia el 11/10:
--   20c714eb-838a-4def-81fe-ad5fbd470617  "ES 0022 0000 0413 6418 ZQ"  (más antigua, se conserva)
--   b9f5be27-3675-4dbc-afdf-2941b3d41757  "ES0022000004136418ZQ"       (se fusiona y se elimina)
-- Cada una tiene 1 factura y 1 estudio. Se mueven a la ficha que se conserva.
-- Si alguna otra tabla referenciara la ficha duplicada, el DELETE falla por FK y todo se deshace.
-- Ejecutar DESPUÉS de 002.

begin;

update public.energia_facturas set cups_id = '20c714eb-838a-4def-81fe-ad5fbd470617'
 where cups_id = 'b9f5be27-3675-4dbc-afdf-2941b3d41757';
update public.energia_estudios set cups_id = '20c714eb-838a-4def-81fe-ad5fbd470617'
 where cups_id = 'b9f5be27-3675-4dbc-afdf-2941b3d41757';
update public.energia_procesos set cups_id = '20c714eb-838a-4def-81fe-ad5fbd470617'
 where cups_id = 'b9f5be27-3675-4dbc-afdf-2941b3d41757';

-- Completar datos que solo tuviera la duplicada
update public.energia_cups k
   set contact_id = coalesce(k.contact_id, d.contact_id)
  from public.energia_cups d
 where k.id = '20c714eb-838a-4def-81fe-ad5fbd470617'
   and d.id = 'b9f5be27-3675-4dbc-afdf-2941b3d41757';

delete from public.energia_cups where id = 'b9f5be27-3675-4dbc-afdf-2941b3d41757';

-- Guardar el CUPS sin espacios en la ficha conservada
update public.energia_cups set codigo_cups = 'ES0022000004136418ZQ'
 where id = '20c714eb-838a-4def-81fe-ad5fbd470617';

-- Ahora sí: un suministro por CUPS (20 caracteres)
drop index if exists public.energia_cups_cups20_idx;
create unique index energia_cups_cups20_uq
  on public.energia_cups ((left(upper(replace(codigo_cups, ' ', '')), 20)));

commit;
