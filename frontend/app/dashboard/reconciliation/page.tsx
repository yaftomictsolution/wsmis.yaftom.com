'use client'
import { useEffect, useMemo, useState } from 'react'
import { CheckCheck, CircleCheck, Eye, Landmark, ListChecks, Pencil, Plus, Send, Trash2, X, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { FinanceMetric, FinanceStatus, InlineError, dateValue, getApiErrorMessage, hasRole, money, monthBounds } from '@/components/finance/FinanceUI'
import { latestCompletedMonthFor, useTrainingMode } from '@/context/TrainingModeContext'
import {
  useApproveAccountReconciliationMutation,
  useCreateAccountReconciliationMutation,
  useDeleteAccountReconciliationMutation,
  useGetAccountReconciliationsQuery,
  useGetAccountingAccountsQuery,
  useGetFinancialReportQuery,
  useGetMeQuery,
  useRejectAccountReconciliationMutation,
  useReviewAccountReconciliationMutation,
  useSubmitAccountReconciliationMutation,
  useUpdateAccountReconciliationMutation,
  type AccountReconciliation,
  type AccountReconciliationItem,
} from '@/src/store/waternetApi'

type Draft = { id?: number; accounting_account_id?: number; period_start: string; period_end: string; statement_balance: number; notes?: string; items: AccountReconciliationItem[] }
const blankAdjustment = (): AccountReconciliationItem => ({ kind: 'outstanding_item', direction: 'add', description: '', amount: 0, cleared: false })
const blankDraft = (month: string): Draft => ({ ...monthBounds(month), statement_balance: 0, items: [] })

export default function ReconciliationPage() {
  const { businessDate } = useTrainingMode()
  const completedMonth = latestCompletedMonthFor(businessDate)
  const { data: reconciliations = [], isLoading, isError } = useGetAccountReconciliationsQuery()
  const { data: accounts = [] } = useGetAccountingAccountsQuery()
  const { data: me } = useGetMeQuery()
  const [createReconciliation] = useCreateAccountReconciliationMutation()
  const [updateReconciliation] = useUpdateAccountReconciliationMutation()
  const [deleteReconciliation] = useDeleteAccountReconciliationMutation()
  const [submitReconciliation] = useSubmitAccountReconciliationMutation()
  const [reviewReconciliation] = useReviewAccountReconciliationMutation()
  const [approveReconciliation] = useApproveAccountReconciliationMutation()
  const [rejectReconciliation] = useRejectAccountReconciliationMutation()
  const [draft, setDraft] = useState<Draft>(blankDraft(completedMonth))
  const [formOpen, setFormOpen] = useState(false)
  const [viewing, setViewing] = useState<AccountReconciliation | null>(null)
  const [rejecting, setRejecting] = useState<AccountReconciliation | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState('')
  const canEstimateBookBalance = formOpen
    && Boolean(draft.accounting_account_id && draft.period_start && draft.period_end)
    && draft.period_start <= draft.period_end
  const { currentData: historicalReport, isFetching: isBookBalanceLoading } = useGetFinancialReportQuery({
    from: draft.period_start,
    to: draft.period_end,
    account_id: draft.accounting_account_id,
  }, { skip: !canEstimateBookBalance })

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const requestedMonth = params.get('month')
    if (!requestedMonth?.match(/^\d{4}-\d{2}$/)) return

    const accountId = Number(params.get('account_id')) || undefined
    const frame = window.requestAnimationFrame(() => {
      setDraft({ ...blankDraft(requestedMonth), accounting_account_id: accountId })
      if (params.get('create') === '1') setFormOpen(true)
    })

    return () => window.cancelAnimationFrame(frame)
  }, [])

  const isManager = hasRole(me?.roles, ['Manager', 'Admin', 'Super Admin'])
  const isAdmin = hasRole(me?.roles, ['Admin', 'Super Admin'])
  const activeAccounts = accounts.filter((account) => account.status === 'active' && ['cash', 'bank', 'mobile_money', 'check', 'online'].includes(account.type))
  const historicalAccount = historicalReport?.accounts.find((account) => account.id === draft.accounting_account_id)
  const estimatedBookBalance = Number(historicalAccount?.closing_balance ?? 0)
  const hasBookEstimate = canEstimateBookBalance && Boolean(historicalReport)
  const adjustmentTotal = useMemo(() => draft.items.reduce((sum, item) => sum + (item.direction === 'add' ? 1 : -1) * Number(item.amount), 0), [draft.items])
  const adjustedStatement = Number(draft.statement_balance) + adjustmentTotal
  const estimatedDifference = hasBookEstimate ? estimatedBookBalance - adjustedStatement : null
  const approvedCount = reconciliations.filter((item) => item.status === 'approved').length
  const unresolvedDifference = reconciliations.filter((item) => Math.abs(Number(item.difference)) > 0.01).reduce((sum, item) => sum + Math.abs(Number(item.difference)), 0)

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    try { await action() } catch (actionError) { setError(getApiErrorMessage(actionError, fallback)) }
  }

  const setAdjustment = (index: number, changes: Partial<AccountReconciliationItem>) => setDraft((current) => ({ ...current, items: current.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...changes } : item) }))

  const openEdit = (item: AccountReconciliation) => {
    setDraft({ id: item.id, accounting_account_id: item.accounting_account_id, period_start: dateValue(item.period_start), period_end: dateValue(item.period_end), statement_balance: Number(item.statement_balance), notes: item.notes, items: item.items.map((adjustment) => ({ ...adjustment })) })
    setFormOpen(true)
  }

  const save = async () => {
    if (!draft.accounting_account_id) { setError('Select an account to reconcile.'); return }
    if (draft.items.some((item) => !item.description || Number(item.amount) <= 0)) { setError('Complete each reconciliation adjustment.'); return }
    const body = { accounting_account_id: draft.accounting_account_id, period_start: draft.period_start, period_end: draft.period_end, statement_balance: Number(draft.statement_balance), notes: draft.notes, items: draft.items.map((item) => ({ kind: item.kind, direction: item.direction, description: item.description, reference: item.reference, amount: Number(item.amount), cleared: Boolean(item.cleared) })) }
    await runAction(async () => {
      if (draft.id) await updateReconciliation({ id: draft.id, body }).unwrap()
      else await createReconciliation(body).unwrap()
      setFormOpen(false)
    }, 'Unable to save reconciliation.')
  }

  const actions = (item: AccountReconciliation) => <div className="flex flex-wrap gap-1.5">
    {['draft', 'rejected'].includes(item.status) ? <button type="button" className="icon-button h-8 w-8" title="Edit" onClick={() => openEdit(item)}><Pencil size={14} /></button> : null}
    {['draft', 'rejected'].includes(item.status) ? <button type="button" className="icon-button h-8 w-8" title="Submit" onClick={() => runAction(() => submitReconciliation(item.id).unwrap(), 'Unable to submit reconciliation.')}><Send size={14} /></button> : null}
    {item.status === 'pending_review' && isManager ? <button type="button" className="icon-button h-8 w-8" title="Review" onClick={() => runAction(() => reviewReconciliation(item.id).unwrap(), 'Unable to review reconciliation.')}><CheckCheck size={14} /></button> : null}
    {['pending_review', 'pending_approval'].includes(item.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Approve" onClick={() => runAction(() => approveReconciliation(item.id).unwrap(), 'Unable to approve reconciliation.')}><CircleCheck size={14} /></button> : null}
    {['pending_review', 'pending_approval'].includes(item.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Reject" onClick={() => { setRejecting(item); setRejectionReason('') }}><XCircle size={14} /></button> : null}
    {['draft', 'rejected'].includes(item.status) ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete" onClick={() => runAction(() => deleteReconciliation(item.id).unwrap(), 'Unable to delete reconciliation.')}><Trash2 size={14} /></button> : null}
    <button type="button" className="icon-button h-8 w-8" title="View details" onClick={() => setViewing(item)}><Eye size={14} /></button>
  </div>

  const columns: Column<AccountReconciliation>[] = [
    
    { key: 'reconciliation_number', label: 'Reconciliation' },
    { key: 'account', label: 'Account', render: (item) => item.account?.name ?? '-' },
    { key: 'period_end', label: 'Period End', render: (item) => <DateText value={item.period_end} /> },
    { key: 'book_balance', label: 'Book Balance', render: (item) => money(item.book_balance) },
    { key: 'statement_balance', label: 'Statement Balance', render: (item) => money(item.statement_balance) },
    { key: 'difference', label: 'Difference', render: (item) => <span className={`font-extrabold ${Math.abs(Number(item.difference)) <= 0.01 ? 'text-[var(--mint)]' : 'text-[var(--coral)]'}`}>{money(item.difference)}</span> },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'workflow', label: 'Workflow', render: actions },
    { key: 'period_start', label: 'Period Start', render: (item) => <DateText value={item.period_start} /> },
    { key: 'adjusted_statement_balance', label: 'Adjusted Statement', render: (item) => money(item.adjusted_statement_balance) },
    { key: 'items', label: 'Adjustments', render: (item) => item.items.length },
    { key: 'creator', label: 'Prepared By', render: (item) => item.creator?.name ?? '-' },
    { key: 'reviewer', label: 'Reviewed By', render: (item) => item.reviewer?.name ?? '-' },
    { key: 'approver', label: 'Approved By', render: (item) => item.approver?.name ?? '-' },
    { key: 'notes', label: 'Notes', render: (item) => item.notes || '-' },
  ]

  return (
    <div className="mx-auto max-w-[1680px] p-6 lg:p-8">
      <PageHeader title="Cash & Bank Reconciliation" subtitle="Match system book balances with cash counts and external account statements before monthly closing"><button type="button" className="primary-action text-sm" onClick={() => { setDraft(blankDraft(completedMonth)); setFormOpen(true) }}><Plus size={18} /> New Reconciliation</button></PageHeader>
      <InlineError message={error || (isError ? 'Unable to load reconciliations.' : '')} />
      <div className="mb-5 grid gap-3 md:grid-cols-3"><FinanceMetric label="Reconciliations" value={String(reconciliations.length)} icon={Landmark} /><FinanceMetric label="Approved" value={String(approvedCount)} icon={ListChecks} tone="text-[var(--mint)]" /><FinanceMetric label="Unresolved Difference" value={money(unresolvedDifference)} icon={XCircle} tone={unresolvedDifference <= 0.01 ? 'text-[var(--mint)]' : 'text-[var(--coral)]'} /></div>
      <DataTable columns={columns} data={reconciliations} loading={isLoading && reconciliations.length === 0} searchKeys={['reconciliation_number', 'status']} summaryColumnCount={8} />
  
      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={draft.id ? 'Edit Reconciliation' : 'New Reconciliation'} size="xl">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><FormField label="Account" type="select" value={draft.accounting_account_id ?? ''} onChange={(value) => setDraft((current) => ({ ...current, accounting_account_id: Number(value), statement_balance: 0 }))} options={activeAccounts.map((account) => ({ value: account.id, label: `${account.name} - ${money(account.current_balance)}` }))} required /><FormField label="Period Start" type="date" value={draft.period_start} onChange={(value) => setDraft({ ...draft, period_start: String(value) })} required /><FormField label="Period End" type="date" value={draft.period_end} onChange={(value) => setDraft({ ...draft, period_end: String(value) })} required /><FormField label="Statement / Cash Count" type="number" value={draft.statement_balance} onChange={(value) => setDraft({ ...draft, statement_balance: Number(value) })} required /></div>
        <div className="my-5 grid gap-3 border-y py-4 elegant-divider md:grid-cols-3"><div><p className="text-xs font-bold text-[var(--text-muted)]">Book Balance at Period End</p><p className="mt-1 font-extrabold">{isBookBalanceLoading && !historicalReport ? 'Calculating...' : hasBookEstimate ? money(estimatedBookBalance) : '-'}</p></div><div><p className="text-xs font-bold text-[var(--text-muted)]">Adjusted Statement</p><p className="mt-1 font-extrabold">{money(adjustedStatement)}</p></div><div><p className="text-xs font-bold text-[var(--text-muted)]">Estimated Difference</p><p className={`mt-1 font-extrabold ${estimatedDifference === null ? 'text-[var(--text-muted)]' : Math.abs(estimatedDifference) <= 0.01 ? 'text-[var(--mint)]' : 'text-[var(--coral)]'}`}>{estimatedDifference === null ? '-' : money(estimatedDifference)}</p></div></div>
        <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-extrabold">Statement Adjustments</p><p className="text-xs font-bold text-[var(--text-muted)]">Examples: outstanding deposit, outstanding check, statement error</p></div><button type="button" className="secondary-action min-h-0 px-3 py-2 text-xs" onClick={() => setDraft({ ...draft, items: [...draft.items, blankAdjustment()] })}><Plus size={14} /> Add Adjustment</button></div>
        <div className="space-y-3">{draft.items.map((item, index) => <div key={index} className="grid gap-3 border-b pb-3 elegant-divider md:grid-cols-2 xl:grid-cols-[1fr_1fr_1.5fr_1fr_auto]"><FormField label="Type" value={item.kind} onChange={(value) => setAdjustment(index, { kind: String(value) })} /><FormField label="Direction" type="select" value={item.direction} onChange={(value) => setAdjustment(index, { direction: value as 'add' | 'subtract' })} options={[{ value: 'add', label: 'Add To Statement' }, { value: 'subtract', label: 'Subtract From Statement' }]} /><FormField label="Description" value={item.description} onChange={(value) => setAdjustment(index, { description: String(value) })} required /><FormField label="Amount" type="number" value={item.amount} onChange={(value) => setAdjustment(index, { amount: Number(value) })} required /><button type="button" className="icon-button mt-7 text-[var(--coral)]" title="Remove adjustment" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, itemIndex) => itemIndex !== index) })}><X size={14} /></button></div>)}</div>
        <div className="mt-4"><FormField label="Notes" type="textarea" value={draft.notes ?? ''} onChange={(value) => setDraft({ ...draft, notes: String(value) })} /></div><div className="mt-6 flex justify-end gap-3"><button type="button" className="secondary-action" onClick={() => setFormOpen(false)}>Cancel</button><button type="button" className="primary-action" onClick={save}>Save Draft</button></div>
      </Modal>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.reconciliation_number ?? 'Reconciliation'} size="lg"><div className="grid grid-cols-2 gap-4 border-b pb-4 elegant-divider"><div><p className="text-xs font-bold text-[var(--text-muted)]">Book Balance</p><p className="font-extrabold">{money(viewing?.book_balance)}</p></div><div><p className="text-xs font-bold text-[var(--text-muted)]">Adjusted Statement</p><p className="font-extrabold">{money(viewing?.adjusted_statement_balance)}</p></div></div><div className="mt-4 space-y-3">{viewing?.items.map((item) => <div key={item.id ?? item.description} className="flex items-center justify-between gap-4 border-b pb-3 elegant-divider"><div><p className="font-bold">{item.description}</p><p className="text-xs text-[var(--text-muted)]">{item.kind} · {item.direction}</p></div><p className="font-extrabold">{money(item.amount)}</p></div>)}{viewing?.items.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No statement adjustments.</p> : null}</div></Modal>
      <Modal isOpen={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject Reconciliation" size="sm"><FormField label="Rejection Reason" type="textarea" value={rejectionReason} onChange={(value) => setRejectionReason(String(value))} required /><div className="mt-5 flex justify-end gap-3"><button type="button" className="secondary-action" onClick={() => setRejecting(null)}>Cancel</button><button type="button" className="primary-action" onClick={() => rejecting && runAction(async () => { await rejectReconciliation({ id: rejecting.id, rejection_reason: rejectionReason }).unwrap(); setRejecting(null) }, 'Unable to reject reconciliation.')}>Reject</button></div></Modal>
    </div>
  )
}
