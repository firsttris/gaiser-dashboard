-- Auto-generated customer numbers (K-0001, K-0002, ...) for both
-- admin-created and self-service-registered companies. Reuses the
-- numbering_settings singleton counter pattern already used for
-- invoice/delivery-note numbers.

alter table public.numbering_settings add column next_customer_number int not null default 1;

create or replace function public.next_customer_number()
returns table(counter int) as $$
  update public.numbering_settings
  set next_customer_number = next_customer_number + 1
  where id = true
  returning next_customer_number - 1;
$$ language sql;
