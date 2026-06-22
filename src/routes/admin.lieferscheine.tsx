import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { ConfirmDialog } from '../components/confirm-dialog'
import { DateRangeFilter } from '../components/date-range-filter'
import { DocLinkButton } from '../components/doc-link-button'
import { DocumentListTable } from '../components/document-list-table'
import { SelectionActionBar } from '../components/selection-action-bar'
import { useDocumentGroupFilters } from '../hooks/use-document-group-filters'
import { useGroupSelection } from '../hooks/use-group-selection'
import { type RecordItem, useAppState } from '../state/app-state'
import { downloadCombinedDeliveryNote, downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'
import { createHistoryCsv, deliveryNoteBadge, deliveryNoteStatusFilterOf, downloadCsvFile, money, reverseChargeExtraBadges } from '../utils/history-utils'

export const Route = createFileRoute('/admin/lieferscheine')({ component: AdminLieferscheinePage })

function AdminLieferscheinePage() {
  const { companies, records, updateRecordStatus, assignInvoice, assignCancel } = useAppState()
  const [pendingAction, setPendingAction] = useState<{ action: () => void; title: string; message: string } | null>(null)
  const [sammelrechnungOpen, setSammelrechnungOpen] = useState(false)
  const [sammelReverseCharge, setSammelReverseCharge] = useState(false)

  const companyOptions = useMemo(
    () => companies.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'de')),
    [companies],
  )

  const {
    companyFilter, setCompanyFilter,
    statusFilter, setStatusFilter,
    searchText, setSearchText,
    dateRange, setDateRange,
    allGroups, filteredGroups,
  } = useDocumentGroupFilters(records, 'deliveryNoteId', deliveryNoteStatusFilterOf, { withCompanyFilter: true })

  const { selectedIds, selectedGroups, selectedTotal, toggleSelection, selectAllVisible, deselectVisible, clearSelection } = useGroupSelection(allGroups)

  const selectedCompanies = useMemo(
    () => new Set(selectedGroups.map((g) => g.items[0].company)),
    [selectedGroups],
  )
  const selectedAllOpen = useMemo(
    () => selectedGroups.length > 0 && selectedGroups.every((g) => deliveryNoteBadge(g.items).label === 'Lieferschein'),
    [selectedGroups],
  )

  function isSelectableGroup(items: RecordItem[]) {
    return deliveryNoteBadge(items).label !== 'Storniert'
  }

  const selectableFilteredGroups = useMemo(
    () => filteredGroups.filter((g) => isSelectableGroup(g.items)),
    [filteredGroups],
  )
  const areAllVisibleSelected = selectableFilteredGroups.length > 0 && selectableFilteredGroups.every((g) => selectedIds.has(g.id))

  function cancelDeliveryNoteGroup(items: typeof records) {
    const cancelId = `ST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${items[0].id}`
    downloadStornoDoc(items, items[0].company, cancelId, items[0].deliveryNoteId)
    assignCancel(items.map((r) => r.id), cancelId)
    items.forEach((r) => updateRecordStatus(r.id, 'storniert'))
  }

  function stornoSelection() {
    selectedGroups.forEach((g) => cancelDeliveryNoteGroup(g.items))
    clearSelection()
  }

  async function createSammelrechnung(isReverseCharge: boolean) {
    const invoiceItems = selectedGroups.flatMap((g) => g.items)
    const deliveryNoteRefs = selectedGroups.map((g) => g.id).join(', ')
    const customerNumber = companies.find((c) => c.name === invoiceItems[0].company)?.customerNumber
    const invoiceNo = await downloadInvoicePdf(invoiceItems, customerNumber, deliveryNoteRefs, undefined, isReverseCharge)
    invoiceItems.forEach((r) => updateRecordStatus(r.id, 'rechnung'))
    assignInvoice(invoiceItems.map((r) => r.id), invoiceNo, isReverseCharge)
    clearSelection()
  }

  function exportSelectedAsCsv() {
    if (selectedGroups.length === 0) return
    const csv = createHistoryCsv(selectedGroups.flatMap((g) => g.items), true)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsvFile(`admin-lieferscheine-${stamp}.csv`, csv)
  }

  function renderDateien(id: string, items: RecordItem[]) {
    const invoiceId = items.find((r) => r.invoiceId)?.invoiceId
    const cancelId = items.find((r) => r.cancelId)?.cancelId
    const customerNumber = companies.find((c) => c.name === items[0].company)?.customerNumber
    return (
      <>
        <DocLinkButton id={id} color="amber" onClick={() => downloadCombinedDeliveryNote(items, items[0].company, id)} />
        {invoiceId && (
          <DocLinkButton
            id={invoiceId}
            color="blue"
            onClick={() => {
              const group = items.filter((r) => r.invoiceId === invoiceId)
              downloadInvoicePdf(group, customerNumber, id, invoiceId, items[0].invoiceReverseCharge)
            }}
          />
        )}
        {cancelId && (
          <DocLinkButton id={cancelId} color="red" onClick={() => downloadStornoDoc(items, items[0].company, cancelId, id)} />
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

        <SelectionActionBar
          count={selectedIds.size}
          noun="Lieferschein"
          pluralSuffix="e"
          total={selectedTotal}
          warning={selectedCompanies.size > 1 ? `Achtung: Lieferscheine gehoeren zu ${selectedCompanies.size} verschiedenen Firmen.` : undefined}
          onClear={clearSelection}
          actions={[
            {
              label: 'CSV Export',
              onClick: exportSelectedAsCsv,
            },
            {
              label: 'Stornieren',
              onClick: () => setPendingAction({
                action: stornoSelection,
                title: 'Lieferscheine stornieren',
                message: `Sind Sie sicher, dass Sie ${selectedGroups.length} Lieferschein${selectedGroups.length !== 1 ? 'e' : ''} stornieren möchten?`,
              }),
            },
            {
              label: 'Rechnung erstellen',
              variant: 'primary',
              disabled: selectedCompanies.size !== 1 || !selectedAllOpen,
              onClick: () => { setSammelReverseCharge(false); setSammelrechnungOpen(true) },
            },
          ]}
        />

        {filteredGroups.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Lieferscheine fuer die aktuellen Filter vorhanden.
          </p>
        ) : (
          <DocumentListTable
            groups={filteredGroups}
            showCompanyColumn
            showTotalColumn={false}
            getBadge={deliveryNoteBadge}
            getExtraBadges={reverseChargeExtraBadges}
            renderDateien={renderDateien}
            selectedIds={selectedIds}
            onSelectionChange={toggleSelection}
            isSelectable={isSelectableGroup}
            areAllSelected={areAllVisibleSelected}
            onSelectAll={(checked) => (checked ? selectAllVisible(selectableFilteredGroups) : deselectVisible(selectableFilteredGroups))}
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
