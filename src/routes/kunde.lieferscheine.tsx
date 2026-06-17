import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo } from 'react'
import { DateRangeFilter } from '../components/date-range-filter'
import { DocLinkButton } from '../components/doc-link-button'
import { DocumentListTable } from '../components/document-list-table'
import { PageShell } from '../components/page-shell'
import { TopNav } from '../components/top-nav'
import { useDocumentGroupFilters } from '../hooks/use-document-group-filters'
import { type RecordItem, useAppState } from '../state/app-state'
import { downloadCombinedDeliveryNote, downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'
import { deliveryNoteBadge, deliveryNoteStatusFilterOf, reverseChargeExtraBadges } from '../utils/history-utils'

export const Route = createFileRoute('/kunde/lieferscheine')({ component: LieferscheinePage })

function LieferscheinePage() {
  const { isLoggedIn, records, selectedCompany } = useAppState()

  const companyRecords = useMemo(
    () => records.filter((r) => r.company === selectedCompany?.name),
    [records, selectedCompany],
  )

  const {
    statusFilter, setStatusFilter,
    searchText, setSearchText,
    dateRange, setDateRange,
    allGroups, filteredGroups,
  } = useDocumentGroupFilters(companyRecords, 'deliveryNoteId', deliveryNoteStatusFilterOf)

  function renderDateien(id: string, items: RecordItem[]) {
    const cancelId = items.find((r) => r.cancelId)?.cancelId
    return (
      <>
        <DocLinkButton id={id} color="amber" onClick={() => downloadCombinedDeliveryNote(items, selectedCompany?.name ?? '', id)} />
        {items[0].invoiceId && (
          <DocLinkButton
            id={items[0].invoiceId}
            color="blue"
            onClick={() => {
              const group = companyRecords.filter((r) => r.invoiceId === items[0].invoiceId)
              downloadInvoicePdf(group, selectedCompany?.shortCode, id, items[0].invoiceId, items[0].invoiceReverseCharge)
            }}
          />
        )}
        {cancelId && (
          <DocLinkButton id={cancelId} color="red" onClick={() => downloadStornoDoc(items, selectedCompany?.name ?? '', cancelId, id)} />
        )}
      </>
    )
  }

  if (!isLoggedIn) {
    return (
      <PageShell>
        <TopNav />
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <h1 className="font-title text-5xl text-slate-900">Bitte zuerst einloggen</h1>
          <p className="mt-2 text-slate-600">Die Lieferscheine sind nur nach Firmen-PIN verfügbar.</p>
          <Link to="/" className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white no-underline">
            Zum Login
          </Link>
        </section>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <TopNav />
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-title text-5xl text-slate-900">Lieferscheine</h1>
            <p className="mt-1 text-sm text-slate-600">Alle Lieferscheine fuer {selectedCompany?.name}.</p>
          </div>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {filteredGroups.length} von {allGroups.length} Lieferschein{allGroups.length !== 1 ? 'en' : ''}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="text-sm font-semibold text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
            >
              <option value="all">Alle Status</option>
              <option value="offen">Offen</option>
              <option value="berechnet">In Rechnung gestellt</option>
              <option value="storniert">Storniert</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Suche
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Lieferschein-Nummer"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>

        {filteredGroups.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Lieferscheine fuer die aktuellen Filter vorhanden.
          </p>
        ) : (
          <DocumentListTable
            groups={filteredGroups}
            showTotalColumn={false}
            getBadge={deliveryNoteBadge}
            getExtraBadges={reverseChargeExtraBadges}
            renderDateien={renderDateien}
          />
        )}
      </section>
    </PageShell>
  )
}
