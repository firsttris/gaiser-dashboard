import { useMemo, useState } from 'react'
import type { RecordItem } from '../state/app-state'

type DocGroup = { id: string; items: RecordItem[] }

export function useGroupSelection<G extends DocGroup>(allGroups: G[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const selectedGroups = useMemo(
    () => allGroups.filter((g) => selectedIds.has(g.id)),
    [allGroups, selectedIds],
  )
  const selectedTotal = useMemo(
    () => selectedGroups.reduce((sum, g) => sum + g.items.reduce((s, r) => s + r.total, 0), 0),
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

  function clearSelection() {
    setSelectedIds(new Set())
  }

  return { selectedIds, selectedGroups, selectedTotal, toggleSelection, clearSelection }
}
