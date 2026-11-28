-- Reversión de 202611280033_platform_operator.sql. Probada en tests/db/platform-rollback.test.ts (sube, baja y vuelve a subir).
drop policy if exists platform_audit_read on public.platform_audit;
drop table if exists public.platform_audit;
drop function if exists private.audit(text,text,text,uuid,uuid,jsonb,jsonb);
drop function if exists private.audit_append_only();
drop function if exists public.platform_is_operator_email(text);
drop function if exists public.platform_access(boolean);
drop function if exists private.require_platform(boolean);
drop function if exists private.platform_mfa_recent();
drop function if exists private.is_platform_operator();
drop table if exists private.platform_operators;
drop function if exists private.platform_operators_guard();
