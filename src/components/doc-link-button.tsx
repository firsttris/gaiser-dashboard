import { shortDocId } from './history-table'

const COLOR_CLASSES = {
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
} as const

interface Props {
  id: string
  color: keyof typeof COLOR_CLASSES
  onClick: () => void
}

export function DocLinkButton({ id, color, onClick }: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`cursor-pointer rounded px-1 py-0.5 font-mono text-xs hover:opacity-75 ${COLOR_CLASSES[color]}`}
    >
      {shortDocId(id)}
    </button>
  )
}
