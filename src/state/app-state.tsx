import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { adminSessionStatusQueryOptions, adminSignIn, adminSignOut } from '../server/admin-auth'
import { customerSessionStatusQueryOptions, customerSignIn, customerSignOut } from '../server/customer-auth'
import {
  adminCompaniesQueryOptions,
  publicCompaniesQueryOptions,
  adminCreateCompany,
  adminUpdateCompany,
  adminDeleteCompany,
  adminSetCompanyPin,
} from '../server/companies'
import { productsQueryOptions, adminCreateProduct, adminUpdateProduct, adminDeleteProduct } from '../server/products'
import { trucksQueryOptions, adminCreateTruck, adminUpdateTruck, adminDeleteTruck } from '../server/trucks'
import {
  constructionSitesQueryOptions,
  adminCreateConstructionSite,
  adminUpdateConstructionSite,
  adminDeleteConstructionSite,
} from '../server/construction-sites'
import {
  numberingSettingsQueryOptions,
  updateNumberingSettings as apiUpdateNumberingSettings,
  generateInvoiceNumber as apiGenerateInvoiceNumber,
} from '../server/numbering'
import {
  recordsQueryOptions,
  createRecord as apiCreateRecord,
  createTruckRecord as apiCreateTruckRecord,
  updateRecordStatus as apiUpdateRecordStatus,
  assignInvoice as apiAssignInvoice,
  assignCancel as apiAssignCancel,
} from '../server/records'

export { formatGeneratedNumber } from '../utils/numbering-format'

export type FlowType = 'pickup' | 'dropoff'
export type RecordType = FlowType | 'lkw'
export type RecordStatus = 'offen' | 'lieferschein' | 'rechnung' | 'bezahlt' | 'storniert'
export type PriceCategory = 'private' | 'business'

