import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { HistoryTable, shortDocId } from '../components/history-table'
import { PageShell } from '../components/page-shell'
import { useRecordSelection } from '../hooks/use-record-selection'
import { TopNav } from '../components/top-nav'
import { useAppState } from '../state/app-state'
import { DateRangeFilter, type DateRangeState, initialDateRange, matchesDateRange } from '../components/date-range-filter'
import { companyFilenameSegment, createHistoryCsv, downloadCsvFile } from '../utils/history-utils'
import { downloadCombinedDeliveryNote, downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'
import { SelectionActionBar } from '../components/selection-action-bar'

export const Route = createFileRoute('/kunde/vorgaenge')({ component: HistoryPage })

function HistoryPage() {
  const { isLoggedIn, records, selectedCompany } = useAppState()
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'dropoff' | 'lkw'>('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeState>(initialDateRange)

  const companyRecords = records.filter((record) => record.company === selectedCompany?.name)

  const statusOptions = useMemo(() => {
    return Array.from(new Set(companyRecords.map((record) => record.status))).sort((a, b) => a.localeCompare(b, 'de'))
  }, [companyRecords])

  const filteredRecords = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('de-DE')

    return companyRecords.filter((record) => {
      if (typeFilter !== 'all' && record.type !== typeFilter) return false
      if (statusFilter !== 'all' && record.status !== statusFilter) return false

      if (!matchesDateRange(record.createdAt, dateRange)) return false
      if (!query) return true

      const haystack = `${record.constructionSiteName} ${shortDocId(record.deliveryNoteId ?? '')} ${shortDocId(record.invoiceId ?? '')} ${shortDocId(record.cancelId ?? '')}`.toLocaleLowerCase('de-DE')
      return haystack.includes(query)
    })
  }, [companyRecords, searchText, statusFilter, typeFilter, dateRange])

  const {
    selectedSet,
    selectedRecords,
    selectedCount,
    areAllVisibleSelected,
    toggleRecordSelection,
    selectAllVisible,
    deselectVisible,
    clearSelection,
  } = useRecordSelection(filteredRecords)

  const selectedTotal = selectedRecords.reduce((sum, r) => sum + r.total, 0)
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null)

  async function handleDeliveryNoteClick(deliveryNoteId: string) {
    const group = companyRecords.filter((r) => r.deliveryNoteId === deliveryNoteId)
    if (group.length === 0) return
    setDownloadingDocId(deliveryNoteId)
    try {
      await downloadCombinedDeliveryNote(group, selectedCompany?.name ?? '', deliveryNoteId, selectedCompany ?? undefined)
    } finally {
      setDownloadingDocId(null)
    }
  }

  async function handleInvoiceClick(invoiceId: string) {
    const group = companyRecords.filter((r) => r.invoiceId === invoiceId)
    if (group.length === 0) return
    setDownloadingDocId(invoiceId)
    try {
      await downloadInvoicePdf(group, selectedCompany ?? undefined, group[0].deliveryNoteId, invoiceId)
    } finally {
      setDownloadingDocId(null)
    }
  }

  function handleCancelClick(cancelId: string) {
    const group = companyRecords.filter((r) => r.cancelId === cancelId)
    if (group.length === 0) return
    downloadStornoDoc(group, selectedCompany?.name ?? '', cancelId, group[0].invoiceId ?? group[0].deliveryNoteId)
  }

  function exportSelectedAsCsv() {
    if (selectedRecords.length === 0) return

    const csv = createHistoryCsv(selectedRecords, false)
    const stamp = new Date().toISOString().slice(0, 10)
    const company = companyFilenameSegment(selectedCompany?.name)
    downloadCsvFile(`history-${company}-${stamp}.csv`, csv)
  }

  if (!isLoggedIn) {
    return (
      <PageShell>
        <TopNav />
        <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
          <h1 className="font-title text-5xl text-slate-900">Bitte zuerst einloggen</h1>
          <p className="mt-2 text-slate-600">Die Vorgänge sind nur nach Firmen-PIN verfügbar.</p>
          <Link
            to="/"
            className="mt-5 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white no-underline"
          >
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
            <h1 className="font-title text-5xl text-slate-900">Vorgänge</h1>
            <p className="mt-1 text-sm text-slate-600">Alle Annahme- und Verkaufsvorgänge für {selectedCompany?.name}.</p>
          </div>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {filteredRecords.length} von {companyRecords.length} Einträgen
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <label className="text-sm font-semibold text-slate-700">
            Typ
            <select
              value={typeFilter}
              onChange={(event) => setTypeFilter(event.target.value as 'all' | 'pickup' | 'dropoff' | 'lkw')}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
            >
              <option value="all">Alle Typen</option>
              <option value="dropoff">Annahme</option>
              <option value="pickup">Verkauf</option>
              <option value="lkw">LKW</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
            >
              <option value="all">Alle Status</option>
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Suche
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Baustelle, LS-/RG-/ST-Nummer"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>

        <SelectionActionBar
          count={selectedCount}
          noun="Eintrag"
          pluralLabel="Einträge"
          total={selectedTotal}
          onClear={clearSelection}
          actions={[
            {
              label: 'CSV Export',
              onClick: exportSelectedAsCsv,
            },
          ]}
        />

        {filteredRecords.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Einträge für die aktuellen Filter vorhanden.
          </p>
        ) : (
          <HistoryTable
            records={filteredRecords}
            selectedSet={selectedSet}
            areAllVisibleSelected={areAllVisibleSelected}
            onSelectAll={(checked) => (checked ? selectAllVisible() : deselectVisible())}
            onToggle={toggleRecordSelection}
            onDeliveryNoteClick={(id) => void handleDeliveryNoteClick(id)}
            onInvoiceClick={(id) => void handleInvoiceClick(id)}
            onCancelClick={handleCancelClick}
            downloadingDocId={downloadingDocId}
          />
        )}
      </section>
    </PageShell>
  )
}
