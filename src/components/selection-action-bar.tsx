import { money } from '../utils/history-utils'

type ActionButton = {
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: 'default' | 'primary'
}

interface Props {
  count: number
  noun: string
  pluralLabel: string
  total: number
  warning?: string
  onClear: () => void
  actions: ActionButton[]
}

const VARIANT_CLASSES = {
  default: 'bg-slate-200 text-slate-700 hover:bg-slate-300',
  primary: 'bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-40',
} as const

export function SelectionActionBar({ count, noun, pluralLabel, total, warning, onClear, actions }: Props) {
  if (count === 0) return null

  const label = count === 1 ? noun : pluralLabel

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 p-3">
      <div className="text-sm text-emerald-800">
        <span className="font-semibold">{count} {label}</span> ausgewählt
        {' · '}
        <span className="font-semibold">{money(total)}</span>
        {warning && <span className="ml-2 font-semibold text-amber-700">{warning}</span>}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onClear}
          className="rounded-xl bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Auswahl aufheben
        </button>
        {actions.map((action) => (
          <button
            key={action.label}
            type="button"
            disabled={action.disabled}
            onClick={action.onClick}
            className={`rounded-xl px-3 py-1.5 text-sm font-semibold ${VARIANT_CLASSES[action.variant ?? 'default']}`}
          >
            {action.label}
          </button>
        ))}
      </div>
    </div>
  )
}
