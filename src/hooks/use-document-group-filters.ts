import { useMemo, useState } from 'react'
import { type DateRangeState, initialDateRange, matchesDateRange } from '../components/date-range-filter'
import type { RecordItem } from '../state/app-state'
import { groupAllByDocId } from '../utils/history-utils'

export function useDocumentGroupFilters<S extends string>(
  records: RecordItem[],
  idField: 'deliveryNoteId' | 'invoiceId',
  statusOf: (items: RecordItem[]) => S,
  { withCompanyFilter = false }: { withCompanyFilter?: boolean } = {},
) {
  const [companyFilter, setCompanyFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState<S | 'all'>('all')
  const [searchText, setSearchText] = useState('')
  const [dateRange, setDateRange] = useState<DateRangeState>(initialDateRange)

  const allGroups = useMemo(() => groupAllByDocId(records, idField), [records, idField])

  const filteredGroups = useMemo(() => {
    const query = searchText.trim().toLocaleLowerCase('de-DE')
    return allGroups.filter((g) => {
      if (withCompanyFilter && companyFilter !== 'all' && g.items[0].company !== companyFilter) return false
      if (statusFilter !== 'all' && statusOf(g.items) !== statusFilter) return false
      if (query && !g.id.toLocaleLowerCase('de-DE').includes(query)) return false
      if (!matchesDateRange(g.items[0].createdAt, dateRange)) return false
      return true
    })
  }, [allGroups, withCompanyFilter, companyFilter, statusFilter, searchText, dateRange, statusOf])

  return {
    companyFilter,
    setCompanyFilter,
    statusFilter,
    setStatusFilter,
    searchText,
    setSearchText,
    dateRange,
    setDateRange,
    allGroups,
    filteredGroups,
  }
}
