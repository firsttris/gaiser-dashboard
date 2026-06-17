import { createFileRoute, Link } from '@tanstack/react-router'
import { useMemo, useState } from 'react'
import { DocumentListTable, type BadgeConfig } from '../components/document-list-table'
import { PageShell } from '../components/page-shell'
import { TopNav } from '../components/top-nav'
import { type RecordItem, useAppState } from '../state/app-state'
import { groupAllByDocId, statusBadge } from '../utils/history-utils'
import { downloadCombinedDeliveryNote, downloadInvoicePdf, downloadStornoDoc } from '../utils/delivery-note-utils'

export const Route = createFileRoute('/lieferscheine')({ component: LieferscheinePage })

function getBadge(items: RecordItem[]): BadgeConfig {
  const statuses = new Set(items.map((r) => r.status))
  if (statuses.size === 1 && statuses.has('storniert')) return statusBadge('storniert')
  if (statuses.has('bezahlt')) return statusBadge('bezahlt')
  if (statuses.has('rechnung')) return statusBadge('rechnung')
  return statusBadge('lieferschein')
}

function LieferscheinePage() {
  const { isLoggedIn, records, selectedCompany } = useAppState()
  const [statusFilter, setStatusFilter] = useState<'all' | 'offen' | 'berechnet' | 'storniert'>('all')
  const [searchText, setSearchText] = useState('')

  const companyRecords = records.filter((r) => r.company === selectedCompany?.name)
  const allGroups = useMemo(() => groupAllByDocId(companyRecords, 'deliveryNoteId'), [companyRecords])

  const filteredGroups = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('de-DE')
    return allGroups.filter((g) => {
      if (statusFilter !== 'all') {
        const badge = getBadge(g.items)
        const groupStatus = badge.label === 'Storniert' ? 'storniert' : (badge.label === 'Rechnung' || badge.label === 'Bezahlt') ? 'berechnet' : 'offen'
        if (groupStatus !== statusFilter) return false
      }
      if (query && !g.id.toLocaleLowerCase('de-DE').includes(query)) return false
      return true
    })
  }, [allGroups, statusFilter, searchText])

  function renderActions(id: string, items: RecordItem[]) {
    const cancelId = items.find((r) => r.cancelId)?.cancelId
    return (
      <>
        <button
          type="button"
          onClick={() => downloadCombinedDeliveryNote(items, selectedCompany?.name ?? '', id)}
          className="rounded bg-amber-500 px-1.5 py-0.5 text-xs font-semibold text-white hover:bg-amber-600"
        >
          LS-PDF
        </button>
        {items[0].invoiceId && (
          <button
            type="button"
            onClick={() => {
              const group = companyRecords.filter((r) => r.invoiceId === items[0].invoiceId)
              downloadInvoicePdf(group, selectedCompany?.shortCode, id, items[0].invoiceId, items[0].invoiceReverseCharge)
            }}
            className="rounded bg-blue-500 px-1.5 py-0.5 text-xs font-semibold text-white hover:bg-blue-600"
          >
            RG-PDF
          </button>
        )}
        {cancelId && (
          <button
            type="button"
            onClick={() => downloadStornoDoc(items, selectedCompany?.name ?? '', cancelId, id)}
            className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-300"
          >
            ST-PDF
          </button>
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

        <div className="mt-4 grid gap-3 md:grid-cols-2">
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
        </div>

        {filteredGroups.length === 0 ? (
          <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            Keine Lieferscheine fuer die aktuellen Filter vorhanden.
          </p>
        ) : (
          <DocumentListTable
            groups={filteredGroups}
            getBadge={getBadge}
            renderActions={renderActions}
          />
        )}
      </section>
    </PageShell>
  )
}
