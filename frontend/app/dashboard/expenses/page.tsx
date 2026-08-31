'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  CheckCheck,
  CircleCheck,
  Download,
  Edit2,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  TrendingDown,
  Undo2,
  WalletCards,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingButton } from '@/components/ui/AsyncButton'
import {
  FinanceMetric,
  FinanceStatus,
  dateValue,
  getApiErrorMessage,
  hasRole,
  money,
} from '@/components/finance/FinanceUI'
import { API_BASE_URL, getAuthToken } from '@/lib/api'
import { useTrainingMode } from '@/context/TrainingModeContext'

import {
  useApproveAccountingTransactionMutation,
  useCancelAccountingTransactionMutation,
  useCreateAccountingTransactionMutation,
  useDeleteAccountingTransactionMutation,
  useGetAccountingAccountsQuery,
  useGetAccountingSummaryQuery,
  useGetExpensesQuery,
  useGetFinancialCategoriesQuery,
  useGetMeQuery,
  useGetPaymentMethodsQuery,
  useGetSuppliersQuery,
  useRejectAccountingTransactionMutation,
  useReviewAccountingTransactionMutation,
  useUpdateAccountingTransactionMutation,
  type AccountingTransaction,
} from '@/src/store/waternetApi'

type ExpenseDraft = {
  title: string
  financial_category_id?: number
  payment_method_id?: number
  accounting_account_id?: number
  supplier_id?: number
  amount: number
  transaction_date: string
  paid_to: string
  receipt_number: string
  reference: string
  description: string
}

type ConfirmAction = {
  kind: 'review' | 'approve' | 'delete'
  expense: AccountingTransaction
}

const emptyDraft = (businessDate: string): ExpenseDraft => ({
  title: '',
  amount: 0,
  transaction_date: businessDate,
  paid_to: '',
  receipt_number: '',
  reference: '',
  description: '',
})

function accountTypeForMethod(code?: string): string {
  if (code === 'bank_transfer') return 'bank'
  if (code === 'mobile_money') return 'mobile_money'
  if (code === 'check') return 'check'
  if (code === 'online_payment') return 'online'
  return 'cash'
}

function isManual(expense: AccountingTransaction): boolean {
  return !expense.source_type || expense.source_type === 'manual'
}

