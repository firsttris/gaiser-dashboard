import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type FlowType = 'pickup' | 'dropoff'
export type RecordType = FlowType | 'lkw'
export type RecordStatus = 'offen' | 'lieferschein' | 'rechnung' | 'bezahlt' | 'storniert'
export type PriceCategory = 'private' | 'business'

export type Company = {
  id: string
  shortCode: string
  name: string
  customerNumber: string
  street: string
  postalCode: string
  city: string
  pin: string
  priceCategory: PriceCategory
}

export type Product = {
  id: number
  name: string
  unit: string
  flow: FlowType
  pickupPrivatePrice: number
  pickupBusinessPrice: number
  dropoffPrivatePrice: number
  dropoffBusinessPrice: number
}

export type Truck = {
  id: number
  name: string
  privatePrice: number
  businessPrice: number
}

export type ConstructionSite = {
  id: string
  name: string
}

export type RecordItem = {
  id: number
  company: string
  constructionSiteId: string
  constructionSiteName: string
  type: RecordType
  productName: string
  amount: number
  unit: string
  unitPrice: number
  total: number
  status: RecordStatus
  createdAt: string
  deliveryNoteId?: string
  invoiceId?: string
  invoiceReverseCharge?: boolean
  cancelId?: string
}

type LoginResult = { ok: true } | { ok: false; message: string }
type CreateCompanyResult = { ok: true } | { ok: false; message: string }

export type NumberingSettings = {
  invoiceTemplate: string
  deliveryNoteTemplate: string
  nextInvoiceNumber: number
  nextDeliveryNoteNumber: number
  numberPadding: number
}

type UpdateNumberingSettingsInput = Partial<NumberingSettings>

type CreateRecordInput = {
  type: FlowType
  product: Product
  amount: number
  constructionSiteName: string
  company?: Company
}

type CreateTruckRecordInput = {
  truck: Truck
  hours: number
  constructionSiteName: string
  company?: Company
}

type CreateCompanyInput = {
  shortCode: string
  name: string
  customerNumber: string
  street: string
  postalCode: string
  city: string
  pin: string
  priceCategory: PriceCategory
}

type CreateProductInput = {
  name: string
  unit: string
  flow: FlowType
  privatePrice: string
  businessPrice: string
}

type UpdateCompanyInput = {
  id: string
  shortCode: string
  name: string
  customerNumber: string
  street: string
  postalCode: string
  city: string
  pin: string
  priceCategory: PriceCategory
}

type UpdateProductInput = {
  id: number
  name: string
  unit: string
  flow: FlowType
  privatePrice: string
  businessPrice: string
}

type DeleteCompanyInput = {
  id: string
}

type DeleteProductInput = {
  id: number
}

type CreateTruckInput = {
  name: string
  privatePrice: string
  businessPrice: string
}

type UpdateTruckInput = {
  id: number
  name: string
  privatePrice: string
  businessPrice: string
}

type DeleteTruckInput = {
  id: number
}

type CreateConstructionSiteInput = {
  name: string
}

type UpdateConstructionSiteInput = {
  id: string
  name: string
}

type DeleteConstructionSiteInput = {
  id: string
}

type AppState = {
  hydrated: boolean
  companies: Company[]
  selectedCompany: Company | null
  isLoggedIn: boolean
  isAdminLoggedIn: boolean
  products: Product[]
  trucks: Truck[]
  constructionSites: ConstructionSite[]
  records: RecordItem[]
  numberingSettings: NumberingSettings
  login: (companyId: string, pin: string) => LoginResult
  logout: () => void
  adminLogin: (password: string) => LoginResult
  adminLogout: () => void
  clearCache: () => void
  createRecord: (input: CreateRecordInput) => RecordItem | null
  createTruckRecord: (input: CreateTruckRecordInput) => RecordItem | null
  createCompany: (input: CreateCompanyInput) => CreateCompanyResult
  updateCompany: (input: UpdateCompanyInput) => CreateCompanyResult
  deleteCompany: (input: DeleteCompanyInput) => CreateCompanyResult
  createProduct: (input: CreateProductInput) => CreateCompanyResult
  updateProduct: (input: UpdateProductInput) => CreateCompanyResult
  deleteProduct: (input: DeleteProductInput) => CreateCompanyResult
  createTruck: (input: CreateTruckInput) => CreateCompanyResult
  updateTruck: (input: UpdateTruckInput) => CreateCompanyResult
  deleteTruck: (input: DeleteTruckInput) => CreateCompanyResult
  createConstructionSite: (input: CreateConstructionSiteInput) => CreateCompanyResult
  updateConstructionSite: (input: UpdateConstructionSiteInput) => CreateCompanyResult
  deleteConstructionSite: (input: DeleteConstructionSiteInput) => CreateCompanyResult
  updateRecordStatus: (recordId: number, status: RecordStatus) => void
  assignDeliveryNote: (recordIds: number[], deliveryNoteId: string) => void
  assignInvoice: (recordIds: number[], invoiceId: string, reverseCharge?: boolean) => void
  assignCancel: (recordIds: number[], cancelId: string) => void
  updateNumberingSettings: (input: UpdateNumberingSettingsInput) => CreateCompanyResult
  generateInvoiceNumber: () => string
  generateDeliveryNoteNumber: () => string
}

