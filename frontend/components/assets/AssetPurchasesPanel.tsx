'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCheck,
  CircleCheck,
  Download,
  Edit2,
  Plus,
  Search,
  Trash2,
  Undo2,
  XCircle,
} from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingButton } from '@/components/ui/AsyncButton'
import { FinanceStatus, dateValue, getApiErrorMessage, hasRole, money } from '@/components/finance/FinanceUI'
import { API_BASE_URL, getAuthToken } from '@/lib/api'
import { useTrainingMode } from '@/context/TrainingModeContext'
import {
  useApproveAccountingTransactionMutation,
  useCancelAccountingTransactionMutation,
  useCreateAssetPurchaseMutation,
  useDeleteAssetPurchaseMutation,
  useGetAccountingAccountsQuery,
  useGetAssetPurchasesQuery,
  useGetFinancialCategoriesQuery,
  useGetMeQuery,
  useGetPaymentMethodsQuery,
  useGetServiceAreasQuery,
  useGetSuppliersQuery,
  useRejectAccountingTransactionMutation,
  useReviewAccountingTransactionMutation,
  useUpdateAssetPurchaseMutation,
  type AssetPurchase,
} from '@/src/store/waternetApi'

type PurchaseDraft = {
  asset_code_prefix: string
  name: string
  type: AssetPurchase['type']
  quantity: number
  unit_cost: number
  supplier_id?: number
  service_area_id?: number
  financial_category_id?: number
  payment_method_id?: number
  accounting_account_id?: number
  asset_status: AssetPurchase['asset_status']
  purchase_date: string
  warranty_expiry: string
  invoice_number: string
  address: string
  notes: string
}

type ConfirmAction = {
  kind: 'review' | 'approve' | 'delete'
  purchase: AssetPurchase
}

const typeLabels: Record<AssetPurchase['type'], string> = {
  well: 'Well',
  reservoir: 'Reservoir',
  generator: 'Generator',
  solar: 'Solar',
  technical: 'Technical Equipment',
}

const emptyDraft = (businessDate: string, categoryId?: number): PurchaseDraft => ({
  asset_code_prefix: '',
  name: '',
  type: 'technical',
  quantity: 1,
  unit_cost: 0,
  financial_category_id: categoryId,
  asset_status: 'active',
  purchase_date: businessDate,
  warranty_expiry: '',
  invoice_number: '',
  address: '',
  notes: '',
})

function accountTypeForMethod(code?: string): string {
  if (code === 'bank_transfer') return 'bank'
  if (code === 'mobile_money') return 'mobile_money'
  if (code === 'check') return 'check'
  if (code === 'online_payment') return 'online'
  return 'cash'
}

