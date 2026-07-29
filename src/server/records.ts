import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { requireAnySession } from './auth-context'
import { findOrCreateConstructionSite } from './construction-sites'
import { formatGeneratedNumber } from '#/utils/numbering-format'
import type { PriceCategory, RecordRow } from '#/lib/supabase/types'
import type { RecordItem } from '../state/app-state'

const createRecordSchema = z.object({
  type: z.enum(['pickup', 'dropoff']),
  productId: z.number(),
  amount: z.number().positive(),
  constructionSiteName: z.string(),
  companyId: z.string().uuid().optional(),
})

const createTruckRecordSchema = z.object({
  truckId: z.number(),
  hours: z.number().positive(),
  constructionSiteName: z.string(),
  companyId: z.string().uuid().optional(),
})

const updateStatusSchema = z.object({
  recordId: z.number(),
  status: z.enum(['offen', 'lieferschein', 'rechnung', 'bezahlt', 'storniert']),
})

const assignInvoiceSchema = z.object({
  recordIds: z.array(z.number()),
  invoiceId: z.string(),
  reverseCharge: z.boolean().optional(),
})

const assignCancelSchema = z.object({
  recordIds: z.array(z.number()),
  cancelId: z.string(),
})

export function toRecord(row: RecordRow): RecordItem {
  return {
    id: row.id,
    company: row.company_name,
    constructionSiteId: row.construction_site_id ?? '',
    constructionSiteName: row.construction_site_name,
    type: row.type,
    productName: row.product_name,
    amount: row.amount,
    unit: row.unit,
    unitPrice: row.unit_price,
    total: row.total,
    status: row.status,
    createdAt: new Date(row.created_at).toLocaleString('de-DE'),
    deliveryNoteId: row.delivery_note_id ?? undefined,
    invoiceId: row.invoice_id ?? undefined,
    invoiceReverseCharge: row.invoice_reverse_charge,
    cancelId: row.cancel_id ?? undefined,
  }
}

function productUnitPrice(
  product: { pickup_private_price: number; pickup_business_price: number; dropoff_private_price: number; dropoff_business_price: number },
  type: 'pickup' | 'dropoff',
  priceCategory: PriceCategory,
) {
  if (type === 'pickup') {
    return priceCategory === 'private' ? product.pickup_private_price : product.pickup_business_price
  }
  return priceCategory === 'private' ? product.dropoff_private_price : product.dropoff_business_price
}

// Resolves which company a dual-mode call may act on. Customers can only
// ever create records for their own company — any companyId they send is
// ignored. Admins must explicitly say which company the record is for.
async function resolveActingCompanyId(companyIdFromCaller: string | undefined) {
  const caller = await requireAnySession()
  if (caller.role === 'customer') return caller.companyId
  return companyIdFromCaller ?? null
}

export const createRecord = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createRecordSchema.parse(data))
  .handler(async ({ data }) => {
    const companyId = await resolveActingCompanyId(data.companyId)
    if (!companyId) return null

    const supabase = getServiceSupabaseClient()

    const [{ data: company }, { data: product }] = await Promise.all([
      supabase.from('companies').select('id, name, price_category').eq('id', companyId).maybeSingle(),
      supabase.from('products').select('*').eq('id', data.productId).maybeSingle(),
    ])
    if (!company || !product) return null

    const site = await findOrCreateConstructionSite(supabase, data.constructionSiteName)
    if (!site) return null

    const unitPrice = productUnitPrice(product, data.type, company.price_category)
    const total = unitPrice * data.amount

    const { data: numbering, error: numberingError } = await supabase.rpc('next_delivery_note_number')
    const numberingRow = numbering?.[0]
    if (numberingError || !numberingRow) return null
    const deliveryNoteId = formatGeneratedNumber(numberingRow.template, numberingRow.counter, numberingRow.padding)

    const { data: inserted, error } = await supabase
      .from('records')
      .insert({
        company_id: company.id,
        company_name: company.name,
        construction_site_id: site.id,
        construction_site_name: site.name,
        type: data.type,
        product_name: product.name,
        amount: data.amount,
        unit: product.unit,
        unit_price: unitPrice,
        total,
        status: 'lieferschein',
        delivery_note_id: deliveryNoteId,
        invoice_reverse_charge: false,
      })
      .select('*')
      .single()

    if (error || !inserted) return null
    return toRecord(inserted)
  })

