import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmDialog } from '../components/confirm-dialog'
import { DateRangeFilter, type DateRangeState, initialDateRange, matchesDateRange } from '../components/date-range-filter'
import { DocumentListTable, type BadgeConfig } from '../components/document-list-table'
import { type RecordItem, useAppState } from '../state/app-state'
import { groupAllByDocId, money, statusBadge } from '../utils/history-utils'
import { downloadCombinedDeliveryNote, downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'
import { shortDocId } from '../components/history-table'

export const Route = createFileRoute('/admin/lieferscheine')({ component: AdminLieferscheinePage })

type StatusFilter = 'all' | 'offen' | 'berechnet' | 'storniert'

function getBadge(items: RecordItem[]): BadgeConfig {
  const statuses = new Set(items.map((r) => r.status))
  if (statuses.size === 1 && statuses.has('storniert')) return statusBadge('storniert')
  if (statuses.has('bezahlt')) return statusBadge('bezahlt')
  if (statuses.has('rechnung')) return statusBadge('rechnung')
  return statusBadge('lieferschein')
}

function AdminLieferscheinePage() {
  const { companies, records, updateRecordStatus, assignInvoice, assignCancel } = useAppState()
  const [pendingAction, setPendingAction] = useState<{ action: () => void; title: string; message: string } | null>(null)
  const [companyFilter, setCompanyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeState>(initialDateRange)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [sammelrechnungOpen, setSammelrechnungOpen] = useState(false)
  const [sammelReverseCharge, setSammelReverseCharge] = useState(false)

  const companyOptions = useMemo(
    () => companies.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'de')),
    [companies],
  )

  const allGroups = useMemo(() => groupAllByDocId(records, 'deliveryNoteId'), [records])

  const filteredGroups = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('de-DE')
    return allGroups.filter((g) => {
      if (companyFilter !== 'all' && g.items[0].company !== companyFilter) return false
      if (statusFilter !== 'all') {
        const badge = getBadge(g.items)
        const groupStatus: StatusFilter = badge.label === 'Storniert' ? 'storniert' : (badge.label === 'Rechnung' || badge.label === 'Bezahlt') ? 'berechnet' : 'offen'
        if (groupStatus !== statusFilter) return false
      }
      if (query && !g.id.toLocaleLowerCase('de-DE').includes(query)) return false
      if (!matchesDateRange(g.items[0].createdAt, dateRange)) return false
      return true
    })
  }, [allGroups, companyFilter, statusFilter, searchText, dateRange])

  function cancelDeliveryNoteGroup(items: typeof records) {
    const cancelId = `ST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${items[0].id}`
    downloadStornoDoc(items, items[0].company, cancelId, items[0].deliveryNoteId)
    assignCancel(items.map((r) => r.id), cancelId)
    items.forEach((r) => updateRecordStatus(r.id, 'storniert'))
  }

  function isSelectableGroup(items: RecordItem[]) {
    return getBadge(items).label !== 'Storniert'
  }

  const selectedGroups = useMemo(
    () => allGroups.filter((g) => selectedIds.has(g.id)),
    [allGroups, selectedIds],
  )
  const selectedCompanies = useMemo(
    () => new Set(selectedGroups.map((g) => g.items[0].company)),
    [selectedGroups],
  )
  const selectedTotal = useMemo(
    () => selectedGroups.reduce((sum, g) => sum + g.items.reduce((s, r) => s + r.total, 0), 0),
    [selectedGroups],
  )
  const selectedAllOpen = useMemo(
    () => selectedGroups.length > 0 && selectedGroups.every((g) => getBadge(g.items).label === 'Lieferschein'),
    [selectedGroups],
  )

  function toggleSelection(id: string, checked: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (checked) next.add(id)
      else next.delete(id)
      return next
    })
  }

  function stornoSelection() {
    selectedGroups.forEach((g) => cancelDeliveryNoteGroup(g.items))
    setSelectedIds(new Set())
  }

  function createSammelrechnung(isReverseCharge: boolean) {
    const invoiceItems = selectedGroups.flatMap((g) => g.items)
    const deliveryNoteRefs = selectedGroups.map((g) => g.id).join(', ')
    const shortCode = companies.find((c) => c.name === invoiceItems[0].company)?.shortCode
    const invoiceNo = downloadInvoicePdf(invoiceItems, shortCode, deliveryNoteRefs, undefined, isReverseCharge)
    invoiceItems.forEach((r) => updateRecordStatus(r.id, 'rechnung'))
    assignInvoice(invoiceItems.map((r) => r.id), invoiceNo, isReverseCharge)
    setSelectedIds(new Set())
  }

  function renderDateien(id: string, items: RecordItem[]) {
    const invoiceId = items.find((r) => r.invoiceId)?.invoiceId
    const cancelId = items.find((r) => r.cancelId)?.cancelId
    return (
      <>
        <button
          type="button"
          onClick={() => downloadCombinedDeliveryNote(items, items[0].company, id)}
          className="cursor-pointer rounded bg-amber-100 px-1 py-0.5 font-mono text-xs text-amber-700 hover:opacity-75"
        >
          {shortDocId(id)}
        </button>
        {invoiceId && (
          <button
            type="button"
            onClick={() => {
              const group = items.filter((r) => r.invoiceId === invoiceId)
              downloadInvoicePdf(group, items[0].company, id, invoiceId, items[0].invoiceReverseCharge)
            }}
            className="cursor-pointer rounded bg-blue-100 px-1 py-0.5 font-mono text-xs text-blue-700 hover:opacity-75"
          >
            {shortDocId(invoiceId)}
          </button>
        )}
        {cancelId && (
          <button
            type="button"
            onClick={() => downloadStornoDoc(items, items[0].company, cancelId, id)}
            className="cursor-pointer rounded bg-red-100 px-1 py-0.5 font-mono text-xs text-red-700 hover:opacity-75"
          >
            {shortDocId(cancelId)}
          </button>
        )}
      </>
    )
  }

  return (
    <section className="space-y-5">
      <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-title text-4xl text-slate-900">Lieferscheine</h2>
            <p className="mt-1 text-sm text-slate-600">Alle Lieferscheine ueber alle Firmen.</p>
          </div>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {filteredGroups.length} von {allGroups.length} Lieferschein{allGroups.length !== 1 ? 'en' : ''}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-4">
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
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
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

        {selectedIds.size > 0 && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3">
            <div className="text-sm text-emerald-800">
              <span className="font-semibold">{selectedIds.size} Lieferschein{selectedIds.size !== 1 ? 'e' : ''}</span> ausgewaehlt
              {' · '}
              <span className="font-semibold">{money(selectedTotal)}</span>
              {selectedCompanies.size > 1 && (
                <span className="ml-2 font-semibold text-amber-700">
                  Achtung: Lieferscheine gehoeren zu {selectedCompanies.size} verschiedenen Firmen.
                </span>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
              >
                Auswahl aufheben
              </button>
              <button
                type="button"
                onClick={() => setPendingAction({
                  action: stornoSelection,
                  title: 'Lieferscheine stornieren',
                  message: `Sind Sie sicher, dass Sie ${selectedGroups.length} Lieferschein${selectedGroups.length !== 1 ? 'e' : ''} stornieren möchten?`,
                })}
                className="rounded-xl bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-300"
              >
                Stornieren
              </button>
              <button
                type="button"
                disabled={selectedCompanies.size !== 1 || !selectedAllOpen}
                onClick={() => { setSammelReverseCharge(false); setSammelrechnungOpen(true) }}
                className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
              >
                Sammelrechnung erstellen
              </button>
            </div>
          </div>
        )}

        {filteredGroups.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Lieferscheine fuer die aktuellen Filter vorhanden.
          </p>
        ) : (
          <DocumentListTable
            groups={filteredGroups}
            showCompanyColumn
            getBadge={getBadge}
            renderDateien={renderDateien}
            selectedIds={selectedIds}
            onSelectionChange={toggleSelection}
            isSelectable={isSelectableGroup}
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
            <h3 className="font-semibold text-slate-900">Sammelrechnung erstellen</h3>
            <p className="mt-2 text-sm text-slate-600">
              {selectedGroups.length} Lieferschein{selectedGroups.length !== 1 ? 'e' : ''} fuer {selectedGroups[0]?.items[0].company} · {money(selectedTotal)}
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
                USt. wird nicht ausgewiesen. Der Hinweis zur Steuerschuldnerschaft des Leistungsempfaengers wird auf der Rechnung ergaenzt.
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
                Sammelrechnung erstellen
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
