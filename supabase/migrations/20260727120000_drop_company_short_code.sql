-- short_code was dropped from the app's Company model; the pre-login search
-- box now matches on name instead. companies_public depends on the column,
-- so it has to be dropped and recreated around the ALTER.
drop view public.companies_public;

alter table public.companies drop column short_code;

create view public.companies_public as
  select id, name from public.companies;
