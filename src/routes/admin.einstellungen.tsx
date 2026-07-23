import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { formatGeneratedNumber, useAppState } from '../state/app-state'

export const Route = createFileRoute('/admin/einstellungen')({ component: AdminEinstellungenPage })

const TOKEN_HINTS = [
  { token: '{JAHR}', description: 'Jahr, 4-stellig (z.B. 2026)' },
  { token: '{MONAT}', description: 'Monat, 2-stellig (z.B. 06)' },
  { token: '{TAG}', description: 'Tag, 2-stellig (z.B. 29)' },
  { token: '{NUMMER}', description: 'Laufende Nummer, mit Nullen aufgefüllt' },
]

function AdminEinstellungenPage() {
  const { numberingSettings, updateNumberingSettings } = useAppState()

  const [invoiceTemplate, setInvoiceTemplate] = useState(numberingSettings.invoiceTemplate)
  const [deliveryNoteTemplate, setDeliveryNoteTemplate] = useState(numberingSettings.deliveryNoteTemplate)
  const [nextInvoiceNumber, setNextInvoiceNumber] = useState(String(numberingSettings.nextInvoiceNumber))
  const [nextDeliveryNoteNumber, setNextDeliveryNoteNumber] = useState(String(numberingSettings.nextDeliveryNoteNumber))
  const [numberPadding, setNumberPadding] = useState(String(numberingSettings.numberPadding))
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null)

  const paddingValue = Math.max(Number(numberPadding) || 1, 1)
  const invoicePreview = formatGeneratedNumber(invoiceTemplate, Number(nextInvoiceNumber) || 0, paddingValue)
  const deliveryNotePreview = formatGeneratedNumber(deliveryNoteTemplate, Number(nextDeliveryNoteNumber) || 0, paddingValue)

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = updateNumberingSettings({
      invoiceTemplate,
      deliveryNoteTemplate,
      nextInvoiceNumber: Math.max(Number(nextInvoiceNumber) || 1, 1),
      nextDeliveryNoteNumber: Math.max(Number(nextDeliveryNoteNumber) || 1, 1),
      numberPadding: paddingValue,
    })

    if (!result.ok) {
      setMessage({ kind: 'error', text: result.message })
      return
    }

    setMessage({ kind: 'success', text: 'Einstellungen wurden gespeichert.' })
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <h2 className="font-title text-4xl text-slate-900">Einstellungen</h2>
      <p className="mt-2 text-sm text-slate-600">
        Lege fest, wie Rechnungs- und Lieferscheinnummern automatisch generiert werden.
      </p>

      <div className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
        <p className="font-semibold text-slate-700">Verfügbare Platzhalter</p>
        <ul className="mt-2 space-y-1">
          {TOKEN_HINTS.map(({ token, description }) => (
            <li key={token}>
              <code className="rounded bg-slate-200 px-1.5 py-0.5 text-xs font-semibold text-slate-800">{token}</code>{' '}
              {description}
            </li>
          ))}
        </ul>
      </div>

      <form onSubmit={submit} className="mt-6 grid gap-6 md:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Format Rechnungsnummer</label>
            <input
              value={invoiceTemplate}
              onChange={(e) => setInvoiceTemplate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-800"
            />
            <p className="mt-1 text-xs text-slate-500">Vorschau: {invoicePreview}</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Nächste Rechnungsnummer</label>
            <input
              type="number"
              min={1}
              value={nextInvoiceNumber}
              onChange={(e) => setNextInvoiceNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-800"
            />
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-slate-700">Format Lieferscheinnummer</label>
            <input
              value={deliveryNoteTemplate}
              onChange={(e) => setDeliveryNoteTemplate(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 font-mono text-sm outline-none focus:border-slate-800"
            />
            <p className="mt-1 text-xs text-slate-500">Vorschau: {deliveryNotePreview}</p>
          </div>

          <div>
            <label className="text-sm font-semibold text-slate-700">Nächste Lieferscheinnummer</label>
            <input
              type="number"
              min={1}
              value={nextDeliveryNoteNumber}
              onChange={(e) => setNextDeliveryNoteNumber(e.target.value)}
              className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-800"
            />
          </div>
        </div>

        <div className="md:col-span-2">
          <label className="text-sm font-semibold text-slate-700">Stellen der laufenden Nummer</label>
          <input
            type="number"
            min={1}
            max={10}
            value={numberPadding}
            onChange={(e) => setNumberPadding(e.target.value)}
            className="mt-2 w-32 rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-slate-800"
          />
          <p className="mt-1 text-xs text-slate-500">Z.B. 4 ergibt 0001, 0002, ...</p>
        </div>

        <div className="md:col-span-2">
          <button
            type="submit"
            className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-black"
          >
            Speichern
          </button>
        </div>
      </form>

      {message && (
        <p
          className={`mt-4 rounded-xl p-3 text-sm ${
            message.kind === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          {message.text}
        </p>
      )}
    </section>
  )
}
