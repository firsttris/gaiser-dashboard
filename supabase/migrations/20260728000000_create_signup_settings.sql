-- Singleton settings row for the self-service customer signup flow, holding
-- the shared "master PIN" that gates account creation (see registrieren.tsx /
-- customerSignUp). Mirrors the numbering_settings singleton pattern.

create table public.signup_settings (
  id                  boolean primary key default true,
  master_pin_hash     text not null,
  failed_pin_attempts int not null default 0,
  pin_locked_until    timestamptz,
  updated_at          timestamptz not null default now(),
  constraint signup_settings_singleton check (id)   -- only one row can ever exist
);

create trigger signup_settings_set_updated_at
  before update on public.signup_settings
  for each row execute function public.set_updated_at();

alter table public.signup_settings enable row level security;
revoke all on public.signup_settings from anon, authenticated;
-- No policies at all: neither anon nor authenticated (i.e. a signed-in admin's
-- own token) can touch this table under any circumstance. Only service_role
-- (used via getServiceSupabaseClient() in adminSetMasterPin/customerSignUp)
-- bypasses RLS and can read/write it.

-- Seed row required because master_pin_hash is not null. CHANGE THIS
-- IMMEDIATELY after running this migration, via Admin -> Einstellungen ->
-- "Master-PIN für Kunden-Registrierung". Placeholder PIN is 1234, hash
-- generated with:
--   node -e "console.log(require('bcryptjs').hashSync(process.argv[1], 12))" 1234
insert into public.signup_settings (id, master_pin_hash)
values (true, '$2b$12$7LodHLo8etxaAgMXoz9kBO4RalWZLIEfMYA59sOMb6j90ZXCZlTga');
