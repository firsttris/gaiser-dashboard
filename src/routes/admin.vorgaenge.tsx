import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { HistoryTable, shortDocId } from '../components/history-table'
import { useRecordSelection } from '../hooks/use-record-selection'
import { type RecordStatus, useAppState } from '../state/app-state'
import { DateRangeFilter, type DateRangeState, initialDateRange, matchesDateRange } from '../components/date-range-filter'
import { createHistoryCsv, downloadCsvFile, statusLabel } from '../utils/history-utils'
import { downloadCombinedDeliveryNote, downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'
import { RecordActionsBar } from '../components/record-actions-bar'

export const Route = createFileRoute('/admin/vorgaenge')({ component: AdminVorgaengePage })

function AdminVorgaengePage() {
  const { companies, records, updateRecordStatus, assignDeliveryNote } = useAppState()
  const [companyFilter, setCompanyFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'dropoff'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | RecordStatus>('all')
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeState>(initialDateRange)

  const companyOptions = useMemo(
    () => companies.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'de')),
    [companies],
  )

  const statusOptions = useMemo(
    () => Array.from(new Set(records.map((r) => r.status))).sort((a, b) => a.localeCompare(b, 'de')),
    [records],
  )

  const filteredRecords = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('de-DE')
    return records.filter((record) => {
      if (companyFilter !== 'all' && record.company !== companyFilter) return false
      if (typeFilter !== 'all' && record.type !== typeFilter) return false
      if (statusFilter !== 'all' && record.status !== statusFilter) return false
      if (!matchesDateRange(record.createdAt, dateRange)) return false
      if (!query) return true
      const haystack = `${record.constructionSiteName} ${shortDocId(record.deliveryNoteId ?? '')} ${shortDocId(record.invoiceId ?? '')} ${shortDocId(record.cancelId ?? '')}`.toLocaleLowerCase('de-DE')
      return haystack.includes(query)
    })
  }, [companyFilter, records, searchText, statusFilter, typeFilter, dateRange])

  const {
    selectedSet,
    selectedRecords,
    selectedCount,
    areAllVisibleSelected,
    toggleRecordSelection,
    selectAllVisible,
    deselectVisible,
  } = useRecordSelection(filteredRecords)

  const selectedCompanies = Array.from(new Set(selectedRecords.map((r) => r.company)))
  const selectedHaveDeliveryNote = selectedRecords.some((r) => r.deliveryNoteId)
  const canCreateCompanyDocuments = selectedRecords.length > 0 && selectedCompanies.length === 1 && !selectedHaveDeliveryNote

  function exportSelectedAsCsv() {
    if (selectedRecords.length === 0) return
    const csv = createHistoryCsv(selectedRecords, true)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsvFile(`admin-history-${stamp}.csv`, csv)
  }

  function createDeliveryNotes() {
    if (selectedRecords.length === 0 || selectedCompanies.length !== 1) return
    const deliveryNoteId = `LS-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${selectedRecords[0].id}`
    assignDeliveryNote(selectedRecords.map((r) => r.id), deliveryNoteId)
    selectedRecords.forEach((r) => updateRecordStatus(r.id, 'lieferschein'))
    downloadCombinedDeliveryNote(selectedRecords, selectedCompanies[0], deliveryNoteId)
  }

  function handleDeliveryNoteClick(deliveryNoteId: string) {
    const group = records.filter((r) => r.deliveryNoteId === deliveryNoteId)
    if (!group.length) return
    downloadCombinedDeliveryNote(group, group[0].company, deliveryNoteId)
  }

  function handleInvoiceClick(invoiceId: string) {
    const group = records.filter((r) => r.invoiceId === invoiceId)
    if (!group.length) return
    const shortCode = companies.find((c) => c.name === group[0].company)?.shortCode
    downloadInvoicePdf(group, shortCode, group[0].deliveryNoteId, invoiceId, group[0].invoiceReverseCharge)
  }

  function handleCancelClick(cancelId: string) {
    const group = records.filter((r) => r.cancelId === cancelId)
    if (!group.length) return
    downloadStornoDoc(group, group[0].company, cancelId, group[0].invoiceId ?? group[0].deliveryNoteId)
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-title text-4xl text-slate-900">Vorgänge</h2>
            <p className="mt-1 text-sm text-slate-600">Alle Annahme- und Verkaufsvorgaenge ueber alle Firmen.</p>
          </div>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {filteredRecords.length} von {records.length} Eintraegen
          </p>
        </div>

        <RecordActionsBar
          selectedCount={selectedCount}
          canCreateDeliveryNote={canCreateCompanyDocuments}
          selectedHaveDeliveryNote={selectedHaveDeliveryNote}
          multipleCompaniesSelected={selectedCompanies.length > 1}
          onCreateDeliveryNote={createDeliveryNotes}
          onExportCsv={exportSelectedAsCsv}
        />

        <div className="mt-4 grid gap-3 md:grid-cols-4 lg:grid-cols-5">
          <label className="text-sm font-semibold text-slate-700">
            Firma
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
            >
              <option value="all">Alle Firmen</option>
              {companyOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Typ
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'pickup' | 'dropoff')}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
            >
              <option value="all">Alle Typen</option>
              <option value="dropoff">Annahme</option>
              <option value="pickup">Verkauf</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | RecordStatus)}
              className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
            >
              <option value="all">Alle Status</option>
              {statusOptions.map((s) => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Suche
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Baustelle, LS-/RG-/ST-Nummer"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>

        {filteredRecords.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Eintraege fuer die aktuellen Filter vorhanden.
          </p>
        ) : (
          <HistoryTable
            records={filteredRecords}
            selectedSet={selectedSet}
            areAllVisibleSelected={areAllVisibleSelected}
            onSelectAll={(checked) => (checked ? selectAllVisible() : deselectVisible())}
            onToggle={toggleRecordSelection}
            showCompanyColumn
            onDeliveryNoteClick={handleDeliveryNoteClick}
            onInvoiceClick={handleInvoiceClick}
            onCancelClick={handleCancelClick}
          />
        )}
      </article>
    </section>
  )
}
