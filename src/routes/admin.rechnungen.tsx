import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ConfirmDialog } from '../components/confirm-dialog'
import { DateRangeFilter } from '../components/date-range-filter'
import { DocLinkButton } from '../components/doc-link-button'
import { DocumentListTable } from '../components/document-list-table'
import { SelectionActionBar } from '../components/selection-action-bar'
import { useDocumentGroupFilters } from '../hooks/use-document-group-filters'
import { useGroupSelection } from '../hooks/use-group-selection'
import { type RecordItem, useAppState } from '../state/app-state'
import { downloadCombinedDeliveryNote, downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'
import { createHistoryCsv, downloadCsvFile, invoiceBadge, invoiceStatusFilterOf, reverseChargeExtraBadges } from '../utils/history-utils'

export const Route = createFileRoute('/admin/rechnungen')({ component: AdminRechnungenPage })

function AdminRechnungenPage() {
  const { companies, records, updateRecordStatus, assignCancel } = useAppState()
  const [pendingAction, setPendingAction] = useState<{ action: () => void; title: string; message: string } | null>(null)

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
  } = useDocumentGroupFilters(records, 'invoiceId', invoiceStatusFilterOf, { withCompanyFilter: true })

  const { selectedIds, selectedGroups, selectedTotal, toggleSelection, selectAllVisible, deselectVisible, clearSelection } = useGroupSelection(allGroups)

  const selectedAllOpen = useMemo(
    () => selectedGroups.length > 0 && selectedGroups.every((g) => invoiceBadge(g.items).label === 'Rechnung'),
    [selectedGroups],
  )

  function isSelectableGroup(items: RecordItem[]) {
    return invoiceBadge(items).label !== 'Storniert'
  }

  const selectableFilteredGroups = useMemo(
    () => filteredGroups.filter((g) => isSelectableGroup(g.items)),
    [filteredGroups],
  )
  const areAllVisibleSelected = selectableFilteredGroups.length > 0 && selectableFilteredGroups.every((g) => selectedIds.has(g.id))

  function cancelGroup(items: typeof records) {
    const cancelId = `ST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${items[0].id}`
    const originalDocId = items[0].invoiceId ?? items[0].deliveryNoteId
    downloadStornoDoc(items, items[0].company, cancelId, originalDocId)
    assignCancel(items.map((r) => r.id), cancelId)
    items.forEach((r) => updateRecordStatus(r.id, 'storniert'))
  }

  function stornoSelection() {
    selectedGroups.forEach((g) => cancelGroup(g.items))
    clearSelection()
  }

  function bezahltSelection() {
    selectedGroups.forEach((g) => g.items.forEach((r) => updateRecordStatus(r.id, 'bezahlt')))
    clearSelection()
  }

  function exportSelectedAsCsv() {
    if (selectedGroups.length === 0) return
    const csv = createHistoryCsv(selectedGroups.flatMap((g) => g.items), true)
    const stamp = new Date().toISOString().slice(0, 10)
    downloadCsvFile(`admin-rechnungen-${stamp}.csv`, csv)
  }

  function renderDateien(id: string, items: RecordItem[]) {
    const cancelId = items.find((r) => r.cancelId)?.cancelId
    const customer = companies.find((c) => c.name === items[0].company)
    const deliveryNoteId = items[0].deliveryNoteId
    return (
      <>
        <DocLinkButton
          id={id}
          color="blue"
          onClick={() => downloadInvoicePdf(items, customer, deliveryNoteId, id, items[0].invoiceReverseCharge)}
        />
        {deliveryNoteId && (
          <DocLinkButton
            id={deliveryNoteId}
            color="amber"
            onClick={() => {
              const group = records.filter((r) => r.deliveryNoteId === deliveryNoteId)
              downloadCombinedDeliveryNote(group, items[0].company, deliveryNoteId)
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
            <h2 className="font-title text-4xl text-slate-900">Rechnungen</h2>
            <p className="mt-1 text-sm text-slate-600">Alle Rechnungen ueber alle Firmen.</p>
          </div>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {filteredGroups.length} von {allGroups.length} Rechnung{allGroups.length !== 1 ? 'en' : ''}
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
              <option value="bezahlt">Bezahlt</option>
              <option value="storniert">Storniert</option>
            </select>
          </label>

          <label className="text-sm font-semibold text-slate-700">
            Suche
            <input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Rechnungs-Nummer"
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
          <DateRangeFilter value={dateRange} onChange={setDateRange} />
        </div>

        <SelectionActionBar
          count={selectedIds.size}
          noun="Rechnung"
          pluralSuffix="en"
          total={selectedTotal}
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
                title: 'Rechnungen stornieren',
                message: `Sind Sie sicher, dass Sie ${selectedGroups.length} Rechnung${selectedGroups.length !== 1 ? 'en' : ''} stornieren möchten?`,
              }),
            },
            {
              label: 'Als bezahlt markieren',
              variant: 'primary',
              disabled: !selectedAllOpen,
              onClick: () => setPendingAction({
                action: bezahltSelection,
                title: 'Als bezahlt markieren',
                message: `Sind Sie sicher, dass Sie ${selectedGroups.length} Rechnung${selectedGroups.length !== 1 ? 'en' : ''} als bezahlt markieren möchten?`,
              }),
            },
          ]}
        />

        {filteredGroups.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Rechnungen fuer die aktuellen Filter vorhanden.
          </p>
        ) : (
          <DocumentListTable
            groups={filteredGroups}
            showCompanyColumn
            getBadge={invoiceBadge}
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
