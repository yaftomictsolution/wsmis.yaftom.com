'use client'

import { useMemo, useState } from 'react'
import { CheckCheck, CircleCheck, Download, Plus, ReceiptText, TrendingDown, TrendingUp, Undo2, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { FinanceMetric, FinanceStatus, InlineError, dateValue, getApiErrorMessage, hasRole, money } from '@/components/finance/FinanceUI'
import { API_BASE_URL, getAuthToken } from '@/lib/api'
import { useLanguage } from '@/context/LanguageContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import {
  useApproveAccountingTransactionMutation,
  useCancelAccountingTransactionMutation,
  useCreateAccountingTransactionMutation,
  useGetAccountingAccountsQuery,
  useGetAccountingSummaryQuery,
  useGetAccountingTransactionsQuery,
  useGetMeQuery,
  useGetSettingsQuery,
  useRejectAccountingTransactionMutation,
  useReviewAccountingTransactionMutation,
  type AccountingTransaction,
} from '@/src/store/waternetApi'

type Draft = {
  type: 'income'
  title: string
  financial_category_id?: number
  payment_method_id?: number
  accounting_account_id?: number
  amount: number
  transaction_date: string
  received_from?: string
  paid_to?: string
  receipt_number?: string
  reference?: string
  description?: string
}

const emptyDraft = (businessDate: string): Draft => ({ type: 'income', title: '', amount: 0, transaction_date: businessDate })

