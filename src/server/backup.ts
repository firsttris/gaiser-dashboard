import { createServerFn } from '@tanstack/react-start'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import type { Database } from '#/lib/supabase/types'

type TableName = keyof Database['public']['Tables']

// Data-only dump: table order respects foreign keys (companies and
// construction_sites before records, which references both). Schema itself
// lives in supabase/migrations/ and is not repeated here.
const TABLES_IN_DEPENDENCY_ORDER = [
  'companies',
  'construction_sites',
  'admin_users',
  'products',
  'trucks',
  'numbering_settings',
  'signup_settings',
  'records',
] as const satisfies ReadonlyArray<TableName>

// Tables with a serial/bigserial id column — after inserting explicit ids,
// the sequence needs to be fast-forwarded past the highest one used.
const SEQUENCE_TABLES = ['products', 'trucks', 'records'] as const

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return 'NULL'
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NULL'
  return `'${String(value).replace(/'/g, "''")}'`
}

async function dumpTable(supabase: SupabaseClient<Database>, table: TableName) {
  const { data, error } = await supabase.from(table).select('*')
  if (error) throw new Error(`Backup fehlgeschlagen (Tabelle "${table}"): ${error.message}`)

  const rows = data ?? []
  if (rows.length === 0) return `-- Tabelle "${table}": keine Zeilen\n`

  const columns = Object.keys(rows[0] as Record<string, unknown>)
  const columnList = columns.map((c) => `"${c}"`).join(', ')
  const inserts = rows.map((row) => {
    const values = columns.map((col) => sqlLiteral((row as Record<string, unknown>)[col]))
    return `INSERT INTO public.${table} (${columnList}) VALUES (${values.join(', ')});`
  })
  return inserts.join('\n') + '\n'
}

export const adminDownloadBackup = createServerFn({ method: 'GET' })
  .middleware([requireAdminSession])
  .handler(async () => {
    const supabase = getServiceSupabaseClient()

    const parts: string[] = []
    for (const table of TABLES_IN_DEPENDENCY_ORDER) {
      parts.push(`--\n-- Daten: ${table}\n--\n${await dumpTable(supabase, table)}`)
    }
    for (const table of SEQUENCE_TABLES) {
      parts.push(`SELECT setval('public.${table}_id_seq', COALESCE((SELECT MAX(id) FROM public.${table}), 1));`)
    }

    const generatedAt = new Date().toISOString()
    const content =
      `-- Gaiser Dashboard – Datenbank-Backup\n` +
      `-- Erstellt: ${generatedAt}\n` +
      `--\n` +
      `-- Reiner Daten-Dump (INSERT-Statements). Zum Wiederherstellen zuerst das\n` +
      `-- Schema aus supabase/migrations/ auf eine leere Datenbank anwenden,\n` +
      `-- anschliessend dieses Skript ausfuehren.\n\n` +
      `BEGIN;\n\n${parts.join('\n')}\nCOMMIT;\n`

    return { ok: true, filename: `gaiser-backup-${generatedAt.slice(0, 10)}.sql`, content } as const
  })