export default function AssetPurchasesPanel() {
  const { businessDate } = useTrainingMode()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AssetPurchase | null>(null)
  const [draft, setDraft] = useState<PurchaseDraft>(emptyDraft(businessDate))
  const [attachment, setAttachment] = useState<File | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [rejecting, setRejecting] = useState<AssetPurchase | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [reversing, setReversing] = useState<AssetPurchase | null>(null)
  const [reversalReason, setReversalReason] = useState('')
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  const params = useMemo(() => ({
    page,
    status: status === 'all' ? undefined : status,
    search: search || undefined,
  }), [page, search, status])
  const { data: purchasePage, isLoading, isFetching, isError } = useGetAssetPurchasesQuery(params)
  const { data: accounts = [] } = useGetAccountingAccountsQuery()
  const { data: methods = [] } = useGetPaymentMethodsQuery()
  const { data: categories = [] } = useGetFinancialCategoriesQuery({ type: 'expense' })
  const {
    data: suppliers = [],
    refetch: refetchSuppliers,
  } = useGetSuppliersQuery({})
  const {
    data: serviceAreas = [],
    refetch: refetchServiceAreas,
  } = useGetServiceAreasQuery()
  const { data: me } = useGetMeQuery()
  const [createPurchase, createState] = useCreateAssetPurchaseMutation()
  const [updatePurchase, updateState] = useUpdateAssetPurchaseMutation()
  const [deletePurchase] = useDeleteAssetPurchaseMutation()
  const [reviewTransaction] = useReviewAccountingTransactionMutation()
  const [approveTransaction] = useApproveAccountingTransactionMutation()
  const [rejectTransaction, rejectState] = useRejectAccountingTransactionMutation()
  const [cancelTransaction, cancelState] = useCancelAccountingTransactionMutation()

  const purchases = purchasePage?.data ?? []
  const activeCategories = categories.filter((category) => category.status === 'active')
  const assetPurchaseCategory = activeCategories.find((category) => category.code === 'asset_purchase')
  const activeMethods = methods.filter((method) => method.status === 'active')
  const activeSuppliers = suppliers.filter((supplier) => supplier.status === 'active')
  const selectedMethod = activeMethods.find((method) => method.id === draft.payment_method_id)
  const compatibleAccounts = accounts.filter(
    (account) => account.status === 'active' && account.type === accountTypeForMethod(selectedMethod?.code),
  )
  const selectedAccount = accounts.find((account) => account.id === draft.accounting_account_id)
  const total = Math.round(Number(draft.quantity || 0) * Number(draft.unit_cost || 0) * 100) / 100
  const balanceAfter = Number(selectedAccount?.current_balance ?? 0) - total
  const isManager = hasRole(me?.roles, ['Manager', 'Admin', 'Super Admin'])
  const isAdmin = hasRole(me?.roles, ['Admin', 'Super Admin'])

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyDraft(businessDate, assetPurchaseCategory?.id))
    setAttachment(null)
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (purchase: AssetPurchase) => {
    setEditing(purchase)
    setDraft({
      asset_code_prefix: purchase.asset_code_prefix,
      name: purchase.name,
      type: purchase.type,
      quantity: Number(purchase.quantity),
      unit_cost: Number(purchase.unit_cost),
      supplier_id: purchase.supplier_id,
      service_area_id: purchase.service_area_id,
      financial_category_id: purchase.financial_category_id,
      payment_method_id: purchase.payment_method_id,
      accounting_account_id: purchase.accounting_account_id,
      asset_status: purchase.asset_status,
      purchase_date: purchase.purchase_date.slice(0, 10),
      warranty_expiry: purchase.warranty_expiry?.slice(0, 10) ?? '',
      invoice_number: purchase.invoice_number ?? '',
      address: purchase.address ?? '',
      notes: purchase.notes ?? '',
    })
    setAttachment(null)
    setFormError('')
    setFormOpen(true)
  }

  const save = async () => {
    setFormError('')
    if (
      !draft.asset_code_prefix.trim()
      || !draft.name.trim()
      || draft.quantity < 1
      || draft.unit_cost <= 0
      || !draft.financial_category_id
      || !draft.payment_method_id
      || !draft.accounting_account_id
    ) {
      setFormError('Complete all required purchase fields.')
      return
    }
    if (balanceAfter < -0.005) {
      setFormError('The selected account does not have enough available balance.')
      return
    }

    try {
      const [latestSuppliers, latestServiceAreas] = await Promise.all([
        draft.supplier_id ? refetchSuppliers().unwrap() : Promise.resolve(suppliers),
        draft.service_area_id ? refetchServiceAreas().unwrap() : Promise.resolve(serviceAreas),
      ])

      if (
        draft.supplier_id
        && !latestSuppliers.some((supplier) => supplier.id === draft.supplier_id && supplier.status === 'active')
      ) {
        setDraft((current) => ({ ...current, supplier_id: undefined }))
        setFormError('The selected supplier no longer exists. Create it in Suppliers, then select it again.')
        return
      }

      if (
        draft.service_area_id
        && !latestServiceAreas.some((area) => area.id === draft.service_area_id)
      ) {
        setDraft((current) => ({ ...current, service_area_id: undefined }))
        setFormError('The selected service area no longer exists. Create it in Service Areas, then select it again.')
        return
      }
    } catch {
      setFormError('Unable to refresh suppliers and service areas. Check the connection and try again.')
      return
    }

    const body = new FormData()
    Object.entries(draft).forEach(([key, value]) => {
      if (value !== undefined && value !== '') body.append(key, String(value))
    })
    if (attachment) body.append('attachment', attachment)

    try {
      if (editing) await updatePurchase({ id: editing.id, body }).unwrap()
      else await createPurchase(body).unwrap()
      setFormOpen(false)
      setEditing(null)
      setAttachment(null)
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Unable to save the asset purchase.'))
    }
  }

  const runConfirmedAction = async () => {
    if (!confirmAction) return
    setPageError('')
    const transactionId = confirmAction.purchase.accounting_transaction_id
    try {
      if (confirmAction.kind === 'delete') {
        await deletePurchase(confirmAction.purchase.id).unwrap()
        return
      }
      if (!transactionId) throw new Error('The linked financial transaction was not found.')
      if (confirmAction.kind === 'review') await reviewTransaction(transactionId).unwrap()
      if (confirmAction.kind === 'approve') await approveTransaction(transactionId).unwrap()
    } catch (error) {
      setPageError(getApiErrorMessage(error, `Unable to ${confirmAction.kind} the asset purchase.`))
      throw error
    }
  }

  const reject = async () => {
    if (!rejecting?.accounting_transaction_id || !rejectionReason.trim()) return
    setPageError('')
    try {
      await rejectTransaction({
        id: rejecting.accounting_transaction_id,
        rejectionReason: rejectionReason.trim(),
      }).unwrap()
      setRejecting(null)
      setRejectionReason('')
    } catch (error) {
      setPageError(getApiErrorMessage(error, 'Unable to reject the asset purchase.'))
    }
  }

  const reverse = async () => {
    if (!reversing?.accounting_transaction_id || !reversalReason.trim()) return
    setPageError('')
    try {
      await cancelTransaction({
        id: reversing.accounting_transaction_id,
        reversalReason: reversalReason.trim(),
      }).unwrap()
      setReversing(null)
      setReversalReason('')
    } catch (error) {
      setPageError(getApiErrorMessage(error, 'Unable to reverse the asset purchase.'))
    }
  }

  const downloadAttachment = async (purchase: AssetPurchase) => {
    setPageError('')
    try {
      const response = await fetch(`${API_BASE_URL}/asset-purchases/${purchase.id}/attachment`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (!response.ok) throw new Error('Unable to download the purchase attachment.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = purchase.attachment_original_name || 'asset-purchase-attachment'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setPageError(getApiErrorMessage(error, 'Unable to download the purchase attachment.'))
    }
  }

  const actions = (purchase: AssetPurchase) => (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {['pending_review', 'rejected'].includes(purchase.status) ? (
        <button type="button" className="icon-button h-8 w-8 text-[var(--gold)]" title="Edit" onClick={() => openEdit(purchase)}><Edit2 size={15} /></button>
      ) : null}
      {['pending_review', 'rejected'].includes(purchase.status) ? (
        <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete" onClick={() => setConfirmAction({ kind: 'delete', purchase })}><Trash2 size={15} /></button>
      ) : null}
      {purchase.status === 'pending_review' && isManager ? (
        <button type="button" className="icon-button h-8 w-8" title="Review" onClick={() => setConfirmAction({ kind: 'review', purchase })}><CheckCheck size={15} /></button>
      ) : null}
      {['pending_review', 'pending_approval'].includes(purchase.status) && isAdmin ? (
        <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Approve" onClick={() => setConfirmAction({ kind: 'approve', purchase })}><CircleCheck size={15} /></button>
      ) : null}
      {['pending_review', 'pending_approval'].includes(purchase.status) && isAdmin ? (
        <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Reject" onClick={() => { setRejecting(purchase); setRejectionReason('') }}><XCircle size={15} /></button>
      ) : null}
      {purchase.status === 'approved' && isAdmin ? (
        <button type="button" className="icon-button h-8 w-8" title="Reverse" onClick={() => { setReversing(purchase); setReversalReason('') }}><Undo2 size={15} /></button>
      ) : null}
      {purchase.attachment_path ? (
        <button type="button" className="icon-button h-8 w-8" title="Download attachment" onClick={() => void downloadAttachment(purchase)}><Download size={15} /></button>
      ) : null}
    </div>
  )

  const columns: Column<AssetPurchase>[] = [
    { key: 'purchase_number', label: 'Purchase Number', render: (purchase) => <span className="font-mono text-xs font-extrabold">{purchase.purchase_number}</span> },
    { key: 'purchase_date', label: 'Date', render: (purchase) => <DateText value={purchase.purchase_date} /> },
    { key: 'name', label: 'Asset', render: (purchase) => <span className="font-bold text-[var(--text-primary)]">{purchase.name}</span> },
    { key: 'quantity', label: 'Quantity', render: (purchase) => <span className="font-extrabold">{purchase.quantity}</span> },
    { key: 'total_amount', label: 'Total', render: (purchase) => <span className="font-extrabold text-[var(--coral)]">{money(purchase.total_amount)}</span> },
    { key: 'account', label: 'Paid From Account', render: (purchase) => purchase.account?.name ?? '-' },
    { key: 'status', label: 'Status', render: (purchase) => <FinanceStatus value={purchase.status} /> },
    { key: 'actions', label: 'Actions', render: actions },
    { key: 'asset_code_prefix', label: 'Asset Code Prefix' },
    { key: 'type', label: 'Asset Type', render: (purchase) => typeLabels[purchase.type] },
    { key: 'unit_cost', label: 'Unit Cost', render: (purchase) => money(purchase.unit_cost) },
    { key: 'supplier', label: 'Supplier', render: (purchase) => purchase.supplier?.name ?? '-' },
    { key: 'payment_method', label: 'Payment Method', render: (purchase) => purchase.payment_method?.name ?? '-' },
    { key: 'category', label: 'Expense Type', render: (purchase) => purchase.category?.name ?? '-' },
    { key: 'assets', label: 'Generated Assets', render: (purchase) => purchase.assets?.map((asset) => asset.asset_code).join(', ') || '-' },
    { key: 'invoice_number', label: 'Invoice Number', render: (purchase) => purchase.invoice_number || '-' },
    { key: 'creator', label: 'Created By', render: (purchase) => purchase.creator?.name ?? '-' },
    { key: 'notes', label: 'Notes', render: (purchase) => purchase.notes || '-' },
  ]

  const confirmTitle = confirmAction?.kind === 'approve'
    ? 'Approve Asset Purchase'
    : confirmAction?.kind === 'review'
      ? 'Review Asset Purchase'
      : 'Delete Asset Purchase'
  const confirmMessage = confirmAction?.kind === 'approve'
    ? `Approve ${confirmAction.purchase.purchase_number}? ${money(confirmAction.purchase.total_amount)} will be deducted and ${confirmAction.purchase.quantity} asset record(s) will be created.`
    : confirmAction?.kind === 'review'
      ? `Send ${confirmAction.purchase.purchase_number} to the administrator for approval?`
      : `Delete ${confirmAction?.purchase.purchase_number ?? 'this pending purchase'}?`

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--text-primary)]">Asset Purchases</h2>
          <p className="text-sm text-[var(--text-muted)]">Purchase fixed assets from a selected financial account</p>
        </div>
        <button type="button" onClick={openCreate} className="primary-action text-sm"><Plus size={18} /> Purchase Asset</button>
      </div>

      {pageError || isError ? (
        <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
          {pageError || 'Unable to load asset purchases.'}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search asset purchases..." className="field-control h-10 w-full ps-10 pe-3 text-sm" />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'pending_review', 'pending_approval', 'approved', 'rejected', 'cancelled'].map((item) => (
            <button key={item} type="button" onClick={() => { setStatus(item); setPage(1) }} className={status === item ? 'primary-action min-h-0 px-3 py-2 text-xs' : 'secondary-action min-h-0 px-3 py-2 text-xs'}>
              {item.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={purchases}
        loading={(isLoading || isFetching) && purchases.length === 0}
        searchable={false}
        summaryColumnCount={8}
        emptyMessage="No asset purchases found"
        serverPagination={{
          currentPage: purchasePage?.current_page ?? page,
          lastPage: purchasePage?.last_page ?? 1,
          perPage: purchasePage?.per_page ?? 20,
          total: purchasePage?.total ?? 0,
          onPageChange: setPage,
        }}
      />

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Asset Purchase' : 'Purchase Asset'} size="xl">
        <div className="space-y-5">
          {formError ? (
            <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
              {formError}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Asset Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: String(value) })} required />
            <FormField label="Asset Code Prefix" value={draft.asset_code_prefix} onChange={(value) => setDraft({ ...draft, asset_code_prefix: String(value).toUpperCase().replace(/[^A-Z0-9_-]/g, '') })} required />
            <FormField label="Asset Type" type="select" value={draft.type} onChange={(value) => setDraft({ ...draft, type: value as AssetPurchase['type'] })} options={Object.entries(typeLabels).map(([value, label]) => ({ value, label }))} required />
            <FormField label="Asset Status" type="select" value={draft.asset_status} onChange={(value) => setDraft({ ...draft, asset_status: value as AssetPurchase['asset_status'] })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} required />
            <FormField label="Quantity" type="number" min={1} max={100} value={draft.quantity} onChange={(value) => setDraft({ ...draft, quantity: Number(value) })} required />
            <FormField label="Unit Cost" type="number" min={0.01} value={draft.unit_cost} onChange={(value) => setDraft({ ...draft, unit_cost: Number(value) })} required />
            <FormField label="Supplier" type="select" value={draft.supplier_id ?? ''} onChange={(value) => setDraft({ ...draft, supplier_id: Number(value) || undefined })} options={activeSuppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))} />
            <FormField label="Service Area" type="select" value={draft.service_area_id ?? ''} onChange={(value) => setDraft({ ...draft, service_area_id: Number(value) || undefined })} options={serviceAreas.map((area) => ({ value: area.id, label: area.name }))} />
            <FormField label="Expense Type" type="select" value={draft.financial_category_id ?? ''} onChange={(value) => setDraft({ ...draft, financial_category_id: Number(value) })} options={activeCategories.map((category) => ({ value: category.id, label: category.name }))} required />
            <FormField label="Payment Method" type="select" value={draft.payment_method_id ?? ''} onChange={(value) => setDraft({ ...draft, payment_method_id: Number(value), accounting_account_id: undefined })} options={activeMethods.map((method) => ({ value: method.id, label: method.name }))} required />
            <FormField label="Paid From Account" type="select" value={draft.accounting_account_id ?? ''} onChange={(value) => setDraft({ ...draft, accounting_account_id: Number(value) })} options={compatibleAccounts.map((account) => ({ value: account.id, label: `${account.name} - ${money(account.current_balance)}` }))} required />
            <FormField label="Purchase Date" type="date" value={draft.purchase_date} onChange={(value) => setDraft({ ...draft, purchase_date: String(value) })} required />
            <FormField label="Warranty Expiry" type="date" value={draft.warranty_expiry} onChange={(value) => setDraft({ ...draft, warranty_expiry: String(value) })} />
            <FormField label="Invoice Number" value={draft.invoice_number} onChange={(value) => setDraft({ ...draft, invoice_number: String(value) })} />
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-[var(--text-secondary)]">Invoice Attachment</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="field-control px-3 py-2 text-sm" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
            </div>
            <div className="md:col-span-2"><FormField label="Address / Location" value={draft.address} onChange={(value) => setDraft({ ...draft, address: String(value) })} /></div>
            <div className="md:col-span-2"><FormField label="Notes" type="textarea" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: String(value) })} /></div>
          </div>

          <div className="grid gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 sm:grid-cols-4">
            <div><p className="text-xs font-bold text-[var(--text-muted)]">Quantity</p><p className="mt-1 font-extrabold">{draft.quantity || 0}</p></div>
            <div><p className="text-xs font-bold text-[var(--text-muted)]">Purchase Total</p><p className="mt-1 font-extrabold text-[var(--coral)]">{money(total)}</p></div>
            <div><p className="text-xs font-bold text-[var(--text-muted)]">Current Balance</p><p className="mt-1 font-extrabold">{selectedAccount ? money(selectedAccount.current_balance) : '-'}</p></div>
            <div><p className="text-xs font-bold text-[var(--text-muted)]">Balance After Approval</p><p className={`mt-1 font-extrabold ${balanceAfter < 0 ? 'text-[var(--coral)]' : 'text-[var(--mint)]'}`}>{selectedAccount ? money(balanceAfter) : '-'}</p></div>
          </div>

          <div className="flex justify-end gap-3">
            <button type="button" className="secondary-action" onClick={() => setFormOpen(false)}>Cancel</button>
            <LoadingButton loading={createState.isLoading || updateState.isLoading} className="primary-action" onClick={() => void save()}>
              Send For Review
            </LoadingButton>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(confirmAction)}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel={confirmAction?.kind === 'approve' ? 'Approve' : confirmAction?.kind === 'review' ? 'Review' : 'Delete'}
        kind={confirmAction?.kind === 'approve' ? 'approval' : confirmAction?.kind === 'review' ? 'primary' : 'danger'}
        onConfirm={runConfirmedAction}
        onCancel={() => setConfirmAction(null)}
      />

      <Modal isOpen={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject Asset Purchase" size="sm">
        <FormField label="Rejection Reason" type="textarea" value={rejectionReason} onChange={(value) => setRejectionReason(String(value))} required />
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="secondary-action" onClick={() => setRejecting(null)}>Cancel</button>
          <LoadingButton loading={rejectState.isLoading} className="primary-action" disabled={!rejectionReason.trim()} onClick={() => void reject()}>Reject Purchase</LoadingButton>
        </div>
      </Modal>

      <Modal isOpen={Boolean(reversing)} onClose={() => setReversing(null)} title="Reverse Asset Purchase" size="sm">
        <FormField label="Reversal Reason" type="textarea" value={reversalReason} onChange={(value) => setReversalReason(String(value))} required />
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="secondary-action" onClick={() => setReversing(null)}>Cancel</button>
          <LoadingButton loading={cancelState.isLoading} className="primary-action" disabled={!reversalReason.trim()} onClick={() => void reverse()}>Reverse Purchase</LoadingButton>
        </div>
      </Modal>
    </div>
  )
}
