import type { RecordItem, RecordStatus } from '../state/app-state'
import { flowLabel, money, statusBadge, statusStages } from '../utils/history-utils'
import { Spinner } from './spinner'

interface Props {
  records: RecordItem[]
  selectedSet: Set<number>
  areAllVisibleSelected: boolean
  onSelectAll: (checked: boolean) => void
  onToggle: (id: number) => void
  showCompanyColumn?: boolean
  onStatusChange?: (id: number, status: RecordStatus) => void
  onDeliveryNoteClick?: (deliveryNoteId: string) => void
  onInvoiceClick?: (invoiceId: string) => void
  onCancelClick?: (cancelId: string) => void
  downloadingDocId?: string | null
}

export function shortDocId(id: string) {
  const parts = id.split('-')
  if (parts.length >= 3) return `${parts[0]}-${parts[1].slice(4)}-${parts[2].slice(-4)}`
  return id
}

const DOC_COLOR_CLASSES = {
  amber: 'bg-amber-100 text-amber-700',
  blue: 'bg-blue-100 text-blue-700',
  red: 'bg-red-100 text-red-700',
} as const

function DocButton({
  id,
  color,
  onClick,
  loading,
}: {
  id: string
  color: keyof typeof DOC_COLOR_CLASSES
  onClick: () => void
  loading: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 font-mono text-xs hover:opacity-75 disabled:cursor-not-allowed ${DOC_COLOR_CLASSES[color]}`}
    >
      {loading && <Spinner className="h-3 w-3" />}
      {shortDocId(id)}
    </button>
  )
}

export function HistoryTable({
  records,
  selectedSet,
  areAllVisibleSelected,
  onSelectAll,
  onToggle,
  showCompanyColumn = false,
  onStatusChange,
  onDeliveryNoteClick,
  onInvoiceClick,
  onCancelClick,
  downloadingDocId = null,
}: Props) {
  return (
    <>
      <div className="mt-4 space-y-3 md:hidden">
        {records.map((record) => {
          return (
            <article
              key={record.id}
              className={`rounded-xl border border-slate-200 p-4 ${record.status === 'storniert' ? 'bg-slate-100 opacity-60' : record.status === 'bezahlt' ? 'bg-emerald-50' : record.status === 'rechnung' ? 'bg-blue-50' : record.status === 'lieferschein' ? 'bg-amber-50' : 'odd:bg-white even:bg-slate-50'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-xs">
                    <span className="block text-slate-600">{record.createdAt.split(', ')[0]}</span>
                    <span className="block text-slate-400">{record.createdAt.split(', ')[1]}</span>
                  </p>
                  {showCompanyColumn && (
                    <p className="mt-1 text-sm font-semibold text-slate-900">{record.company}</p>
                  )}
                  <p className="mt-1 text-sm text-slate-700">{record.productName}</p>
                  <p className="mt-1 text-xs text-slate-600">Baustelle: {record.constructionSiteName || '-'}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {record.deliveryNoteId && (
                      <DocButton
                        id={record.deliveryNoteId}
                        color="amber"
                        onClick={() => onDeliveryNoteClick?.(record.deliveryNoteId!)}
                        loading={downloadingDocId === record.deliveryNoteId}
                      />
                    )}
                    {record.invoiceId && (
                      <DocButton
                        id={record.invoiceId}
                        color="blue"
                        onClick={() => onInvoiceClick?.(record.invoiceId!)}
                        loading={downloadingDocId === record.invoiceId}
                      />
                    )}
                    {record.cancelId && (
                      <DocButton
                        id={record.cancelId}
                        color="red"
                        onClick={() => onCancelClick?.(record.cancelId!)}
                        loading={downloadingDocId === record.cancelId}
                      />
                    )}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                    {flowLabel(record.type)}
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(record.id)}
                    onChange={() => onToggle(record.id)}
                    className="h-4 w-4 rounded border-slate-300"
                    aria-label={`Eintrag ${record.id} markieren`}
                  />
                </div>
              </div>

              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Menge</dt>
                  <dd className="font-semibold text-slate-800">
                    {record.amount} {record.unit}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">Einzelpreis</dt>
                  <dd className="font-semibold text-slate-800">{money(record.unitPrice)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Status</dt>
                  <dd className="mt-0.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(record.status).className}`}>
                      {statusBadge(record.status).label}
                    </span>
                  </dd>
                </div>
              </dl>
              {onStatusChange && (
                <label className="mt-3 block text-xs font-semibold text-slate-700">
                  Status
                  <select
                    value={record.status}
                    onChange={(event) => onStatusChange(record.id, event.target.value as RecordStatus)}
                    className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-xs font-normal outline-none focus:border-slate-800"
                  >
                    {statusStages.map((stage) => (
                      <option key={stage.value} value={stage.value}>
                        {stage.label}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </article>
          )
        })}
      </div>

      <div className="mt-4 hidden md:block">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="w-8 px-2 py-2">
                <input
                  type="checkbox"
                  checked={areAllVisibleSelected}
                  onChange={(event) => onSelectAll(event.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                  aria-label="Alle sichtbaren Einträge markieren"
                />
              </th>
              <th className="w-28 px-2 py-2">Zeit</th>
              <th className="w-20 px-2 py-2">Typ</th>
              {showCompanyColumn && <th className="hidden w-28 px-2 py-2 lg:table-cell">Firma</th>}
              <th className="w-40 px-2 py-2">Produkt</th>
              <th className="w-16 px-2 py-2">Menge</th>
              <th className={`hidden w-44 px-2 py-2 ${showCompanyColumn ? '2xl:table-cell' : 'xl:table-cell'}`}>Baustelle</th>
              {onStatusChange ? (
                <th className="w-32 px-2 py-2">Status</th>
              ) : (
                <th className="w-24 px-2 py-2">Status</th>
              )}
              <th className="w-36 px-2 py-2">Dateien</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              return (
                <tr
                  key={record.id}
                  className={`border-b border-slate-100 align-top ${record.status === 'storniert' ? 'bg-slate-100 opacity-60' : record.status === 'bezahlt' ? 'bg-emerald-50' : record.status === 'rechnung' ? 'bg-blue-50' : record.status === 'lieferschein' ? 'bg-amber-50' : 'odd:bg-white even:bg-slate-50'}`}
                >
                  <td className="px-2 pb-2 pt-2.5">
                    <input
                      type="checkbox"
                      checked={selectedSet.has(record.id)}
                      onChange={() => onToggle(record.id)}
                      className="h-4 w-4 rounded border-slate-300"
                      aria-label={`Eintrag ${record.id} markieren`}
                    />
                  </td>
                  <td className="px-2 py-2 text-xs">
                    <span className="block text-slate-600">{record.createdAt.split(', ')[0]}</span>
                    <span className="block text-slate-400">{record.createdAt.split(', ')[1]}</span>
                  </td>
                  <td className="px-2 py-2">{flowLabel(record.type)}</td>
                  {showCompanyColumn && (
                    <td className="hidden px-2 py-2 font-semibold text-slate-900 lg:table-cell">{record.company}</td>
                  )}
                  <td className="px-2 py-2">
                    <p className="truncate" title={record.productName}>{record.productName}</p>
                  </td>
                  <td className="px-2 py-2">
                    {record.amount} {record.unit}
                  </td>
                  <td className={`hidden px-2 py-2 text-slate-600 ${showCompanyColumn ? '2xl:table-cell' : 'xl:table-cell'}`}>
                    <p className="line-clamp-2 whitespace-pre-wrap wrap-break-word">{record.constructionSiteName || '-'}</p>
                  </td>
                  {onStatusChange ? (
                    <td className="px-2 py-2">
                      <select
                        value={record.status}
                        onChange={(event) => onStatusChange(record.id, event.target.value as RecordStatus)}
                        className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs font-normal outline-none focus:border-slate-800"
                      >
                        {statusStages.map((stage) => (
                          <option key={stage.value} value={stage.value}>
                            {stage.label}
                          </option>
                        ))}
                      </select>
                    </td>
                  ) : (
                    <td className="px-2 py-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusBadge(record.status).className}`}>
                        {statusBadge(record.status).label}
                      </span>
                    </td>
                  )}
                  <td className="px-2 py-2">
                    <div className="flex flex-wrap gap-1">
                      {record.deliveryNoteId && (
                        <DocButton
                          id={record.deliveryNoteId}
                          color="amber"
                          onClick={() => onDeliveryNoteClick?.(record.deliveryNoteId!)}
                          loading={downloadingDocId === record.deliveryNoteId}
                        />
                      )}
                      {record.invoiceId && (
                        <DocButton
                          id={record.invoiceId}
                          color="blue"
                          onClick={() => onInvoiceClick?.(record.invoiceId!)}
                          loading={downloadingDocId === record.invoiceId}
                        />
                      )}
                      {record.cancelId && (
                        <DocButton
                          id={record.cancelId}
                          color="red"
                          onClick={() => onCancelClick?.(record.cancelId!)}
                          loading={downloadingDocId === record.cancelId}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </>
  )
}
