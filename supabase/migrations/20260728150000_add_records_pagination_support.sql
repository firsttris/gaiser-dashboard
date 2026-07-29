-- Supports server-side filtering/pagination of the Vorgänge/Rechnungen lists:
-- indexes for the new status/type/date filters, and a view that aggregates
-- records into invoice groups (an invoice isn't its own table — it's the set
-- of records sharing an invoice_id) so pagination can happen per invoice
-- instead of per raw row.

create index if not exists records_status_idx on public.records (status);
create index if not exists records_type_idx on public.records (type);
create index if not exists records_created_at_idx on public.records (created_at);

-- status is grouped, not aggregated: every mutation in the app (assignInvoice,
-- "als bezahlt markieren", Stornieren) sets it for every record of an invoice
-- together, so all rows sharing an invoice_id always carry the same status in
-- practice. Exposing it as a plain grouped column (instead of a CASE/bool_or
-- computed from the aggregate) lets Postgres push status filters down before
-- the GROUP BY instead of evaluating them on every row of every invoice on
-- every query.
create view public.invoice_groups as
select
  invoice_id,
  company_id,
  min(company_name) as company_name,
  max(created_at) as created_at,
  sum(total) as total,
  count(*) as item_count,
  bool_or(invoice_reverse_charge) as invoice_reverse_charge,
  status
from public.records
where invoice_id is not null
group by invoice_id, company_id, status;
