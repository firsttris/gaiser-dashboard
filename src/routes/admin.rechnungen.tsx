import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { ConfirmDialog } from '../components/confirm-dialog'
import { DocumentListTable, type BadgeConfig } from '../components/document-list-table'
import { type RecordItem, useAppState } from '../state/app-state'
import { groupAllByDocId, statusBadge } from '../utils/history-utils'
import { downloadCombinedDeliveryNote, downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'
import { shortDocId } from '../components/history-table'

export const Route = createFileRoute('/admin/rechnungen')({ component: AdminRechnungenPage })

type StatusFilter = 'all' | 'offen' | 'bezahlt' | 'storniert'

function getBadge(items: RecordItem[]): BadgeConfig {
  const statuses = new Set(items.map((r) => r.status))
  if (statuses.size === 1 && statuses.has('storniert')) return statusBadge('storniert')
  if (statuses.has('bezahlt')) return statusBadge('bezahlt')
  return statusBadge('rechnung')
}

function AdminRechnungenPage() {
  const { companies, records, updateRecordStatus, assignCancel } = useAppState()
  const [pendingAction, setPendingAction] = useState<{ action: () => void; title: string; message: string } | null>(null)
  const [companyFilter, setCompanyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [searchText, setSearchText] = useState('')

  const companyOptions = useMemo(
    () => companies.map((c) => c.name).sort((a, b) => a.localeCompare(b, 'de')),
    [companies],
  )

  const allGroups = useMemo(() => groupAllByDocId(records, 'invoiceId'), [records])

  const filteredGroups = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('de-DE')
    return allGroups.filter((g) => {
      if (companyFilter !== 'all' && g.items[0].company !== companyFilter) return false
      if (statusFilter !== 'all') {
        const badge = getBadge(g.items)
        const groupStatus: StatusFilter = badge.label === 'Bezahlt' ? 'bezahlt' : badge.label === 'Storniert' ? 'storniert' : 'offen'
        if (groupStatus !== statusFilter) return false
      }
      if (query && !g.id.toLocaleLowerCase('de-DE').includes(query)) return false
      return true
    })
  }, [allGroups, companyFilter, statusFilter, searchText])

  function cancelGroup(items: typeof records) {
    const cancelId = `ST-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${items[0].id}`
    const originalDocId = items[0].invoiceId ?? items[0].deliveryNoteId
    downloadStornoDoc(items, items[0].company, cancelId, originalDocId)
    assignCancel(items.map((r) => r.id), cancelId)
    items.forEach((r) => updateRecordStatus(r.id, 'storniert'))
  }

  function renderDateien(id: string, items: RecordItem[]) {
    const cancelId = items.find((r) => r.cancelId)?.cancelId
    const shortCode = companies.find((c) => c.name === items[0].company)?.shortCode
    const deliveryNoteId = items[0].deliveryNoteId
    return (
      <>
        <button
          type="button"
          onClick={() => downloadInvoicePdf(items, shortCode, deliveryNoteId, id, items[0].invoiceReverseCharge)}
          className="cursor-pointer rounded bg-blue-100 px-1 py-0.5 font-mono text-xs text-blue-700 hover:opacity-75"
        >
          {shortDocId(id)}
        </button>
        {deliveryNoteId && (
          <button
            type="button"
            onClick={() => {
              const group = records.filter((r) => r.deliveryNoteId === deliveryNoteId)
              downloadCombinedDeliveryNote(group, items[0].company, deliveryNoteId)
            }}
            className="cursor-pointer rounded bg-amber-100 px-1 py-0.5 font-mono text-xs text-amber-700 hover:opacity-75"
          >
            {shortDocId(deliveryNoteId)}
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

  function renderActions(id: string, items: RecordItem[]) {
    const badge = getBadge(items)
    const isStorniert = badge.label === 'Storniert'
    const isOffen = badge.label === 'Rechnung'
    return (
      <>
        {!isStorniert && (
          <button
            type="button"
            onClick={() => setPendingAction({
              action: () => cancelGroup(items),
              title: 'Rechnung stornieren',
              message: `Sind Sie sicher, dass Sie Rechnung ${id} stornieren möchten?`,
            })}
            className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"
          >
            Stornieren
          </button>
        )}
        {isOffen && (
          <button
            type="button"
            onClick={() => setPendingAction({
              action: () => items.forEach((r) => updateRecordStatus(r.id, 'bezahlt')),
              title: 'Als bezahlt markieren',
              message: `Sind Sie sicher, dass Sie Rechnung ${id} als bezahlt markieren möchten?`,
            })}
            className="rounded bg-emerald-600 px-1.5 py-0.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Bezahlt
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
            <h2 className="font-title text-4xl text-slate-900">Rechnungen</h2>
            <p className="mt-1 text-sm text-slate-600">Alle Rechnungen ueber alle Firmen.</p>
          </div>
          <p className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700">
            {filteredGroups.length} von {allGroups.length} Rechnung{allGroups.length !== 1 ? 'en' : ''}
          </p>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
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
        </div>

        {filteredGroups.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Rechnungen fuer die aktuellen Filter vorhanden.
          </p>
        ) : (
          <DocumentListTable
            groups={filteredGroups}
            showCompanyColumn
            getBadge={getBadge}
            getExtraBadges={(items) => items[0].invoiceReverseCharge ? [{ label: '§13b UStG', className: 'bg-purple-100 text-purple-700' }] : []}
            renderDateien={renderDateien}
            renderActions={renderActions}
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