const companiesSeed: Company[] = [
  { id: 'kr', shortCode: 'KR', name: 'Krampfert Wohnbau GmbH', customerNumber: '', street: '', postalCode: '', city: '', pin: '1234', priceCategory: 'business' },
  { id: 'be', shortCode: 'BE', name: 'Bergbau Erden AG', customerNumber: '', street: '', postalCode: '', city: '', pin: '2468', priceCategory: 'business' },
  { id: 'no', shortCode: 'NO', name: 'Nordstein Bau', customerNumber: '', street: '', postalCode: '', city: '', pin: '7777', priceCategory: 'business' },
  { id: 'wa', shortCode: 'WA', name: 'Walter Tiefbau KG', customerNumber: '', street: '', postalCode: '', city: '', pin: '2222', priceCategory: 'business' },
]

const productsSeed: Product[] = [
  // Annahme → Material bringen (dropoff)
  { id: 1,  name: 'Unbewehrter Betonschutt, Pflastersteine, Stahlbeton', unit: 't',  flow: 'dropoff', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 8,  dropoffBusinessPrice: 8 },
  { id: 3,  name: 'Stark bewehrter Betonschutt',              unit: 't',  flow: 'dropoff', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 45, dropoffBusinessPrice: 45 },
  { id: 4,  name: 'Bituminöser Straßenaufbruch',              unit: 't',  flow: 'dropoff', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 15, dropoffBusinessPrice: 15 },
  { id: 5,  name: 'Gemischter Bauschutt',                     unit: 't',  flow: 'dropoff', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 25, dropoffBusinessPrice: 25 },
  { id: 6,  name: 'Aushub',                                   unit: 'm³', flow: 'dropoff', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 45, dropoffBusinessPrice: 40 },
  { id: 7,  name: 'Aushub mit Bauschutt o.ä. vermischt',      unit: 'm³', flow: 'dropoff', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 60, dropoffBusinessPrice: 60 },
  // Verkauf → Material holen (pickup)
  { id: 8,  name: 'Betonrecycling 0/45 FSS-STS',              unit: 't',  flow: 'pickup', pickupPrivatePrice: 10,   pickupBusinessPrice: 8,    dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 9,  name: 'Bauschuttrecycling 0/56',                  unit: 't',  flow: 'pickup', pickupPrivatePrice: 0,    pickupBusinessPrice: 0,    dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 10, name: 'Gesiebt Mutterboden',                      unit: 't',  flow: 'pickup', pickupPrivatePrice: 12.5, pickupBusinessPrice: 8.5,  dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 11, name: 'Rollkies 8/16',                            unit: 't',  flow: 'pickup', pickupPrivatePrice: 27,   pickupBusinessPrice: 24.2, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 12, name: 'Mischkies 0/16',                           unit: 't',  flow: 'pickup', pickupPrivatePrice: 29,   pickupBusinessPrice: 25.3, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 13, name: 'Sand 0/2',                                 unit: 't',  flow: 'pickup', pickupPrivatePrice: 28,   pickupBusinessPrice: 24.4, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 14, name: 'Schwemmsand',                              unit: 't',  flow: 'pickup', pickupPrivatePrice: 18,   pickupBusinessPrice: 15.5, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 15, name: 'Mineralgemisch 0/16',                      unit: 't',  flow: 'pickup', pickupPrivatePrice: 24,   pickupBusinessPrice: 16.7, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 16, name: 'Mineralgemisch 0/32',                      unit: 't',  flow: 'pickup', pickupPrivatePrice: 22,   pickupBusinessPrice: 15.1, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
  { id: 17, name: 'Splitt 2/5',                               unit: 't',  flow: 'pickup', pickupPrivatePrice: 27,   pickupBusinessPrice: 20.4, dropoffPrivatePrice: 0,  dropoffBusinessPrice: 0 },
]

const trucksSeed: Truck[] = [
  { id: 1, name: 'LKW 3-Achser inkl. Maut', privatePrice: 90, businessPrice: 90 },
]

const constructionSitesSeed: ConstructionSite[] = [
  { id: 'baustelle-nordring', name: 'Nordring 12, Berlin' },
  { id: 'baustelle-hafenallee', name: 'Hafenallee 8, Potsdam' },
]

const numberingSettingsSeed: NumberingSettings = {
  invoiceTemplate: 'RG-{JAHR}{MONAT}{TAG}-{NUMMER}',
  deliveryNoteTemplate: 'LS-{JAHR}{MONAT}{TAG}-{NUMMER}',
  nextInvoiceNumber: 1,
  nextDeliveryNoteNumber: 1,
  numberPadding: 4,
}

export function formatGeneratedNumber(template: string, counter: number, padding: number) {
  const now = new Date()
  const jahr = String(now.getFullYear())
  const monat = String(now.getMonth() + 1).padStart(2, '0')
  const tag = String(now.getDate()).padStart(2, '0')
  const nummer = String(counter).padStart(Math.max(padding, 1), '0')

  return template
    .replaceAll('{JAHR}', jahr)
    .replaceAll('{MONAT}', monat)
    .replaceAll('{TAG}', tag)
    .replaceAll('{NUMMER}', nummer)
}

type LegacyCompany = Omit<Company, 'priceCategory' | 'customerNumber' | 'street' | 'postalCode' | 'city'> & {
  priceCategory?: PriceCategory
  customerNumber?: string
  street?: string
  postalCode?: string
  city?: string
}
type LegacyProduct = Omit<
  Product,
  'pickupPrivatePrice' | 'pickupBusinessPrice' | 'dropoffPrivatePrice' | 'dropoffBusinessPrice'
> & {
  pickupPrice?: number
  dropoffPrice?: number
  pickupPrivatePrice?: number
  pickupBusinessPrice?: number
  dropoffPrivatePrice?: number
  dropoffBusinessPrice?: number
}

function normalizeCompanies(raw: LegacyCompany[]): Company[] {
  return raw.map((company) => ({
    ...company,
    priceCategory: company.priceCategory ?? 'business',
    customerNumber: company.customerNumber ?? '',
    street: company.street ?? '',
    postalCode: company.postalCode ?? '',
    city: company.city ?? '',
  }))
}

function normalizeProducts(raw: LegacyProduct[]): Product[] {
  const defaultsById = new Map(productsSeed.map((product) => [product.id, product]))

  const normalized = raw.map((product) => {
    const defaults = defaultsById.get(product.id)

    return {
      id: product.id,
      name: product.name,
      unit: product.unit,
      flow: product.flow,
      // Legacy datasets had only one price field. We keep business from legacy,
      // but initialize missing private prices from the official 2026 price list seed.
      pickupPrivatePrice: product.pickupPrivatePrice ?? defaults?.pickupPrivatePrice ?? product.pickupPrice ?? 0,
      pickupBusinessPrice: product.pickupBusinessPrice ?? product.pickupPrice ?? defaults?.pickupBusinessPrice ?? 0,
      dropoffPrivatePrice: product.dropoffPrivatePrice ?? defaults?.dropoffPrivatePrice ?? product.dropoffPrice ?? 0,
      dropoffBusinessPrice: product.dropoffBusinessPrice ?? product.dropoffPrice ?? defaults?.dropoffBusinessPrice ?? 0,
    }
  })

  const hasAnyTierDifference = normalized.some((product) => {
    if (product.flow === 'pickup') {
      return product.pickupPrivatePrice !== product.pickupBusinessPrice
    }

    return product.dropoffPrivatePrice !== product.dropoffBusinessPrice
  })

  if (!hasAnyTierDifference) {
    return normalized.map((product) => {
      const defaults = defaultsById.get(product.id)
      if (!defaults) return product

      return {
        ...product,
        pickupPrivatePrice: defaults.pickupPrivatePrice,
        dropoffPrivatePrice: defaults.dropoffPrivatePrice,
      }
    })
  }

  return normalized
}

function getUnitPrice(product: Product, type: FlowType, priceCategory: PriceCategory) {
  if (type === 'pickup') {
    return priceCategory === 'private' ? product.pickupPrivatePrice : product.pickupBusinessPrice
  }

  return priceCategory === 'private' ? product.dropoffPrivatePrice : product.dropoffBusinessPrice
}

function normalizeRecordStatus(status: string): RecordStatus {
  if (status === 'in_bearbeitung') return 'lieferschein'
  if (status === 'abgerechnet') return 'rechnung'

  if (
    status === 'offen' ||
    status === 'lieferschein' ||
    status === 'rechnung' ||
    status === 'bezahlt' ||
    status === 'storniert'
  ) {
    return status
  }

  return 'offen'
}

function normalizeRecords(raw: RecordItem[]): RecordItem[] {
  return raw.map((record) => ({
    ...record,
    constructionSiteId: (record as Partial<RecordItem>).constructionSiteId ?? '',
    constructionSiteName: (record as Partial<RecordItem>).constructionSiteName ?? '',
    status: normalizeRecordStatus(record.status),
  }))
}

function normalizeConstructionSiteName(name: string) {
  return name
    .trim()
    .replace(/\s+/g, ' ')
}

function resolveConstructionSite(name: string, sites: ConstructionSite[]) {
  const cleanedName = normalizeConstructionSiteName(name)
  if (!cleanedName) return null

  const existing = sites.find(
    (item) => item.name.toLocaleLowerCase('de-DE') === cleanedName.toLocaleLowerCase('de-DE'),
  )

  return {
    site: existing ?? ({ id: createConstructionSiteId(cleanedName), name: cleanedName } satisfies ConstructionSite),
    isNew: !existing,
  }
}

function createConstructionSiteId(name: string) {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')

  return `site-${slug || 'neu'}-${Date.now()}`
}

const AppStateContext = createContext<AppState | null>(null)
const ADMIN_PASSWORD = 'admin'
const STORAGE_KEYS = {
  companies: 'gaiser.mock.companies.v1',
  products: 'gaiser.mock.products.v1',
  trucks: 'gaiser.mock.trucks.v1',
  constructionSites: 'gaiser.mock.constructionSites.v1',
  records: 'gaiser.mock.records.v1',
  selectedCompanyId: 'gaiser.mock.selectedCompanyId.v1',
  adminLoggedIn: 'gaiser.mock.adminLoggedIn.v1',
  numberingSettings: 'gaiser.mock.numberingSettings.v1',
}

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback

  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeStorage<T>(key: string, value: T) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Ignore quota/serialization errors in mock mode.
  }
}

