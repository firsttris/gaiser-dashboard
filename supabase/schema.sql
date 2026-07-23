-- Run this once in the Supabase SQL editor (Dashboard → SQL Editor → New query)
-- for a fresh project. Covers the full schema: companies/auth plus the
-- product/truck/construction-site/record/numbering domain data.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Companies + admin allow-list
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- Products, trucks, construction sites, records, numbering settings
--
-- Note: price/amount columns use `double precision` rather than `numeric` so
-- PostgREST returns plain JS numbers (numeric would come back as strings and
-- require parsing everywhere arithmetic happens on prices/totals).
-- ---------------------------------------------------------------------------

create table public.products (
  id serial primary key,
  name text not null,
  unit text not null,
  flow text not null check (flow in ('pickup', 'dropoff')),
  pickup_private_price double precision not null default 0,
  pickup_business_price double precision not null default 0,
  dropoff_private_price double precision not null default 0,
  dropoff_business_price double precision not null default 0,
  created_at timestamptz not null default now()
);

create table public.trucks (
  id serial primary key,
  name text not null,
  private_price double precision not null default 0,
  business_price double precision not null default 0,
  created_at timestamptz not null default now()
);

create table public.construction_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
create unique index construction_sites_name_lower_idx on public.construction_sites (lower(name));

create table public.records (
  id bigserial primary key,
  company_id uuid not null references public.companies(id),
  company_name text not null,               -- denormalized snapshot; cascades on company rename
  construction_site_id uuid references public.construction_sites(id),
  construction_site_name text not null,      -- denormalized snapshot; cascades on site rename
  type text not null check (type in ('pickup', 'dropoff', 'lkw')),
  product_name text not null,                -- denormalized snapshot; cascades on product/truck rename
  amount double precision not null,
  unit text not null,
  unit_price double precision not null,      -- frozen at creation, never recalculated
  total double precision not null,           -- frozen at creation, never recalculated
  status text not null check (status in ('offen', 'lieferschein', 'rechnung', 'bezahlt', 'storniert')),
  created_at timestamptz not null default now(),
  delivery_note_id text,
  invoice_id text,
  invoice_reverse_charge boolean not null default false,
  cancel_id text
);
create index records_company_id_idx on public.records (company_id);
create index records_delivery_note_id_idx on public.records (delivery_note_id);
create index records_invoice_id_idx on public.records (invoice_id);

create table public.numbering_settings (
  id boolean primary key default true,
  invoice_template text not null,
  delivery_note_template text not null,
  next_invoice_number int not null,
  next_delivery_note_number int not null,
  number_padding int not null,
  constraint numbering_settings_singleton check (id)   -- only one row can ever exist
);
insert into public.numbering_settings (id, invoice_template, delivery_note_template, next_invoice_number, next_delivery_note_number, number_padding)
values (true, 'RG-{JAHR}{MONAT}{TAG}-{NUMMER}', 'LS-{JAHR}{MONAT}{TAG}-{NUMMER}', 1, 1, 4);

-- Atomic counters (UPDATE...RETURNING is a single locked statement — safe
-- under concurrent admin + customer record creation, unlike read-then-write).
create or replace function public.next_delivery_note_number()
returns table(template text, counter int, padding int) as $$
  update public.numbering_settings
  set next_delivery_note_number = next_delivery_note_number + 1
  where id = true
  returning delivery_note_template, next_delivery_note_number - 1, number_padding;
$$ language sql;

create or replace function public.next_invoice_number()
returns table(template text, counter int, padding int) as $$
  update public.numbering_settings
  set next_invoice_number = next_invoice_number + 1
  where id = true
  returning invoice_template, next_invoice_number - 1, number_padding;
$$ language sql;

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- anon gets nothing on any base table except companies_public — there is no
-- other pre-login read path. service_role (used for all dual-mode
-- admin-or-customer server functions, e.g. record creation) bypasses RLS
-- entirely by default in Postgres/Supabase, so it is unaffected by these
-- grants.
-- ---------------------------------------------------------------------------

alter table public.companies enable row level security;
alter table public.admin_users enable row level security;
alter table public.products enable row level security;
alter table public.trucks enable row level security;
alter table public.construction_sites enable row level security;
alter table public.records enable row level security;
alter table public.numbering_settings enable row level security;

revoke all on public.companies, public.products, public.trucks, public.construction_sites, public.records, public.numbering_settings
  from anon, authenticated;
grant select, insert, update, delete on public.companies, public.products, public.trucks, public.construction_sites, public.records, public.numbering_settings
  to authenticated;

create policy "admins manage companies" on public.companies for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "admin can check own membership" on public.admin_users
  for select to authenticated
  using (user_id = auth.uid());
create policy "admins manage products" on public.products for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "admins manage trucks" on public.trucks for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "admins manage construction sites" on public.construction_sites for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "admins manage records" on public.records for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));
create policy "admins manage numbering settings" on public.numbering_settings for all to authenticated
  using (exists (select 1 from public.admin_users a where a.user_id = auth.uid()))
  with check (exists (select 1 from public.admin_users a where a.user_id = auth.uid()));

grant select on public.companies_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Seed data (equivalent of the old localStorage seed arrays). Adjust/remove
-- as needed — this just gets a fresh project to the same starting point the
-- app used to boot with.
-- ---------------------------------------------------------------------------

insert into public.products (id, name, unit, flow, pickup_private_price, pickup_business_price, dropoff_private_price, dropoff_business_price) values
  (1,  'Unbewehrter Betonschutt, Pflastersteine, Stahlbeton', 't',  'dropoff', 0,    0,    8,  8),
  (3,  'Stark bewehrter Betonschutt',                          't',  'dropoff', 0,    0,    45, 45),
  (4,  'Bituminöser Straßenaufbruch',                          't',  'dropoff', 0,    0,    15, 15),
  (5,  'Gemischter Bauschutt',                                 't',  'dropoff', 0,    0,    25, 25),
  (6,  'Aushub',                                               'm³', 'dropoff', 0,    0,    45, 40),
  (7,  'Aushub mit Bauschutt o.ä. vermischt',                  'm³', 'dropoff', 0,    0,    60, 60),
  (8,  'Betonrecycling 0/45 FSS-STS',                          't',  'pickup',  10,   8,    0,  0),
  (9,  'Bauschuttrecycling 0/56',                              't',  'pickup',  0,    0,    0,  0),
  (10, 'Gesiebt Mutterboden',                                  't',  'pickup',  12.5, 8.5,  0,  0),
  (11, 'Rollkies 8/16',                                        't',  'pickup',  27,   24.2, 0,  0),
  (12, 'Mischkies 0/16',                                       't',  'pickup',  29,   25.3, 0,  0),
  (13, 'Sand 0/2',                                             't',  'pickup',  28,   24.4, 0,  0),
  (14, 'Schwemmsand',                                          't',  'pickup',  18,   15.5, 0,  0),
  (15, 'Mineralgemisch 0/16',                                  't',  'pickup',  24,   16.7, 0,  0),
  (16, 'Mineralgemisch 0/32',                                  't',  'pickup',  22,   15.1, 0,  0),
  (17, 'Splitt 2/5',                                           't',  'pickup',  27,   20.4, 0,  0);
select setval('products_id_seq', (select max(id) from public.products));

insert into public.trucks (name, private_price, business_price) values
  ('LKW 3-Achser inkl. Maut', 90, 90);

insert into public.construction_sites (name) values
  ('Nordring 12, Berlin'),
  ('Hafenallee 8, Potsdam');

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
