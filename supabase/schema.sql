-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query).
-- See /home/tristan/.claude/plans/resilient-honking-candy.md for the full Phase 1 plan.

create extension if not exists pgcrypto;

create table public.companies (
  id                  uuid primary key default gen_random_uuid(),
  short_code          text not null unique,
  name                text not null,
  customer_number     text not null default '',
  street              text not null default '',
  postal_code         text not null default '',
  city                text not null default '',
  price_category      text not null check (price_category in ('private', 'business')),
  pin_hash            text not null,
  failed_pin_attempts int not null default 0,
  pin_locked_until    timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index companies_short_code_lower_idx on public.companies (lower(short_code));

create or replace function public.set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger companies_set_updated_at
  before update on public.companies
  for each row execute function public.set_updated_at();

-- Public-safe view for the pre-login company search box (views run with the
-- owner's privileges by default, i.e. security_invoker = false, so this exposes
-- exactly these 3 columns regardless of the base table's RLS policies below).
create view public.companies_public as
  select id, short_code, name from public.companies;

-- Single-admin allow-list. RLS below only lets a signed-in user check their
-- own membership row, not enumerate all admins.
create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.companies enable row level security;
alter table public.admin_users enable row level security;

-- Lock the base table down, then re-grant only to `authenticated` so the RLS
-- policy below has something to actually govern. `anon` gets nothing on the
-- base table — it only ever sees `companies_public`. The service_role key
-- (used by the customer PIN-login server function) bypasses RLS entirely by
-- default in Postgres/Supabase, so it is unaffected by these grants.
revoke all on public.companies from anon, authenticated;
grant select, insert, update, delete on public.companies to authenticated;

create policy "admins manage companies" on public.companies
  for all
  to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

create policy "admin can check own membership" on public.admin_users
  for select
  to authenticated
  using (user_id = auth.uid());

grant select on public.companies_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Manual one-time steps after running this file (Supabase dashboard):
--
-- 1. Authentication → Providers → Email → turn OFF "Allow new users to sign up".
-- 2. Authentication → Users → Add user → create the one admin account
--    (your email + a real password).
-- 3. Copy that user's UUID and run:
--      insert into public.admin_users (user_id) values ('<uuid-here>');
-- 4. Seed company rows, e.g.:
--      insert into public.companies (short_code, name, price_category, pin_hash)
--      values ('KR', 'Krampfert Wohnbau GmbH', 'business', '<bcrypt-hash-of-a-4-digit-pin>');
--    Generate a bcrypt hash for a PIN with:
--      node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 1234
-- ---------------------------------------------------------------------------