// Every domain entity below lives in Supabase — see src/server/*.ts. Nothing
// in this file touches localStorage; AppStateProvider is a thin TanStack
// Query wrapper, not a data store.
export type Company = {
  id: string
  name: string
  customerNumber: string
  street: string
  postalCode: string
  city: string
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

const DEFAULT_NUMBERING_SETTINGS: NumberingSettings = {
  invoiceTemplate: 'RG-{JAHR}{MONAT}{TAG}-{NUMMER}',
  deliveryNoteTemplate: 'LS-{JAHR}{MONAT}{TAG}-{NUMMER}',
  nextInvoiceNumber: 1,
  nextDeliveryNoteNumber: 1,
  numberPadding: 4,
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
  name: string
  customerNumber: string
  street: string
  postalCode: string
  city: string
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

type SetCompanyPinInput = {
  companyId: string
  pin: string
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
  login: (companyId: string, pin: string) => Promise<LoginResult>
  logout: () => void
  adminLogin: (email: string, password: string) => Promise<LoginResult>
  adminLogout: () => void
  createRecord: (input: CreateRecordInput) => Promise<RecordItem | null>
  createTruckRecord: (input: CreateTruckRecordInput) => Promise<RecordItem | null>
  createCompany: (input: CreateCompanyInput) => Promise<CreateCompanyResult>
  updateCompany: (input: UpdateCompanyInput) => Promise<CreateCompanyResult>
  deleteCompany: (input: DeleteCompanyInput) => Promise<CreateCompanyResult>
  setCompanyPin: (input: SetCompanyPinInput) => Promise<CreateCompanyResult>
  createProduct: (input: CreateProductInput) => Promise<CreateCompanyResult>
  updateProduct: (input: UpdateProductInput) => Promise<CreateCompanyResult>
  deleteProduct: (input: DeleteProductInput) => Promise<CreateCompanyResult>
  createTruck: (input: CreateTruckInput) => Promise<CreateCompanyResult>
  updateTruck: (input: UpdateTruckInput) => Promise<CreateCompanyResult>
  deleteTruck: (input: DeleteTruckInput) => Promise<CreateCompanyResult>
  createConstructionSite: (input: CreateConstructionSiteInput) => Promise<CreateCompanyResult>
  updateConstructionSite: (input: UpdateConstructionSiteInput) => Promise<CreateCompanyResult>
  deleteConstructionSite: (input: DeleteConstructionSiteInput) => Promise<CreateCompanyResult>
  updateRecordStatus: (recordId: number, status: RecordStatus) => void
  assignInvoice: (recordIds: number[], invoiceId: string, reverseCharge?: boolean) => void
  assignCancel: (recordIds: number[], cancelId: string) => void
  updateNumberingSettings: (input: UpdateNumberingSettingsInput) => Promise<CreateCompanyResult>
  generateInvoiceNumber: () => Promise<string>
}

const AppStateContext = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()

  const adminSessionQuery = useQuery(adminSessionStatusQueryOptions())
  const customerSessionQuery = useQuery(customerSessionStatusQueryOptions())
  const isAdminLoggedIn = adminSessionQuery.data?.isAdminLoggedIn ?? false
  const selectedCompany = customerSessionQuery.data?.company ?? null
  const hasSession = isAdminLoggedIn || selectedCompany !== null

  // Two separate queries (rather than one conditional queryOptions object) so
  // each stays a single, stable shape — switching only which one is enabled.
  const adminCompaniesQuery = useQuery({ ...adminCompaniesQueryOptions(), enabled: isAdminLoggedIn })
  const publicCompaniesQuery = useQuery({ ...publicCompaniesQueryOptions(), enabled: !isAdminLoggedIn })
  const companiesQuery = isAdminLoggedIn ? adminCompaniesQuery : publicCompaniesQuery
  const companies = companiesQuery.data ?? []

  // Dual-mode catalog/records data — only meaningful once some session exists,
  // so these stay disabled (and don't block hydration) before any login.
  const productsQuery = useQuery({ ...productsQueryOptions(), enabled: hasSession })
  const trucksQuery = useQuery({ ...trucksQueryOptions(), enabled: hasSession })
  const constructionSitesQuery = useQuery({ ...constructionSitesQueryOptions(), enabled: hasSession })
  const recordsQuery = useQuery({ ...recordsQueryOptions(), enabled: hasSession })
  const numberingSettingsQuery = useQuery({ ...numberingSettingsQueryOptions(), enabled: isAdminLoggedIn })

  const products = productsQuery.data ?? []
  const trucks = trucksQuery.data ?? []
  const constructionSites = constructionSitesQuery.data ?? []
  const records = recordsQuery.data ?? []
  const numberingSettings = numberingSettingsQuery.data ?? DEFAULT_NUMBERING_SETTINGS

  const hydrated =
    adminSessionQuery.isFetched &&
    customerSessionQuery.isFetched &&
    companiesQuery.isFetched &&
    (!hasSession ||
      (productsQuery.isFetched && trucksQuery.isFetched && constructionSitesQuery.isFetched && recordsQuery.isFetched))

  const invalidate = (queryKey: readonly unknown[]) => void queryClient.invalidateQueries({ queryKey })

  const adminSignInMutation = useMutation({
    mutationFn: adminSignIn,
    onSuccess: (result) => {
      if (result.ok) invalidate(['auth', 'admin'])
    },
  })
  const adminSignOutMutation = useMutation({
    mutationFn: adminSignOut,
    onSuccess: () => {
      invalidate(['auth', 'admin'])
      invalidate(['companies'])
    },
  })
  const customerSignInMutation = useMutation({
    mutationFn: customerSignIn,
    onSuccess: (result) => {
      if (result.ok) invalidate(['auth', 'customer'])
    },
  })
  const customerSignOutMutation = useMutation({
    mutationFn: customerSignOut,
    onSuccess: () => invalidate(['auth', 'customer']),
  })
  const createCompanyMutation = useMutation({
    mutationFn: adminCreateCompany,
    onSuccess: (result) => {
      if (result.ok) invalidate(['companies'])
    },
  })
  const updateCompanyMutation = useMutation({
    mutationFn: adminUpdateCompany,
    onSuccess: (result) => {
      if (result.ok) invalidate(['companies'])
    },
  })
  const deleteCompanyMutation = useMutation({
    mutationFn: adminDeleteCompany,
    onSuccess: (result) => {
      if (result.ok) invalidate(['companies'])
    },
  })
  const setCompanyPinMutation = useMutation({ mutationFn: adminSetCompanyPin })

  const createProductMutation = useMutation({
    mutationFn: adminCreateProduct,
    onSuccess: (result) => {
      if (result.ok) invalidate(['products'])
    },
  })
  const updateProductMutation = useMutation({
    mutationFn: adminUpdateProduct,
    onSuccess: (result) => {
      if (result.ok) {
        invalidate(['products'])
        invalidate(['records'])
      }
    },
  })
  const deleteProductMutation = useMutation({
    mutationFn: adminDeleteProduct,
    onSuccess: (result) => {
      if (result.ok) invalidate(['products'])
    },
  })

  const createTruckMutation = useMutation({
    mutationFn: adminCreateTruck,
    onSuccess: (result) => {
      if (result.ok) invalidate(['trucks'])
    },
  })
  const updateTruckMutation = useMutation({
    mutationFn: adminUpdateTruck,
    onSuccess: (result) => {
      if (result.ok) {
        invalidate(['trucks'])
        invalidate(['records'])
      }
    },
  })
  const deleteTruckMutation = useMutation({
    mutationFn: adminDeleteTruck,
    onSuccess: (result) => {
      if (result.ok) invalidate(['trucks'])
    },
  })

  const createSiteMutation = useMutation({
    mutationFn: adminCreateConstructionSite,
    onSuccess: (result) => {
      if (result.ok) invalidate(['construction-sites'])
    },
  })
  const updateSiteMutation = useMutation({
    mutationFn: adminUpdateConstructionSite,
    onSuccess: (result) => {
      if (result.ok) {
        invalidate(['construction-sites'])
        invalidate(['records'])
      }
    },
  })
  const deleteSiteMutation = useMutation({
    mutationFn: adminDeleteConstructionSite,
    onSuccess: (result) => {
      if (result.ok) invalidate(['construction-sites'])
    },
  })

  const createRecordMutation = useMutation({
    mutationFn: apiCreateRecord,
    onSuccess: (record) => {
      if (record) invalidate(['records'])
    },
  })
  const createTruckRecordMutation = useMutation({
    mutationFn: apiCreateTruckRecord,
    onSuccess: (record) => {
      if (record) invalidate(['records'])
    },
  })
  const updateRecordStatusMutation = useMutation({
    mutationFn: apiUpdateRecordStatus,
    onSuccess: () => invalidate(['records']),
  })
  const assignInvoiceMutation = useMutation({
    mutationFn: apiAssignInvoice,
    onSuccess: () => invalidate(['records']),
  })
  const assignCancelMutation = useMutation({
    mutationFn: apiAssignCancel,
    onSuccess: () => invalidate(['records']),
  })

  const updateNumberingSettingsMutation = useMutation({
    mutationFn: apiUpdateNumberingSettings,
    onSuccess: (result) => {
      if (result.ok) invalidate(['numbering-settings'])
    },
  })
  const generateInvoiceNumberMutation = useMutation({
    mutationFn: apiGenerateInvoiceNumber,
    onSuccess: () => invalidate(['numbering-settings']),
  })

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
      login: async (companyId, pin) => customerSignInMutation.mutateAsync({ data: { companyId, pin } }),
      logout: () => customerSignOutMutation.mutate({}),
      adminLogin: async (email, password) => adminSignInMutation.mutateAsync({ data: { email, password } }),
      adminLogout: () => adminSignOutMutation.mutate({}),
      createRecord: async ({ type, product, amount, constructionSiteName, company }: CreateRecordInput) => {
        return createRecordMutation.mutateAsync({
          data: { type, productId: product.id, amount, constructionSiteName, companyId: company?.id },
        })
      },
      createTruckRecord: async ({ truck, hours, constructionSiteName, company }: CreateTruckRecordInput) => {
        return createTruckRecordMutation.mutateAsync({
          data: { truckId: truck.id, hours, constructionSiteName, companyId: company?.id },
        })
      },
      createCompany: async (input) => createCompanyMutation.mutateAsync({ data: input }),
      updateCompany: async (input) => updateCompanyMutation.mutateAsync({ data: input }),
      deleteCompany: async (input) => deleteCompanyMutation.mutateAsync({ data: input }),
      setCompanyPin: async (input) => setCompanyPinMutation.mutateAsync({ data: input }),
      createProduct: async (input) => createProductMutation.mutateAsync({ data: input }),
      updateProduct: async (input) => updateProductMutation.mutateAsync({ data: input }),
      deleteProduct: async (input) => deleteProductMutation.mutateAsync({ data: input }),
      createTruck: async (input) => createTruckMutation.mutateAsync({ data: input }),
      updateTruck: async (input) => updateTruckMutation.mutateAsync({ data: input }),
      deleteTruck: async (input) => deleteTruckMutation.mutateAsync({ data: input }),
      createConstructionSite: async (input) => createSiteMutation.mutateAsync({ data: input }),
      updateConstructionSite: async (input) => updateSiteMutation.mutateAsync({ data: input }),
      deleteConstructionSite: async (input) => deleteSiteMutation.mutateAsync({ data: input }),
      updateRecordStatus: (recordId, status) => updateRecordStatusMutation.mutate({ data: { recordId, status } }),
      assignInvoice: (recordIds, invoiceId, reverseCharge) =>
        assignInvoiceMutation.mutate({ data: { recordIds, invoiceId, reverseCharge } }),
      assignCancel: (recordIds, cancelId) => assignCancelMutation.mutate({ data: { recordIds, cancelId } }),
      updateNumberingSettings: async (input) => updateNumberingSettingsMutation.mutateAsync({ data: input }),
      generateInvoiceNumber: async () => generateInvoiceNumberMutation.mutateAsync({}),
    }),
    [
      hydrated,
      companies,
      selectedCompany,
      isAdminLoggedIn,
      products,
      trucks,
      constructionSites,
      records,
      numberingSettings,
      customerSignInMutation,
      customerSignOutMutation,
      adminSignInMutation,
      adminSignOutMutation,
      createRecordMutation,
      createTruckRecordMutation,
      createCompanyMutation,
      updateCompanyMutation,
      deleteCompanyMutation,
      setCompanyPinMutation,
      createProductMutation,
      updateProductMutation,
      deleteProductMutation,
      createTruckMutation,
      updateTruckMutation,
      deleteTruckMutation,
      createSiteMutation,
      updateSiteMutation,
      deleteSiteMutation,
      updateRecordStatusMutation,
      assignInvoiceMutation,
      assignCancelMutation,
      updateNumberingSettingsMutation,
      generateInvoiceNumberMutation,
    ],
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
