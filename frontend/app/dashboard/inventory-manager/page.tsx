'use client'

import { useEffect, useMemo, useState } from 'react'
import { Package, Warehouse as WarehouseIcon, ShoppingCart, ArrowRightLeft, TrendingUp, AlertTriangle, Plus, X, FilePlus2, Eye, CheckCircle2, XCircle, WalletCards, ReceiptText, Printer, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { FormField } from '@/components/ui/FormField'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { DateText } from '@/components/ui/DateText'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingButton } from '@/components/ui/AsyncButton'
import { useLanguage } from '@/context/LanguageContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import { useGetInventoryItemsQuery, useGetWarehousesQuery, useGetSuppliersQuery, useGetCustomersQuery, useGetDepartmentsQuery, useGetGoodsQuery, useGetMetersQuery, useGetInventoryPurchaseAccountsQuery, useGetInventoryRequestsQuery, useCreateInventoryRequestMutation, useApproveInventoryRequestMutation, useRecordInventoryPurchasePaymentMutation, useGetMeQuery, useGetSettingsQuery, useCreatePaymentMutation, type InventoryItem, type Warehouse, type Supplier, type Good, type Meter, type InventoryRequest } from '@/src/store/waternetApi'
import { StatsCard } from '@/components/StatsCard'
import AssetPurchasesPanel from '@/components/assets/AssetPurchasesPanel'

type ViewMode = 'items' | 'purchase' | 'issue' | 'asset-purchases'
type PurchaseItemForm = { good_id: string; quantity: string; unit_cost: string; warehouse_id: string; meter_serials: string }
type IssueItemForm = { inventory_item_id: string; quantity: string; unit_price: string; meter_ids: number[] }
const inventorySaleCustomerStatuses = new Set(['registered', 'awaiting_approval', 'awaiting_installation', 'active', 'suspended', 'disconnected'])

function meterSerials(value: string): string[] {
  return value
    .split(/[\n,]+/)
    .map((serial) => serial.trim())
    .filter(Boolean)
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as { data?: { message?: string; errors?: Record<string, string[]> } }
  const validation = apiError?.data?.errors
    ? Object.values(apiError.data.errors).flat()[0]
    : undefined

  return validation || apiError?.data?.message || fallback
}

function accountTypeForMethod(code?: string): string {
  switch (code) {
    case 'bank_transfer':
      return 'bank'
    case 'mobile_money':
      return 'mobile_money'
    case 'check':
      return 'check'
    case 'online_payment':
      return 'online'
    default:
      return 'cash'
  }
}

function money(value: string | number | undefined): string {
  return `AFN ${Number(value ?? 0).toLocaleString()}`
}

function salePaid(request: InventoryRequest): number {
  return Number(request.invoice?.paid_amount ?? 0)
}

function saleRemaining(request: InventoryRequest): number {
  return Number(request.invoice?.remaining_amount ?? request.total_amount)
}

function purchasePaid(request: InventoryRequest): number {
  return Number(request.paid_amount ?? 0)
}

function purchaseRemaining(request: InventoryRequest): number {
  return Number(request.remaining_amount ?? request.total_amount)
}

