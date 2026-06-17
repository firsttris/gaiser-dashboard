import type { ReactNode } from 'react'
import type { RecordItem } from '../state/app-state'
import { money } from '../utils/history-utils'

export type DocumentGroup = { id: string; items: RecordItem[] }
export type BadgeConfig = { label: string; className: string }

interface Props {
  groups: DocumentGroup[]
  showCompanyColumn?: boolean
  getBadge: (items: RecordItem[]) => BadgeConfig
  renderActions: (id: string, items: RecordItem[]) => ReactNode
}

export function DocumentListTable({ groups, showCompanyColumn, getBadge, renderActions }: Props) {
  return (
    <>
      <div className="mt-4 space-y-3 md:hidden">
        {groups.map(({ id, items }) => {
          const total = items.reduce((sum, r) => sum + r.total, 0)
          const badge = getBadge(items)
          return (
            <article key={id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-semibold text-slate-900">{id}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{items[0].createdAt.split(',')[0]}</p>
                  {showCompanyColumn && (
                    <p className="mt-1 text-sm font-semibold text-slate-900">{items[0].company}</p>
                  )}
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
                  {badge.label}
                </span>
              </div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-slate-500">Positionen</dt>
                  <dd className="font-semibold text-slate-800">{items.length}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">Gesamt</dt>
                  <dd className="font-semibold text-slate-900">{money(total)}</dd>
                </div>
              </dl>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
                {renderActions(id, items)}
              </div>
            </article>
          )
        })}
      </div>

      <div className="mt-4 hidden md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="w-28 px-2 py-2 font-semibold">Datum</th>
              <th className="px-2 py-2 font-semibold">Nummer</th>
              {showCompanyColumn && <th className="w-36 px-2 py-2 font-semibold">Firma</th>}
              <th className="w-24 px-2 py-2 text-right font-semibold">Positionen</th>
              <th className="w-28 px-2 py-2 text-right font-semibold">Gesamt</th>
              <th className="w-40 px-2 py-2 font-semibold">Status</th>
              <th className="px-2 py-2 font-semibold">Aktionen</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(({ id, items }) => {
              const total = items.reduce((sum, r) => sum + r.total, 0)
              const badge = getBadge(items)
              return (
                <tr key={id} className="border-b border-slate-100 align-middle odd:bg-white even:bg-slate-50">
                  <td className="px-2 py-2.5 text-xs text-slate-600">{items[0].createdAt.split(',')[0]}</td>
                  <td className="px-2 py-2.5 font-mono">{id}</td>
                  {showCompanyColumn && (
                    <td className="px-2 py-2.5 font-semibold text-slate-900">{items[0].company}</td>
                  )}
                  <td className="px-2 py-2.5 text-right text-slate-700">{items.length}</td>
                  <td className="whitespace-nowrap px-2 py-2.5 text-right">
                    {money(total)}
                  </td>
                  <td className="px-2 py-2.5">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {renderActions(id, items)}
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