function loadPersistedState() {
  return {
    companies: normalizeCompanies(readStorage<LegacyCompany[]>(STORAGE_KEYS.companies, companiesSeed)),
    products: normalizeProducts(readStorage<LegacyProduct[]>(STORAGE_KEYS.products, productsSeed)),
    trucks: readStorage<Truck[]>(STORAGE_KEYS.trucks, trucksSeed),
    constructionSites: readStorage<ConstructionSite[]>(STORAGE_KEYS.constructionSites, constructionSitesSeed),
    records: normalizeRecords(readStorage<RecordItem[]>(STORAGE_KEYS.records, [])),
    selectedCompanyId: readStorage<string | null>(STORAGE_KEYS.selectedCompanyId, null),
    adminLoggedIn: readStorage<boolean>(STORAGE_KEYS.adminLoggedIn, false),
    numberingSettings: readStorage<NumberingSettings>(STORAGE_KEYS.numberingSettings, numberingSettingsSeed),
  }
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false)
  const [companies, setCompanies] = useState<Company[]>(companiesSeed)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [isAdminLoggedIn, setIsAdminLoggedIn] = useState(false)
  const [products, setProducts] = useState<Product[]>(productsSeed)
  const [trucks, setTrucks] = useState<Truck[]>(trucksSeed)
  const [constructionSites, setConstructionSites] = useState<ConstructionSite[]>(constructionSitesSeed)
  const [records, setRecords] = useState<RecordItem[]>([])
  const [numberingSettings, setNumberingSettings] = useState<NumberingSettings>(numberingSettingsSeed)

  useEffect(() => {
    const persisted = loadPersistedState()
    setCompanies(persisted.companies)
    setProducts(persisted.products)
    setTrucks(persisted.trucks)
    setConstructionSites(persisted.constructionSites)
    setRecords(persisted.records)
    setIsAdminLoggedIn(persisted.adminLoggedIn)
    setNumberingSettings(persisted.numberingSettings)
    setSelectedCompany(
      persisted.companies.find((company) => company.id === persisted.selectedCompanyId) ?? null,
    )
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    writeStorage(STORAGE_KEYS.companies, companies)
  }, [hydrated, companies])

  useEffect(() => {
    if (!hydrated) return
    writeStorage(STORAGE_KEYS.products, products)
  }, [hydrated, products])

  useEffect(() => {
    if (!hydrated) return
    writeStorage(STORAGE_KEYS.trucks, trucks)
  }, [hydrated, trucks])

  useEffect(() => {
    if (!hydrated) return
    writeStorage(STORAGE_KEYS.constructionSites, constructionSites)
  }, [hydrated, constructionSites])

  useEffect(() => {
    if (!hydrated) return
    writeStorage(STORAGE_KEYS.records, records)
  }, [hydrated, records])

  useEffect(() => {
    if (!hydrated) return
    writeStorage(STORAGE_KEYS.selectedCompanyId, selectedCompany?.id ?? null)
  }, [hydrated, selectedCompany])

  useEffect(() => {
    if (!hydrated) return
    writeStorage(STORAGE_KEYS.adminLoggedIn, isAdminLoggedIn)
  }, [hydrated, isAdminLoggedIn])

  useEffect(() => {
    if (!hydrated) return
    writeStorage(STORAGE_KEYS.numberingSettings, numberingSettings)
  }, [hydrated, numberingSettings])

  useEffect(() => {
    if (!selectedCompany) return

    const exists = companies.some((company) => company.id === selectedCompany.id)
    if (!exists) {
      setSelectedCompany(null)
    }
  }, [companies, selectedCompany])

  useEffect(() => {
    if (typeof window === 'undefined') return

    function onStorage(event: StorageEvent) {
      if (!event.key) return

      if (event.key === STORAGE_KEYS.companies) {
        setCompanies(normalizeCompanies(readStorage<LegacyCompany[]>(STORAGE_KEYS.companies, companiesSeed)))
      }

      if (event.key === STORAGE_KEYS.products) {
        setProducts(normalizeProducts(readStorage<LegacyProduct[]>(STORAGE_KEYS.products, productsSeed)))
      }

      if (event.key === STORAGE_KEYS.trucks) {
        setTrucks(readStorage<Truck[]>(STORAGE_KEYS.trucks, trucksSeed))
      }

      if (event.key === STORAGE_KEYS.constructionSites) {
        setConstructionSites(readStorage<ConstructionSite[]>(STORAGE_KEYS.constructionSites, constructionSitesSeed))
      }

      if (event.key === STORAGE_KEYS.records) {
        setRecords(normalizeRecords(readStorage<RecordItem[]>(STORAGE_KEYS.records, [])))
      }

      if (event.key === STORAGE_KEYS.selectedCompanyId) {
        const selectedCompanyId = readStorage<string | null>(STORAGE_KEYS.selectedCompanyId, null)
        const nextCompanies = normalizeCompanies(
          readStorage<LegacyCompany[]>(STORAGE_KEYS.companies, companiesSeed),
        )
        setSelectedCompany(nextCompanies.find((company) => company.id === selectedCompanyId) ?? null)
      }

      if (event.key === STORAGE_KEYS.adminLoggedIn) {
        setIsAdminLoggedIn(readStorage<boolean>(STORAGE_KEYS.adminLoggedIn, false))
      }

      if (event.key === STORAGE_KEYS.numberingSettings) {
        setNumberingSettings(readStorage<NumberingSettings>(STORAGE_KEYS.numberingSettings, numberingSettingsSeed))
      }
    }

    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const value = useMemo<AppState>(
    () => ({
      hydrated,
      companies,
      selectedCompany,
      isLoggedIn: selectedCompany !== null,
      isAdminLoggedIn,
      products,
      trucks,
      constructionSites,
      records,
      numberingSettings,
      login: (companyId: string, pin: string) => {
        const company = companies.find((item) => item.id === companyId)
        if (!company) {
          return { ok: false, message: 'Bitte wähle eine Firma aus.' }
        }

        if (company.pin !== pin) {
          return { ok: false, message: 'PIN ist falsch.' }
        }

        setSelectedCompany(company)
        return { ok: true }
      },
      logout: () => {
        setSelectedCompany(null)
      },
      adminLogin: (password: string) => {
        if (password.trim() !== ADMIN_PASSWORD) {
          return { ok: false, message: 'Admin-Passwort ist falsch.' }
        }

        setIsAdminLoggedIn(true)
        return { ok: true }
      },
      adminLogout: () => {
        setIsAdminLoggedIn(false)
      },
      clearCache: () => {
        if (typeof window !== 'undefined') {
          const preserved = [STORAGE_KEYS.selectedCompanyId, STORAGE_KEYS.adminLoggedIn]
          Object.keys(localStorage)
            .filter((k) => k.startsWith('gaiser.') && !preserved.includes(k))
            .forEach((k) => localStorage.removeItem(k))
        }
        setCompanies(companiesSeed)
        setProducts(productsSeed)
        setTrucks(trucksSeed)
        setConstructionSites(constructionSitesSeed)
        setRecords([])
      },
      createRecord: ({ type, product, amount, constructionSiteName, company }: CreateRecordInput) => {
        const activeCompany = company ?? selectedCompany
        if (!activeCompany) return null

        const resolved = resolveConstructionSite(constructionSiteName, constructionSites)
        if (!resolved) return null

        if (resolved.isNew) {
          setConstructionSites((prev) => [...prev, resolved.site])
        }

        const unitPrice = getUnitPrice(product, type, activeCompany.priceCategory)
        const total = unitPrice * amount
        const deliveryNoteId = formatGeneratedNumber(
          numberingSettings.deliveryNoteTemplate,
          numberingSettings.nextDeliveryNoteNumber,
          numberingSettings.numberPadding,
        )
        const nextRecord: RecordItem = {
          id: Date.now(),
          company: activeCompany.name,
          constructionSiteId: resolved.site.id,
          constructionSiteName: resolved.site.name,
          type,
          productName: product.name,
          amount,
          unit: product.unit,
          unitPrice,
          total,
          status: 'lieferschein',
          createdAt: new Date().toLocaleString('de-DE'),
          deliveryNoteId,
        }

        setNumberingSettings((prev) => ({ ...prev, nextDeliveryNoteNumber: prev.nextDeliveryNoteNumber + 1 }))
        setRecords((prev) => [nextRecord, ...prev])
        return nextRecord
      },
      createTruckRecord: ({ truck, hours, constructionSiteName, company }: CreateTruckRecordInput) => {
        const activeCompany = company ?? selectedCompany
        if (!activeCompany) return null

        const resolved = resolveConstructionSite(constructionSiteName, constructionSites)
        if (!resolved) return null

        if (resolved.isNew) {
          setConstructionSites((prev) => [...prev, resolved.site])
        }

        const unitPrice = activeCompany.priceCategory === 'private' ? truck.privatePrice : truck.businessPrice
        const total = unitPrice * hours
        const deliveryNoteId = formatGeneratedNumber(
          numberingSettings.deliveryNoteTemplate,
          numberingSettings.nextDeliveryNoteNumber,
          numberingSettings.numberPadding,
        )
        const nextRecord: RecordItem = {
          id: Date.now(),
          company: activeCompany.name,
          constructionSiteId: resolved.site.id,
          constructionSiteName: resolved.site.name,
          type: 'lkw',
          productName: truck.name,
          amount: hours,
          unit: 'Std.',
          unitPrice,
          total,
          status: 'lieferschein',
          createdAt: new Date().toLocaleString('de-DE'),
          deliveryNoteId,
        }

        setNumberingSettings((prev) => ({ ...prev, nextDeliveryNoteNumber: prev.nextDeliveryNoteNumber + 1 }))
        setRecords((prev) => [nextRecord, ...prev])
        return nextRecord
      },
      createCompany: ({ shortCode, name, customerNumber, street, postalCode, city, pin, priceCategory }: CreateCompanyInput) => {
        const cleanedShortCode = shortCode.trim().toUpperCase()
        const cleanedName = name.trim()
        const cleanedPin = pin.replace(/[^0-9]/g, '').slice(0, 4)

        if (!cleanedShortCode || !cleanedName) {
          return { ok: false, message: 'Bitte Kundenname und Kürzel ausfüllen.' }
        }

        if (cleanedPin.length !== 4) {
          return { ok: false, message: 'Die PIN muss 4-stellig sein.' }
        }

        const hasShortCode = companies.some((company) => company.shortCode === cleanedShortCode)
        if (hasShortCode) {
          return { ok: false, message: 'Das Kundenkürzel ist bereits vergeben.' }
        }

        const company: Company = {
          id: `${cleanedShortCode.toLowerCase()}-${Date.now()}`,
          shortCode: cleanedShortCode,
          name: cleanedName,
          customerNumber: customerNumber.trim(),
          street: street.trim(),
          postalCode: postalCode.trim(),
          city: city.trim(),
          pin: cleanedPin,
          priceCategory,
        }

        setCompanies((prev) => [...prev, company])
        return { ok: true }
      },
      updateCompany: ({ id, shortCode, name, customerNumber, street, postalCode, city, pin, priceCategory }: UpdateCompanyInput) => {
        const company = companies.find((item) => item.id === id)
        if (!company) {
          return { ok: false, message: 'Der Kunde wurde nicht gefunden.' }
        }

        const cleanedShortCode = shortCode.trim().toUpperCase()
        const cleanedName = name.trim()
        const cleanedPin = pin.replace(/[^0-9]/g, '').slice(0, 4)

        if (!cleanedShortCode || !cleanedName) {
          return { ok: false, message: 'Bitte Kundenname und Kürzel ausfüllen.' }
        }

        if (cleanedPin.length !== 4) {
          return { ok: false, message: 'Die PIN muss 4-stellig sein.' }
        }

        const hasShortCode = companies.some(
          (item) => item.id !== id && item.shortCode.toUpperCase() === cleanedShortCode,
        )
        if (hasShortCode) {
          return { ok: false, message: 'Das Kundenkürzel ist bereits vergeben.' }
        }

        const updatedCompany: Company = {
          id,
          shortCode: cleanedShortCode,
          name: cleanedName,
          customerNumber: customerNumber.trim(),
          street: street.trim(),
          postalCode: postalCode.trim(),
          city: city.trim(),
          pin: cleanedPin,
          priceCategory,
        }

        setCompanies((prev) => prev.map((item) => (item.id === id ? updatedCompany : item)))

        if (selectedCompany?.id === id) {
          setSelectedCompany(updatedCompany)
        }

        if (company.name !== cleanedName) {
          setRecords((prev) =>
            prev.map((record) => {
              if (record.company !== company.name) return record
              return { ...record, company: cleanedName }
            }),
          )
        }

        return { ok: true }
      },
      deleteCompany: ({ id }: DeleteCompanyInput) => {
        const company = companies.find((item) => item.id === id)
        if (!company) {
          return { ok: false, message: 'Die Firma wurde nicht gefunden.' }
        }

        if (companies.length <= 1) {
          return { ok: false, message: 'Mindestens eine Firma muss vorhanden sein.' }
        }

        const hasHistory = records.some((record) => record.company === company.name)
        if (hasHistory) {
          return {
            ok: false,
            message: 'Firma kann nicht gelöscht werden, solange Historie-Einträge vorhanden sind.',
          }
        }

        setCompanies((prev) => prev.filter((item) => item.id !== id))

        if (selectedCompany?.id === id) {
          setSelectedCompany(null)
        }

        return { ok: true }
      },
      createProduct: ({ name, unit, flow, privatePrice, businessPrice }: CreateProductInput) => {
        const cleanedName = name.trim()
        const cleanedUnit = unit.trim()
        const parsedPrivatePrice = Number(privatePrice)
        const parsedBusinessPrice = Number(businessPrice)

        if (!cleanedName || !cleanedUnit) {
          return { ok: false, message: 'Bitte Produktname und Einheit ausfüllen.' }
        }

        if (
          Number.isNaN(parsedPrivatePrice) ||
          Number.isNaN(parsedBusinessPrice) ||
          parsedPrivatePrice < 0 ||
          parsedBusinessPrice < 0
        ) {
          return { ok: false, message: 'Preise müssen gültige positive Zahlen sein.' }
        }

        const nextId = products.reduce((maxValue, product) => Math.max(maxValue, product.id), 0) + 1
        const product: Product = {
          id: nextId,
          name: cleanedName,
          unit: cleanedUnit,
          flow,
          pickupPrivatePrice: flow === 'pickup' ? parsedPrivatePrice : 0,
          pickupBusinessPrice: flow === 'pickup' ? parsedBusinessPrice : 0,
          dropoffPrivatePrice: flow === 'dropoff' ? parsedPrivatePrice : 0,
          dropoffBusinessPrice: flow === 'dropoff' ? parsedBusinessPrice : 0,
        }

        setProducts((prev) => [...prev, product])
        return { ok: true }
      },
      updateProduct: ({ id, name, unit, flow, privatePrice, businessPrice }: UpdateProductInput) => {
        const currentProduct = products.find((item) => item.id === id)
        if (!currentProduct) {
          return { ok: false, message: 'Das Produkt wurde nicht gefunden.' }
        }

        const cleanedName = name.trim()
        const cleanedUnit = unit.trim()
        const parsedPrivatePrice = Number(privatePrice)
        const parsedBusinessPrice = Number(businessPrice)

        if (!cleanedName || !cleanedUnit) {
          return { ok: false, message: 'Bitte Produktname und Einheit ausfüllen.' }
        }

        if (
          Number.isNaN(parsedPrivatePrice) ||
          Number.isNaN(parsedBusinessPrice) ||
          parsedPrivatePrice < 0 ||
          parsedBusinessPrice < 0
        ) {
          return { ok: false, message: 'Preise müssen gültige positive Zahlen sein.' }
        }

        const updatedProduct: Product = {
          id,
          name: cleanedName,
          unit: cleanedUnit,
          flow,
          pickupPrivatePrice: flow === 'pickup' ? parsedPrivatePrice : 0,
          pickupBusinessPrice: flow === 'pickup' ? parsedBusinessPrice : 0,
          dropoffPrivatePrice: flow === 'dropoff' ? parsedPrivatePrice : 0,
          dropoffBusinessPrice: flow === 'dropoff' ? parsedBusinessPrice : 0,
        }

        setProducts((prev) => prev.map((item) => (item.id === id ? updatedProduct : item)))

        if (currentProduct.name !== cleanedName) {
          setRecords((prev) =>
            prev.map((record) => {
              if (record.productName !== currentProduct.name) return record
              return { ...record, productName: cleanedName }
            }),
          )
        }

        return { ok: true }
      },
      deleteProduct: ({ id }: DeleteProductInput) => {
        const currentProduct = products.find((item) => item.id === id)
        if (!currentProduct) {
          return { ok: false, message: 'Das Produkt wurde nicht gefunden.' }
        }

        const hasHistory = records.some((record) => record.productName === currentProduct.name)
        if (hasHistory) {
          return {
            ok: false,
            message: 'Produkt kann nicht gelöscht werden, solange Historie-Einträge vorhanden sind.',
          }
        }

        const flowCount = products.filter((item) => item.flow === currentProduct.flow).length
        if (flowCount <= 1) {
          return {
            ok: false,
            message: 'Mindestens ein Produkt pro Typ muss vorhanden sein.',
          }
        }

        setProducts((prev) => prev.filter((item) => item.id !== id))
        return { ok: true }
      },
      createTruck: ({ name, privatePrice, businessPrice }: CreateTruckInput) => {
        const cleanedName = name.trim()
        const parsedPrivatePrice = Number(privatePrice)
        const parsedBusinessPrice = Number(businessPrice)

        if (!cleanedName) {
          return { ok: false, message: 'Bitte LKW-Bezeichnung ausfüllen.' }
        }

        if (
          Number.isNaN(parsedPrivatePrice) ||
          Number.isNaN(parsedBusinessPrice) ||
          parsedPrivatePrice < 0 ||
          parsedBusinessPrice < 0
        ) {
          return { ok: false, message: 'Preise müssen gültige positive Zahlen sein.' }
        }

        const nextId = trucks.reduce((maxValue, truck) => Math.max(maxValue, truck.id), 0) + 1
        const truck: Truck = {
          id: nextId,
          name: cleanedName,
          privatePrice: parsedPrivatePrice,
          businessPrice: parsedBusinessPrice,
        }

        setTrucks((prev) => [...prev, truck])
        return { ok: true }
      },
      updateTruck: ({ id, name, privatePrice, businessPrice }: UpdateTruckInput) => {
        const currentTruck = trucks.find((item) => item.id === id)
        if (!currentTruck) {
          return { ok: false, message: 'Der LKW wurde nicht gefunden.' }
        }

        const cleanedName = name.trim()
        const parsedPrivatePrice = Number(privatePrice)
        const parsedBusinessPrice = Number(businessPrice)

        if (!cleanedName) {
          return { ok: false, message: 'Bitte LKW-Bezeichnung ausfüllen.' }
        }

        if (
          Number.isNaN(parsedPrivatePrice) ||
          Number.isNaN(parsedBusinessPrice) ||
          parsedPrivatePrice < 0 ||
          parsedBusinessPrice < 0
        ) {
          return { ok: false, message: 'Preise müssen gültige positive Zahlen sein.' }
        }

        const updatedTruck: Truck = {
          id,
          name: cleanedName,
          privatePrice: parsedPrivatePrice,
          businessPrice: parsedBusinessPrice,
        }

        setTrucks((prev) => prev.map((item) => (item.id === id ? updatedTruck : item)))

        if (currentTruck.name !== cleanedName) {
          setRecords((prev) =>
            prev.map((record) => {
              if (record.type !== 'lkw' || record.productName !== currentTruck.name) return record
              return { ...record, productName: cleanedName }
            }),
          )
        }

        return { ok: true }
      },
      deleteTruck: ({ id }: DeleteTruckInput) => {
        const currentTruck = trucks.find((item) => item.id === id)
        if (!currentTruck) {
          return { ok: false, message: 'Der LKW wurde nicht gefunden.' }
        }

        const hasHistory = records.some((record) => record.type === 'lkw' && record.productName === currentTruck.name)
        if (hasHistory) {
          return {
            ok: false,
            message: 'LKW kann nicht gelöscht werden, solange Historie-Einträge vorhanden sind.',
          }
        }

        if (trucks.length <= 1) {
          return { ok: false, message: 'Mindestens ein LKW muss vorhanden sein.' }
        }

        setTrucks((prev) => prev.filter((item) => item.id !== id))
        return { ok: true }
      },
      createConstructionSite: ({ name }: CreateConstructionSiteInput) => {
        const cleanedName = normalizeConstructionSiteName(name)
        if (!cleanedName) {
          return { ok: false, message: 'Bitte Baustellennamen ausfüllen.' }
        }

        const exists = constructionSites.some(
          (item) => item.name.toLocaleLowerCase('de-DE') === cleanedName.toLocaleLowerCase('de-DE'),
        )
        if (exists) {
          return { ok: false, message: 'Diese Baustelle existiert bereits.' }
        }

        const nextSite: ConstructionSite = {
          id: createConstructionSiteId(cleanedName),
          name: cleanedName,
        }

        setConstructionSites((prev) => [...prev, nextSite])
        return { ok: true }
      },
      updateConstructionSite: ({ id, name }: UpdateConstructionSiteInput) => {
        const currentSite = constructionSites.find((item) => item.id === id)
        if (!currentSite) {
          return { ok: false, message: 'Die Baustelle wurde nicht gefunden.' }
        }

        const cleanedName = normalizeConstructionSiteName(name)
        if (!cleanedName) {
          return { ok: false, message: 'Bitte Baustellennamen ausfüllen.' }
        }

        const alreadyExists = constructionSites.some(
          (item) =>
            item.id !== id &&
            item.name.toLocaleLowerCase('de-DE') === cleanedName.toLocaleLowerCase('de-DE'),
        )
        if (alreadyExists) {
          return { ok: false, message: 'Diese Baustelle existiert bereits.' }
        }

        setConstructionSites((prev) =>
          prev.map((item) => {
            if (item.id !== id) return item
            return { ...item, name: cleanedName }
          }),
        )

        if (currentSite.name !== cleanedName) {
          setRecords((prev) =>
            prev.map((record) => {
              if (record.constructionSiteId !== id) return record
              return { ...record, constructionSiteName: cleanedName }
            }),
          )
        }

        return { ok: true }
      },
      deleteConstructionSite: ({ id }: DeleteConstructionSiteInput) => {
        const currentSite = constructionSites.find((item) => item.id === id)
        if (!currentSite) {
          return { ok: false, message: 'Die Baustelle wurde nicht gefunden.' }
        }

        const hasHistory = records.some((record) => record.constructionSiteId === id)
        if (hasHistory) {
          return {
            ok: false,
            message: 'Baustelle kann nicht gelöscht werden, solange Historie-Einträge vorhanden sind.',
          }
        }

        setConstructionSites((prev) => prev.filter((item) => item.id !== id))
        return { ok: true }
      },
      updateRecordStatus: (recordId: number, status: RecordStatus) => {
        setRecords((prev) =>
          prev.map((record) => {
            if (record.id !== recordId) return record
            return { ...record, status }
          }),
        )
      },
      assignDeliveryNote: (recordIds: number[], deliveryNoteId: string) => {
        setRecords((prev) =>
          prev.map((record) => {
            if (!recordIds.includes(record.id)) return record
            return { ...record, deliveryNoteId }
          }),
        )
      },
      assignInvoice: (recordIds: number[], invoiceId: string, reverseCharge?: boolean) => {
        setRecords((prev) =>
          prev.map((record) => {
            if (!recordIds.includes(record.id)) return record
            return { ...record, invoiceId, invoiceReverseCharge: reverseCharge ?? false }
          }),
        )
      },
      assignCancel: (recordIds: number[], cancelId: string) => {
        setRecords((prev) =>
          prev.map((record) => {
            if (!recordIds.includes(record.id)) return record
            return { ...record, cancelId }
          }),
        )
      },
      updateNumberingSettings: (input: UpdateNumberingSettingsInput) => {
        if (input.invoiceTemplate !== undefined && !input.invoiceTemplate.trim()) {
          return { ok: false, message: 'Das Rechnungsnummer-Format darf nicht leer sein.' }
        }
        if (input.deliveryNoteTemplate !== undefined && !input.deliveryNoteTemplate.trim()) {
          return { ok: false, message: 'Das Lieferschein-Format darf nicht leer sein.' }
        }

        setNumberingSettings((prev) => ({ ...prev, ...input }))
        return { ok: true }
      },
      generateInvoiceNumber: () => {
        const value = formatGeneratedNumber(
          numberingSettings.invoiceTemplate,
          numberingSettings.nextInvoiceNumber,
          numberingSettings.numberPadding,
        )
        setNumberingSettings((prev) => ({ ...prev, nextInvoiceNumber: prev.nextInvoiceNumber + 1 }))
        return value
      },
      generateDeliveryNoteNumber: () => {
        const value = formatGeneratedNumber(
          numberingSettings.deliveryNoteTemplate,
          numberingSettings.nextDeliveryNoteNumber,
          numberingSettings.numberPadding,
        )
        setNumberingSettings((prev) => ({ ...prev, nextDeliveryNoteNumber: prev.nextDeliveryNoteNumber + 1 }))
        return value
      },
    }),
    [hydrated, companies, isAdminLoggedIn, products, trucks, constructionSites, records, selectedCompany, numberingSettings],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState() {
  const context = useContext(AppStateContext)
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider')
  }

  return context
}
