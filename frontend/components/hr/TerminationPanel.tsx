'use client'

import { useMemo, useState } from 'react'
import { Banknote, Calculator, CheckCheck, CircleCheck, Eye, Send, Undo2, UserMinus, XCircle } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AsyncIconButton, LoadingButton } from '@/components/ui/AsyncButton'
import { FinanceMetric, FinanceStatus, InlineError, getApiErrorMessage, hasRole, money } from '@/components/finance/FinanceUI'
import { useCalendar } from '@/context/CalendarContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import {
  useApproveEmployeeTerminationMutation,
  useCancelEmployeeTerminationMutation,
  useCreateEmployeeTerminationMutation,
  useGetAccountingAccountsQuery,
  useGetEmployeeTerminationsQuery,
  useGetMeQuery,
  useGetSettingsQuery,
  usePreviewEmployeeTerminationMutation,
  useRejectEmployeeTerminationMutation,
  useReviewEmployeeTerminationMutation,
  type Employee,
  type EmployeeTermination,
  type TerminationPreview,
} from '@/src/store/waternetApi'

type Props = { employees: Employee[] }
type Draft = Record<string, string | number>
type Confirmation = { kind: 'approve' | 'reverse'; item: EmployeeTermination }

const blankDraft = (businessDate: string): Draft => ({ employee_id: '', payment_method_id: '', accounting_account_id: '', last_working_date: businessDate, termination_type: 'resignation', reason: '', severance_amount: 0, other_earnings: 0, other_deductions: 0, notes: '' })

