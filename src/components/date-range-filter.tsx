export type DatePreset = 'all' | 'this-month' | 'last-month' | 'last-3-months' | 'this-year' | 'custom'

export interface DateRangeState {
  preset: DatePreset
  from: string
  to: string
}

export const initialDateRange: DateRangeState = { preset: 'all', from: '', to: '' }

interface Props {
  value: DateRangeState
  onChange: (value: DateRangeState) => void
}

export function DateRangeFilter({ value, onChange }: Props) {
  return (
    <>
      <label className="text-sm font-semibold text-slate-700">
        Zeitraum
        <select
          value={value.preset}
          onChange={(e) => onChange({ preset: e.target.value as DatePreset, from: '', to: '' })}
          className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-normal outline-none focus:border-slate-800"
        >
          <option value="all">Alle Zeiträume</option>
          <option value="this-month">Dieser Monat</option>
          <option value="last-month">Letzter Monat</option>
          <option value="last-3-months">Letzte 3 Monate</option>
          <option value="this-year">Dieses Jahr</option>
          <option value="custom">Benutzerdefiniert</option>
        </select>
      </label>
      {value.preset === 'custom' && (
        <>
          <label className="text-sm font-semibold text-slate-700">
            Von
            <input
              type="date"
              value={value.from}
              onChange={(e) => onChange({ ...value, from: e.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Bis
            <input
              type="date"
              value={value.to}
              onChange={(e) => onChange({ ...value, to: e.target.value })}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-normal outline-none focus:border-slate-800"
            />
          </label>
        </>
      )}
    </>
  )
}

function parseGermanDate(createdAt: string): Date {
  const [datePart, timePart] = createdAt.split(', ')
  const [day, month, year] = datePart.split('.')
  const [h = '0', m = '0', s = '0'] = (timePart ?? '').split(':')
  return new Date(Number(year), Number(month) - 1, Number(day), Number(h), Number(m), Number(s))
}

export function matchesDateRange(createdAt: string, state: DateRangeState): boolean {
  if (state.preset === 'all') return true

  const date = parseGermanDate(createdAt)
  const now = new Date()

  if (state.preset === 'this-month') {
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  }

  if (state.preset === 'last-month') {
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear()
  }

  if (state.preset === 'last-3-months') {
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
    return date >= cutoff
  }

  if (state.preset === 'this-year') {
    return date.getFullYear() === now.getFullYear()
  }

  if (state.preset === 'custom') {
    if (state.from) {
      const fromDate = new Date(state.from)
      fromDate.setHours(0, 0, 0, 0)
      if (date < fromDate) return false
    }
    if (state.to) {
      const toDate = new Date(state.to)
      toDate.setHours(23, 59, 59, 999)
      if (date > toDate) return false
    }
    return true
  }

  return true
}
