import { useMemo, useState } from 'react'
import type { RecordItem } from '../state/app-state'

type DocGroup = { id: string; items: RecordItem[] }

// Selection is a Map keyed by id rather than a filter over the page's
// groups — with server-side pagination, groups selected on one page are no
// longer present in the array once the user pages away, so selectedGroups
// can't be re-derived by filtering `pageGroups` anymore.
export function useGroupSelection<G extends DocGroup>(_pageGroups: G[]) {
  const [selectedMap, setSelectedMap] = useState<Map<string, G>>(new Map())

  const selectedIds = useMemo(() => new Set(selectedMap.keys()), [selectedMap])
  const selectedGroups = useMemo(() => Array.from(selectedMap.values()), [selectedMap])
  const selectedTotal = useMemo(
    () => selectedGroups.reduce((sum, g) => sum + g.items.reduce((s, r) => s + r.total, 0), 0),
    [selectedGroups],
  )

  function toggleSelection(group: G, checked: boolean) {
    setSelectedMap((prev) => {
      const next = new Map(prev)
      if (checked) next.set(group.id, group)
      else next.delete(group.id)
      return next
    })
  }

  function selectAllVisible(groups: G[]) {
    setSelectedMap((prev) => {
      const next = new Map(prev)
      groups.forEach((g) => next.set(g.id, g))
      return next
    })
  }

  function deselectVisible(groups: DocGroup[]) {
    setSelectedMap((prev) => {
      const next = new Map(prev)
      groups.forEach((g) => next.delete(g.id))
      return next
    })
  }

  function clearSelection() {
    setSelectedMap(new Map())
  }

  return { selectedIds, selectedGroups, selectedTotal, toggleSelection, selectAllVisible, deselectVisible, clearSelection }
}