export const createTruckRecord = createServerFn({ method: 'POST' })
  .validator((data: unknown) => createTruckRecordSchema.parse(data))
  .handler(async ({ data }) => {
    const companyId = await resolveActingCompanyId(data.companyId)
    if (!companyId) return null

    const supabase = getServiceSupabaseClient()

    const [{ data: company }, { data: truck }] = await Promise.all([
      supabase.from('companies').select('id, name, price_category').eq('id', companyId).maybeSingle(),
      supabase.from('trucks').select('*').eq('id', data.truckId).maybeSingle(),
    ])
    if (!company || !truck) return null

    const site = await findOrCreateConstructionSite(supabase, data.constructionSiteName)
    if (!site) return null

    const unitPrice = company.price_category === 'private' ? truck.private_price : truck.business_price
    const total = unitPrice * data.hours

    const { data: numbering, error: numberingError } = await supabase.rpc('next_delivery_note_number')
    const numberingRow = numbering?.[0]
    if (numberingError || !numberingRow) return null
    const deliveryNoteId = formatGeneratedNumber(numberingRow.template, numberingRow.counter, numberingRow.padding)

    const { data: inserted, error } = await supabase
      .from('records')
      .insert({
        company_id: company.id,
        company_name: company.name,
        construction_site_id: site.id,
        construction_site_name: site.name,
        type: 'lkw',
        product_name: truck.name,
        amount: data.hours,
        unit: 'Std.',
        unit_price: unitPrice,
        total,
        status: 'lieferschein',
        delivery_note_id: deliveryNoteId,
        invoice_reverse_charge: false,
      })
      .select('*')
      .single()

    if (error || !inserted) return null
    return toRecord(inserted)
  })

const listRecordsPageSchema = z.object({
  page: z.number().int().positive(),
  pageSize: z.number().int().positive().max(200),
  companyId: z.string().uuid().optional(),
  type: z.enum(['pickup', 'dropoff', 'lkw']).optional(),
  status: z.enum(['offen', 'lieferschein', 'rechnung', 'bezahlt', 'storniert']).optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
})

// PostgREST's .or() takes a comma-separated filter list — strip characters
// that would let free-text search input break out of that syntax.
function sanitizeSearchTerm(search: string) {
  return search.replace(/[,()]/g, ' ').trim()
}

export const listRecordsPage = createServerFn({ method: 'GET' })
  .validator((data: unknown) => listRecordsPageSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await requireAnySession()
    const supabase = getServiceSupabaseClient()

    let query = supabase.from('records').select('*', { count: 'exact' })
    query = caller.role === 'admin' ? query : query.eq('company_id', caller.companyId)
    if (caller.role === 'admin' && data.companyId) query = query.eq('company_id', data.companyId)
    if (data.type) query = query.eq('type', data.type)
    if (data.status) query = query.eq('status', data.status)

    const search = data.search ? sanitizeSearchTerm(data.search) : ''
    if (search) {
      const term = `%${search}%`
      query = query.or(
        `construction_site_name.ilike.${term},delivery_note_id.ilike.${term},invoice_id.ilike.${term},cancel_id.ilike.${term}`,
      )
    }

    if (data.dateFrom) query = query.gte('created_at', `${data.dateFrom}T00:00:00`)
    if (data.dateTo) query = query.lte('created_at', `${data.dateTo}T23:59:59.999`)

    const from = (data.page - 1) * data.pageSize
    const { data: rows, error, count } = await query
      .order('id', { ascending: false })
      .range(from, from + data.pageSize - 1)

    if (error || !rows) return { records: [], totalCount: 0 }
    return { records: rows.map(toRecord), totalCount: count ?? 0 }
  })

const listRecordsByDocIdSchema = z.object({
  field: z.enum(['delivery_note_id', 'invoice_id', 'cancel_id']),
  value: z.string(),
})

// Delivery notes / invoices / cancellations can combine records that no
// longer share a page once results are paginated — this fetches the full
// set for one doc id, independent of the current page/filters.
export const listRecordsByDocId = createServerFn({ method: 'GET' })
  .validator((data: unknown) => listRecordsByDocIdSchema.parse(data))
  .handler(async ({ data }) => {
    const caller = await requireAnySession()
    const supabase = getServiceSupabaseClient()

    let query = supabase.from('records').select('*').eq(data.field, data.value).order('id', { ascending: false })
    query = caller.role === 'admin' ? query : query.eq('company_id', caller.companyId)

    const { data: rows, error } = await query
    if (error || !rows) return []
    return rows.map(toRecord)
  })

export const countAllRecords = createServerFn({ method: 'GET' }).handler(async () => {
  const caller = await requireAnySession()
  const supabase = getServiceSupabaseClient()

  let query = supabase.from('records').select('*', { count: 'exact', head: true })
  query = caller.role === 'admin' ? query : query.eq('company_id', caller.companyId)

  const { count } = await query
  return count ?? 0
})

export const updateRecordStatus = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => updateStatusSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase.from('records').update({ status: data.status }).eq('id', data.recordId)
  })

export const assignInvoice = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => assignInvoiceSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase
      .from('records')
      .update({ invoice_id: data.invoiceId, invoice_reverse_charge: data.reverseCharge ?? false })
      .in('id', data.recordIds)
  })

export const assignCancel = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => assignCancelSchema.parse(data))
  .handler(async ({ data, context }) => {
    await context.supabase.from('records').update({ cancel_id: data.cancelId }).in('id', data.recordIds)
  })