export default function InventoryManagerPage() {
  const { t } = useLanguage()
  const { businessDate } = useTrainingMode()
  const [view, setView] = useState<ViewMode>('items')
  const [isPurchaseOpen, setIsPurchaseOpen] = useState(false)
  const [isIssueOpen, setIsIssueOpen] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<InventoryRequest | null>(null)
  const [approvalAction, setApprovalAction] = useState<'approved' | 'rejected' | null>(null)
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemForm[]>([{ good_id: '', quantity: '', unit_cost: '', warehouse_id: '', meter_serials: '' }])
  const [issueItems, setIssueItems] = useState<IssueItemForm[]>([{ inventory_item_id: '', quantity: '', unit_price: '', meter_ids: [] }])
  const [issueType, setIssueType] = useState<'internal' | 'customer'>('internal')
  const [issuePurpose, setIssuePurpose] = useState<'separate_sale' | 'contract_material'>('separate_sale')
  const [issueTarget, setIssueTarget] = useState({ customer_id: '', department_id: '', account_id: '', payment_method_id: '', amount_paid: '0', warehouse_id: '', request_date: businessDate, notes: '' })
  const [purchaseData, setPurchaseData] = useState({ supplier_id: '', account_id: '', payment_method_id: '', amount_paid: '0', request_date: businessDate, notes: '' })
  const [paymentRequest, setPaymentRequest] = useState<InventoryRequest | null>(null)
  const [paymentData, setPaymentData] = useState({ amount: '', payment_method_id: '', account_id: '', paid_at: businessDate, reference: '', notes: '' })
  const [supplierPaymentRequest, setSupplierPaymentRequest] = useState<InventoryRequest | null>(null)
  const [supplierPaymentData, setSupplierPaymentData] = useState({ amount: '', payment_method_id: '', account_id: '', paid_at: businessDate, reference: '', notes: '' })
  const [paymentError, setPaymentError] = useState('')
  const [formError, setFormError] = useState('')
  const [notice, setNotice] = useState('')

  const { data: itemsData } = useGetInventoryItemsQuery({})
  const { data: warehousesData } = useGetWarehousesQuery({})
  const { data: suppliersData } = useGetSuppliersQuery({}, { skip: !isPurchaseOpen })
  const { data: customersData, isLoading: customersLoading, isError: customersError } = useGetCustomersQuery(undefined, { skip: !isIssueOpen || issueType !== 'customer' })
  const { data: departmentsData } = useGetDepartmentsQuery(undefined, { skip: !isIssueOpen || issueType !== 'internal' })
  const { data: goodsData } = useGetGoodsQuery({ status: 'active' }, { skip: !isPurchaseOpen })
  const { data: metersData = [] } = useGetMetersQuery(undefined, { skip: !isIssueOpen })
  const {
    data: accountsData,
    isLoading: accountsLoading,
    isError: accountsError,
  } = useGetInventoryPurchaseAccountsQuery(undefined, { skip: !isPurchaseOpen && !(isIssueOpen && issueType === 'customer') && !paymentRequest && !supplierPaymentRequest })
  const { data: currentUser } = useGetMeQuery()
  const { data: settingsData } = useGetSettingsQuery(undefined, { skip: !isPurchaseOpen && !(isIssueOpen && issueType === 'customer') && !paymentRequest && !supplierPaymentRequest })
  const { data: purchaseRequestsData } = useGetInventoryRequestsQuery({ type: 'purchase' }, { skip: view !== 'purchase' })
  const { data: issueRequestsData } = useGetInventoryRequestsQuery({ type: 'issue' }, { skip: view !== 'issue' })
  const [createRequest, { isLoading: isSubmitting }] = useCreateInventoryRequestMutation()
  const [approveRequest] = useApproveInventoryRequestMutation()
  const [createPayment, { isLoading: isReceivingPayment }] = useCreatePaymentMutation()
  const [recordPurchasePayment, { isLoading: isPayingSupplier }] = useRecordInventoryPurchasePaymentMutation()

  const items = itemsData ?? []
  const warehouses = (warehousesData?.data ?? []).filter((warehouse) => warehouse.status === 'active')
  const suppliers = (suppliersData ?? []).filter((supplier) => supplier.status === 'active')
  const customers = (customersData ?? []).filter((customer) => inventorySaleCustomerStatuses.has(customer.status))
  const selectedIssueCustomer = customers.find((customer) => customer.id === Number(issueTarget.customer_id))
  const selectedCustomerContract = selectedIssueCustomer?.latest_contract
  const customerHasCurrentContract = Boolean(
    selectedCustomerContract && ['installation_pending', 'active'].includes(selectedCustomerContract.status),
  )
  const departments = departmentsData ?? []
  const goods = goodsData ?? []
  const meters = metersData ?? []
  const accounts = (accountsData ?? []).filter((account) => account.status === 'active')
  const paymentMethods = (settingsData?.payment_methods ?? []).filter((method) => method.status === 'active')
  const purchaseRequests = purchaseRequestsData?.data ?? []
  const issueRequests = issueRequestsData?.data ?? []
  const canApprove = currentUser?.roles.some((role) => role === 'Admin' || role === 'Super Admin') ?? false
  const canReceivePayment = Boolean(currentUser && (
    currentUser.roles.some((role) => ['Collector', 'Accountant', 'Manager', 'Admin', 'Super Admin'].includes(role))
    || currentUser.permissions.includes('payments.create')
  ))
  const canPaySupplier = Boolean(currentUser && (
    currentUser.roles.some((role) => ['Accountant', 'Manager', 'Admin', 'Super Admin'].includes(role))
    || currentUser.permissions.includes('accounting.create')
    || currentUser.permissions.includes('expenses.create')
  ))
  const canViewAssetPurchases = currentUser?.roles.some((role) => ['Accountant', 'Manager', 'Admin', 'Super Admin'].includes(role)) ?? false
  const availableIssueItems = items.filter((item: InventoryItem) =>
    String(item.warehouse_id) === issueTarget.warehouse_id
    && Number(item.quantity) > 0
    && !(issueType === 'customer' && issuePurpose === 'contract_material' && item.category === 'meter')
  )

  const lowStockItems = items.filter((i: InventoryItem) => Number(i.quantity) <= Number(i.reorder_level))

  useEffect(() => {
    const requestedView = new URLSearchParams(window.location.search).get('view')
    if (requestedView === 'purchase' || requestedView === 'issue' || requestedView === 'items') {
      const frame = window.requestAnimationFrame(() => setView(requestedView))

      return () => window.cancelAnimationFrame(frame)
    }
    if (requestedView === 'asset-purchases' && canViewAssetPurchases) {
      const frame = window.requestAnimationFrame(() => setView('asset-purchases'))

      return () => window.cancelAnimationFrame(frame)
    }
  }, [canViewAssetPurchases])

  const purchaseTotals = useMemo(() => purchaseItems.reduce((acc, item) => {
    const qty = Number(item.quantity) || 0
    const cost = Number(item.unit_cost) || 0
    acc.totalQuantity += qty
    acc.totalCost += qty * cost
    return acc
  }, { totalQuantity: 0, totalCost: 0 }), [purchaseItems])

  const purchaseInitialPayment = Number(purchaseData.amount_paid) || 0
  const purchaseRemainingAmount = Math.max(0, purchaseTotals.totalCost - purchaseInitialPayment)
  const purchaseInitialPaymentIsInvalid = purchaseInitialPayment < 0 || purchaseInitialPayment > purchaseTotals.totalCost + 0.005
  const selectedPurchasePaymentMethod = paymentMethods.find((method) => method.id === Number(purchaseData.payment_method_id))
  const purchasePaymentAccounts = selectedPurchasePaymentMethod
    ? accounts.filter((account) => account.type === accountTypeForMethod(selectedPurchasePaymentMethod.code))
    : []

  const issueTotals = useMemo(() => issueItems.reduce((acc, item) => {
    const qty = Number(item.quantity) || 0
    const price = Number(item.unit_price) || 0
    acc.totalQuantity += qty
    acc.totalPrice += qty * price
    return acc
  }, { totalQuantity: 0, totalPrice: 0 }), [issueItems])

  const initialPaymentAmount = Number(issueTarget.amount_paid) || 0
  const issueRemainingAmount = Math.max(0, issueTotals.totalPrice - initialPaymentAmount)
  const initialPaymentIsInvalid = initialPaymentAmount < 0 || initialPaymentAmount > issueTotals.totalPrice + 0.005
  const selectedIssuePaymentMethod = paymentMethods.find((method) => method.id === Number(issueTarget.payment_method_id))
  const issuePaymentAccounts = selectedIssuePaymentMethod
    ? accounts.filter((account) => account.type === accountTypeForMethod(selectedIssuePaymentMethod.code))
    : []
  const selectedReceivePaymentMethod = paymentMethods.find((method) => method.id === Number(paymentData.payment_method_id))
  const receivePaymentAccounts = selectedReceivePaymentMethod
    ? accounts.filter((account) => account.type === accountTypeForMethod(selectedReceivePaymentMethod.code))
    : []
  const selectedSupplierPaymentMethod = paymentMethods.find((method) => method.id === Number(supplierPaymentData.payment_method_id))
  const supplierPaymentAccounts = selectedSupplierPaymentMethod
    ? accounts.filter((account) => account.type === accountTypeForMethod(selectedSupplierPaymentMethod.code))
    : []

  const hasInvalidIssueItems = issueItems.some((item) => {
    const selectedItem = availableIssueItems.find((inventoryItem) => inventoryItem.id === Number(item.inventory_item_id))
    const quantity = Number(item.quantity)
    const serializedMismatch = selectedItem?.category === 'meter'
      && (item.meter_ids.length !== quantity || item.meter_ids.length === 0)

    return !selectedItem
      || !Number.isFinite(quantity)
      || quantity <= 0
      || quantity > Number(selectedItem.quantity)
      || serializedMismatch
      || item.unit_price === ''
      || (issueType === 'customer' && Number(item.unit_price) <= 0)
  })
  const columns: Column<InventoryItem>[] = [
    { key: 'code', label: 'Code', render: (item) => <span className="font-mono text-xs">{item.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category', render: (item) => <Badge variant="blue">{item.category}</Badge> },
    { key: 'quantity', label: 'Stock', render: (item) => (
      <span className={Number(item.quantity) <= Number(item.reorder_level) ? 'text-[var(--coral)] font-bold' : ''}>
        {Number(item.quantity).toLocaleString()} {item.unit}
        {Number(item.quantity) <= Number(item.reorder_level) && <AlertTriangle className="inline h-4 w-4 ms-2 text-[var(--coral)]" />}
      </span>
    )},
    { key: 'unit_cost', label: 'Cost', render: (item) => `AFN ${Number(item.unit_cost).toLocaleString()}` },
    { key: 'unit_price', label: 'Price', render: (item) => `AFN ${Number(item.unit_price).toLocaleString()}` },
    { key: 'total_value', label: 'Value', render: (item) => `AFN ${(Number(item.quantity) * Number(item.unit_cost)).toLocaleString()}` },
  ]

  const openReceivePayment = (request: InventoryRequest) => {
    if (!request.invoice || saleRemaining(request) <= 0.005) return

    setPaymentError('')
    setPaymentRequest(request)
    setPaymentData({
      amount: String(saleRemaining(request)),
      payment_method_id: '',
      account_id: '',
      paid_at: businessDate,
      reference: request.request_number,
      notes: '',
    })
    setSelectedRequest(null)
  }

  const openSupplierPayment = (request: InventoryRequest) => {
    const remaining = purchaseRemaining(request)
    if (request.type !== 'purchase' || request.status !== 'approved' || remaining <= 0.005) return

    setPaymentError('')
    setSupplierPaymentRequest(request)
    setSupplierPaymentData({
      amount: String(remaining),
      payment_method_id: '',
      account_id: '',
      paid_at: businessDate,
      reference: request.request_number,
      notes: '',
    })
    setSelectedRequest(null)
  }

  const canPrintDocument = (request: InventoryRequest) => request.status === 'approved'
    && Boolean(request.document_number)
    && (request.type === 'purchase' || request.issue_type === 'customer' || Boolean(request.customer_id))

  const printDocument = (request: InventoryRequest) => {
    const printWindow = window.open(`/print/inventory-bill/${request.id}`, '_blank')
    if (!printWindow) {
      setNotice('Allow pop-ups to open the generated bill.')
      return
    }
    printWindow.opener = null
  }

  const requestActions = (request: InventoryRequest) => (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => setSelectedRequest(request)}
        className="icon-button"
        title="View details"
        aria-label={`View ${request.request_number}`}
      >
        <Eye className="h-4 w-4" />
      </button>
      {canPrintDocument(request) ? (
        <button
          type="button"
          onClick={() => printDocument(request)}
          className="icon-button text-[#305477]"
          title={request.type === 'purchase' ? 'Print purchase bill' : 'Print sales invoice'}
          aria-label={`Print ${request.document_number}`}
        >
          <Printer className="h-4 w-4" />
        </button>
      ) : null}
      {canReceivePayment
        && request.status === 'approved'
        && (request.issue_type === 'customer' || request.customer_id)
        && request.invoice
        && saleRemaining(request) > 0.005 ? (
          <button
            type="button"
            onClick={() => openReceivePayment(request)}
            className="icon-button text-[var(--mint)]"
            title="Receive payment"
            aria-label={`Receive payment for ${request.request_number}`}
          >
            <WalletCards className="h-4 w-4" />
          </button>
        ) : null}
      {canPaySupplier
        && request.type === 'purchase'
        && request.status === 'approved'
        && purchaseRemaining(request) > 0.005 ? (
          <button
            type="button"
            onClick={() => openSupplierPayment(request)}
            className="icon-button text-[var(--gold)]"
            title="Pay supplier"
            aria-label={`Pay supplier for ${request.request_number}`}
          >
            <WalletCards className="h-4 w-4" />
          </button>
        ) : null}
      {canApprove && request.status === 'pending' ? (
        <>
          <button
            type="button"
            onClick={() => {
              setSelectedRequest(request)
              setApprovalAction('approved')
            }}
            className="icon-button text-[var(--mint)]"
            title="Approve"
            aria-label={`Approve ${request.request_number}`}
          >
            <CheckCircle2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedRequest(request)
              setApprovalAction('rejected')
            }}
            className="icon-button text-[var(--coral)]"
            title="Reject"
            aria-label={`Reject ${request.request_number}`}
          >
            <XCircle className="h-4 w-4" />
          </button>
        </>
      ) : null}
    </div>
  )

  const purchaseRequestColumns: Column<InventoryRequest>[] = [
    { key: 'request_number', label: 'Purchase #', render: (req) => <span className="font-mono text-xs font-bold">{req.request_number}</span> },
    { key: 'supplier_id', label: 'Supplier', render: (req) => req.supplier?.name ?? '-' },
    { key: 'document_number', label: 'Purchase Bill', render: (req) => req.document_number ? <span className="font-mono text-xs font-bold text-[#305477]">{req.document_number}</span> : <span className="text-xs text-[var(--text-muted)]">After approval</span> },
    { key: 'total_amount', label: 'Total', render: (req) => money(req.total_amount) },
    {
      key: 'paid_amount',
      label: 'Paid',
      render: (req) => (
        <div>
          <span className="font-bold text-[var(--mint)]">{money(purchasePaid(req))}</span>
          {req.status === 'pending' && Number(req.initial_payment_amount) > 0.005 ? (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{money(req.initial_payment_amount)} on approval</p>
          ) : null}
        </div>
      ),
    },
    { key: 'remaining_amount', label: 'Remaining', render: (req) => <span className="font-bold text-[var(--gold)]">{money(purchaseRemaining(req))}</span> },
    { key: 'payment_status', label: 'Payment', render: (req) => <Badge variant={req.payment_status === 'paid' ? 'emerald' : req.payment_status === 'partially_paid' ? 'amber' : 'red'}>{req.payment_status.replaceAll('_', ' ')}</Badge> },
    { key: 'status', label: 'Status', render: (req) => (<Badge variant={req.status === 'pending' ? 'amber' : req.status === 'approved' ? 'emerald' : 'red'}>{req.status}</Badge>)},
    { key: 'request_date', label: 'Date', render: (req) => <DateText value={req.request_date} /> },
    { key: 'warehouse', label: 'Warehouse', render: (req) => req.warehouse?.name ?? '-' },
    { key: 'items', label: 'Purchased Goods', render: (req) => req.items?.map((item) => `${item.description} x ${Number(item.quantity).toLocaleString()}${item.meter_serials?.length ? ` (${item.meter_serials.length} serials)` : ''}`).join(', ') || '-' },
    { key: 'requester', label: 'Requested By', render: (req) => req.requester?.name ?? '-' },
    { key: 'approved_at', label: 'Processed At', render: (req) => <DateText value={req.approved_at} /> },
    { key: 'actions', label: 'Actions', render: requestActions },
  ]

  const issueRequestColumns: Column<InventoryRequest>[] = [
    { key: 'request_number', label: 'Issue #', render: (req) => <span className="font-mono text-xs font-bold">{req.request_number}</span> },
    { key: 'issue_type', label: 'Issue Type', render: (req) => req.issue_type === 'customer' || req.customer_id ? (req.issue_purpose === 'contract_material' ? 'Contract Material' : 'Customer Sale') : 'Internal Use' },
    { key: 'customer_id', label: 'Issued To', render: (req) => req.customer?.name ?? req.department?.name ?? '-' },
    { key: 'document_number', label: 'Bill / Invoice', render: (req) => req.issue_type === 'customer' || req.customer_id ? (req.document_number ? <span className="font-mono text-xs font-bold text-[#305477]">{req.document_number}</span> : <span className="text-xs text-[var(--text-muted)]">After approval</span>) : '-' },
    { key: 'total_amount', label: 'Total', render: (req) => money(req.total_amount) },
    {
      key: 'paid_amount',
      label: 'Paid',
      render: (req) => req.issue_type === 'customer' || req.customer_id ? (
        <div>
          <span className="font-bold text-[var(--mint)]">{money(salePaid(req))}</span>
          {req.status === 'pending' && Number(req.initial_payment_amount) > 0.005 ? (
            <p className="mt-0.5 text-xs text-[var(--text-muted)]">{money(req.initial_payment_amount)} on approval</p>
          ) : null}
        </div>
      ) : '-',
    },
    { key: 'remaining_amount', label: 'Remaining', render: (req) => req.issue_type === 'customer' || req.customer_id ? <span className="font-bold">{money(saleRemaining(req))}</span> : '-' },
    {
      key: 'payment_status',
      label: 'Payment',
      render: (req) => {
        if (!(req.issue_type === 'customer' || req.customer_id)) return <Badge variant="slate">No cash</Badge>
        const paymentStatus = req.invoice?.status ?? (req.status === 'pending' ? 'awaiting approval' : 'unpaid')
        return <Badge variant={paymentStatus === 'paid' ? 'emerald' : paymentStatus === 'partially_paid' ? 'amber' : paymentStatus === 'unpaid' ? 'red' : 'slate'}>{paymentStatus.replaceAll('_', ' ')}</Badge>
      },
    },
    { key: 'status', label: 'Record Status', render: (req) => (<Badge variant={req.status === 'pending' ? 'amber' : req.status === 'approved' ? 'emerald' : 'red'}>{req.status}</Badge>)},
    { key: 'request_date', label: 'Date', render: (req) => <DateText value={req.request_date} /> },
    { key: 'warehouse', label: 'Warehouse', render: (req) => req.warehouse?.name ?? '-' },
    { key: 'account', label: 'Initial Account', render: (req) => req.account?.name ?? 'No initial payment' },
    { key: 'items', label: 'Issued Goods', render: (req) => req.items?.map((item) => `${item.description} x ${Number(item.quantity).toLocaleString()}`).join(', ') || '-' },
    { key: 'requester', label: 'Requested By', render: (req) => req.requester?.name ?? '-' },
    { key: 'approved_at', label: 'Processed At', render: (req) => <DateText value={req.approved_at} /> },
    { key: 'actions', label: 'Actions', render: requestActions },
  ]

  const resetIssueForm = () => {
    setIssueType('internal')
    setIssuePurpose('separate_sale')
    setIssueTarget({ customer_id: '', department_id: '', account_id: '', payment_method_id: '', amount_paid: '0', warehouse_id: '', request_date: businessDate, notes: '' })
    setIssueItems([{ inventory_item_id: '', quantity: '', unit_price: '', meter_ids: [] }])
    setFormError('')
  }

  const handlePurchase = async () => {
    setFormError('')

    // Validate required fields
    if (!purchaseData.supplier_id) {
      setFormError('Please select a supplier.')
      return
    }
    if (!purchaseItems[0]?.warehouse_id) {
      setFormError('Please select a warehouse.')
      return
    }
    if (purchaseInitialPaymentIsInvalid) {
      setFormError(`Paid now must be between AFN 0 and ${money(purchaseTotals.totalCost)}.`)
      return
    }
    if (purchaseInitialPayment > 0.005 && (!purchaseData.payment_method_id || !purchaseData.account_id)) {
      setFormError('Select a payment method and paying account for the amount paid now.')
      return
    }
    const selectedPurchaseAccount = accounts.find((account) => account.id === Number(purchaseData.account_id))
    if (purchaseInitialPayment > 0.005 && selectedPurchaseAccount && Number(selectedPurchaseAccount.current_balance) + 0.005 < purchaseInitialPayment) {
      setFormError(`The selected account only has ${money(selectedPurchaseAccount.current_balance)} available.`)
      return
    }

    // Validate items
    for (let i = 0; i < purchaseItems.length; i++) {
      const item = purchaseItems[i]
      if (!item.good_id) {
        setFormError(`Please select a good for item ${i + 1}.`)
        return
      }
      if (!item.quantity || Number(item.quantity) <= 0) {
        setFormError(`Please enter a valid quantity for item ${i + 1}.`)
        return
      }
      if (!item.unit_cost || Number(item.unit_cost) < 0) {
        setFormError(`Please enter a valid unit cost for item ${i + 1}.`)
        return
      }
      // Validate meter serials for meter category
      const good = goods.find((g) => g.id === Number(item.good_id))
      if (good?.category === 'meter') {
        const serials = meterSerials(item.meter_serials)
        const qty = Number(item.quantity)
        if (serials.length !== qty) {
          setFormError(`Item ${i + 1}: Enter ${qty} meter serial${qty > 1 ? 's' : ''} (one per line). You entered ${serials.length}.`)
          return
        }
      }
    }

    try {
      const payload = {
        type: 'purchase' as const,
        supplier_id: Number(purchaseData.supplier_id),
        accounting_account_id: purchaseInitialPayment > 0.005 ? Number(purchaseData.account_id) : undefined,
        payment_method_id: purchaseInitialPayment > 0.005 ? Number(purchaseData.payment_method_id) : undefined,
        amount_paid: purchaseInitialPayment,
        warehouse_id: Number(purchaseItems[0]?.warehouse_id),
        request_date: purchaseData.request_date,
        notes: purchaseData.notes,
        items: purchaseItems.map(item => ({
          good_id: Number(item.good_id),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_cost),
          meter_serials: goods.find((good) => good.id === Number(item.good_id))?.category === 'meter'
            ? meterSerials(item.meter_serials)
            : undefined,
        })),
      }

      await createRequest(payload).unwrap()
      setIsPurchaseOpen(false)
      setPurchaseData({ supplier_id: '', account_id: '', payment_method_id: '', amount_paid: '0', request_date: businessDate, notes: '' })
      setPurchaseItems([{ good_id: '', quantity: '', unit_cost: '', warehouse_id: '', meter_serials: '' }])
      setNotice(purchaseInitialPayment > 0.005
        ? `Purchase sent for approval. On approval, ${money(purchaseInitialPayment)} will be paid and ${money(purchaseRemainingAmount)} will remain payable.`
        : `Purchase sent for approval. Goods will be received as unpaid, with ${money(purchaseTotals.totalCost)} payable to the supplier.`)
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Unable to submit the purchase request.'))
    }
  }

  const handleIssue = async () => {
    setFormError('')
    try {
      await createRequest({
        type: 'issue',
        issue_type: issueType,
        issue_purpose: issueType === 'customer' ? issuePurpose : undefined,
        customer_id: issueType === 'customer' ? Number(issueTarget.customer_id) : undefined,
        customer_contract_id: issueType === 'customer' && issuePurpose === 'contract_material'
          ? selectedCustomerContract?.id
          : undefined,
        department_id: issueType === 'internal' ? Number(issueTarget.department_id) : undefined,
        accounting_account_id: issueType === 'customer' && initialPaymentAmount > 0.005 ? Number(issueTarget.account_id) : undefined,
        payment_method_id: issueType === 'customer' && initialPaymentAmount > 0.005 ? Number(issueTarget.payment_method_id) : undefined,
        amount_paid: issueType === 'customer' ? initialPaymentAmount : undefined,
        warehouse_id: Number(issueTarget.warehouse_id),
        request_date: issueTarget.request_date,
        notes: issueTarget.notes,
        items: issueItems.map(item => ({
          inventory_item_id: Number(item.inventory_item_id),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          meter_ids: item.meter_ids.length ? item.meter_ids : undefined,
        })),
      }).unwrap()
      setIsIssueOpen(false)
      resetIssueForm()
      setNotice(issueType === 'customer'
        ? initialPaymentAmount > 0.005
          ? `Sale submitted. On approval, ${money(initialPaymentAmount)} will be received and ${money(issueRemainingAmount)} will remain payable.`
          : `Sale submitted. Approval will create an unpaid invoice for ${money(issueTotals.totalPrice)}.`
        : 'Internal issue request submitted. After admin approval, stock will decrease without changing a cash account.')
    } catch (err) {
      setFormError(apiErrorMessage(err, 'Unable to submit the issue request.'))
    }
  }

  const handleReceivePayment = async () => {
    if (!paymentRequest?.invoice || !paymentRequest.customer_id) return

    const amount = Number(paymentData.amount)
    const remaining = saleRemaining(paymentRequest)
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.005) {
      setPaymentError(`Enter an amount between AFN 0.01 and ${money(remaining)}.`)
      return
    }
    if (!paymentData.payment_method_id || !paymentData.account_id) {
      setPaymentError('Select a payment method and receiving account.')
      return
    }

    setPaymentError('')
    try {
      const payment = await createPayment({
        customer_id: paymentRequest.customer_id,
        payment_method_id: Number(paymentData.payment_method_id),
        accounting_account_id: Number(paymentData.account_id),
        paid_at: paymentData.paid_at,
        reference: paymentData.reference || paymentRequest.request_number,
        notes: paymentData.notes || undefined,
        items: [{
          type: 'invoice',
          id: paymentRequest.invoice.id,
          amount,
        }],
      }).unwrap()

      setNotice(`${money(amount)} received for ${paymentRequest.request_number}. Receipt ${payment.receipt_number}. Remaining: ${money(Math.max(0, remaining - amount))}.`)
      setPaymentRequest(null)
    } catch (error) {
      setPaymentError(apiErrorMessage(error, 'Unable to receive this payment.'))
    }
  }

  const handleSupplierPayment = async () => {
    if (!supplierPaymentRequest) return

    const amount = Number(supplierPaymentData.amount)
    const remaining = purchaseRemaining(supplierPaymentRequest)
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining + 0.005) {
      setPaymentError(`Enter an amount between AFN 0.01 and ${money(remaining)}.`)
      return
    }
    if (!supplierPaymentData.payment_method_id || !supplierPaymentData.account_id) {
      setPaymentError('Select a payment method and paying account.')
      return
    }

    setPaymentError('')
    try {
      const updated = await recordPurchasePayment({
        id: supplierPaymentRequest.id,
        amount,
        payment_method_id: Number(supplierPaymentData.payment_method_id),
        accounting_account_id: Number(supplierPaymentData.account_id),
        paid_at: supplierPaymentData.paid_at,
        reference: supplierPaymentData.reference || supplierPaymentRequest.request_number,
        notes: supplierPaymentData.notes || undefined,
      }).unwrap()

      const payment = updated.purchase_payments?.at(-1)
      setNotice(`${money(amount)} paid to ${updated.supplier?.name ?? 'the supplier'}. Receipt ${payment?.receipt_number ?? 'recorded'}. Remaining: ${money(purchaseRemaining(updated))}.`)
      setSupplierPaymentRequest(null)
    } catch (error) {
      setPaymentError(apiErrorMessage(error, 'Unable to record this supplier payment.'))
    }
  }

  const handleApproval = async () => {
    if (!selectedRequest || !approvalAction) return

    const result = await approveRequest({
      id: selectedRequest.id,
      status: approvalAction,
      approval_notes: '',
    }).unwrap()

    const recordType = selectedRequest.type === 'purchase' ? 'Purchase' : 'Issue'
    const documentLabel = result.type === 'purchase' ? 'purchase bill' : 'sales invoice'
    setNotice(approvalAction === 'approved' && result.document_number
      ? `${recordType} ${selectedRequest.request_number} approved. ${documentLabel} ${result.document_number} was generated automatically.`
      : `${recordType} ${selectedRequest.request_number} ${approvalAction}.`)
    setSelectedRequest(approvalAction === 'approved' ? result : null)
    setApprovalAction(null)
  }

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
      <PageHeader title={t('inventoryManager')} subtitle={t('purchaseStoreSell')} />
      {notice && (
        <div role="status" className="rounded-lg border border-[var(--mint)]/30 bg-[var(--mint-soft)] px-4 py-3 text-sm font-bold text-[var(--mint)]">
          {notice}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title={t('totalItems')} value={items.length} icon={<Package className="h-5 w-5 text-[var(--accent)]" />} />
        <StatsCard title={t('lowStock')} value={lowStockItems.length} icon={<AlertTriangle className="h-5 w-5 text-[var(--coral)]" />} />
        <StatsCard title={t('warehouses')} value={warehouses.length} icon={<WarehouseIcon className="h-5 w-5 text-[var(--mint)]" />} />
        <StatsCard title={t('totalValue')} value={`AFN ${items.reduce((sum: number, i: InventoryItem) => sum + Number(i.quantity) * Number(i.unit_cost), 0).toLocaleString()}`} icon={<TrendingUp className="h-5 w-5 text-[var(--gold)]" />} />
      </div>
      <div className="flex flex-wrap gap-3">
        <button onClick={() => setView('items')} className={`h-10 px-4 text-sm flex items-center gap-2 ${view === 'items' ? 'btn-primary' : 'btn-secondary'}`}><Package className="h-4 w-4" /> {t('viewItems')}</button>
        <button onClick={() => setView('purchase')} className={`h-10 px-4 text-sm flex items-center gap-2 ${view === 'purchase' ? 'btn-primary' : 'btn-secondary'}`}><ShoppingCart className="h-4 w-4" /> {t('purchaseGoods')}</button>
        <button onClick={() => setView('issue')} className={`h-10 px-4 text-sm flex items-center gap-2 ${view === 'issue' ? 'btn-primary' : 'btn-secondary'}`}><ArrowRightLeft className="h-4 w-4" /> {t('issueGoods')}</button>
        {canViewAssetPurchases ? (
          <button onClick={() => setView('asset-purchases')} className={`h-10 px-4 text-sm flex items-center gap-2 ${view === 'asset-purchases' ? 'btn-primary' : 'btn-secondary'}`}><Wrench className="h-4 w-4" /> {t('assetPurchases')}</button>
        ) : null}
      </div>

      {view === 'items' && (<div className="elegant-panel p-4"><DataTable data={items} columns={columns} searchKeys={['name', 'code']} emptyMessage={t('noRecordsFound')} /></div>)}

      {view === 'purchase' && (
        <div className="elegant-panel p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-lg font-extrabold text-[var(--text-primary)]">{t('purchaseGoods')}</h2><p className="text-sm text-[var(--text-muted)]">{t('allPendingApprovedRejected')}</p></div>
            <button onClick={() => { setFormError(''); setIsPurchaseOpen(true) }} className="btn-primary flex h-10 items-center gap-2 px-5 text-sm font-bold"><FilePlus2 className="h-4 w-4" /> {t('newPurchase')}</button>
          </div>
          <DataTable data={purchaseRequests} columns={purchaseRequestColumns} searchKeys={['request_number']} emptyMessage={t('noRecordsFound')} />
        </div>
      )}

      {view === 'issue' && (
        <div className="elegant-panel p-6">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-lg font-extrabold text-[var(--text-primary)]">{t('issueGoods')}</h2><p className="text-sm text-[var(--text-muted)]">{t('customerSalesInternalIssues')}</p></div>
            <button onClick={() => { resetIssueForm(); setIsIssueOpen(true) }} className="btn-primary flex h-10 items-center gap-2 px-5 text-sm font-bold"><FilePlus2 className="h-4 w-4" /> {t('newIssue')}</button>
          </div>
          <DataTable data={issueRequests} columns={issueRequestColumns} searchKeys={['request_number']} summaryColumnCount={7} emptyMessage={t('noRecordsFound')} />
        </div>
      )}

      {view === 'asset-purchases' && canViewAssetPurchases ? (
        <div className="elegant-panel p-6">
          <AssetPurchasesPanel />
        </div>
      ) : null}

      <Modal isOpen={isPurchaseOpen} onClose={() => { setIsPurchaseOpen(false); setFormError('') }} title={t('purchaseGoods')} size="40p" centered>
        <div className="space-y-4">
          {formError && <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{formError}</div>}
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-1.5"><label className="text-xs font-bold text-[var(--text-secondary)]">{t('supplier')}</label><select value={purchaseData.supplier_id} onChange={(e) => setPurchaseData({ ...purchaseData, supplier_id: e.target.value })} className="field-control h-10 px-3 text-sm w-full"><option value="">{t('selectSupplier')}</option>{suppliers.map((s: Supplier) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div className="space-y-1.5"><label className="text-xs font-bold text-[var(--text-secondary)]">{t('warehouse')}</label><select value={purchaseItems[0]?.warehouse_id} onChange={(e) => setPurchaseItems(purchaseItems.map(i => ({ ...i, warehouse_id: e.target.value })))} className="field-control h-10 px-3 text-sm w-full"><option value="">{t('selectWarehouse')}</option>{warehouses.map((w: Warehouse) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}</select></div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[var(--text-secondary)]">Purchase Date</label>
              <DatePickerField id="inventory-purchase-date" value={purchaseData.request_date} max={businessDate} onChange={(requestDate) => setPurchaseData({ ...purchaseData, request_date: requestDate })} className="field-control h-10 w-full px-3 text-sm" />
              <p className="text-xs text-[var(--text-muted)]">Defaults to the current business date.</p>
            </div>
          </div>
          <div className="border-t border-[var(--border-subtle)] pt-4">
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-[var(--text-primary)]">{t('itemsToPurchase')}</h3><button type="button" onClick={() => setPurchaseItems([...purchaseItems, { good_id: '', quantity: '', unit_cost: '', warehouse_id: purchaseItems[0]?.warehouse_id || '', meter_serials: '' }])} className="btn-secondary h-8 w-8 p-0 flex items-center justify-center" title={t('addItem')}><Plus className="h-4 w-4" /></button></div>
            <div className="space-y-3">
              {purchaseItems.map((item, idx) => (
                <div key={idx} className="relative p-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                  {purchaseItems.length > 1 && (<button type="button" onClick={() => setPurchaseItems(purchaseItems.filter((_, i) => i !== idx))} className="absolute -top-2 -end-2 h-6 w-6 rounded-full bg-[var(--coral)] text-white flex items-center justify-center hover:bg-[var(--coral-hover)] shadow-sm" title={t('removeItem')}><X className="h-3 w-3" /></button>)}
                  <div className="grid gap-3 md:grid-cols-3">
                    <div className="space-y-1.5"><label className="text-xs font-bold text-[var(--text-secondary)]">{t('good')}</label><select value={item.good_id || ''} onChange={(e) => { const u = [...purchaseItems]; const selectedGood = goods.find((g: Good) => g.id === Number(e.target.value)); u[idx] = { ...u[idx], good_id: e.target.value, unit_cost: selectedGood ? String(selectedGood.default_cost) : '', warehouse_id: u[0]?.warehouse_id || '', meter_serials: '' }; setPurchaseItems(u); }} className="field-control h-10 px-3 text-sm w-full"><option value="">{t('selectGood')}</option>{goods.map((g: Good) => <option key={g.id} value={g.id}>{g.name} ({g.code})</option>)}</select></div>
                    <div className="space-y-1.5"><label className="text-xs font-bold text-[var(--text-secondary)]">{t('quantity')}</label><input type="number" min="1" value={item.quantity || ''} onChange={(e) => { const u = [...purchaseItems]; u[idx].quantity = e.target.value; setPurchaseItems(u) }} placeholder="100" className="field-control h-10 px-3 text-sm w-full" /></div>
                    <div className="space-y-1.5"><label className="text-xs font-bold text-[var(--text-secondary)]">{t('unitCost')}</label><input type="number" min="0" step="0.01" value={item.unit_cost || ''} onChange={(e) => { const u = [...purchaseItems]; u[idx].unit_cost = e.target.value; setPurchaseItems(u) }} placeholder="250" className="field-control h-10 px-3 text-sm w-full" /></div>
                  </div>
                  {goods.find((good) => good.id === Number(item.good_id))?.category === 'meter' ? (
                    <div className="mt-3 space-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-xs font-bold text-[var(--text-secondary)]">Physical Meter Serials</label>
                        <span className={`text-xs font-extrabold ${meterSerials(item.meter_serials).length === Number(item.quantity) ? 'text-[var(--mint)]' : 'text-[var(--coral)]'}`}>
                          {meterSerials(item.meter_serials).length} / {Number(item.quantity) || 0}
                        </span>
                      </div>
                      <textarea
                        value={item.meter_serials}
                        onChange={(event) => { const updated = [...purchaseItems]; updated[idx].meter_serials = event.target.value; setPurchaseItems(updated) }}
                        rows={4}
                        placeholder={'WM-1001\nWM-1002\nWM-1003'}
                        className="field-control min-h-24 w-full resize-y px-3 py-2 font-mono text-sm"
                      />
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-4 border-t border-[var(--border-subtle)] pt-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('totalQuantity')}</div>
                <div className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">{purchaseTotals.totalQuantity.toLocaleString()}</div>
              </div>
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Purchase Total</div>
                <div className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">{money(purchaseTotals.totalCost)}</div>
              </div>
              <div className="border-b border-[var(--border-subtle)] pb-3">
                <div className="text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Remaining Payable</div>
                <div className="mt-1 text-lg font-extrabold text-[var(--gold)]">{money(purchaseRemainingAmount)}</div>
              </div>
            </div>

            <div className="border-s-2 border-[var(--accent)] ps-4">
              <p className="text-sm font-extrabold text-[var(--text-primary)]">Supplier Payment</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">Enter zero for an unpaid purchase, part of the total for a partial payment, or the full total when completely paid. Only this amount is debited after admin approval.</p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Amount Paid Now (AFN)</label>
                <input
                  type="number"
                  min="0"
                  max={purchaseTotals.totalCost}
                  step="0.01"
                  value={purchaseData.amount_paid}
                  onChange={(event) => setPurchaseData({ ...purchaseData, amount_paid: event.target.value })}
                  className={`field-control h-10 w-full px-3 text-sm ${purchaseInitialPaymentIsInvalid ? 'border-[var(--coral)]' : ''}`}
                />
              </div>
              {purchaseInitialPayment > 0.005 ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">Payment Method</label>
                    <select
                      value={purchaseData.payment_method_id}
                      onChange={(event) => setPurchaseData({ ...purchaseData, payment_method_id: event.target.value, account_id: '' })}
                      className="field-control h-10 w-full px-3 text-sm"
                    >
                      <option value="">Select payment method...</option>
                      {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">Paying Account</label>
                    <select
                      value={purchaseData.account_id}
                      disabled={!purchaseData.payment_method_id || accountsLoading || accountsError}
                      onChange={(event) => setPurchaseData({ ...purchaseData, account_id: event.target.value })}
                      className="field-control h-10 w-full px-3 text-sm disabled:cursor-not-allowed disabled:opacity-65"
                    >
                      <option value="">{purchaseData.payment_method_id ? 'Select paying account...' : 'Select payment method first...'}</option>
                      {purchasePaymentAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.code}) - {money(account.current_balance)}</option>)}
                    </select>
                    {purchaseData.payment_method_id && purchasePaymentAccounts.length === 0 ? <p className="text-xs font-bold text-[var(--coral)]">No active compatible account exists for this payment method.</p> : null}
                  </div>
                </>
              ) : null}
            </div>
          </div>
          <FormField label={t('notes')} value={purchaseData.notes} onChange={(v) => setPurchaseData({ ...purchaseData, notes: String(v) })} placeholder={t('purchaseNotes')} textarea />
          <div className="flex justify-end gap-3 pt-4"><button onClick={() => { setIsPurchaseOpen(false); setFormError('') }} className="btn-secondary h-10 px-4 text-sm">{t('cancel')}</button><button onClick={handlePurchase} disabled={isSubmitting} className="btn-primary h-10 px-4 text-sm disabled:opacity-50 disabled:cursor-not-allowed">{isSubmitting ? t('submitting') : t('submitPurchaseRequest')}</button></div>
        </div>
      </Modal>

      <Modal isOpen={isIssueOpen} onClose={() => { setIsIssueOpen(false); resetIssueForm() }} title={t('issueGoods')} size="60p" centered>
        <div className="space-y-4">
          {formError && <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{formError}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1.5"><label className="text-xs font-bold text-[var(--text-secondary)]">{t('issueType')}</label><select value={issueType} onChange={(e) => { const nextType = e.target.value as 'internal' | 'customer'; setIssueType(nextType); setIssuePurpose('separate_sale'); setIssueTarget({ ...issueTarget, customer_id: '', department_id: '', account_id: '', payment_method_id: '', amount_paid: '0' }); setIssueItems([{ inventory_item_id: '', quantity: '', unit_price: '', meter_ids: [] }]) }} className="field-control h-10 px-3 text-sm w-full"><option value="internal">{t('internalUseCompany')}</option><option value="customer">{t('customerSale')}</option></select></div>
            <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-sm text-[var(--text-secondary)]">
              {issueType === 'customer'
                ? 'Approval issues one invoice. The customer can pay now, partly, or later.'
                : 'Internal use records material expense only. No cash account changes.'}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {issueType === 'customer' ? (<div className="space-y-1.5"><label className="text-xs font-bold text-[var(--text-secondary)]">{t('customer')}</label><select value={issueTarget.customer_id} onChange={(e) => { setIssuePurpose('separate_sale'); setIssueTarget({ ...issueTarget, customer_id: e.target.value }); setIssueItems([{ inventory_item_id: '', quantity: '', unit_price: '', meter_ids: [] }]) }} className="field-control h-10 px-3 text-sm w-full" disabled={customersLoading || customersError}><option value="">{customersLoading ? 'Loading customers...' : customersError ? 'Unable to load customers' : t('selectCustomer')}</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{[customer.name, customer.last_name].filter(Boolean).join(' ')}{customer.subscription_code ? ` (${customer.subscription_code})` : ''}</option>)}</select>{!customersLoading && !customersError && customers.length === 0 ? <p className="text-xs font-semibold text-[var(--coral)]">No current customers are available. Inactive customers are excluded.</p> : null}</div>) : (<div className="space-y-1.5"><label className="text-xs font-bold text-[var(--text-secondary)]">{t('department')}</label><select value={issueTarget.department_id} onChange={(e) => setIssueTarget({ ...issueTarget, department_id: e.target.value })} className="field-control h-10 px-3 text-sm w-full"><option value="">{t('selectDepartment')}</option>{departments.map((department) => <option key={department.id} value={department.id}>{department.name} ({department.code})</option>)}</select></div>)}
            <div className="space-y-1.5"><label className="text-xs font-bold text-[var(--text-secondary)]">{t('warehouse')}</label><select value={issueTarget.warehouse_id} onChange={(e) => { setIssueTarget({ ...issueTarget, warehouse_id: e.target.value }); setIssueItems([{ inventory_item_id: '', quantity: '', unit_price: '', meter_ids: [] }]) }} className="field-control h-10 px-3 text-sm w-full"><option value="">{t('selectWarehouse')}</option>{warehouses.map((w: Warehouse) => <option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}</select></div>
            <div className="space-y-1.5"><label className="text-xs font-bold text-[var(--text-secondary)]">Issue Date</label><DatePickerField id="inventory-issue-date" value={issueTarget.request_date} max={businessDate} onChange={(requestDate) => setIssueTarget({ ...issueTarget, request_date: requestDate })} className="field-control h-10 w-full px-3 text-sm" /></div>
          </div>
          {issueType === 'customer' && issueTarget.customer_id ? (
            <div className="space-y-2 border-t border-[var(--border-subtle)] pt-4">
              <label className="text-xs font-bold text-[var(--text-secondary)]">{t('salePurpose')}</label>
              <div className="grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--border-color)] bg-[var(--bg-elevated)] p-1">
                <button
                  type="button"
                  disabled={!customerHasCurrentContract}
                  onClick={() => { setIssuePurpose('contract_material'); setIssueItems([{ inventory_item_id: '', quantity: '', unit_price: '', meter_ids: [] }]) }}
                  className={`min-h-9 px-3 text-sm font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${issuePurpose === 'contract_material' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
                >
                  {t('contractMaterial')}
                </button>
                <button
                  type="button"
                  onClick={() => { setIssuePurpose('separate_sale'); setIssueItems([{ inventory_item_id: '', quantity: '', unit_price: '', meter_ids: [] }]) }}
                  className={`min-h-9 px-3 text-sm font-bold transition-colors ${issuePurpose === 'separate_sale' ? 'bg-[var(--accent)] text-white' : 'text-[var(--text-secondary)]'}`}
                >
                  {t('separateCustomerSale')}
                </button>
              </div>
              <p className="text-xs font-semibold text-[var(--text-muted)]">
                {issuePurpose === 'contract_material'
                  ? `${t('linkedToContract')} ${selectedCustomerContract?.contract_number ?? ''}`
                  : t('independentFromContract')}
              </p>
            </div>
          ) : null}
          <div className="border-t border-[var(--border-subtle)] pt-4">
            <div className="flex items-center justify-between mb-3"><h3 className="text-sm font-bold text-[var(--text-primary)]">{t('itemsToIssue')}</h3><button type="button" onClick={() => setIssueItems([...issueItems, { inventory_item_id: '', quantity: '', unit_price: '', meter_ids: [] }])} className="btn-secondary h-8 w-8 p-0 flex items-center justify-center" title={t('addItem')}><Plus className="h-4 w-4" /></button></div>
            <div className="space-y-3">
              {issueItems.map((item, idx) => {
                const selectedItem = availableIssueItems.find((inventoryItem) => inventoryItem.id === Number(item.inventory_item_id))
                const availableQuantity = Number(selectedItem?.quantity ?? 0)
                const requestedQuantity = Number(item.quantity) || 0
                const remainingQuantity = availableQuantity - requestedQuantity
                const exceedsAvailable = Boolean(selectedItem) && requestedQuantity > availableQuantity
                const availableMeterSerials = selectedItem?.category === 'meter'
                  ? meters.filter((meter: Meter) => meter.status === 'available'
                    && meter.inventory_item_id === selectedItem.id
                    && meter.current_warehouse_id === Number(issueTarget.warehouse_id))
                  : []

                return (
                  <div key={idx} className="relative rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                    {issueItems.length > 1 && (<button type="button" onClick={() => setIssueItems(issueItems.filter((_, i) => i !== idx))} className="absolute -top-2 -end-2 flex h-6 w-6 items-center justify-center rounded-full bg-[var(--coral)] text-white shadow-sm hover:bg-[var(--coral-hover)]" title={t('removeItem')}><X className="h-3 w-3" /></button>)}
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[var(--text-secondary)]">{t('item')}</label>
                        <select value={item.inventory_item_id} disabled={!issueTarget.warehouse_id} onChange={(e) => { const u = [...issueItems]; const nextItem = availableIssueItems.find((inventoryItem: InventoryItem) => inventoryItem.id === Number(e.target.value)); u[idx] = { ...u[idx], inventory_item_id: e.target.value, quantity: '', unit_price: nextItem ? String(issueType === 'customer' ? nextItem.unit_price : nextItem.unit_cost) : '', meter_ids: [] }; setIssueItems(u); }} className="field-control h-10 w-full px-3 text-sm">
                          <option value="">{issueTarget.warehouse_id ? t('selectItem') : t('selectWarehouseFirst')}</option>
                          {availableIssueItems.map((inventoryItem: InventoryItem) => <option key={inventoryItem.id} value={inventoryItem.id}>{inventoryItem.name} ({Number(inventoryItem.quantity).toLocaleString()} {inventoryItem.unit} available)</option>)}
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[var(--text-secondary)]">{t('availableQuantity')}</label>
                        <div className={`field-control flex h-10 items-center px-3 text-sm font-extrabold ${selectedItem ? 'text-[var(--mint)]' : 'text-[var(--text-muted)]'}`}>
                          {selectedItem ? `${availableQuantity.toLocaleString()} ${selectedItem.unit}` : 'Select an item'}
                        </div>
                        {selectedItem && requestedQuantity > 0 ? (
                          <p className={`text-xs font-bold ${exceedsAvailable ? 'text-[var(--coral)]' : 'text-[var(--text-muted)]'}`}>
                            {exceedsAvailable ? `Exceeds stock by ${Math.abs(remainingQuantity).toLocaleString()} ${selectedItem.unit}` : `Remaining: ${remainingQuantity.toLocaleString()} ${selectedItem.unit}`}
                          </p>
                        ) : null}
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[var(--text-secondary)]">{t('issueQuantity')}</label>
                        <input type="number" min="0.01" step={selectedItem?.category === 'meter' ? 1 : 0.01} max={selectedItem?.quantity} readOnly={selectedItem?.category === 'meter'} value={item.quantity} onChange={(e) => { const u = [...issueItems]; u[idx].quantity = e.target.value; setIssueItems(u) }} placeholder="10" className={`field-control h-10 w-full px-3 text-sm read-only:opacity-70 ${exceedsAvailable ? 'border-[var(--coral)]' : ''}`} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-[var(--text-secondary)]">{issueType === 'customer' ? t('unitSalePrice') : t('unitCost')}</label>
                        <input type="number" min="0" step="0.01" readOnly={issueType === 'internal'} value={item.unit_price} onChange={(e) => { const u = [...issueItems]; u[idx].unit_price = e.target.value; setIssueItems(u) }} placeholder="350" className="field-control h-10 w-full px-3 text-sm read-only:opacity-70" />
                      </div>
                    </div>
                    {selectedItem?.category === 'meter' ? (
                      <div className="mt-3 border-t border-[var(--border-subtle)] pt-3">
                        <div className="mb-2 flex items-center justify-between gap-3">
                          <p className="text-xs font-bold text-[var(--text-secondary)]">Select Physical Meter Serials</p>
                          <span className="text-xs font-extrabold text-[var(--accent)]">{item.meter_ids.length} selected</span>
                        </div>
                        <div className="grid max-h-40 gap-2 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3">
                          {availableMeterSerials.map((meter) => (
                            <label key={meter.id} className="flex cursor-pointer items-center gap-2 border-b border-[var(--border-subtle)] px-2 py-2 text-sm">
                              <input
                                type="checkbox"
                                checked={item.meter_ids.includes(meter.id)}
                                onChange={(event) => {
                                  const updated = [...issueItems]
                                  const ids = event.target.checked
                                    ? [...updated[idx].meter_ids, meter.id]
                                    : updated[idx].meter_ids.filter((id) => id !== meter.id)
                                  updated[idx] = { ...updated[idx], meter_ids: ids, quantity: String(ids.length) }
                                  setIssueItems(updated)
                                }}
                              />
                              <span className="font-mono text-xs font-bold">{meter.meter_number}</span>
                            </label>
                          ))}
                        </div>
                        {availableMeterSerials.length === 0 ? <p className="py-3 text-sm font-bold text-[var(--coral)]">No serialized meter is available for this warehouse stock item.</p> : null}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="space-y-4 border-t border-[var(--border-subtle)] pt-4">
            <div className={`grid gap-4 ${issueType === 'customer' ? 'sm:grid-cols-2 xl:grid-cols-4' : 'grid-cols-2'}`}>
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)]">{t('totalQuantity')}</p>
                <p className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">{issueTotals.totalQuantity.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)]">{issueType === 'customer' ? t('saleTotal') : t('totalValue')}</p>
                <p className="mt-1 text-lg font-extrabold text-[var(--mint)]">{money(issueTotals.totalPrice)}</p>
              </div>
              {issueType === 'customer' ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">{t('amountPaidNow')}</label>
                    <input
                      type="number"
                      min="0"
                      max={issueTotals.totalPrice}
                      step="0.01"
                      value={issueTarget.amount_paid}
                      disabled={!canReceivePayment}
                      onChange={(event) => setIssueTarget({ ...issueTarget, amount_paid: event.target.value })}
                      className={`field-control h-10 w-full px-3 text-sm disabled:cursor-not-allowed disabled:opacity-65 ${initialPaymentIsInvalid ? 'border-[var(--coral)]' : ''}`}
                    />
                    <p className="text-xs text-[var(--text-muted)]">{canReceivePayment ? 'Use 0 when the customer will pay later.' : 'Authorized payment staff can receive this balance after approval.'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-[var(--text-muted)]">{t('remaining')}</p>
                    <p className={`mt-1 text-lg font-extrabold ${initialPaymentIsInvalid ? 'text-[var(--coral)]' : 'text-[var(--gold)]'}`}>{money(issueRemainingAmount)}</p>
                    {initialPaymentIsInvalid ? <p className="mt-1 text-xs font-bold text-[var(--coral)]">Paid amount cannot exceed the sale total.</p> : null}
                  </div>
                </>
              ) : null}
            </div>

            {issueType === 'customer' && initialPaymentAmount > 0.005 ? (
              <div className="grid gap-4 border-t border-[var(--border-subtle)] pt-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">{t('paymentMethod')}</label>
                  <select
                    value={issueTarget.payment_method_id}
                    onChange={(event) => setIssueTarget({ ...issueTarget, payment_method_id: event.target.value, account_id: '' })}
                    className="field-control h-10 w-full px-3 text-sm"
                  >
                    <option value="">Select payment method...</option>
                    {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[var(--text-secondary)]">{t('receivingAccount')}</label>
                  <select
                    value={issueTarget.account_id}
                    disabled={!issueTarget.payment_method_id}
                    onChange={(event) => setIssueTarget({ ...issueTarget, account_id: event.target.value })}
                    className="field-control h-10 w-full px-3 text-sm"
                  >
                    <option value="">{issueTarget.payment_method_id ? 'Select receiving account...' : 'Select payment method first...'}</option>
                    {issuePaymentAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.code}) - {money(account.current_balance)}</option>)}
                  </select>
                  {issueTarget.payment_method_id && issuePaymentAccounts.length === 0 ? <p className="text-xs font-bold text-[var(--coral)]">No active compatible account exists for this payment method.</p> : null}
                </div>
              </div>
            ) : null}
          </div>
          <FormField label={t('notes')} value={issueTarget.notes} onChange={(v) => setIssueTarget({ ...issueTarget, notes: String(v) })} placeholder={t('issueNotes')} textarea />
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { setIsIssueOpen(false); resetIssueForm() }} className="btn-secondary h-10 px-4 text-sm">{t('cancel')}</button>
            <LoadingButton
              onClick={() => void handleIssue()}
              loading={isSubmitting}
              loadingLabel="Submitting..."
              disabled={!issueTarget.warehouse_id || (issueType === 'customer' ? !issueTarget.customer_id || (issuePurpose === 'contract_material' && !customerHasCurrentContract) || initialPaymentIsInvalid || (initialPaymentAmount > 0.005 && (!issueTarget.payment_method_id || !issueTarget.account_id)) : !issueTarget.department_id) || hasInvalidIssueItems}
              className="btn-primary h-10 px-4 text-sm"
            >
              {t('submitIssueRequest')}
            </LoadingButton>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={Boolean(selectedRequest) && !approvalAction}
        onClose={() => setSelectedRequest(null)}
        title={selectedRequest?.request_number ?? 'Inventory Record'}
        size="lg"
      >
        {selectedRequest ? (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-xs font-bold text-[var(--text-muted)]">Record Type</p>
                <p className="mt-1 text-sm font-bold capitalize text-[var(--text-primary)]">
                  {selectedRequest.type === 'purchase'
                    ? 'Purchase'
                    : selectedRequest.issue_type === 'customer' || selectedRequest.customer_id
                      ? selectedRequest.issue_purpose === 'contract_material' ? 'Contract Material' : 'Customer Sale'
                      : 'Internal Issue'}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-xs font-bold text-[var(--text-muted)]">Status</p>
                <div className="mt-1">
                  <Badge variant={selectedRequest.status === 'pending' ? 'amber' : selectedRequest.status === 'approved' ? 'emerald' : 'red'}>
                    {selectedRequest.status}
                  </Badge>
                </div>
              </div>
              {selectedRequest.issue_purpose === 'contract_material' ? (
                <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                  <p className="text-xs font-bold text-[var(--text-muted)]">Contract</p>
                  <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{selectedRequest.contract?.contract_number ?? '-'}</p>
                </div>
              ) : null}
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-xs font-bold text-[var(--text-muted)]">Date</p>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]"><DateText value={selectedRequest.request_date} /></p>
              </div>
              {selectedRequest.type === 'purchase' || selectedRequest.issue_type === 'customer' || selectedRequest.customer_id ? (
                <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                  <p className="text-xs font-bold text-[var(--text-muted)]">{selectedRequest.type === 'purchase' ? 'Purchase Bill' : 'Sales Invoice'}</p>
                  <p className="mt-1 font-mono text-sm font-extrabold text-[#305477]">{selectedRequest.document_number ?? 'Generated after approval'}</p>
                </div>
              ) : null}
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-xs font-bold text-[var(--text-muted)]">Supplier / Recipient</p>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">
                  {selectedRequest.supplier?.name ?? selectedRequest.customer?.name ?? selectedRequest.department?.name ?? '-'}
                </p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-xs font-bold text-[var(--text-muted)]">Warehouse</p>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{selectedRequest.warehouse?.name ?? '-'}</p>
              </div>
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-xs font-bold text-[var(--text-muted)]">{selectedRequest.type === 'purchase' ? 'Initial Paying Account' : selectedRequest.issue_type === 'customer' || selectedRequest.customer_id ? 'Initial Receiving Account' : 'Account'}</p>
                <p className="mt-1 text-sm font-bold text-[var(--text-primary)]">{selectedRequest.account?.name ?? (selectedRequest.type === 'purchase' || selectedRequest.issue_type === 'customer' || selectedRequest.customer_id ? 'No initial payment' : 'No cash movement')}</p>
              </div>
            </div>

            {selectedRequest.type === 'purchase' ? (
              <div className="grid gap-4 border-y border-[var(--border-subtle)] py-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)]">Purchase Bill</p>
                  <p className="mt-1 font-mono text-sm font-extrabold text-[var(--text-primary)]">{selectedRequest.document_number ?? 'Created after approval'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)]">Purchase Total</p>
                  <p className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">{money(selectedRequest.total_amount)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)]">Paid</p>
                  <p className="mt-1 text-lg font-extrabold text-[var(--mint)]">{money(purchasePaid(selectedRequest))}</p>
                  {selectedRequest.status === 'pending' && Number(selectedRequest.initial_payment_amount) > 0.005 ? (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{money(selectedRequest.initial_payment_amount)} will post on approval</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)]">Remaining Payable</p>
                  <p className="mt-1 text-lg font-extrabold text-[var(--gold)]">{money(purchaseRemaining(selectedRequest))}</p>
                </div>
              </div>
            ) : null}

            {selectedRequest.type === 'issue' && (selectedRequest.issue_type === 'customer' || selectedRequest.customer_id) ? (
              <div className="grid gap-4 border-y border-[var(--border-subtle)] py-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)]">Invoice</p>
                  <p className="mt-1 font-mono text-sm font-extrabold text-[var(--text-primary)]">{selectedRequest.invoice?.invoice_number ?? 'Created after approval'}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)]">Sale Total</p>
                  <p className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">{money(selectedRequest.total_amount)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)]">Paid</p>
                  <p className="mt-1 text-lg font-extrabold text-[var(--mint)]">{money(salePaid(selectedRequest))}</p>
                  {selectedRequest.status === 'pending' && Number(selectedRequest.initial_payment_amount) > 0.005 ? (
                    <p className="mt-1 text-xs text-[var(--text-muted)]">{money(selectedRequest.initial_payment_amount)} will post on approval</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-bold text-[var(--text-muted)]">Remaining</p>
                  <p className="mt-1 text-lg font-extrabold text-[var(--gold)]">{money(saleRemaining(selectedRequest))}</p>
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
              <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-xs font-extrabold text-[var(--text-muted)]">
                <span>Goods</span>
                <span>Quantity</span>
                <span>Amount</span>
              </div>
              <div className="divide-y divide-[var(--border-subtle)]">
                {selectedRequest.items?.map((item) => (
                  <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 px-4 py-3 text-sm">
                    <span className="min-w-0 font-bold text-[var(--text-primary)]">
                      {item.description}
                      {item.meter_serials?.length ? <span className="mt-1 block break-words font-mono text-xs font-medium text-[var(--text-muted)]">{item.meter_serials.join(', ')}</span> : null}
                    </span>
                    <span className="text-[var(--text-secondary)]">{Number(item.quantity).toLocaleString()}</span>
                    <span className="font-bold text-[var(--text-primary)]">AFN {Number(item.total_price).toLocaleString()}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-between border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-sm font-extrabold">
                <span>Total</span>
                <span>AFN {Number(selectedRequest.total_amount).toLocaleString()}</span>
              </div>
            </div>

            {selectedRequest.invoice ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="h-4 w-4 text-[var(--accent)]" />
                    <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Payment History</h3>
                  </div>
                  <Badge variant={selectedRequest.invoice.status === 'paid' ? 'emerald' : selectedRequest.invoice.status === 'partially_paid' ? 'amber' : 'red'}>
                    {selectedRequest.invoice.status.replaceAll('_', ' ')}
                  </Badge>
                </div>
                {selectedRequest.invoice.allocations?.length ? (
                  <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-lg border border-[var(--border-subtle)]">
                    {selectedRequest.invoice.allocations.map((allocation) => (
                      <div key={allocation.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_0.8fr_0.8fr_1fr_auto] sm:items-center">
                        <span className="font-mono text-xs font-bold text-[var(--text-primary)]">{allocation.payment?.receipt_number ?? '-'}</span>
                        <span className="text-[var(--text-secondary)]"><DateText value={allocation.payment?.paid_at} /></span>
                        <span className="font-extrabold text-[var(--mint)]">{money(allocation.amount)}</span>
                        <span className="text-[var(--text-secondary)]">{allocation.payment?.account?.name ?? allocation.payment?.payment_method?.name ?? '-'}</span>
                        <Badge variant={allocation.payment?.status === 'posted' ? 'emerald' : 'slate'}>{allocation.payment?.status ?? 'unknown'}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-[var(--border-subtle)] px-4 py-5 text-center text-sm text-[var(--text-muted)]">No payment has been received for this sale.</p>
                )}
              </section>
            ) : null}

            {selectedRequest.type === 'purchase' && selectedRequest.status === 'approved' ? (
              <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ReceiptText className="h-4 w-4 text-[var(--accent)]" />
                    <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Supplier Payment History</h3>
                  </div>
                  <Badge variant={selectedRequest.payment_status === 'paid' ? 'emerald' : selectedRequest.payment_status === 'partially_paid' ? 'amber' : 'red'}>
                    {selectedRequest.payment_status.replaceAll('_', ' ')}
                  </Badge>
                </div>
                {selectedRequest.purchase_payments?.length ? (
                  <div className="divide-y divide-[var(--border-subtle)] overflow-hidden rounded-lg border border-[var(--border-subtle)]">
                    {selectedRequest.purchase_payments.map((payment) => (
                      <div key={payment.id} className="grid gap-2 px-4 py-3 text-sm sm:grid-cols-[1fr_0.8fr_0.8fr_1fr_auto] sm:items-center">
                        <span className="font-mono text-xs font-bold text-[var(--text-primary)]">{payment.receipt_number}</span>
                        <span className="text-[var(--text-secondary)]"><DateText value={payment.paid_at} /></span>
                        <span className="font-extrabold text-[var(--mint)]">{money(payment.amount)}</span>
                        <span className="text-[var(--text-secondary)]">{payment.account?.name ?? payment.payment_method?.name ?? '-'}</span>
                        <Badge variant={payment.status === 'posted' ? 'emerald' : 'slate'}>{payment.status}</Badge>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-lg border border-dashed border-[var(--border-subtle)] px-4 py-5 text-center text-sm text-[var(--text-muted)]">No supplier payment has been made for this purchase.</p>
                )}
              </section>
            ) : null}

            {selectedRequest.notes ? (
              <div className="rounded-lg border border-[var(--border-subtle)] p-3">
                <p className="text-xs font-bold text-[var(--text-muted)]">Notes</p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{selectedRequest.notes}</p>
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              {canPrintDocument(selectedRequest) ? (
                <button type="button" onClick={() => printDocument(selectedRequest)} className="btn-secondary flex h-10 items-center gap-2 px-4 text-sm text-[#305477]">
                  <Printer className="h-4 w-4" /> {selectedRequest.type === 'purchase' ? 'Print Purchase Bill' : 'Print Sales Invoice'}
                </button>
              ) : null}
              {canReceivePayment
                && selectedRequest.status === 'approved'
                && selectedRequest.invoice
                && saleRemaining(selectedRequest) > 0.005 ? (
                  <button type="button" onClick={() => openReceivePayment(selectedRequest)} className="btn-primary flex h-10 items-center gap-2 px-4 text-sm">
                    <WalletCards className="h-4 w-4" /> Receive Payment
                  </button>
                ) : null}
              {canPaySupplier
                && selectedRequest.type === 'purchase'
                && selectedRequest.status === 'approved'
                && purchaseRemaining(selectedRequest) > 0.005 ? (
                  <button type="button" onClick={() => openSupplierPayment(selectedRequest)} className="btn-primary flex h-10 items-center gap-2 px-4 text-sm">
                    <WalletCards className="h-4 w-4" /> Pay Supplier
                  </button>
                ) : null}
              {canApprove && selectedRequest.status === 'pending' ? (
                <>
                  <button type="button" onClick={() => setApprovalAction('approved')} className="btn-primary flex h-10 items-center gap-2 px-4 text-sm">
                    <CheckCircle2 className="h-4 w-4" /> Approve
                  </button>
                  <button type="button" onClick={() => setApprovalAction('rejected')} className="btn-secondary flex h-10 items-center gap-2 px-4 text-sm text-[var(--coral)]">
                    <XCircle className="h-4 w-4" /> Reject
                  </button>
                </>
              ) : null}
              <button type="button" onClick={() => setSelectedRequest(null)} className="btn-secondary h-10 px-4 text-sm">Close</button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(paymentRequest)}
        onClose={() => {
          if (!isReceivingPayment) {
            setPaymentRequest(null)
            setPaymentError('')
          }
        }}
        title="Receive Sale Payment"
        size="lg"
        centered
      >
        {paymentRequest?.invoice ? (
          <div className="space-y-5">
            {paymentError ? <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{paymentError}</div> : null}

            <div className="flex flex-col gap-1 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)]">Customer</p>
                <p className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">{paymentRequest.customer?.name ?? '-'}</p>
              </div>
              <div className="sm:text-end">
                <p className="text-xs font-bold text-[var(--text-muted)]">Invoice</p>
                <p className="mt-1 font-mono text-sm font-extrabold text-[var(--text-primary)]">{paymentRequest.invoice.invoice_number}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)]">Total</p>
                <p className="mt-1 text-base font-extrabold text-[var(--text-primary)]">{money(paymentRequest.invoice.total_amount)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)]">Paid</p>
                <p className="mt-1 text-base font-extrabold text-[var(--mint)]">{money(paymentRequest.invoice.paid_amount)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)]">Remaining</p>
                <p className="mt-1 text-base font-extrabold text-[var(--gold)]">{money(paymentRequest.invoice.remaining_amount)}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Amount Received (AFN)</label>
                <input
                  type="number"
                  min="0.01"
                  max={saleRemaining(paymentRequest)}
                  step="0.01"
                  value={paymentData.amount}
                  onChange={(event) => setPaymentData({ ...paymentData, amount: event.target.value })}
                  className="field-control h-10 w-full px-3 text-sm"
                />
                <p className="text-xs text-[var(--text-muted)]">Maximum {money(saleRemaining(paymentRequest))}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Payment Date</label>
                <DatePickerField id="inventory-sale-payment-date" value={paymentData.paid_at} onChange={(paidAt) => setPaymentData({ ...paymentData, paid_at: paidAt })} className="field-control h-10 w-full px-3 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Payment Method</label>
                <select
                  value={paymentData.payment_method_id}
                  onChange={(event) => setPaymentData({ ...paymentData, payment_method_id: event.target.value, account_id: '' })}
                  className="field-control h-10 w-full px-3 text-sm"
                >
                  <option value="">Select payment method...</option>
                  {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Receiving Account</label>
                <select
                  value={paymentData.account_id}
                  disabled={!paymentData.payment_method_id}
                  onChange={(event) => setPaymentData({ ...paymentData, account_id: event.target.value })}
                  className="field-control h-10 w-full px-3 text-sm"
                >
                  <option value="">{paymentData.payment_method_id ? 'Select receiving account...' : 'Select payment method first...'}</option>
                  {receivePaymentAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.code}) - {money(account.current_balance)}</option>)}
                </select>
                {paymentData.payment_method_id && receivePaymentAccounts.length === 0 ? <p className="text-xs font-bold text-[var(--coral)]">No active compatible account exists for this payment method.</p> : null}
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Reference</label>
                <input value={paymentData.reference} onChange={(event) => setPaymentData({ ...paymentData, reference: event.target.value })} className="field-control h-10 w-full px-3 text-sm" />
              </div>
            </div>

            <FormField label="Notes" value={paymentData.notes} onChange={(value) => setPaymentData({ ...paymentData, notes: String(value) })} placeholder="Optional payment note..." textarea />

            <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
              <button type="button" disabled={isReceivingPayment} onClick={() => setPaymentRequest(null)} className="btn-secondary h-10 px-4 text-sm">Cancel</button>
              <LoadingButton
                onClick={() => void handleReceivePayment()}
                loading={isReceivingPayment}
                loadingLabel="Recording..."
                disabled={!paymentData.payment_method_id || !paymentData.account_id || !paymentData.paid_at || Number(paymentData.amount) <= 0 || Number(paymentData.amount) > saleRemaining(paymentRequest) + 0.005}
                className="btn-primary h-10 px-4 text-sm"
              >
                <WalletCards className="h-4 w-4" /> Receive Payment
              </LoadingButton>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(supplierPaymentRequest)}
        onClose={() => {
          if (!isPayingSupplier) {
            setSupplierPaymentRequest(null)
            setPaymentError('')
          }
        }}
        title="Pay Supplier"
        size="lg"
        centered
      >
        {supplierPaymentRequest ? (
          <div className="space-y-5">
            {paymentError ? <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{paymentError}</div> : null}

            <div className="flex flex-col gap-1 border-b border-[var(--border-subtle)] pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)]">Supplier</p>
                <p className="mt-1 text-lg font-extrabold text-[var(--text-primary)]">{supplierPaymentRequest.supplier?.name ?? '-'}</p>
              </div>
              <div className="sm:text-end">
                <p className="text-xs font-bold text-[var(--text-muted)]">Purchase Bill</p>
                <p className="mt-1 font-mono text-sm font-extrabold text-[var(--text-primary)]">{supplierPaymentRequest.document_number ?? supplierPaymentRequest.request_number}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 border-b border-[var(--border-subtle)] pb-4">
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)]">Total</p>
                <p className="mt-1 text-base font-extrabold text-[var(--text-primary)]">{money(supplierPaymentRequest.total_amount)}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)]">Paid</p>
                <p className="mt-1 text-base font-extrabold text-[var(--mint)]">{money(purchasePaid(supplierPaymentRequest))}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--text-muted)]">Remaining</p>
                <p className="mt-1 text-base font-extrabold text-[var(--gold)]">{money(purchaseRemaining(supplierPaymentRequest))}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Amount Paid (AFN)</label>
                <input
                  type="number"
                  min="0.01"
                  max={purchaseRemaining(supplierPaymentRequest)}
                  step="0.01"
                  value={supplierPaymentData.amount}
                  onChange={(event) => setSupplierPaymentData({ ...supplierPaymentData, amount: event.target.value })}
                  className="field-control h-10 w-full px-3 text-sm"
                />
                <p className="text-xs text-[var(--text-muted)]">Maximum {money(purchaseRemaining(supplierPaymentRequest))}</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Payment Date</label>
                <DatePickerField id="inventory-supplier-payment-date" value={supplierPaymentData.paid_at} max={businessDate} onChange={(paidAt) => setSupplierPaymentData({ ...supplierPaymentData, paid_at: paidAt })} className="field-control h-10 w-full px-3 text-sm" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Payment Method</label>
                <select
                  value={supplierPaymentData.payment_method_id}
                  onChange={(event) => setSupplierPaymentData({ ...supplierPaymentData, payment_method_id: event.target.value, account_id: '' })}
                  className="field-control h-10 w-full px-3 text-sm"
                >
                  <option value="">Select payment method...</option>
                  {paymentMethods.map((method) => <option key={method.id} value={method.id}>{method.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Paying Account</label>
                <select
                  value={supplierPaymentData.account_id}
                  disabled={!supplierPaymentData.payment_method_id}
                  onChange={(event) => setSupplierPaymentData({ ...supplierPaymentData, account_id: event.target.value })}
                  className="field-control h-10 w-full px-3 text-sm"
                >
                  <option value="">{supplierPaymentData.payment_method_id ? 'Select paying account...' : 'Select payment method first...'}</option>
                  {supplierPaymentAccounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.code}) - {money(account.current_balance)}</option>)}
                </select>
                {supplierPaymentData.payment_method_id && supplierPaymentAccounts.length === 0 ? <p className="text-xs font-bold text-[var(--coral)]">No active compatible account exists for this payment method.</p> : null}
              </div>
              <div className="space-y-1.5 md:col-span-2">
                <label className="text-xs font-bold text-[var(--text-secondary)]">Reference</label>
                <input value={supplierPaymentData.reference} onChange={(event) => setSupplierPaymentData({ ...supplierPaymentData, reference: event.target.value })} className="field-control h-10 w-full px-3 text-sm" />
              </div>
            </div>

            <FormField label="Notes" value={supplierPaymentData.notes} onChange={(value) => setSupplierPaymentData({ ...supplierPaymentData, notes: String(value) })} placeholder="Optional supplier payment note..." textarea />

            <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
              <button type="button" disabled={isPayingSupplier} onClick={() => setSupplierPaymentRequest(null)} className="btn-secondary h-10 px-4 text-sm">Cancel</button>
              <LoadingButton
                onClick={() => void handleSupplierPayment()}
                loading={isPayingSupplier}
                loadingLabel="Recording..."
                disabled={!supplierPaymentData.payment_method_id || !supplierPaymentData.account_id || !supplierPaymentData.paid_at || Number(supplierPaymentData.amount) <= 0 || Number(supplierPaymentData.amount) > purchaseRemaining(supplierPaymentRequest) + 0.005}
                className="btn-primary h-10 px-4 text-sm"
              >
                <WalletCards className="h-4 w-4" /> Record Supplier Payment
              </LoadingButton>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(selectedRequest && approvalAction)}
        title={approvalAction === 'approved' ? 'Approve Inventory Record' : 'Reject Inventory Record'}
        message={`Are you sure you want to ${approvalAction === 'approved' ? 'approve' : 'reject'} ${selectedRequest?.request_number ?? 'this record'}?`}
        confirmLabel={approvalAction === 'approved' ? 'Approve' : 'Reject'}
        loadingLabel={approvalAction === 'approved' ? 'Approving...' : 'Rejecting...'}
        kind="approval"
        onConfirm={handleApproval}
        onCancel={() => setApprovalAction(null)}
      />
    </div>
  )
}
