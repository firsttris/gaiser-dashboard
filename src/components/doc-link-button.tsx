import { shortDocId } from './history-table'
import { Spinner } from './spinner'

const COLOR_CLASSES = {
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
} as const

interface Props {
  id: string
  color: keyof typeof COLOR_CLASSES
  onClick: () => void
  loading?: boolean
}

export function DocLinkButton({ id, color, onClick, loading = false }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 font-mono text-xs hover:opacity-75 disabled:cursor-not-allowed ${COLOR_CLASSES[color]}`}
    >
      {loading && <Spinner className="h-3 w-3" />}
      {shortDocId(id)}
    </button>
  )
}
