-- invoice_groups was created without the revoke/grant pair every other view
-- and table in this schema gets, so it inherited Supabase's default grants to
-- anon/authenticated and, being a plain (non security_invoker) view, ran with
-- the view owner's privileges instead of the querying role's — bypassing the
-- RLS policy on public.records entirely. Lock it down the same way
-- public.records itself is locked down: authenticated only, RLS enforced.

revoke all on public.invoice_groups from anon, authenticated;
grant select on public.invoice_groups to authenticated;
alter view public.invoice_groups set (security_invoker = true);
