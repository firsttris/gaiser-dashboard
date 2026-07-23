import { createServerFn } from '@tanstack/react-start'
import { queryOptions } from '@tanstack/react-query'
import { z } from 'zod'
import { getServiceSupabaseClient } from '#/lib/supabase/service-client.server'
import { requireAdminSession } from './middleware/require-admin-session'
import { requireAnySession } from './auth-context'
import type { ProductRow } from '#/lib/supabase/types'

const flowSchema = z.enum(['pickup', 'dropoff'])

const createProductSchema = z.object({
  name: z.string(),
  unit: z.string(),
  flow: flowSchema,
  privatePrice: z.string(),
  businessPrice: z.string(),
})

const updateProductSchema = createProductSchema.extend({ id: z.number() })
const deleteProductSchema = z.object({ id: z.number() })

function toProduct(row: ProductRow) {
  return {
    id: row.id,
    name: row.name,
    unit: row.unit,
    flow: row.flow,
    pickupPrivatePrice: row.pickup_private_price,
    pickupBusinessPrice: row.pickup_business_price,
    dropoffPrivatePrice: row.dropoff_private_price,
    dropoffBusinessPrice: row.dropoff_business_price,
  }
}

function parsePrices(privatePrice: string, businessPrice: string) {
  const parsedPrivatePrice = Number(privatePrice)
  const parsedBusinessPrice = Number(businessPrice)

  if (
    Number.isNaN(parsedPrivatePrice) ||
    Number.isNaN(parsedBusinessPrice) ||
    parsedPrivatePrice < 0 ||
    parsedBusinessPrice < 0
  ) {
    return null
  }

  return { parsedPrivatePrice, parsedBusinessPrice }
}

export const listProducts = createServerFn({ method: 'GET' }).handler(async () => {
  await requireAnySession()

  const supabase = getServiceSupabaseClient()
  const { data, error } = await supabase.from('products').select('*').order('id', { ascending: true })
  if (error || !data) return []
  return data.map(toProduct)
})

export const adminCreateProduct = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => createProductSchema.parse(data))
  .handler(async ({ data, context }) => {
    const cleanedName = data.name.trim()
    const cleanedUnit = data.unit.trim()

    if (!cleanedName || !cleanedUnit) {
      return { ok: false, message: 'Bitte Produktname und Einheit ausfuellen.' } as const
    }

    const prices = parsePrices(data.privatePrice, data.businessPrice)
    if (!prices) {
      return { ok: false, message: 'Preise muessen gueltige positive Zahlen sein.' } as const
    }

    const { error } = await context.supabase.from('products').insert({
      name: cleanedName,
      unit: cleanedUnit,
      flow: data.flow,
      pickup_private_price: data.flow === 'pickup' ? prices.parsedPrivatePrice : 0,
      pickup_business_price: data.flow === 'pickup' ? prices.parsedBusinessPrice : 0,
      dropoff_private_price: data.flow === 'dropoff' ? prices.parsedPrivatePrice : 0,
      dropoff_business_price: data.flow === 'dropoff' ? prices.parsedBusinessPrice : 0,
    })

    if (error) {
      return { ok: false, message: 'Das Produkt konnte nicht angelegt werden.' } as const
    }

    return { ok: true } as const
  })

export const adminUpdateProduct = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => updateProductSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: currentProduct } = await context.supabase.from('products').select('name').eq('id', data.id).maybeSingle()
    if (!currentProduct) {
      return { ok: false, message: 'Das Produkt wurde nicht gefunden.' } as const
    }

    const cleanedName = data.name.trim()
    const cleanedUnit = data.unit.trim()

    if (!cleanedName || !cleanedUnit) {
      return { ok: false, message: 'Bitte Produktname und Einheit ausfuellen.' } as const
    }

    const prices = parsePrices(data.privatePrice, data.businessPrice)
    if (!prices) {
      return { ok: false, message: 'Preise muessen gueltige positive Zahlen sein.' } as const
    }

    const { error } = await context.supabase
      .from('products')
      .update({
        name: cleanedName,
        unit: cleanedUnit,
        flow: data.flow,
        pickup_private_price: data.flow === 'pickup' ? prices.parsedPrivatePrice : 0,
        pickup_business_price: data.flow === 'pickup' ? prices.parsedBusinessPrice : 0,
        dropoff_private_price: data.flow === 'dropoff' ? prices.parsedPrivatePrice : 0,
        dropoff_business_price: data.flow === 'dropoff' ? prices.parsedBusinessPrice : 0,
      })
      .eq('id', data.id)

    if (error) {
      return { ok: false, message: 'Das Produkt konnte nicht aktualisiert werden.' } as const
    }

    if (currentProduct.name !== cleanedName) {
      await context.supabase.from('records').update({ product_name: cleanedName }).eq('product_name', currentProduct.name)
    }

    return { ok: true } as const
  })

export const adminDeleteProduct = createServerFn({ method: 'POST' })
  .middleware([requireAdminSession])
  .validator((data: unknown) => deleteProductSchema.parse(data))
  .handler(async ({ data, context }) => {
    const { data: currentProduct } = await context.supabase.from('products').select('name, flow').eq('id', data.id).maybeSingle()
    if (!currentProduct) {
      return { ok: false, message: 'Das Produkt wurde nicht gefunden.' } as const
    }

    const { count: historyCount } = await context.supabase
      .from('records')
      .select('id', { count: 'exact', head: true })
      .eq('product_name', currentProduct.name)

    if (historyCount && historyCount > 0) {
      return {
        ok: false,
        message: 'Produkt kann nicht geloescht werden, solange Historie-Eintraege vorhanden sind.',
      } as const
    }

    const { count: flowCount } = await context.supabase
      .from('products')
      .select('id', { count: 'exact', head: true })
      .eq('flow', currentProduct.flow)

    if (flowCount !== null && flowCount <= 1) {
      return { ok: false, message: 'Mindestens ein Produkt pro Typ muss vorhanden sein.' } as const
    }

    const { error } = await context.supabase.from('products').delete().eq('id', data.id)
    if (error) {
      return { ok: false, message: 'Das Produkt konnte nicht geloescht werden.' } as const
    }

    return { ok: true } as const
  })

export const productsQueryOptions = () =>
  queryOptions({
    queryKey: ['products'] as const,
    queryFn: () => listProducts(),
  })
