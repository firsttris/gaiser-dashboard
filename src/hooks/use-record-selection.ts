import { useMemo, useState } from 'react'

type SelectableRecord = {
  id: number
}

// Selection is a Map keyed by id rather than a filter over the page's
// records — with server-side pagination, records selected on one page are
// no longer present in the array once the user pages away, so selectedRecords
// can't be re-derived by filtering `pageRecords` anymore.
export function useRecordSelection<T extends SelectableRecord>(pageRecords: T[]) {
  const [selectedMap, setSelectedMap] = useState<Map<number, T>>(new Map())

  const selectedSet = useMemo(() => new Set(selectedMap.keys()), [selectedMap])
  const selectedRecords = useMemo(() => Array.from(selectedMap.values()), [selectedMap])
  const selectedCount = selectedMap.size
  const areAllVisibleSelected = pageRecords.length > 0 && pageRecords.every((record) => selectedMap.has(record.id))

  function toggleRecordSelection(record: T) {
    setSelectedMap((prev) => {
      const next = new Map(prev)
      if (next.has(record.id)) next.delete(record.id)
      else next.set(record.id, record)
      return next
    })
  }

  function selectAllVisible() {
    setSelectedMap((prev) => {
      const next = new Map(prev)
      pageRecords.forEach((record) => next.set(record.id, record))
      return next
    })
  }

  function deselectVisible() {
    setSelectedMap((prev) => {
      const next = new Map(prev)
      pageRecords.forEach((record) => next.delete(record.id))
      return next
    })
  }

  function clearSelection() {
    setSelectedMap(new Map())
  }

  return {
    selectedSet,
    selectedRecords,
    selectedCount,
    areAllVisibleSelected,
    toggleRecordSelection,
    selectAllVisible,
    deselectVisible,
    clearSelection,
  }
}
