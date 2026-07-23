import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { adminSessionStatusQueryOptions } from '../server/admin-auth'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmDialog } from '../components/confirm-dialog'
import { HistoryTable, shortDocId } from '../components/history-table'
import { SelectionActionBar } from '../components/selection-action-bar'
import { useRecordSelection } from '../hooks/use-record-selection'
import { type RecordStatus, useAppState } from '../state/app-state'
import { DateRangeFilter, type DateRangeState, initialDateRange, matchesDateRange } from '../components/date-range-filter'
import { createHistoryCsv, downloadCsvFile, money, statusLabel } from '../utils/history-utils'
import { downloadCombinedDeliveryNote, downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'

export const Route = createFileRoute('/admin/vorgaenge')({
  beforeLoad: async ({ context }) => {
    const { isAdminLoggedIn } = await context.queryClient.ensureQueryData(adminSessionStatusQueryOptions())
    if (!isAdminLoggedIn) throw redirect({ to: '/admin' })
  },
  component: AdminVorgaengePage,
})

function AdminVorgaengePage() {
  const { companies, records, updateRecordStatus, assignInvoice, assignCancel, generateInvoiceNumber } = useAppState()
  const [companyFilter, setCompanyFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'pickup' | 'dropoff' | 'lkw'>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | RecordStatus>('all')
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeState>(initialDateRange)
  const [pendingAction, setPendingAction] = useState<{ action: () => void; title: string; message: string } | null>(null)
  const [sammelrechnungOpen, setSammelrechnungOpen] = useState(false)
  const [sammelReverseCharge, setSammelReverseCharge] = useState(false)

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
    clearSelection,
  } = useRecordSelection(filteredRecords)

  const selectedTotal = selectedRecords.reduce((sum, r) => sum + r.total, 0)
  const selectedCompanies = Array.from(new Set(selectedRecords.map((r) => r.company)))
  const selectedAllOpenLieferschein = selectedRecords.length > 0 && selectedRecords.every((r) => r.status === 'lieferschein')
  const canCreateInvoice = selectedAllOpenLieferschein && selectedCompanies.length === 1
  const canStorno = selectedAllOpenLieferschein

  function exportSelectedAsCsv() {
    if (selectedRecords.length === 0) return
    const csv = createHistoryCsv(selectedRecords, true)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsvFile(`admin-history-${stamp}.csv`, csv)
  }

  function stornoSelection() {
    selectedRecords.forEach((record) => {
      const cancelId = `ST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${record.id}`
      downloadStornoDoc([record], record.company, cancelId, record.deliveryNoteId)
      assignCancel([record.id], cancelId)
      updateRecordStatus(record.id, 'storniert')
    })
    clearSelection()
  }

  async function createSammelrechnung(isReverseCharge: boolean) {
    if (!canCreateInvoice) return
    const deliveryNoteRefs = selectedRecords.map((r) => r.deliveryNoteId).filter(Boolean).join(', ')
    const customer = companies.find((c) => c.name === selectedCompanies[0])
    const invoiceNo = await generateInvoiceNumber()
    await downloadInvoicePdf(selectedRecords, customer, deliveryNoteRefs, invoiceNo, isReverseCharge)
    selectedRecords.forEach((r) => updateRecordStatus(r.id, 'rechnung'))
    assignInvoice(selectedRecords.map((r) => r.id), invoiceNo, isReverseCharge)
    clearSelection()
  }

  function handleDeliveryNoteClick(deliveryNoteId: string) {
    const group = records.filter((r) => r.deliveryNoteId === deliveryNoteId)
    if (!group.length) return
    const customer = companies.find((c) => c.name === group[0].company)
    downloadCombinedDeliveryNote(group, group[0].company, deliveryNoteId, customer)
  }

  function handleInvoiceClick(invoiceId: string) {
    const group = records.filter((r) => r.invoiceId === invoiceId)
    if (!group.length) return
    const customer = companies.find((c) => c.name === group[0].company)
    downloadInvoicePdf(group, customer, group[0].deliveryNoteId, invoiceId, group[0].invoiceReverseCharge)
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
            <p className="mt-1 text-sm text-slate-600">Alle Annahme- und Verkaufsvorgänge über alle Firmen.</p>
          </div>
          <div className="flex items-center gap-3">
            <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
              {filteredRecords.length} von {records.length} Einträgen
            </p>
            <Link
              to="/admin/neuer-vorgang"
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white no-underline hover:bg-slate-800"
            >
              Neuer Vorgang
            </Link>
          </div>
        </div>

        <SelectionActionBar
          count={selectedCount}
          noun="Eintrag"
          pluralLabel="Einträge"
          total={selectedTotal}
          warning={
            selectedAllOpenLieferschein && selectedCompanies.length > 1
              ? 'Rechnung ist nur möglich, wenn alle markierten Einträge zur gleichen Firma gehören.'
              : undefined
          }
          onClear={clearSelection}
          actions={[
            {
              label: 'CSV Export',
              onClick: exportSelectedAsCsv,
            },
            {
              label: 'Stornieren',
              disabled: !canStorno,
              onClick: () => setPendingAction({
                action: stornoSelection,
                title: 'Lieferscheine stornieren',
                message: `Sind Sie sicher, dass Sie ${selectedRecords.length} ${selectedRecords.length === 1 ? 'Eintrag' : 'Einträge'} stornieren möchten?`,
              }),
            },
            {
              label: 'Rechnung erstellen',
              variant: 'primary',
              disabled: !canCreateInvoice,
              onClick: () => { setSammelReverseCharge(false); setSammelrechnungOpen(true) },
            },
          ]}
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
              onChange={(e) => setTypeFilter(e.target.value as 'all' | 'pickup' | 'dropoff' | 'lkw')}
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
            Keine Einträge für die aktuellen Filter vorhanden.
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

      {sammelrechnungOpen && createPortal(
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSammelrechnungOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-semibold text-slate-900">Rechnung erstellen</h3>
            <p className="mt-2 text-sm text-slate-600">
              {selectedRecords.length} {selectedRecords.length === 1 ? 'Eintrag' : 'Einträge'} für {selectedCompanies[0]} · {money(selectedTotal)}
            </p>
            <label className="mt-4 flex cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                checked={sammelReverseCharge}
                onChange={(e) => setSammelReverseCharge(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              <span className="text-sm font-medium text-slate-700">Reverse Charge (§13b UStG)</span>
            </label>
            {sammelReverseCharge && (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                USt. wird nicht ausgewiesen. Der Hinweis zur Steuerschuldnerschaft des Leistungsempfängers wird auf der Rechnung ergänzt.
              </p>
            )}
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setSammelrechnungOpen(false)}
                className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={() => {
                  createSammelrechnung(sammelReverseCharge)
                  setSammelrechnungOpen(false)
                }}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Rechnung erstellen
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}

      <ConfirmDialog
        open={pendingAction !== null}
        title={pendingAction?.title ?? ''}
        message={pendingAction?.message ?? ''}
        confirmLabel="Ja"
        onConfirm={() => { pendingAction?.action(); setPendingAction(null) }}
        onCancel={() => setPendingAction(null)}
      />
    </section>
  )
}