export default function ExpensesPage() {
  const { businessDate } = useTrainingMode()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AccountingTransaction | null>(null)
  const [draft, setDraft] = useState<ExpenseDraft>(emptyDraft(businessDate))
  const [attachment, setAttachment] = useState<File | null>(null)
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null)
  const [rejecting, setRejecting] = useState<AccountingTransaction | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [reversing, setReversing] = useState<AccountingTransaction | null>(null)
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

  const query = useMemo(() => ({
    page,
    per_page: 20,
    status: status === 'all' ? undefined : status,
    search: search || undefined,
  }), [page, search, status])
  const { data: expensePage, isLoading, isFetching, isError } = useGetExpensesQuery(query)
  const { data: summary } = useGetAccountingSummaryQuery()
  const { data: categories = [] } = useGetFinancialCategoriesQuery({ type: 'expense' })
  const { data: methods = [] } = useGetPaymentMethodsQuery()
  const { data: accounts = [] } = useGetAccountingAccountsQuery()
  const { data: suppliers = [] } = useGetSuppliersQuery({})
  const { data: me } = useGetMeQuery()
  const [createExpense, createState] = useCreateAccountingTransactionMutation()
  const [updateExpense, updateState] = useUpdateAccountingTransactionMutation()
  const [deleteExpense] = useDeleteAccountingTransactionMutation()
  const [reviewExpense] = useReviewAccountingTransactionMutation()
  const [approveExpense] = useApproveAccountingTransactionMutation()
  const [rejectExpense, rejectState] = useRejectAccountingTransactionMutation()
  const [cancelExpense, cancelState] = useCancelAccountingTransactionMutation()

  const expenses = expensePage?.data ?? []
  const activeCategories = categories.filter((category) => category.status === 'active')
  const activeMethods = methods.filter((method) => method.status === 'active')
  const activeSuppliers = suppliers.filter((supplier) => supplier.status === 'active')
  const selectedMethod = activeMethods.find((method) => method.id === draft.payment_method_id)
  const compatibleAccounts = accounts.filter(
    (account) => account.status === 'active' && account.type === accountTypeForMethod(selectedMethod?.code),
  )
  const selectedAccount = accounts.find((account) => account.id === draft.accounting_account_id)
  const balanceAfter = Number(selectedAccount?.current_balance ?? 0) - Number(draft.amount || 0)
  const isManager = hasRole(me?.roles, ['Manager', 'Admin', 'Super Admin'])
  const isAdmin = hasRole(me?.roles, ['Admin', 'Super Admin'])

  const openCreate = () => {
    setEditing(null)
    setDraft(emptyDraft(businessDate))
    setAttachment(null)
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (expense: AccountingTransaction) => {
    setEditing(expense)
    setDraft({
      title: expense.title,
      financial_category_id: expense.financial_category_id,
      payment_method_id: expense.payment_method_id,
      accounting_account_id: expense.accounting_account_id,
      supplier_id: expense.supplier_id,
      amount: Number(expense.amount),
      transaction_date: expense.transaction_date.slice(0, 10),
      paid_to: expense.paid_to ?? '',
      receipt_number: expense.receipt_number ?? '',
      reference: expense.reference ?? '',
      description: expense.description ?? '',
    })
    setAttachment(null)
    setFormError('')
    setFormOpen(true)
  }

  const save = async () => {
    setFormError('')
    if (!draft.title.trim() || !draft.financial_category_id || !draft.payment_method_id || !draft.accounting_account_id || draft.amount <= 0) {
      setFormError('Complete all required expense fields.')
      return
    }
    if (balanceAfter < -0.005) {
      setFormError('The selected account does not have enough available balance.')
      return
    }

    const body = new FormData()
    body.append('type', 'expense')
    Object.entries(draft).forEach(([key, value]) => {
      if (value !== undefined && value !== '') body.append(key, String(value))
    })
    if (attachment) body.append('attachment', attachment)

    try {
      if (editing) await updateExpense({ id: editing.id, body }).unwrap()
      else await createExpense(body).unwrap()
      setFormOpen(false)
      setEditing(null)
      setDraft(emptyDraft(businessDate))
      setAttachment(null)
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Unable to save the expense.'))
    }
  }

  const runConfirmedAction = async () => {
    if (!confirmAction) return
    setPageError('')
    const { expense, kind } = confirmAction
    try {
      if (kind === 'review') await reviewExpense(expense.id).unwrap()
      if (kind === 'approve') await approveExpense(expense.id).unwrap()
      if (kind === 'delete') await deleteExpense(expense.id).unwrap()
    } catch (error) {
      setPageError(getApiErrorMessage(error, `Unable to ${kind} the expense.`))
      throw error
    }
  }

  const reject = async () => {
    if (!rejecting || !rejectionReason.trim()) return
    setPageError('')
    try {
      await rejectExpense({ id: rejecting.id, rejectionReason: rejectionReason.trim() }).unwrap()
      setRejecting(null)
      setRejectionReason('')
    } catch (error) {
      setPageError(getApiErrorMessage(error, 'Unable to reject the expense.'))
    }
  }

  const reverse = async () => {
    if (!reversing || !reversalReason.trim()) return
    setPageError('')
    try {
      await cancelExpense({ id: reversing.id, reversalReason: reversalReason.trim() }).unwrap()
      setReversing(null)
      setReversalReason('')
    } catch (error) {
      setPageError(getApiErrorMessage(error, 'Unable to reverse the expense.'))
    }
  }

  const downloadAttachment = async (expense: AccountingTransaction) => {
    setPageError('')
    try {
      const response = await fetch(`${API_BASE_URL}/accounting/transactions/${expense.id}/attachment`, {
        headers: { Authorization: `Bearer ${getAuthToken()}` },
      })
      if (!response.ok) throw new Error('Unable to download attachment.')
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = expense.attachment_original_name || 'expense-attachment'
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      setPageError(getApiErrorMessage(error, 'Unable to download attachment.'))
    }
  }

  const actions = (expense: AccountingTransaction) => (
    <div className="flex flex-wrap items-center justify-center gap-1.5">
      {isManual(expense) && ['pending_review', 'rejected'].includes(expense.status) ? (
        <button type="button" className="icon-button h-8 w-8 text-[var(--gold)]" title="Edit" onClick={() => openEdit(expense)}><Edit2 size={15} /></button>
      ) : null}
      {isManual(expense) && ['pending_review', 'rejected'].includes(expense.status) ? (
        <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete" onClick={() => setConfirmAction({ kind: 'delete', expense })}><Trash2 size={15} /></button>
      ) : null}
      {expense.status === 'pending_review' && isManager ? (
        <button type="button" className="icon-button h-8 w-8" title="Review" onClick={() => setConfirmAction({ kind: 'review', expense })}><CheckCheck size={15} /></button>
      ) : null}
      {['pending_review', 'pending_approval'].includes(expense.status) && isAdmin ? (
        <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Approve" onClick={() => setConfirmAction({ kind: 'approve', expense })}><CircleCheck size={15} /></button>
      ) : null}
      {['pending_review', 'pending_approval'].includes(expense.status) && isAdmin ? (
        <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Reject" onClick={() => { setRejecting(expense); setRejectionReason('') }}><XCircle size={15} /></button>
      ) : null}
      {expense.status === 'approved' && isAdmin && [undefined, null, 'manual', 'asset_purchase'].includes(expense.source_type) ? (
        <button type="button" className="icon-button h-8 w-8" title="Reverse" onClick={() => { setReversing(expense); setReversalReason('') }}><Undo2 size={15} /></button>
      ) : null}
      {expense.attachment_path ? (
        <button type="button" className="icon-button h-8 w-8" title="Download attachment" onClick={() => void downloadAttachment(expense)}><Download size={15} /></button>
      ) : null}
    </div>
  )

  const columns: Column<AccountingTransaction>[] = [
    { key: 'transaction_number', label: 'Expense Number', render: (expense) => <span className="font-mono text-xs font-extrabold">{expense.transaction_number}</span> },
    { key: 'transaction_date', label: 'Date', render: (expense) => <DateText value={expense.transaction_date} /> },
    { key: 'title', label: 'Expense', render: (expense) => <span className="font-bold text-[var(--text-primary)]">{expense.title}</span> },
    { key: 'category', label: 'Expense Type', render: (expense) => expense.category?.name ?? '-' },
    { key: 'amount', label: 'Amount', render: (expense) => <span className="font-extrabold text-[var(--coral)]">{money(expense.amount)}</span> },
    { key: 'account', label: 'Paid From Account', render: (expense) => expense.account?.name ?? '-' },
    { key: 'status', label: 'Status', render: (expense) => <FinanceStatus value={expense.status} /> },
    { key: 'actions', label: 'Actions', render: actions },
    { key: 'paid_to', label: 'Paid To', render: (expense) => expense.paid_to || expense.supplier?.name || '-' },
    { key: 'payment_method', label: 'Payment Method', render: (expense) => expense.payment_method?.name ?? '-' },
    { key: 'source_type', label: 'Source', render: (expense) => expense.source_type?.replaceAll('_', ' ') || 'manual' },
    { key: 'reference', label: 'Reference', render: (expense) => expense.reference || '-' },
    { key: 'recorder', label: 'Recorded By', render: (expense) => expense.recorder?.name ?? '-' },
    { key: 'reviewer', label: 'Reviewed By', render: (expense) => expense.reviewer?.name ?? '-' },
    { key: 'approver', label: 'Approved By', render: (expense) => expense.approver?.name ?? '-' },
    { key: 'description', label: 'Description', render: (expense) => expense.description || '-' },
  ]

  const confirmTitle = confirmAction?.kind === 'approve'
    ? 'Approve Expense'
    : confirmAction?.kind === 'review'
      ? 'Review Expense'
      : 'Delete Expense'
  const confirmMessage = confirmAction?.kind === 'approve'
    ? `Approve ${confirmAction.expense.transaction_number}? The selected account will be reduced by ${money(confirmAction.expense.amount)}.`
    : confirmAction?.kind === 'review'
      ? `Send ${confirmAction.expense.transaction_number} to the administrator for approval?`
      : `Delete ${confirmAction?.expense.transaction_number ?? 'this expense'}?`

  return (
    <div className="mx-auto max-w-[1680px] space-y-5 p-4 lg:p-8">
      <PageHeader title="Expenses" subtitle="Record, approve, and audit every outgoing payment">
        <button type="button" onClick={openCreate} className="primary-action text-sm"><Plus size={18} /> New Expense</button>
      </PageHeader>

      {pageError || isError ? (
        <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
          {pageError || 'Unable to load expenses.'}
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric label="Monthly Expenses" value={money(summary?.monthly_expense)} icon={TrendingDown} tone="text-[var(--coral)]" />
        <FinanceMetric label="Pending Expenses" value={money(summary?.pending_expenses)} icon={ReceiptText} tone="text-[var(--gold)]" />
        <FinanceMetric label="Cash Balance" value={money(summary?.cash_balance)} icon={WalletCards} />
        <FinanceMetric label="Bank Balance" value={money(summary?.bank_balance)} icon={WalletCards} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[240px] flex-1">
          <Search className="absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search expenses..."
            className="field-control h-10 w-full ps-10 pe-3 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'pending_review', 'pending_approval', 'approved', 'rejected', 'cancelled'].map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => { setStatus(item); setPage(1) }}
              className={status === item ? 'primary-action min-h-0 px-3 py-2 text-xs' : 'secondary-action min-h-0 px-3 py-2 text-xs'}
            >
              {item.replaceAll('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <DataTable
        columns={columns}
        data={expenses}
        loading={(isLoading || isFetching) && expenses.length === 0}
        searchable={false}
        summaryColumnCount={8}
        emptyMessage="No expenses found"
        serverPagination={{
          currentPage: expensePage?.current_page ?? page,
          lastPage: expensePage?.last_page ?? 1,
          perPage: expensePage?.per_page ?? 20,
          total: expensePage?.total ?? 0,
          onPageChange: setPage,
        }}
      />

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={editing ? 'Edit Expense' : 'New Expense'} size="xl">
        <div className="space-y-5">
          {formError ? (
            <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
              {formError}
            </div>
          ) : null}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Expense Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: String(value) })} required />
            <FormField
              label="Expense Type"
              type="select"
              value={draft.financial_category_id ?? ''}
              onChange={(value) => setDraft({ ...draft, financial_category_id: Number(value) })}
              options={activeCategories.map((category) => ({ value: category.id, label: category.name }))}
              required
            />
            <FormField
              label="Payment Method"
              type="select"
              value={draft.payment_method_id ?? ''}
              onChange={(value) => setDraft({ ...draft, payment_method_id: Number(value), accounting_account_id: undefined })}
              options={activeMethods.map((method) => ({ value: method.id, label: method.name }))}
              required
            />
            <FormField
              label="Paid From Account"
              type="select"
              value={draft.accounting_account_id ?? ''}
              onChange={(value) => setDraft({ ...draft, accounting_account_id: Number(value) })}
              options={compatibleAccounts.map((account) => ({ value: account.id, label: `${account.name} - ${money(account.current_balance)}` }))}
              required
            />
            <FormField label="Amount" type="number" value={draft.amount} onChange={(value) => setDraft({ ...draft, amount: Number(value) })} required />
            <FormField label="Expense Date" type="date" value={draft.transaction_date} onChange={(value) => setDraft({ ...draft, transaction_date: String(value) })} required />
            <FormField
              label="Supplier"
              type="select"
              value={draft.supplier_id ?? ''}
              onChange={(value) => {
                const supplierId = Number(value) || undefined
                const supplier = activeSuppliers.find((item) => item.id === supplierId)
                setDraft({ ...draft, supplier_id: supplierId, paid_to: supplier?.name ?? draft.paid_to })
              }}
              options={activeSuppliers.map((supplier) => ({ value: supplier.id, label: supplier.name }))}
            />
            <FormField label="Paid To" value={draft.paid_to} onChange={(value) => setDraft({ ...draft, paid_to: String(value) })} />
            <FormField label="Receipt Number" value={draft.receipt_number} onChange={(value) => setDraft({ ...draft, receipt_number: String(value) })} />
            <FormField label="Reference" value={draft.reference} onChange={(value) => setDraft({ ...draft, reference: String(value) })} />
            <div className="space-y-1.5">
              <label className="block text-sm font-bold text-[var(--text-secondary)]">Attachment</label>
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="field-control px-3 py-2 text-sm" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
            </div>
            <div className="md:col-span-2">
              <FormField label="Description" type="textarea" value={draft.description} onChange={(value) => setDraft({ ...draft, description: String(value) })} />
            </div>
          </div>

          {selectedAccount ? (
            <div className="grid gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4 sm:grid-cols-3">
              <div><p className="text-xs font-bold text-[var(--text-muted)]">Current Balance</p><p className="mt-1 font-extrabold">{money(selectedAccount.current_balance)}</p></div>
              <div><p className="text-xs font-bold text-[var(--text-muted)]">Expense Amount</p><p className="mt-1 font-extrabold text-[var(--coral)]">{money(draft.amount)}</p></div>
              <div><p className="text-xs font-bold text-[var(--text-muted)]">Balance After Approval</p><p className={`mt-1 font-extrabold ${balanceAfter < 0 ? 'text-[var(--coral)]' : 'text-[var(--mint)]'}`}>{money(balanceAfter)}</p></div>
            </div>
          ) : null}

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

      <Modal isOpen={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject Expense" size="sm">
        <FormField label="Rejection Reason" type="textarea" value={rejectionReason} onChange={(value) => setRejectionReason(String(value))} required />
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="secondary-action" onClick={() => setRejecting(null)}>Cancel</button>
          <LoadingButton loading={rejectState.isLoading} className="primary-action" disabled={!rejectionReason.trim()} onClick={() => void reject()}>Reject Expense</LoadingButton>
        </div>
      </Modal>

      <Modal isOpen={Boolean(reversing)} onClose={() => setReversing(null)} title="Reverse Expense" size="sm">
        <FormField label="Reversal Reason" type="textarea" value={reversalReason} onChange={(value) => setReversalReason(String(value))} required />
        <div className="mt-5 flex justify-end gap-3">
          <button type="button" className="secondary-action" onClick={() => setReversing(null)}>Cancel</button>
          <LoadingButton loading={cancelState.isLoading} className="primary-action" disabled={!reversalReason.trim()} onClick={() => void reverse()}>Reverse Expense</LoadingButton>
        </div>
      </Modal>
    </div>
  )
}
