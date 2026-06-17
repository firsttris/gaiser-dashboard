interface Props {
  selectedCount: number
  canCreateDeliveryNote: boolean
  selectedHaveDeliveryNote: boolean
  multipleCompaniesSelected?: boolean
  onCreateDeliveryNote: () => void
  onExportCsv: () => void
}

export function RecordActionsBar({
  selectedCount,
  canCreateDeliveryNote,
  selectedHaveDeliveryNote,
  multipleCompaniesSelected = false,
  onCreateDeliveryNote,
  onExportCsv,
}: Props) {
  const showWarning = selectedCount > 0 && !canCreateDeliveryNote

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onCreateDeliveryNote}
          disabled={!canCreateDeliveryNote}
          className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          Lieferschein erstellen ({selectedCount})
        </button>
        <button
          type="button"
          onClick={onExportCsv}
          disabled={selectedCount === 0}
          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-300"
        >
          CSV Export ({selectedCount})
        </button>
      </div>

      {showWarning && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
          {selectedHaveDeliveryNote
            ? 'Einige markierte Eintraege gehoeren bereits zu einem Lieferschein und koennen nicht erneut verwendet werden.'
            : multipleCompaniesSelected
              ? 'Lieferschein ist nur moeglich, wenn alle markierten Eintraege zur gleichen Firma gehoeren.'
              : null}
        </p>
      )}
    </>
  )
}
