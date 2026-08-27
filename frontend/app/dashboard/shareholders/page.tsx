'use client'

import { useMemo, useState } from 'react'
import { Banknote, CheckCheck, CircleCheck, Coins, Eye, PieChart, Plus, Send, Trash2, Users, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { FinanceMetric, FinanceStatus, InlineError, dateValue, getApiErrorMessage, hasRole, money } from '@/components/finance/FinanceUI'
import { useTrainingMode } from '@/context/TrainingModeContext'
import {
  useApproveAccountingTransactionMutation,
  useApproveShareholderDistributionMutation,
  useCreateShareholderDistributionMutation,
  useCreateShareholderMutation,
  useDeleteShareholderDistributionMutation,
  useDeleteShareholderMutation,
  useGetAccountingAccountsQuery,
  useGetFinancialClosingsQuery,
  useGetMeQuery,
  useGetSettingsQuery,
  useGetShareholderDistributionsQuery,
  useGetShareholdersQuery,
  usePayShareholderDistributionMutation,
  useRejectAccountingTransactionMutation,
  useRejectShareholderDistributionMutation,
  useReviewAccountingTransactionMutation,
  useReviewShareholderDistributionMutation,
  useSubmitShareholderDistributionMutation,
  useUpdateShareholderMutation,
  type AccountingTransaction,
  type Shareholder,
  type ShareholderDistribution,
  type ShareholderDistributionItem,
} from '@/src/store/waternetApi'

type ShareholderDraft = Partial<Shareholder> & { name?: string }
type PaymentDraft = { item?: ShareholderDistributionItem; amount: number; payment_date: string; payment_method_id?: number; accounting_account_id?: number; receipt_number?: string; notes?: string }

export default function ShareholdersPage() {
  const { businessDate } = useTrainingMode()
  const { data: shareholdersResponse, isLoading: shareholdersLoading, isError: shareholdersError } = useGetShareholdersQuery()
  const { data: distributions = [], isLoading: distributionsLoading, isError: distributionsError, refetch: refetchDistributions } = useGetShareholderDistributionsQuery()
  const { data: closings = [] } = useGetFinancialClosingsQuery()
  const { data: settings } = useGetSettingsQuery()
  const { data: accounts = [] } = useGetAccountingAccountsQuery()
  const { data: me } = useGetMeQuery()
  const [createShareholder] = useCreateShareholderMutation()
  const [updateShareholder] = useUpdateShareholderMutation()
  const [deleteShareholder] = useDeleteShareholderMutation()
  const [createDistribution] = useCreateShareholderDistributionMutation()
  const [deleteDistribution] = useDeleteShareholderDistributionMutation()
  const [submitDistribution] = useSubmitShareholderDistributionMutation()
  const [reviewDistribution] = useReviewShareholderDistributionMutation()
  const [approveDistribution] = useApproveShareholderDistributionMutation()
  const [rejectDistribution] = useRejectShareholderDistributionMutation()
  const [payDistribution] = usePayShareholderDistributionMutation()
  const [reviewTransaction, reviewPaymentState] = useReviewAccountingTransactionMutation()
  const [approveTransaction, approvePaymentState] = useApproveAccountingTransactionMutation()
  const [rejectTransaction] = useRejectAccountingTransactionMutation()
  const [tab, setTab] = useState<'shareholders' | 'distributions'>('shareholders')
  const [shareholderDraft, setShareholderDraft] = useState<ShareholderDraft>({ shareholder_type: 'individual', status: 'active', investment_amount: 0, ownership_percentage: 0, joined_on: businessDate })
  const [shareholderOpen, setShareholderOpen] = useState(false)
  const [distributionOpen, setDistributionOpen] = useState(false)
  const [distributionDraft, setDistributionDraft] = useState<{ financial_period_closing_id?: number; distributable_amount?: number; notes?: string }>({})
  const [viewingId, setViewingId] = useState<number | null>(null)
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>({ amount: 0, payment_date: businessDate })
  const [paymentOpen, setPaymentOpen] = useState(false)
  const [rejectTarget, setRejectTarget] = useState<{ kind: 'distribution'; distribution: ShareholderDistribution } | { kind: 'payment'; transaction: AccountingTransaction } | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState('')

  const shareholders = shareholdersResponse?.data ?? []
  const ownershipTotal = Number(shareholdersResponse?.ownership_total ?? 0)
  const isManager = hasRole(me?.roles, ['Manager', 'Admin', 'Super Admin'])
  const isAdmin = hasRole(me?.roles, ['Admin', 'Super Admin'])
  const methods = settings?.payment_methods.filter((method) => method.status === 'active') ?? []
  const selectedMethod = methods.find((method) => method.id === paymentDraft.payment_method_id)
  const expectedType = selectedMethod?.code === 'bank_transfer' ? 'bank' : selectedMethod?.code === 'mobile_money' ? 'mobile_money' : selectedMethod?.code === 'check' ? 'check' : selectedMethod?.code === 'online_payment' ? 'online' : 'cash'
  const compatibleAccounts = accounts.filter((account) => account.status === 'active' && account.type === expectedType)
  const availableClosings = useMemo(() => closings.filter((closing) => closing.status === 'closed' && Number(closing.distributable_profit) > 0 && !distributions.some((distribution) => distribution.financial_period_closing_id === closing.id)), [closings, distributions])
  const totalEntitled = distributions.reduce((sum, distribution) => sum + Number(distribution.allocated_amount), 0)
  const totalPaid = distributions.reduce((sum, distribution) => sum + Number(distribution.paid_amount), 0)
  const viewing = distributions.find((distribution) => distribution.id === viewingId) ?? null
  const paymentWorkflowBusy = reviewPaymentState.isLoading || approvePaymentState.isLoading

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    try { await action() } catch (actionError) { setError(getApiErrorMessage(actionError, fallback)) }
  }

  const saveShareholder = async () => {
    if (!shareholderDraft.name || Number(shareholderDraft.ownership_percentage) <= 0) { setError('Enter shareholder name and ownership percentage.'); return }
    await runAction(async () => {
      const body = { ...shareholderDraft, shareholder_type: shareholderDraft.shareholder_type ?? 'individual', investment_amount: Number(shareholderDraft.investment_amount || 0), ownership_percentage: Number(shareholderDraft.ownership_percentage), status: shareholderDraft.status ?? 'active' }
      if (shareholderDraft.id) await updateShareholder({ id: shareholderDraft.id, body }).unwrap()
      else await createShareholder(body).unwrap()
      setShareholderOpen(false)
    }, 'Unable to save shareholder.')
  }

  const saveDistribution = async () => {
    if (!distributionDraft.financial_period_closing_id) { setError('Select a closed financial period.'); return }
    await runAction(async () => {
      await createDistribution({ ...distributionDraft, distributable_amount: distributionDraft.distributable_amount ? Number(distributionDraft.distributable_amount) : undefined }).unwrap()
      setDistributionOpen(false)
      setTab('distributions')
    }, 'Unable to create profit distribution.')
  }

  const openPayment = (item: ShareholderDistributionItem) => {
    setPaymentDraft({ item, amount: Number(item.remaining_amount), payment_date: businessDate })
    setPaymentOpen(true)
  }

  const savePayment = async () => {
    if (!paymentDraft.item || !paymentDraft.payment_method_id || !paymentDraft.accounting_account_id || paymentDraft.amount <= 0) { setError('Complete shareholder payment details.'); return }
    await runAction(async () => {
      await payDistribution({ itemId: paymentDraft.item!.id, body: { amount: paymentDraft.amount, payment_date: paymentDraft.payment_date, payment_method_id: paymentDraft.payment_method_id, accounting_account_id: paymentDraft.accounting_account_id, receipt_number: paymentDraft.receipt_number, notes: paymentDraft.notes } }).unwrap()
      setPaymentOpen(false)
      setViewingId(null)
    }, 'Unable to send shareholder payment for review.')
  }

  const distributionActions = (distribution: ShareholderDistribution) => (
    <div className="flex flex-wrap gap-1.5">
      {['draft', 'rejected'].includes(distribution.status) ? <button type="button" className="icon-button h-8 w-8" title="Submit" onClick={() => runAction(() => submitDistribution(distribution.id).unwrap(), 'Unable to submit distribution.')}><Send size={14} /></button> : null}
      {distribution.status === 'pending_review' && isManager ? <button type="button" className="icon-button h-8 w-8" title="Review" onClick={() => runAction(() => reviewDistribution(distribution.id).unwrap(), 'Unable to review distribution.')}><CheckCheck size={14} /></button> : null}
      {['pending_review', 'pending_approval'].includes(distribution.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Approve" onClick={() => runAction(() => approveDistribution(distribution.id).unwrap(), 'Unable to approve distribution.')}><CircleCheck size={14} /></button> : null}
      {['pending_review', 'pending_approval'].includes(distribution.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Reject" onClick={() => { setRejectTarget({ kind: 'distribution', distribution }); setRejectionReason('') }}><XCircle size={14} /></button> : null}
      {['draft', 'rejected'].includes(distribution.status) ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete" onClick={() => runAction(() => deleteDistribution(distribution.id).unwrap(), 'Unable to delete distribution.')}><Trash2 size={14} /></button> : null}
      <button type="button" className="icon-button h-8 w-8" title="View allocation" onClick={() => setViewingId(distribution.id)}><Eye size={14} /></button>
    </div>
  )

  const shareholderColumns: Column<Shareholder>[] = [
    { key: 'shareholder_number', label: 'Shareholder Number' },
    { key: 'name', label: 'Shareholder' },
    { key: 'shareholder_type', label: 'Shareholder Type', render: (item) => item.shareholder_type === 'company' ? 'Company' : item.shareholder_type === 'organization' ? 'Organization' : 'Individual' },
    { key: 'phone', label: 'Phone', render: (item) => item.phone || '-' },
    { key: 'investment_amount', label: 'Investment', render: (item) => money(item.investment_amount) },
    { key: 'ownership_percentage', label: 'Ownership', render: (item) => <span className="font-extrabold">{Number(item.ownership_percentage).toFixed(2)}%</span> },
    { key: 'entitled_amount', label: 'Profit Entitlement', render: (item) => money(item.entitled_amount) },
    { key: 'paid_amount', label: 'Paid', render: (item) => money(item.paid_amount) },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'father_name', label: 'Father Name', render: (item) => item.father_name || '-' },
    { key: 'email', label: 'Email', render: (item) => item.email || '-' },
    { key: 'joined_on', label: 'Joined On', render: (item) => <DateText value={item.joined_on} /> },
    { key: 'notes', label: 'Notes', render: (item) => item.notes || '-' },
  ]

  const distributionColumns: Column<ShareholderDistribution>[] = [
    { key: 'distribution_number', label: 'Distribution' },
    { key: 'closing', label: 'Financial Period', render: (item) => item.closing?.period_code ?? '-' },
    { key: 'distributable_amount', label: 'Allocated Profit', render: (item) => money(item.distributable_amount) },
    { key: 'paid_amount', label: 'Paid', render: (item) => money(item.paid_amount) },
    { key: 'remaining', label: 'Remaining', render: (item) => money(Number(item.allocated_amount) - Number(item.paid_amount)) },
    { key: 'items', label: 'Shareholders', render: (item) => item.items.length },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'workflow', label: 'Workflow', render: distributionActions },
    { key: 'creator', label: 'Prepared By', render: (item) => item.creator?.name ?? '-' },
    { key: 'reviewer', label: 'Reviewed By', render: (item) => item.reviewer?.name ?? '-' },
    { key: 'approver', label: 'Approved By', render: (item) => item.approver?.name ?? '-' },
    { key: 'notes', label: 'Notes', render: (item) => item.notes || '-' },
  ]

  const paymentWorkflow = (payment: NonNullable<ShareholderDistributionItem['payments']>[number]) => {
    const transaction = payment.transaction as AccountingTransaction | undefined
    if (!transaction) return null
    return <div className="flex gap-1.5">
      {transaction.status === 'pending_review' && isManager ? <button type="button" className="icon-button h-8 w-8" title="Review payment" disabled={paymentWorkflowBusy} onClick={() => runAction(async () => { await reviewTransaction(transaction.id).unwrap(); await refetchDistributions() }, 'Unable to review payment.')}><CheckCheck size={14} /></button> : null}
      {['pending_review', 'pending_approval'].includes(transaction.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Approve payment" disabled={paymentWorkflowBusy} onClick={() => runAction(async () => { await approveTransaction(transaction.id).unwrap(); await refetchDistributions() }, 'Unable to approve payment.')}><CircleCheck size={14} /></button> : null}
      {['pending_review', 'pending_approval'].includes(transaction.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Reject payment" onClick={() => { setRejectTarget({ kind: 'payment', transaction }); setRejectionReason('') }}><XCircle size={14} /></button> : null}
    </div>
  }

  return (
    <div className="mx-auto max-w-[1680px] p-6 lg:p-8">
      <PageHeader title="Shareholders" subtitle="Manage ownership, allocate closed-period profit, and control shareholder payments">
        {tab === 'shareholders' ? <button type="button" className="primary-action text-sm" onClick={() => { setShareholderDraft({ shareholder_type: 'individual', status: 'active', investment_amount: 0, ownership_percentage: 0, joined_on: businessDate }); setShareholderOpen(true) }}><Plus size={18} /> Add Shareholder</button> : <button type="button" className="primary-action text-sm" onClick={() => { setDistributionDraft({}); setDistributionOpen(true) }}><PieChart size={18} /> Allocate Profit</button>}
      </PageHeader>
      <InlineError message={error || (shareholdersError || distributionsError ? 'Unable to load shareholder finance.' : '')} />
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric label="Active Shareholders" value={String(shareholders.filter((item) => item.status === 'active').length)} icon={Users} />
        <FinanceMetric label="Ownership Allocated" value={`${ownershipTotal.toFixed(2)}%`} hint={Math.abs(ownershipTotal - 100) <= 0.01 ? 'Ready for distribution' : 'Must equal 100% for distribution'} icon={PieChart} tone={Math.abs(ownershipTotal - 100) <= 0.01 ? 'text-[var(--mint)]' : 'text-[var(--gold)]'} />
        <FinanceMetric label="Profit Entitlements" value={money(totalEntitled)} icon={Coins} />
        <FinanceMetric label="Paid To Shareholders" value={money(totalPaid)} icon={Banknote} tone="text-[var(--mint)]" />
      </div>
      <div className="mb-4 inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1"><button type="button" className={tab === 'shareholders' ? 'primary-action min-h-0 px-4 py-2 text-xs' : 'ghost-action min-h-0 px-4 py-2 text-xs'} onClick={() => setTab('shareholders')}>Shareholders</button><button type="button" className={tab === 'distributions' ? 'primary-action min-h-0 px-4 py-2 text-xs' : 'ghost-action min-h-0 px-4 py-2 text-xs'} onClick={() => setTab('distributions')}>Profit Distributions</button></div>

      {tab === 'shareholders' ? <DataTable columns={shareholderColumns} data={shareholders} loading={shareholdersLoading && shareholders.length === 0} onEdit={(item) => { setShareholderDraft(item); setShareholderOpen(true) }} onDelete={(item) => runAction(() => deleteShareholder(item.id).unwrap(), 'Unable to delete shareholder.')} searchKeys={['shareholder_number', 'name', 'shareholder_type', 'phone', 'status']} summaryColumnCount={8} /> : <DataTable columns={distributionColumns} data={distributions} loading={distributionsLoading && distributions.length === 0} searchKeys={['distribution_number', 'status']} summaryColumnCount={8} />}

      <Modal isOpen={shareholderOpen} onClose={() => setShareholderOpen(false)} title={shareholderDraft.id ? 'Edit Shareholder' : 'Add Shareholder'} size="lg"><div className="grid gap-4 md:grid-cols-2"><FormField label="Full Name" value={shareholderDraft.name ?? ''} onChange={(value) => setShareholderDraft({ ...shareholderDraft, name: String(value) })} required /><FormField label="Shareholder Type" type="select" value={shareholderDraft.shareholder_type ?? 'individual'} onChange={(value) => setShareholderDraft({ ...shareholderDraft, shareholder_type: value as Shareholder['shareholder_type'] })} options={[{ value: 'individual', label: 'Individual' }, { value: 'company', label: 'Company' }, { value: 'organization', label: 'Organization' }]} required /><FormField label="Father Name" value={shareholderDraft.father_name ?? ''} onChange={(value) => setShareholderDraft({ ...shareholderDraft, father_name: String(value) })} /><FormField label="Phone" value={shareholderDraft.phone ?? ''} onChange={(value) => setShareholderDraft({ ...shareholderDraft, phone: String(value) })} /><FormField label="Email" type="email" value={shareholderDraft.email ?? ''} onChange={(value) => setShareholderDraft({ ...shareholderDraft, email: String(value) })} /><FormField label="Investment Amount" type="number" value={shareholderDraft.investment_amount ?? 0} onChange={(value) => setShareholderDraft({ ...shareholderDraft, investment_amount: Number(value) })} /><FormField label="Ownership Percentage" type="number" value={shareholderDraft.ownership_percentage ?? 0} onChange={(value) => setShareholderDraft({ ...shareholderDraft, ownership_percentage: Number(value) })} required /><FormField label="Joined On" type="date" value={dateValue(shareholderDraft.joined_on) === '-' ? businessDate : dateValue(shareholderDraft.joined_on)} onChange={(value) => setShareholderDraft({ ...shareholderDraft, joined_on: String(value) })} /><FormField label="Status" type="select" value={shareholderDraft.status ?? 'active'} onChange={(value) => setShareholderDraft({ ...shareholderDraft, status: value as Shareholder['status'] })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /><div className="md:col-span-2"><FormField label="Notes" type="textarea" value={shareholderDraft.notes ?? ''} onChange={(value) => setShareholderDraft({ ...shareholderDraft, notes: String(value) })} /></div></div><div className="mt-6 flex justify-end gap-3"><button type="button" className="secondary-action" onClick={() => setShareholderOpen(false)}>Cancel</button><button type="button" className="primary-action" onClick={saveShareholder}>Save Shareholder</button></div></Modal>

      <Modal isOpen={distributionOpen} onClose={() => setDistributionOpen(false)} title="Allocate Closed-Period Profit" size="lg"><div className="grid gap-4 md:grid-cols-2"><FormField label="Closed Financial Period" type="select" value={distributionDraft.financial_period_closing_id ?? ''} onChange={(value) => { const id = Number(value); const closing = availableClosings.find((item) => item.id === id); setDistributionDraft({ ...distributionDraft, financial_period_closing_id: id, distributable_amount: Number(closing?.distributable_profit ?? 0) }) }} options={availableClosings.map((closing) => ({ value: closing.id, label: `${closing.period_code} - ${money(closing.distributable_profit)}` }))} required /><FormField label="Amount To Distribute" type="number" value={distributionDraft.distributable_amount ?? 0} onChange={(value) => setDistributionDraft({ ...distributionDraft, distributable_amount: Number(value) })} required /><div className="md:col-span-2"><FormField label="Notes" type="textarea" value={distributionDraft.notes ?? ''} onChange={(value) => setDistributionDraft({ ...distributionDraft, notes: String(value) })} /></div></div><div className="mt-6 flex justify-end gap-3"><button type="button" className="secondary-action" onClick={() => setDistributionOpen(false)}>Cancel</button><button type="button" className="primary-action" onClick={saveDistribution}>Create Allocation</button></div></Modal>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewingId(null)} title={viewing?.distribution_number ?? 'Profit Allocation'} size="xl"><div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-b text-xs uppercase text-[var(--text-muted)] elegant-divider"><tr><th className="px-3 py-3 text-start">Shareholder</th><th className="px-3 py-3 text-end">Ownership</th><th className="px-3 py-3 text-end">Entitlement</th><th className="px-3 py-3 text-end">Paid</th><th className="px-3 py-3 text-end">Remaining</th><th className="px-3 py-3 text-end">Action</th></tr></thead><tbody>{viewing?.items.map((item) => <tr key={item.id} className="border-b align-top elegant-divider"><td className="px-3 py-3"><p className="font-extrabold">{item.shareholder?.name}</p>{item.payments?.map((payment) => <div key={payment.id} className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]"><span>{payment.payment_number}</span><span>{money(payment.amount)}</span><FinanceStatus value={payment.status} />{paymentWorkflow(payment)}</div>)}</td><td className="px-3 py-3 text-end">{Number(item.percentage_snapshot).toFixed(2)}%</td><td className="px-3 py-3 text-end">{money(item.entitlement_amount)}</td><td className="px-3 py-3 text-end">{money(item.paid_amount)}</td><td className="px-3 py-3 text-end font-extrabold">{money(item.remaining_amount)}</td><td className="px-3 py-3 text-end">{viewing.status === 'approved' || viewing.status === 'partially_paid' ? <button type="button" className="primary-action min-h-0 px-3 py-2 text-xs" disabled={Number(item.remaining_amount) <= 0} onClick={() => openPayment(item)}><Banknote size={14} /> Pay</button> : '-'}</td></tr>)}</tbody></table></div></Modal>

      <Modal isOpen={paymentOpen} onClose={() => setPaymentOpen(false)} title={`Pay ${paymentDraft.item?.shareholder?.name ?? 'Shareholder'}`} size="lg"><div className="grid gap-4 md:grid-cols-2"><FormField label="Amount" type="number" value={paymentDraft.amount} onChange={(value) => setPaymentDraft({ ...paymentDraft, amount: Number(value) })} required /><FormField label="Payment Date" type="date" value={paymentDraft.payment_date} onChange={(value) => setPaymentDraft({ ...paymentDraft, payment_date: String(value) })} required /><FormField label="Payment Method" type="select" value={paymentDraft.payment_method_id ?? ''} onChange={(value) => setPaymentDraft({ ...paymentDraft, payment_method_id: Number(value), accounting_account_id: undefined })} options={methods.map((method) => ({ value: method.id, label: method.name }))} required /><FormField label="Account" type="select" value={paymentDraft.accounting_account_id ?? ''} onChange={(value) => setPaymentDraft({ ...paymentDraft, accounting_account_id: Number(value) })} options={compatibleAccounts.map((account) => ({ value: account.id, label: `${account.name} - ${money(account.current_balance)}` }))} required /><FormField label="Receipt Number" value={paymentDraft.receipt_number ?? ''} onChange={(value) => setPaymentDraft({ ...paymentDraft, receipt_number: String(value) })} /><div className="md:col-span-2"><FormField label="Notes" type="textarea" value={paymentDraft.notes ?? ''} onChange={(value) => setPaymentDraft({ ...paymentDraft, notes: String(value) })} /></div></div><div className="mt-6 flex justify-end gap-3"><button type="button" className="secondary-action" onClick={() => setPaymentOpen(false)}>Cancel</button><button type="button" className="primary-action" onClick={savePayment}>Send For Review</button></div></Modal>

      <Modal isOpen={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} title="Reject Financial Request" size="sm"><FormField label="Rejection Reason" type="textarea" value={rejectionReason} onChange={(value) => setRejectionReason(String(value))} required /><div className="mt-5 flex justify-end gap-3"><button type="button" className="secondary-action" onClick={() => setRejectTarget(null)}>Cancel</button><button type="button" className="primary-action" onClick={() => rejectTarget && runAction(async () => { if (rejectTarget.kind === 'distribution') await rejectDistribution({ id: rejectTarget.distribution.id, rejection_reason: rejectionReason }).unwrap(); else await rejectTransaction({ id: rejectTarget.transaction.id, rejectionReason: rejectionReason }).unwrap(); setRejectTarget(null); setViewingId(null) }, 'Unable to reject request.')}>Reject</button></div></Modal>
    </div>
  )
}