export default function FinanceTransactionsPage() {
  const { t } = useLanguage()
  const { businessDate } = useTrainingMode()
  const { data: transactions = [], isLoading, isError } = useGetAccountingTransactionsQuery({ type: 'income' })
  const { data: summary } = useGetAccountingSummaryQuery()
  const { data: settings } = useGetSettingsQuery()
  const { data: accounts = [] } = useGetAccountingAccountsQuery()
  const { data: me } = useGetMeQuery()
  const [createTransaction, createState] = useCreateAccountingTransactionMutation()
  const [review] = useReviewAccountingTransactionMutation()
  const [approve] = useApproveAccountingTransactionMutation()
  const [reject] = useRejectAccountingTransactionMutation()
  const [cancel] = useCancelAccountingTransactionMutation()
  const [draft, setDraft] = useState<Draft>(emptyDraft(businessDate))
  const [attachment, setAttachment] = useState<File | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [rejecting, setRejecting] = useState<AccountingTransaction | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [error, setError] = useState('')

  const isManager = hasRole(me?.roles, ['Manager', 'Admin', 'Super Admin'])
  const isAdmin = hasRole(me?.roles, ['Admin', 'Super Admin'])
  const categories = settings?.financial_categories.filter((category) => category.status === 'active' && category.type === 'income') ?? []
  const methods = settings?.payment_methods.filter((method) => method.status === 'active') ?? []
  const selectedMethod = methods.find((method) => method.id === draft.payment_method_id)
  const expectedAccountType = selectedMethod?.code === 'bank_transfer' ? 'bank' : selectedMethod?.code === 'mobile_money' ? 'mobile_money' : selectedMethod?.code === 'check' ? 'check' : selectedMethod?.code === 'online_payment' ? 'online' : 'cash'
  const compatibleAccounts = accounts.filter((account) => account.status === 'active' && account.type === expectedAccountType)
  const visibleTransactions = useMemo(() => statusFilter === 'all' ? transactions : transactions.filter((transaction) => transaction.status === statusFilter), [statusFilter, transactions])

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    try {
      await action()
    } catch (actionError) {
      setError(getApiErrorMessage(actionError, fallback))
    }
  }

  const save = async () => {
    if (!draft.title || !draft.financial_category_id || !draft.payment_method_id || !draft.accounting_account_id || draft.amount <= 0) {
      setError(t('completeRequiredFields'))
      return
    }
    const body = new FormData()
    Object.entries(draft).forEach(([key, value]) => {
      if (value !== undefined && value !== '') body.append(key, String(value))
    })
    if (attachment) body.append('attachment', attachment)

    await runAction(async () => {
      await createTransaction(body).unwrap()
      setFormOpen(false)
      setDraft(emptyDraft(businessDate))
      setAttachment(null)
    }, t('unableToSaveTransaction'))
  }

  const downloadAttachment = async (transaction: AccountingTransaction) => {
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/accounting/transactions/${transaction.id}/attachment`, { headers: { Authorization: `Bearer ${getAuthToken()}` } })
      if (!response.ok) throw new Error(t('unableToDownloadAttachment'))
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = transaction.attachment_original_name || 'attachment'
      link.click()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      setError(getApiErrorMessage(downloadError, t('unableToDownloadAttachment')))
    }
  }

  const actionCell = (transaction: AccountingTransaction) => (
    <div className="flex flex-wrap items-center gap-1.5">
      {transaction.status === 'pending_review' && isManager ? <button type="button" className="icon-button h-8 w-8" title={t('review')} onClick={() => runAction(() => review(transaction.id).unwrap(), 'Unable to review transaction.')}><CheckCheck size={15} /></button> : null}
      {['pending_review', 'pending_approval'].includes(transaction.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title={t('approve')} onClick={() => runAction(() => approve(transaction.id).unwrap(), 'Unable to approve transaction.')}><CircleCheck size={15} /></button> : null}
      {['pending_review', 'pending_approval'].includes(transaction.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title={t('reject')} onClick={() => { setRejecting(transaction); setRejectionReason('') }}><XCircle size={15} /></button> : null}
      {transaction.status === 'approved' && transaction.source_type !== 'customer_payment' && isAdmin ? <button type="button" className="icon-button h-8 w-8" title={t('reverse')} onClick={() => runAction(() => cancel(transaction.id).unwrap(), 'Unable to reverse transaction.')}><Undo2 size={15} /></button> : null}
      {transaction.attachment_path ? <button type="button" className="icon-button h-8 w-8" title={t('downloadAttachment')} onClick={() => downloadAttachment(transaction)}><Download size={15} /></button> : null}
    </div>
  )

  const columns: Column<AccountingTransaction>[] = [
    { key: 'transaction_number', label: t('transaction') },
    { key: 'transaction_date', label: t('date'), render: (item) => <DateText value={item.transaction_date} /> },
    { key: 'title', label: t('title') },
    { key: 'amount', label: t('amount'), render: (item) => <span className="font-extrabold">{money(item.amount)}</span> },
    { key: 'account', label: t('account'), render: (item) => item.account?.name ?? '-' },
    { key: 'status', label: t('status'), render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'workflow', label: t('workflow'), render: actionCell },
    { key: 'category', label: t('category'), render: (item) => item.category?.name ?? '-' },
    { key: 'source_type', label: t('source'), render: (item) => item.source_type?.replaceAll('_', ' ') ?? 'manual' },
    { key: 'recorder', label: t('recordedBy'), render: (item) => item.recorder?.name ?? '-' },
    { key: 'reviewer', label: t('reviewedBy'), render: (item) => item.reviewer?.name ?? '-' },
    { key: 'approver', label: t('approvedBy'), render: (item) => item.approver?.name ?? '-' },
    { key: 'reference', label: t('reference'), render: (item) => item.reference || '-' },
    { key: 'description', label: t('description'), render: (item) => item.description || '-' },
  ]

  return (
    <div className="mx-auto max-w-[1680px] p-6 lg:p-8">
      <PageHeader title={t('income')} subtitle={t('incomeCaption')}>
        <button type="button" onClick={() => { setDraft(emptyDraft(businessDate)); setError(''); setFormOpen(true) }} className="primary-action text-sm"><Plus size={18} /> {t('newIncome')}</button>
      </PageHeader>
      <InlineError message={error || (isError ? t('unableToLoadTransactions') : '')} />

      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric label={t('monthlyIncome')} value={money(summary?.monthly_income)} icon={TrendingUp} tone="text-[var(--mint)]" />
        <FinanceMetric label={t('availableBalance')} value={money(summary?.available_balance)} icon={ReceiptText} />
        <FinanceMetric label={t('cashBalanceTrans')} value={money(summary?.cash_balance)} icon={TrendingDown} />
        <FinanceMetric label={t('bankBalanceTrans')} value={money(summary?.bank_balance)} icon={CheckCheck} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2" role="tablist">
        {['all', 'pending_review', 'pending_approval', 'approved', 'rejected', 'cancelled'].map((status) => <button key={status} type="button" onClick={() => setStatusFilter(status)} className={statusFilter === status ? 'primary-action min-h-0 px-3 py-2 text-xs' : 'secondary-action min-h-0 px-3 py-2 text-xs'}>{status.replaceAll('_', ' ')}</button>)}
      </div>

      <DataTable columns={columns} data={visibleTransactions} loading={isLoading && transactions.length === 0} searchKeys={['transaction_number', 'title', 'type', 'status', 'reference']} summaryColumnCount={8} />

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={t('incomeTransaction')} size="xl">
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label={t('title')} value={draft.title} onChange={(value) => setDraft({ ...draft, title: String(value) })} required />
          <FormField label={t('financialCategory')} type="select" value={draft.financial_category_id ?? ''} onChange={(value) => setDraft({ ...draft, financial_category_id: Number(value) })} options={categories.map((item) => ({ value: item.id, label: item.name }))} required />
          <FormField label={t('paymentMethod')} type="select" value={draft.payment_method_id ?? ''} onChange={(value) => setDraft({ ...draft, payment_method_id: Number(value), accounting_account_id: undefined })} options={methods.map((item) => ({ value: item.id, label: item.name }))} required />
          <FormField label={t('account')} type="select" value={draft.accounting_account_id ?? ''} onChange={(value) => setDraft({ ...draft, accounting_account_id: Number(value) })} options={compatibleAccounts.map((item) => ({ value: item.id, label: `${item.name} - ${money(item.current_balance)}` }))} required />
          <FormField label={t('amount')} type="number" value={draft.amount} onChange={(value) => setDraft({ ...draft, amount: Number(value) })} required />
          <FormField label={t('transactionDate')} type="date" value={draft.transaction_date} onChange={(value) => setDraft({ ...draft, transaction_date: String(value) })} required />
          <FormField label={t('receivedFrom')} value={draft.received_from ?? ''} onChange={(value) => setDraft({ ...draft, received_from: String(value) })} />
          <FormField label={t('receiptNumber')} value={draft.receipt_number ?? ''} onChange={(value) => setDraft({ ...draft, receipt_number: String(value) })} />
          <FormField label={t('reference')} value={draft.reference ?? ''} onChange={(value) => setDraft({ ...draft, reference: String(value) })} />
          <div className="space-y-1.5">
            <label className="block text-sm font-bold text-[var(--text-secondary)]">{t('attachment')}</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" className="field-control px-3 py-2 text-sm" onChange={(event) => setAttachment(event.target.files?.[0] ?? null)} />
          </div>
          <div className="md:col-span-2"><FormField label={t('description')} type="textarea" value={draft.description ?? ''} onChange={(value) => setDraft({ ...draft, description: String(value) })} /></div>
        </div>
        <div className="mt-6 flex justify-end gap-3"><button type="button" className="secondary-action" onClick={() => setFormOpen(false)}>{t('cancel')}</button><button type="button" className="primary-action" disabled={createState.isLoading} onClick={save}>{t('sendForReview')}</button></div>
      </Modal>

      <Modal isOpen={Boolean(rejecting)} onClose={() => setRejecting(null)} title={t('rejectTransaction')} size="sm">
        <FormField label={t('rejectionReason')} type="textarea" value={rejectionReason} onChange={(value) => setRejectionReason(String(value))} required />
        <div className="mt-5 flex justify-end gap-3"><button type="button" className="secondary-action" onClick={() => setRejecting(null)}>{t('cancel')}</button><button type="button" className="primary-action" onClick={() => rejecting && runAction(async () => { await reject({ id: rejecting.id, rejectionReason }).unwrap(); setRejecting(null) }, 'Unable to reject transaction.')}>{t('reject')}</button></div>
      </Modal>
    </div>
  )
}
