-- Hosted projects can retain global default ACLs even when public auto-exposure is off.
-- Do not change project-wide defaults or expose private schema through PostgREST.
revoke all privileges on all tables in schema private from anon, authenticated;
revoke all privileges on all sequences in schema private from anon, authenticated;
revoke execute on all functions in schema private from public, anon, authenticated;
-- Only these two RLS predicates are required by policies on public tables.
grant execute on function private.is_staff(uuid,boolean), private.can_read_order(uuid) to anon, authenticated;
do $$ declare relation record; begin
 for relation in select tablename from pg_tables where schemaname='private' loop
  execute format('alter table private.%I enable row level security',relation.tablename);
 end loop;
end $$;
