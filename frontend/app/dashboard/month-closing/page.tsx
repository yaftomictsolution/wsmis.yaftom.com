'use client'

import Link from 'next/link'
import { useState } from 'react'
import { CheckCheck, CircleCheck, Eye, FileLock2, LockKeyhole, PieChart, Plus, RefreshCw, RotateCcw, Send, Trash2, XCircle } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DateText } from '@/components/ui/DateText'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { FinanceMetric, FinanceStatus, InlineError, dateValue, getApiErrorMessage, hasRole, money, monthBounds } from '@/components/finance/FinanceUI'
import { latestCompletedMonthFor, useTrainingMode } from '@/context/TrainingModeContext'
import {
  useCloseFinancialClosingMutation,
  useCreateFinancialClosingMutation,
  useDeleteFinancialClosingMutation,
  useGetFinancialClosingsQuery,
  useGetMeQuery,
  useRefreshFinancialClosingMutation,
  useRejectFinancialClosingMutation,
  useReopenFinancialClosingMutation,
  useReviewFinancialClosingMutation,
  useSubmitFinancialClosingMutation,
  type FinancialPeriodClosing,
} from '@/src/store/waternetApi'

export default function MonthClosingPage() {
  const { businessDate } = useTrainingMode()
  const completedMonth = latestCompletedMonthFor(businessDate)
  const { data: closings = [], isLoading, isError } = useGetFinancialClosingsQuery()
  const { data: me } = useGetMeQuery()
  const [createClosing] = useCreateFinancialClosingMutation()
  const [deleteClosing] = useDeleteFinancialClosingMutation()
  const [refreshClosing] = useRefreshFinancialClosingMutation()
  const [submitClosing] = useSubmitFinancialClosingMutation()
  const [reviewClosing] = useReviewFinancialClosingMutation()
  const [closeClosing] = useCloseFinancialClosingMutation()
  const [rejectClosing] = useRejectFinancialClosingMutation()
  const [reopenClosing] = useReopenFinancialClosingMutation()
  const [createOpen, setCreateOpen] = useState(false)
  const [month, setMonth] = useState(completedMonth)
  const [notes, setNotes] = useState('')
  const [viewing, setViewing] = useState<FinancialPeriodClosing | null>(null)
  const [reasonTarget, setReasonTarget] = useState<{ kind: 'reject' | 'reopen'; closing: FinancialPeriodClosing } | null>(null)
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  const isManager = hasRole(me?.roles, ['Manager', 'Admin', 'Super Admin'])
  const isAdmin = hasRole(me?.roles, ['Admin', 'Super Admin'])
  const closed = closings.filter((item) => item.status === 'closed')
  const latest = closings[0]
  const readyCount = closings.filter((item) => item.reconciliation_complete).length

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    try { await action() } catch (actionError) { setError(getApiErrorMessage(actionError, fallback)) }
  }

  const create = async () => {
    const bounds = monthBounds(month)
    await runAction(async () => {
      await createClosing({ ...bounds, notes }).unwrap()
      setCreateOpen(false)
    }, 'Unable to prepare monthly closing.')
  }

  const workflow = (closing: FinancialPeriodClosing) => <div className="flex flex-wrap gap-1.5">
    {['draft', 'rejected'].includes(closing.status) ? <button type="button" className="icon-button h-8 w-8" title="Refresh figures" onClick={() => runAction(() => refreshClosing(closing.id).unwrap(), 'Unable to refresh closing.')}><RefreshCw size={14} /></button> : null}
    {['draft', 'rejected'].includes(closing.status) && closing.readiness?.period_ended !== false ? <button type="button" className="icon-button h-8 w-8" title="Submit" onClick={() => runAction(() => submitClosing(closing.id).unwrap(), 'Unable to submit closing.')}><Send size={14} /></button> : null}
    {['draft', 'rejected'].includes(closing.status) ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete" onClick={() => runAction(() => deleteClosing(closing.id).unwrap(), 'Unable to delete closing draft.')}><Trash2 size={14} /></button> : null}
    {closing.status === 'pending_review' && isManager ? <button type="button" className="icon-button h-8 w-8" title="Review" onClick={() => runAction(() => reviewClosing(closing.id).unwrap(), 'Unable to review closing.')}><CheckCheck size={14} /></button> : null}
    {['pending_review', 'pending_approval'].includes(closing.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Close month" onClick={() => runAction(() => closeClosing(closing.id).unwrap(), 'Unable to close month.')}><LockKeyhole size={14} /></button> : null}
    {['pending_review', 'pending_approval'].includes(closing.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Reject" onClick={() => { setReasonTarget({ kind: 'reject', closing }); setReason('') }}><XCircle size={14} /></button> : null}
    {closing.status === 'closed' && isAdmin && !closing.distribution ? <button type="button" className="icon-button h-8 w-8" title="Reopen period" onClick={() => { setReasonTarget({ kind: 'reopen', closing }); setReason('') }}><RotateCcw size={14} /></button> : null}
    <button type="button" className="icon-button h-8 w-8" title="View snapshot" onClick={() => setViewing(closing)}><Eye size={14} /></button>
  </div>

  const columns: Column<FinancialPeriodClosing>[] = [
    { key: 'period_code', label: 'Period' },
    { key: 'total_income', label: 'Income', render: (item) => <span className="font-extrabold text-[var(--mint)]">{money(item.total_income)}</span> },
    { key: 'total_expense', label: 'Expenses', render: (item) => <span className="font-extrabold text-[var(--coral)]">{money(item.total_expense)}</span> },
    { key: 'net_income', label: 'Net Income', render: (item) => <span className="font-extrabold">{money(item.net_income)}</span> },
    {
      key: 'reconciliation_complete',
      label: 'Reconciled',
      render: (item) => {
        if (item.readiness?.period_ended === false) return <span className="font-extrabold text-[var(--gold)]">Month still open</span>
        if (item.reconciliation_complete) return <span className="font-extrabold text-[var(--mint)]">Complete</span>

        return <Link href={`/dashboard/reconciliation?month=${item.period_code}&create=1`} className="font-extrabold text-[var(--coral)] underline underline-offset-4">Resolve required accounts</Link>
      },
    },
    { key: 'distributable_profit', label: 'Distributable Profit', render: (item) => money(item.distributable_profit) },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'workflow', label: 'Workflow', render: workflow },
    { key: 'period_start', label: 'Start Date', render: (item) => <DateText value={item.period_start} /> },
    { key: 'period_end', label: 'End Date', render: (item) => <DateText value={item.period_end} /> },
    { key: 'payroll_expense', label: 'Payroll Expense', render: (item) => money(item.payroll_expense) },
    { key: 'receivables', label: 'Receivables', render: (item) => money(item.receivables) },
    { key: 'cash_balance', label: 'Cash Balance', render: (item) => money(item.cash_balance) },
    { key: 'bank_balance', label: 'Bank Balance', render: (item) => money(item.bank_balance) },
    { key: 'preparer', label: 'Prepared By', render: (item) => item.preparer?.name ?? '-' },
    { key: 'closer', label: 'Closed By', render: (item) => item.closer?.name ?? '-' },
    { key: 'notes', label: 'Notes', render: (item) => item.notes || '-' },
  ]

  const snapshot = [
    ['Total Income', viewing?.total_income], ['Total Expenses', viewing?.total_expense], ['Payroll Expense', viewing?.payroll_expense], ['Net Income', viewing?.net_income], ['Receivables', viewing?.receivables], ['Cash Balance', viewing?.cash_balance], ['Bank Balance', viewing?.bank_balance], ['Distributable Profit', viewing?.distributable_profit],
  ] as const
  const viewingAccounts = viewing?.readiness?.reconciliation.accounts ?? []

  return (
    <div className="mx-auto max-w-[1680px] p-6 lg:p-8">
      <PageHeader title="Monthly Closing" subtitle="Freeze a reconciled month, preserve its financial snapshot, and release approved profit for allocation"><Link href="/dashboard/shareholders" className="secondary-action text-sm"><PieChart size={18} /> Profit Distribution</Link><button type="button" className="primary-action text-sm" onClick={() => setCreateOpen(true)}><Plus size={18} /> Prepare Month</button></PageHeader>
      <InlineError message={error || (isError ? 'Unable to load financial closings.' : '')} />
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><FinanceMetric label="Closed Months" value={String(closed.length)} icon={FileLock2} /><FinanceMetric label="Reconciled Records" value={String(readyCount)} icon={CheckCheck} tone="text-[var(--mint)]" /><FinanceMetric label="Latest Net Income" value={money(latest?.net_income)} icon={CircleCheck} /><FinanceMetric label="Latest Distributable Profit" value={money(latest?.distributable_profit)} icon={PieChart} tone="text-[var(--gold)]" /></div>
      <DataTable columns={columns} data={closings} loading={isLoading && closings.length === 0} searchKeys={['period_code', 'status']} summaryColumnCount={8} />

      <Modal isOpen={createOpen} onClose={() => setCreateOpen(false)} title="Prepare Monthly Closing" size="md"><div className="space-y-4"><div className="space-y-1.5"><label className="block text-sm font-bold text-[var(--text-secondary)]">Financial Month <span className="text-red-500">*</span></label><input type="month" max={completedMonth} className="field-control px-4 py-2.5 text-sm" value={month} onChange={(event) => setMonth(event.target.value)} /></div><FormField label="Notes" type="textarea" value={notes} onChange={(value) => setNotes(String(value))} /></div><div className="mt-6 flex justify-end gap-3"><button type="button" className="secondary-action" onClick={() => setCreateOpen(false)}>Cancel</button><button type="button" className="primary-action" onClick={create}>Prepare Snapshot</button></div></Modal>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title={`Closing Snapshot - ${viewing?.period_code ?? ''}`} size="lg">
        <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">{snapshot.map(([label, value]) => <div key={label} className="border-b pb-3 elegant-divider"><p className="text-xs font-bold text-[var(--text-muted)]">{label}</p><p className="mt-1 font-extrabold">{money(value)}</p></div>)}</div>
        {viewing?.readiness ? (
          <div className="mt-6 border-t pt-5 elegant-divider">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div><p className="font-extrabold text-[var(--text-primary)]">Closing Readiness</p><p className="text-xs font-bold text-[var(--text-muted)]">{viewing.readiness.reconciliation.approved_count} of {viewing.readiness.reconciliation.required_count} accounts approved</p></div>
              <span className={`font-extrabold ${viewing.readiness.can_close ? 'text-[var(--mint)]' : 'text-[var(--coral)]'}`}>{viewing.readiness.can_close ? 'Ready to close' : viewing.readiness.period_ended ? 'Action required' : `Available ${viewing.readiness.available_after}`}</span>
            </div>
            <div className="divide-y elegant-divider">
              {viewingAccounts.map((account) => (
                <div key={account.account_id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><p className="font-bold text-[var(--text-primary)]">{account.name}</p><p className="text-xs text-[var(--text-muted)]">{account.code} - Book balance {money(account.book_balance)}</p></div>
                  <div className="flex items-center gap-3"><FinanceStatus value={account.status} />{account.status !== 'approved' && viewing.readiness?.period_ended ? <Link href={`/dashboard/reconciliation?month=${viewing.period_code}&account_id=${account.account_id}&create=1`} className="text-sm font-extrabold text-[var(--accent)] underline underline-offset-4">Resolve</Link> : null}</div>
                </div>
              ))}
              {viewingAccounts.length === 0 ? <p className="py-3 text-sm font-bold text-[var(--mint)]">No account reconciliation is required.</p> : null}
            </div>
          </div>
        ) : null}
        {viewing?.distribution ? <div className="mt-5 flex items-center justify-between border-t pt-4 elegant-divider"><div><p className="text-xs font-bold text-[var(--text-muted)]">Profit Distribution</p><p className="font-extrabold">{viewing.distribution.distribution_number}</p></div><FinanceStatus value={viewing.distribution.status} /></div> : null}
      </Modal>

      <Modal isOpen={Boolean(reasonTarget)} onClose={() => setReasonTarget(null)} title={reasonTarget?.kind === 'reopen' ? 'Reopen Financial Period' : 'Reject Financial Closing'} size="sm"><FormField label={reasonTarget?.kind === 'reopen' ? 'Reopen Reason' : 'Rejection Reason'} type="textarea" value={reason} onChange={(value) => setReason(String(value))} required /><div className="mt-5 flex justify-end gap-3"><button type="button" className="secondary-action" onClick={() => setReasonTarget(null)}>Cancel</button><button type="button" className="primary-action" onClick={() => reasonTarget && runAction(async () => { if (reasonTarget.kind === 'reopen') await reopenClosing({ id: reasonTarget.closing.id, reopen_reason: reason }).unwrap(); else await rejectClosing({ id: reasonTarget.closing.id, rejection_reason: reason }).unwrap(); setReasonTarget(null) }, 'Unable to process financial closing.')}>{reasonTarget?.kind === 'reopen' ? 'Reopen Period' : 'Reject'}</button></div></Modal>
    </div>
  )
}
