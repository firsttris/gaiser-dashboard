import { money } from '../utils/history-utils'

interface Props {
  selectedCount: number
  selectedTotal: number
  canCreateDeliveryNote: boolean
  selectedHaveDeliveryNote: boolean
  multipleCompaniesSelected?: boolean
  onCreateDeliveryNote: () => void
  onExportCsv: () => void
  onClearSelection: () => void
}

export function RecordActionsBar({
  selectedCount,
  selectedTotal,
  canCreateDeliveryNote,
  selectedHaveDeliveryNote,
  multipleCompaniesSelected = false,
  onCreateDeliveryNote,
  onExportCsv,
  onClearSelection,
}: Props) {
  if (selectedCount === 0) return null

  const warning = !canCreateDeliveryNote && !selectedHaveDeliveryNote && multipleCompaniesSelected
    ? 'Lieferschein ist nur moeglich, wenn alle markierten Eintraege zur gleichen Firma gehoeren.'
    : null

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3">
      <div className="text-sm text-emerald-800">
        <span className="font-semibold">{selectedCount} Eintrag{selectedCount !== 1 ? 'e' : ''}</span> ausgewaehlt
        {' · '}
        <span className="font-semibold">{money(selectedTotal)}</span>
        {warning && <span className="ml-2 font-semibold text-amber-700">{warning}</span>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClearSelection}
          className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Auswahl aufheben
        </button>
        <button
          type="button"
          onClick={onExportCsv}
          className="rounded-xl bg-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-300"
        >
          CSV Export
        </button>
        <button
          type="button"
          disabled={!canCreateDeliveryNote}
          onClick={onCreateDeliveryNote}
          className="rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
        >
          Lieferschein erstellen
        </button>
      </div>
    </div>
  )
}