export function TerminationPanel({ employees }: Props) {
  const { businessDate } = useTrainingMode()
  const { formatDate } = useCalendar()
  const { data: rows = [], isLoading, isError } = useGetEmployeeTerminationsQuery()
  const { data: me } = useGetMeQuery()
  const { data: settings } = useGetSettingsQuery()
  const { data: accounts = [] } = useGetAccountingAccountsQuery()
  const [previewTermination, previewState] = usePreviewEmployeeTerminationMutation()
  const [createTermination, createState] = useCreateEmployeeTerminationMutation()
  const [reviewTermination] = useReviewEmployeeTerminationMutation()
  const [approveTermination] = useApproveEmployeeTerminationMutation()
  const [rejectTermination, rejectState] = useRejectEmployeeTerminationMutation()
  const [cancelTermination] = useCancelEmployeeTerminationMutation()
  const [formOpen, setFormOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(blankDraft(businessDate))
  const [preview, setPreview] = useState<TerminationPreview | null>(null)
  const [viewing, setViewing] = useState<EmployeeTermination | null>(null)
  const [rejecting, setRejecting] = useState<EmployeeTermination | null>(null)
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [error, setError] = useState('')

  const isManager = hasRole(me?.roles, ['Manager', 'Admin', 'Super Admin'])
  const isAdmin = hasRole(me?.roles, ['Admin', 'Super Admin'])
  const methods = settings?.payment_methods.filter((item) => item.status === 'active') ?? []
  const selectedMethod = methods.find((item) => item.id === Number(draft.payment_method_id))
  const expectedType = selectedMethod?.code === 'bank_transfer' ? 'bank' : selectedMethod?.code === 'mobile_money' ? 'mobile_money' : selectedMethod?.code === 'check' ? 'check' : selectedMethod?.code === 'online_payment' ? 'online' : 'cash'
  const compatibleAccounts = accounts.filter((item) => item.status === 'active' && item.type === expectedType)
  const availableEmployees = employees.filter((item) => item.status !== 'terminated' && !rows.some((row) => row.employee_id === item.id && !['rejected', 'cancelled'].includes(row.status)))

  const totals = useMemo(() => ({
    pending: rows.filter((item) => ['pending_review', 'pending_approval'].includes(item.status)).length,
    approved: rows.filter((item) => item.status === 'approved').length,
    paid: rows.filter((item) => item.status === 'approved').reduce((sum, item) => sum + Number(item.net_settlement), 0),
  }), [rows])

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    try { await action() } catch (actionError) { setError(getApiErrorMessage(actionError, fallback)) }
  }

  const openForm = () => { setDraft(blankDraft(businessDate)); setPreview(null); setError(''); setFormOpen(true) }
  const calculate = () => runAction(async () => {
    if (!draft.employee_id || !draft.last_working_date || !draft.reason) throw new Error('Employee, last working date, type, and reason are required.')
    setPreview(await previewTermination(draft).unwrap())
  }, 'Unable to calculate final settlement.')
  const save = () => runAction(async () => {
    if (!draft.payment_method_id || !draft.accounting_account_id) throw new Error('Select the settlement payment method and account.')
    await createTermination(draft).unwrap()
    setFormOpen(false)
  }, 'Unable to create final settlement.')

  const workflow = (item: EmployeeTermination) => <div className="flex flex-wrap gap-1.5">
    <button type="button" className="icon-button h-8 w-8" title="View settlement" onClick={() => setViewing(item)}><Eye size={14} /></button>
    {item.status === 'pending_review' && isManager ? <AsyncIconButton className="icon-button h-8 w-8 text-[var(--accent)]" title="Send to admin" onAction={() => reviewTermination(item.id).unwrap()} onError={(actionError) => setError(getApiErrorMessage(actionError, 'Unable to review final settlement.'))}><Send size={14} /></AsyncIconButton> : null}
    {['pending_review', 'pending_approval'].includes(item.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Approve and pay" onClick={() => setConfirmation({ kind: 'approve', item })}><CircleCheck size={14} /></button> : null}
    {['pending_review', 'pending_approval'].includes(item.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Reject" onClick={() => { setError(''); setRejecting(item); setRejectionReason('') }}><XCircle size={14} /></button> : null}
    {item.status === 'approved' && isAdmin ? <button type="button" className="icon-button h-8 w-8" title="Reverse settlement" onClick={() => setConfirmation({ kind: 'reverse', item })}><Undo2 size={14} /></button> : null}
  </div>

  const columns: Column<EmployeeTermination>[] = [
    { key: 'termination_number', label: 'Settlement Number' },
    { key: 'employee', label: 'Employee', render: (item) => <div><p className="font-extrabold text-[var(--text-primary)]">{item.employee?.full_name || `${item.employee?.first_name ?? ''} ${item.employee?.last_name ?? ''}`}</p><p className="text-xs text-[var(--text-muted)]">{item.employee?.employee_number}</p></div> },
    { key: 'last_working_date', label: 'Last Working Date', render: (item) => <DateText value={item.last_working_date} /> },
    { key: 'net_settlement', label: 'Net Settlement', render: (item) => <span className="font-extrabold">{money(item.net_settlement)}</span> },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'workflow', label: 'Workflow', render: workflow },
    { key: 'termination_type', label: 'Exit Type', render: (item) => item.termination_type.replaceAll('_', ' ') },
    { key: 'final_salary', label: 'Final Salary', render: (item) => money(item.final_salary) },
    { key: 'unused_leave_payout', label: 'Leave Payout', render: (item) => money(item.unused_leave_payout) },
    { key: 'advance_recovery', label: 'Advance Recovery', render: (item) => money(item.advance_recovery) },
    { key: 'account', label: 'Payment Account', render: (item) => item.account?.name ?? '-' },
    { key: 'reason', label: 'Reason' },
  ]

  return (
    <div className="space-y-5">
      <InlineError message={error || (isError ? 'Unable to load final settlements.' : '')} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><FinanceMetric label="Final Settlements" value={String(rows.length)} icon={UserMinus} /><FinanceMetric label="Awaiting Approval" value={String(totals.pending)} icon={CheckCheck} tone="text-[var(--gold)]" /><FinanceMetric label="Approved Exits" value={String(totals.approved)} icon={CircleCheck} tone="text-[var(--mint)]" /><FinanceMetric label="Settlement Paid" value={money(totals.paid)} icon={Banknote} /></div>
      <section className="tool-panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 elegant-divider"><div><h2 className="font-extrabold">Employee Final Settlements</h2><p className="text-xs text-[var(--text-muted)]">Approval posts the expense, settles advances, terminates employment, and disables login access</p></div><button type="button" className="primary-action min-h-0 px-3 py-2 text-xs" onClick={openForm}><UserMinus size={15} /> Start Termination</button></div><DataTable columns={columns} data={rows} loading={isLoading} searchKeys={['termination_number', 'last_working_date', 'termination_type', 'status', 'reason']} summaryColumnCount={6} /></section>

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title="Employee Termination & Final Settlement" size="xl">
        <InlineError message={error} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><FormField label="Employee" type="select" value={draft.employee_id} onChange={(value) => { setDraft({ ...draft, employee_id: Number(value) }); setPreview(null) }} options={availableEmployees.map((item) => ({ value: item.id, label: `${item.employee_number} · ${item.full_name}` }))} required /><FormField label="Last Working Date" type="date" value={draft.last_working_date} onChange={(value) => { setDraft({ ...draft, last_working_date: String(value) }); setPreview(null) }} required /><FormField label="Exit Type" type="select" value={draft.termination_type} onChange={(value) => setDraft({ ...draft, termination_type: String(value) })} options={[{ value: 'resignation', label: 'Resignation' }, { value: 'termination', label: 'Termination' }, { value: 'end_of_contract', label: 'End Of Contract' }, { value: 'retirement', label: 'Retirement' }, { value: 'other', label: 'Other' }]} required /><FormField label="Severance Amount" type="number" min={0} value={draft.severance_amount} onChange={(value) => { setDraft({ ...draft, severance_amount: Number(value) }); setPreview(null) }} /><FormField label="Other Earnings" type="number" min={0} value={draft.other_earnings} onChange={(value) => { setDraft({ ...draft, other_earnings: Number(value) }); setPreview(null) }} /><FormField label="Other Deductions" type="number" min={0} value={draft.other_deductions} onChange={(value) => { setDraft({ ...draft, other_deductions: Number(value) }); setPreview(null) }} /><FormField label="Payment Method" type="select" value={draft.payment_method_id} onChange={(value) => setDraft({ ...draft, payment_method_id: Number(value), accounting_account_id: '' })} options={methods.map((item) => ({ value: item.id, label: item.name }))} required /><FormField label="Payment Account" type="select" value={draft.accounting_account_id} onChange={(value) => setDraft({ ...draft, accounting_account_id: Number(value) })} options={compatibleAccounts.map((item) => ({ value: item.id, label: `${item.name} · ${money(item.current_balance)}` }))} required /></div><div className="mt-3 grid gap-3 md:grid-cols-2"><FormField label="Reason" type="textarea" value={draft.reason} onChange={(value) => setDraft({ ...draft, reason: String(value) })} required /><FormField label="Notes" type="textarea" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: String(value) })} /></div>
        {preview ? <SettlementBreakdown preview={preview} /> : <div className="mt-5 rounded-lg border border-dashed border-[var(--border-strong)] p-5 text-center text-sm text-[var(--text-muted)]">Calculate the settlement to review salary, unused leave, and deductions before submission.</div>}
        <div className="mt-5 flex flex-wrap justify-end gap-3"><button className="secondary-action" onClick={() => setFormOpen(false)}>Cancel</button><LoadingButton className="secondary-action" loading={previewState.isLoading} loadingLabel="Calculating..." onClick={calculate}><Calculator size={17} /> Calculate Settlement</LoadingButton><LoadingButton className="primary-action" disabled={!preview} loading={createState.isLoading} loadingLabel="Sending..." onClick={save}><Send size={17} /> Send For Review</LoadingButton></div>
      </Modal>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.termination_number ?? 'Final Settlement'} size="lg">{viewing ? <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2"><Detail label="Employee" value={viewing.employee?.full_name || `${viewing.employee?.first_name ?? ''} ${viewing.employee?.last_name ?? ''}`} /><Detail label="Last Working Date" value={formatDate(viewing.last_working_date)} /><Detail label="Exit Type" value={viewing.termination_type.replaceAll('_', ' ')} /><Detail label="Payment Account" value={viewing.account?.name ?? '-'} /></div><SettlementBreakdown preview={viewing} /><div className="rounded-lg border border-[var(--border-subtle)] p-4"><p className="text-xs font-extrabold uppercase text-[var(--text-muted)]">Reason</p><p className="mt-2 text-sm">{viewing.reason}</p></div>{viewing.status === 'cancelled' ? <p className="text-xs font-bold text-[var(--gold)]">Employment was restored, but login access remains disabled until an admin explicitly re-enables it.</p> : null}</div> : null}</Modal>

      <Modal isOpen={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject Final Settlement" size="sm"><InlineError message={rejecting ? error : ''} /><FormField label="Rejection Reason" type="textarea" value={rejectionReason} onChange={(value) => setRejectionReason(String(value))} required /><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setRejecting(null)}>Cancel</button><LoadingButton className="primary-action" loading={rejectState.isLoading} loadingLabel="Rejecting..." onClick={() => rejecting && void runAction(async () => { await rejectTermination({ id: rejecting.id, rejection_reason: rejectionReason }).unwrap(); setRejecting(null) }, 'Unable to reject final settlement.')}>Reject Settlement</LoadingButton></div></Modal>

      <ConfirmDialog
        isOpen={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
        onConfirm={async () => {
          if (!confirmation) return
          if (confirmation.kind === 'approve') await approveTermination(confirmation.item.id).unwrap()
          else await cancelTermination(confirmation.item.id).unwrap()
        }}
        kind={confirmation?.kind === 'approve' ? 'approval' : 'danger'}
        title={confirmation?.kind === 'approve' ? 'Approve Final Settlement' : 'Reverse Final Settlement'}
        message={confirmation?.kind === 'approve'
          ? `Approve and pay ${money(confirmation.item.net_settlement)} for ${confirmation.item.employee?.full_name ?? 'this employee'}? This posts the expense and terminates employment.`
          : `Reverse ${confirmation?.item.termination_number ?? 'this settlement'}? Employment will be restored, but login access must be re-enabled separately.`}
        confirmLabel={confirmation?.kind === 'approve' ? 'Approve and Pay' : 'Reverse Settlement'}
        loadingLabel={confirmation?.kind === 'approve' ? 'Approving...' : 'Reversing...'}
      />
    </div>
  )
}

function SettlementBreakdown({ preview }: { preview: { final_salary: string | number; unused_leave_payout: string | number; severance_amount: string | number; other_earnings: string | number; advance_recovery: string | number; other_deductions: string | number; net_settlement: string | number } }) {
  return <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Detail label="Final Salary" value={money(preview.final_salary)} /><Detail label="Unused Leave Payout" value={money(preview.unused_leave_payout)} /><Detail label="Severance & Earnings" value={money(Number(preview.severance_amount) + Number(preview.other_earnings))} /><Detail label="Advance & Deductions" value={money(Number(preview.advance_recovery) + Number(preview.other_deductions))} /><div className="rounded-lg border border-[var(--accent)] bg-[var(--accent-soft)] p-3 sm:col-span-2 lg:col-span-4"><p className="text-xs font-extrabold uppercase text-[var(--accent)]">Net Final Settlement</p><p className="mt-1 text-xl font-extrabold text-[var(--text-primary)]">{money(preview.net_settlement)}</p></div></div>
}

function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3"><p className="text-xs font-bold text-[var(--text-muted)]">{label}</p><p className="mt-1 font-extrabold text-[var(--text-primary)]">{value}</p></div> }
