'use client'

import { useMemo, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Banknote, Calculator, Check, CheckCheck, CircleCheck, Eye, FileBarChart, FileText, Printer, RefreshCw, Send,
  Search, Trash2, Undo2, UserCheck, Users, XCircle,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AsyncIconButton, LoadingButton } from '@/components/ui/AsyncButton'
import { FinanceMetric, FinanceStatus, InlineError, getApiErrorMessage, hasRole, money } from '@/components/finance/FinanceUI'
import { PayrollReportPanel } from '@/components/hr/PayrollReportPanel'
import { PeoplePayrollFlow } from '@/components/hr/PeoplePayrollFlow'
import { useCalendar } from '@/context/CalendarContext'
import { useLanguage } from '@/context/LanguageContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import {
  useApprovePayrollRunMutation,
  useCancelPayrollRunMutation,
  useDeletePayrollRunMutation,
  useGeneratePayrollRunMutation,
  useGetAccountingAccountsQuery,
  useGetMeQuery,
  useGetPayrollEligibleEmployeesQuery,
  useGetPayrollRunsQuery,
  useGetSettingsQuery,
  useRecalculatePayrollRunMutation,
  useRejectPayrollRunMutation,
  useReviewPayrollRunMutation,
  useSubmitPayrollRunMutation,
  type AccountingAccount,
  type PayrollItem,
  type PayrollRun,
} from '@/src/store/waternetApi'

type PayrollScope = 'all' | 'selected'
type PayrollDraft = {
  title: string
  period_start: string
  period_end: string
  payment_date: string
  payment_method_id: number
  accounting_account_id: number
  notes: string
  employee_scope: PayrollScope
  employee_ids: number[]
}

const blankDraft = (businessDate: string): PayrollDraft => ({
  title: `Monthly Payroll - ${businessDate.slice(0, 7)}`,
  period_start: `${businessDate.slice(0, 7)}-01`, period_end: businessDate, payment_date: businessDate,
  payment_method_id: 0, accounting_account_id: 0, notes: '',
  employee_scope: 'all', employee_ids: [],
})

export default function PayrollPage() {
  const { direction, translate } = useLanguage()
  const { formatDate: dateValue } = useCalendar()
  const { businessDate } = useTrainingMode()
  const { data: payroll = [], isLoading, isError } = useGetPayrollRunsQuery()
  const { data: settings } = useGetSettingsQuery()
  const {
    data: accounts = [],
    isFetching: accountsFetching,
    refetch: refetchAccounts,
  } = useGetAccountingAccountsQuery()
  const { data: me } = useGetMeQuery()
  const [generatePayroll, generateState] = useGeneratePayrollRunMutation()
  const [recalculatePayroll] = useRecalculatePayrollRunMutation()
  const [deletePayroll] = useDeletePayrollRunMutation()
  const [submitPayroll] = useSubmitPayrollRunMutation()
  const [reviewPayroll] = useReviewPayrollRunMutation()
  const [approvePayroll] = useApprovePayrollRunMutation()
  const [rejectPayroll, rejectPayrollState] = useRejectPayrollRunMutation()
  const [cancelPayroll] = useCancelPayrollRunMutation()
  const [draft, setDraft] = useState(blankDraft(businessDate))
  const [generateOpen, setGenerateOpen] = useState(false)
  const [generateStep, setGenerateStep] = useState(0)
  const [accountSnapshot, setAccountSnapshot] = useState<AccountingAccount[]>([])
  const [refreshingAccounts, setRefreshingAccounts] = useState(false)
  const [viewing, setViewing] = useState<PayrollRun | null>(null)
  const [rejecting, setRejecting] = useState<PayrollRun | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [employeeSearch, setEmployeeSearch] = useState('')
  const [confirmation, setConfirmation] = useState<{
    title: string
    message: string
    confirmLabel: string
    loadingLabel: string
    kind: 'danger' | 'approval' | 'primary'
    action: () => Promise<unknown>
  } | null>(null)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'runs' | 'reports'>('runs')

  const payrollPeriodReady = Boolean(draft.period_start && draft.period_end && draft.period_end >= draft.period_start && draft.period_end <= businessDate)
  const {
    data: eligibleEmployees = [],
    isFetching: eligibleEmployeesLoading,
    isError: eligibleEmployeesError,
  } = useGetPayrollEligibleEmployeesQuery(
    { period_start: draft.period_start, period_end: draft.period_end },
    { skip: !generateOpen || !payrollPeriodReady },
  )

  const isManager = hasRole(me?.roles, ['Manager', 'Admin', 'Super Admin'])
  const isAdmin = hasRole(me?.roles, ['Admin', 'Super Admin'])
  const methods = settings?.payment_methods.filter((method) => method.status === 'active') ?? []
  const selectedMethod = methods.find((method) => method.id === Number(draft.payment_method_id))
  const expectedType = selectedMethod?.code === 'bank_transfer' ? 'bank' : selectedMethod?.code === 'mobile_money' ? 'mobile_money' : selectedMethod?.code === 'check' ? 'check' : selectedMethod?.code === 'online_payment' ? 'online' : 'cash'
  const paymentAccounts = generateOpen ? accountSnapshot : accounts
  const compatibleAccounts = paymentAccounts.filter((account) => account.status === 'active' && account.type === expectedType)
  const selectedAccount = compatibleAccounts.find((account) => account.id === Number(draft.accounting_account_id))
  const filteredEmployees = useMemo(() => {
    const search = employeeSearch.trim().toLowerCase()
    if (!search) return eligibleEmployees
    return eligibleEmployees.filter((employee) => [employee.full_name, employee.employee_number, employee.position?.title]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(search)))
  }, [eligibleEmployees, employeeSearch])
  const attendanceReadyEmployees = eligibleEmployees.filter((employee) => employee.attendance_ready)
  const incompleteAttendanceEmployees = eligibleEmployees.filter((employee) => !employee.attendance_ready)
  const selectableFilteredEmployees = filteredEmployees.filter((employee) => employee.attendance_ready)
  const eligibleEmployeeIds = new Set(eligibleEmployees.map((employee) => employee.id))
  const selectedPayrollEmployeeIds = draft.employee_ids.filter((id) => eligibleEmployeeIds.has(id))
  const selectedEmployeeIds = new Set(selectedPayrollEmployeeIds)
  const allFilteredEmployeesSelected = selectableFilteredEmployees.length > 0 && selectableFilteredEmployees.every((employee) => selectedEmployeeIds.has(employee.id))
  const payrollEmployeeCount = draft.employee_scope === 'all' ? eligibleEmployees.length : selectedPayrollEmployeeIds.length

  const totals = useMemo(() => ({
    paid: payroll.filter((run) => run.status === 'approved').reduce((sum, run) => sum + Number(run.total_net), 0),
    pending: payroll.filter((run) => ['pending_review', 'pending_approval'].includes(run.status)).reduce((sum, run) => sum + Number(run.total_net), 0),
    employees: payroll.find((run) => run.status === 'approved')?.items.length ?? 0,
  }), [payroll])

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    try { await action() } catch (actionError) { setError(getApiErrorMessage(actionError, fallback)) }
  }

  const openGenerate = async () => {
    setDraft(blankDraft(businessDate))
    setEmployeeSearch('')
    setError('')
    setGenerateStep(0)
    setAccountSnapshot([])
    setGenerateOpen(true)
    setRefreshingAccounts(true)
    try {
      setAccountSnapshot(await refetchAccounts().unwrap())
    } catch (accountError) {
      setError(getApiErrorMessage(accountError, 'Unable to refresh payment account balances.'))
    } finally {
      setRefreshingAccounts(false)
    }
  }

  const toggleEmployee = (employeeId: number) => setDraft((current) => ({
    ...current,
    employee_ids: current.employee_ids.includes(employeeId)
      ? current.employee_ids.filter((id) => id !== employeeId)
      : [...current.employee_ids, employeeId],
  }))

  const toggleFilteredEmployees = () => setDraft((current) => {
    const filteredIds = selectableFilteredEmployees.map((employee) => employee.id)
    const nextIds = allFilteredEmployeesSelected
      ? current.employee_ids.filter((id) => !filteredIds.includes(id))
      : Array.from(new Set([...current.employee_ids, ...filteredIds]))
    return { ...current, employee_ids: nextIds }
  })

  const getPayrollReadinessError = () => {
    if (!payrollPeriodReady) return 'Choose a valid payroll period ending today or earlier.'
    if (draft.employee_scope === 'selected' && selectedPayrollEmployeeIds.length === 0) return 'Select at least one employee.'
    if (payrollEmployeeCount === 0) return 'No employees are available for this payroll period.'
    const employeesToProcess = draft.employee_scope === 'all'
      ? eligibleEmployees
      : eligibleEmployees.filter((employee) => selectedEmployeeIds.has(employee.id))
    const incomplete = employeesToProcess.filter((employee) => !employee.attendance_ready)
    if (incomplete.length > 0) {
      const names = incomplete.slice(0, 3).map((employee) => employee.full_name).join(', ')
      const remaining = incomplete.length > 3 ? ` and ${incomplete.length - 3} more` : ''
      return `Complete and approve attendance for ${names}${remaining} before calculating payroll.`
    }
    return ''
  }

  const continuePayroll = () => {
    const readinessError = getPayrollReadinessError()
    if (readinessError) {
      setError(readinessError)
      return
    }
    setError('')
    setGenerateStep(1)
  }

  const generate = () => runAction(async () => {
    if (!draft.title || !payrollPeriodReady || !draft.payment_method_id || !draft.accounting_account_id) throw new Error('Select the payroll period, payment method, and payment account.')
    const readinessError = getPayrollReadinessError()
    if (readinessError) throw new Error(readinessError)
    const { employee_scope, employee_ids, ...payrollData } = draft
    await generatePayroll({
      ...payrollData,
      ...(employee_scope === 'selected' ? { employee_ids: employee_ids.filter((id) => eligibleEmployeeIds.has(id)) } : {}),
    }).unwrap()
    setGenerateOpen(false)
  }, 'Unable to generate payroll from HR records.')

  const workflow = (run: PayrollRun) => <div className="flex flex-wrap gap-1.5">
    {run.generated_from_hr && ['draft', 'pending_review'].includes(run.status) ? <AsyncIconButton title="Recalculate from HR records" onAction={() => runAction(() => recalculatePayroll(run.id).unwrap(), 'Unable to recalculate payroll from HR records.')}><RefreshCw size={14} /></AsyncIconButton> : null}
    {['draft', 'rejected'].includes(run.status) ? <AsyncIconButton className="icon-button h-8 w-8 text-[var(--accent)]" title="Submit for review" onAction={() => runAction(() => submitPayroll(run.id).unwrap(), 'Unable to submit payroll.')}><Send size={14} /></AsyncIconButton> : null}
    {run.status === 'pending_review' && isManager ? <AsyncIconButton title="Review payroll" onAction={() => runAction(() => reviewPayroll(run.id).unwrap(), 'Unable to review payroll.')}><CheckCheck size={14} /></AsyncIconButton> : null}
    {['pending_review', 'pending_approval'].includes(run.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Approve and pay" onClick={() => setConfirmation({ title: 'Approve and Pay Payroll', message: `Approve ${run.payroll_number} for ${money(run.total_net)} from ${run.account?.name ?? 'the selected account'}? This will post the payroll expense and pay employees.`, confirmLabel: 'Approve and Pay', loadingLabel: 'Approving...', kind: 'approval', action: () => approvePayroll(run.id).unwrap() })}><CircleCheck size={14} /></button> : null}
    {['pending_review', 'pending_approval'].includes(run.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Reject" onClick={() => { setError(''); setRejecting(run); setRejectionReason('') }}><XCircle size={14} /></button> : null}
    {run.status === 'approved' && isAdmin ? <button type="button" className="icon-button h-8 w-8" title="Reverse payroll" onClick={() => setConfirmation({ title: 'Reverse Payroll', message: `Reverse ${run.payroll_number}? Its accounting and employee payment effects will be reversed.`, confirmLabel: 'Reverse Payroll', loadingLabel: 'Reversing...', kind: 'danger', action: () => cancelPayroll(run.id).unwrap() })}><Undo2 size={14} /></button> : null}
    {['draft', 'rejected'].includes(run.status) ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete draft" onClick={() => setConfirmation({ title: 'Delete Payroll Draft', message: `Delete ${run.payroll_number}? This draft and its calculated items will be removed.`, confirmLabel: 'Delete', loadingLabel: 'Deleting...', kind: 'danger', action: () => deletePayroll(run.id).unwrap() })}><Trash2 size={14} /></button> : null}
    <button type="button" className="icon-button h-8 w-8" title="View payroll" onClick={() => setViewing(run)}><Eye size={14} /></button>
  </div>

  const columns: Column<PayrollRun>[] = [
    { key: 'payroll_number', label: 'Payroll Number' },
    { key: 'title', label: 'Payroll', render: (item) => <div><p className="font-extrabold">{item.title}</p><p className="text-xs text-[var(--text-muted)]">{item.generated_from_hr ? 'Generated from approved HR records' : 'Manual legacy payroll'}</p></div> },
    { key: 'period_end', label: 'Period', render: (item) => `${dateValue(item.period_start)} - ${dateValue(item.period_end)}` },
    { key: 'items', label: 'Employees', render: (item) => item.items.length },
    { key: 'total_net', label: 'Net Payroll', render: (item) => <span className="font-extrabold">{money(item.total_net)}</span> },
    { key: 'account', label: 'Payment Account', render: (item) => item.account?.name ?? '-' },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'workflow', label: 'Workflow', render: workflow },
    { key: 'total_base_salary', label: 'Base Salary', render: (item) => money(item.total_base_salary) },
    { key: 'total_bonus', label: 'Bonus', render: (item) => money(item.total_bonus) },
    { key: 'total_overtime', label: 'Overtime', render: (item) => money(item.total_overtime) },
    { key: 'deductions', label: 'Deductions', render: (item) => money(Number(item.total_absence_deduction ?? 0) + Number(item.total_late_deduction ?? 0) + Number(item.total_advance_deduction) + Number(item.total_tax_deduction ?? 0) + Number(item.total_recurring_deduction ?? 0) + Number(item.total_other_deduction)) },
    { key: 'creator', label: 'Prepared By', render: (item) => item.creator?.name ?? '-' },
    { key: 'approver', label: 'Approved By', render: (item) => item.approver?.name ?? '-' },
  ]

  const printPayslip = (run: PayrollRun, item: PayrollItem) => {
    const company = settings?.system.system_profile
    const employeeName = item.employee?.full_name || item.employee_name
    const position = item.employee?.position?.title ?? '-'
    const deductions = Number(item.absence_deduction ?? 0) + Number(item.late_deduction ?? 0) + Number(item.advance_deduction) + Number(item.tax_deduction ?? 0) + Number(item.recurring_deduction ?? 0) + Number(item.other_deduction)
    const escape = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char)
    const t = (value: string) => escape(translate(value))
    const popup = window.open('', '_blank', 'width=900,height=900')
    if (!popup) { setError('Allow pop-ups to print the payslip.'); return }
    popup.document.write(`<!doctype html><html dir="${direction}"><head><meta charset="utf-8"><title>${escape(run.payroll_number)} - ${escape(employeeName)}</title><style>
      @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#132238;margin:0;direction:${direction};text-align:${direction === 'rtl' ? 'right' : 'left'}}main{max-width:760px;margin:auto;border:1px solid #b8c9d6;padding:28px}.head{display:flex;justify-content:space-between;gap:20px;border-bottom:3px solid #1687a7;padding-bottom:18px}.brand{font-size:22px;font-weight:800;color:#0c6b87}.muted{color:#5e7180;font-size:12px}.title{text-align:${direction === 'rtl' ? 'left' : 'right'}}.title h1{margin:0;font-size:24px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px 28px;margin:22px 0}.field{border-bottom:1px solid #d8e2e8;padding:8px 0}.field b{display:block;font-size:11px;text-transform:uppercase;color:#647985;margin-bottom:4px}table{width:100%;border-collapse:collapse;margin-top:18px}th,td{padding:11px;border:1px solid #c8d6df;text-align:${direction === 'rtl' ? 'right' : 'left'}}th{background:#eaf7fb;color:#0c6b87;font-size:12px}.num{text-align:right}.net{margin-top:18px;display:flex;justify-content:flex-end}.net div{width:280px;background:#0c6b87;color:white;padding:16px}.net strong{float:${direction === 'rtl' ? 'left' : 'right'};font-size:20px}.sign{display:grid;grid-template-columns:1fr 1fr;gap:80px;margin-top:70px}.line{border-top:1px solid #273b49;text-align:center;padding-top:8px;font-size:12px}@media print{main{border:0;padding:0}}
    </style></head><body><main><div class="head"><div><div class="brand">${escape(company?.company_name || translate('Water Supply Management System'))}</div><div class="muted">${escape(company?.address || '')}<br>${escape(company?.phone || '')}</div></div><div class="title"><h1>${t('Payslip')}</h1><div class="muted">${escape(run.payroll_number)}</div></div></div><div class="grid"><div class="field"><b>${t('Employee')}</b>${escape(employeeName)}</div><div class="field"><b>${t('Employee ID')}</b>${escape(item.employee?.employee_number || '-')}</div><div class="field"><b>${t('Position')}</b>${escape(position)}</div><div class="field"><b>${t('Pay Period')}</b>${escape(dateValue(run.period_start))} ${t('to')} ${escape(dateValue(run.period_end))}</div><div class="field"><b>${t('Payment Date')}</b>${escape(dateValue(run.payment_date))}</div><div class="field"><b>${t('Payment Account')}</b>${escape(run.account?.name || '-')}</div></div><table><thead><tr><th>${t('Description')}</th><th class="num">${t('Earnings')}</th><th class="num">${t('Deductions')}</th></tr></thead><tbody><tr><td>${t('Base Salary')}</td><td class="num">${escape(money(item.base_salary))}</td><td></td></tr><tr><td>${t('Bonus')}</td><td class="num">${escape(money(item.bonus))}</td><td></td></tr><tr><td>${t('Overtime')} (${escape(item.overtime_hours ?? 0)} ${t('hours')})</td><td class="num">${escape(money(item.overtime_amount))}</td><td></td></tr><tr><td>${t('Absence')} (${escape(item.absent_days ?? 0)} ${t('days')})</td><td></td><td class="num">${escape(money(item.absence_deduction))}</td></tr><tr><td>${t('Late Arrival')} (${escape(item.late_minutes ?? 0)} ${t('minutes')})</td><td></td><td class="num">${escape(money(item.late_deduction))}</td></tr><tr><td>${t('Salary Advance')}</td><td></td><td class="num">${escape(money(item.advance_deduction))}</td></tr><tr><td>${t('Tax')}</td><td></td><td class="num">${escape(money(item.tax_deduction))}</td></tr><tr><td>${t('Recurring Deductions')}</td><td></td><td class="num">${escape(money(item.recurring_deduction))}</td></tr><tr><td>${t('Other Deductions')}</td><td></td><td class="num">${escape(money(item.other_deduction))}</td></tr><tr><th>${t('Total')}</th><th class="num">${escape(money(Number(item.base_salary) + Number(item.bonus) + Number(item.overtime_amount)))}</th><th class="num">${escape(money(deductions))}</th></tr></tbody></table><div class="net"><div>${t('Net Salary')} <strong>${escape(money(item.net_amount))}</strong></div></div><div class="sign"><div class="line">${t('Employee Signature')}</div><div class="line">${t('Authorized Signature')}</div></div></main><script>window.onload=()=>{window.print()}</script></body></html>`)
    popup.document.close()
  }

  return (
    <div className="mx-auto max-w-[1680px] p-6 lg:p-8">
      <PageHeader title="Payroll" subtitle="Generate salaries from approved attendance, leave, overtime, advances, bonuses, and deductions">
        {tab === 'runs' ? <button type="button" className="primary-action text-sm" onClick={openGenerate}><Calculator size={18} /> Generate Payroll</button> : null}
      </PageHeader>
      <PeoplePayrollFlow active="payroll" />
      <InlineError message={error || (isError ? 'Unable to load payroll.' : '')} />
      <div className="mb-5 flex flex-wrap gap-2 border-b pb-3 elegant-divider"><button type="button" onClick={() => setTab('runs')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-extrabold ${tab === 'runs' ? 'bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]' : 'text-[var(--text-muted)]'}`}><FileText size={16} /> Payroll Runs</button><button type="button" onClick={() => setTab('reports')} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-extrabold ${tab === 'reports' ? 'bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]' : 'text-[var(--text-muted)]'}`}><FileBarChart size={16} /> Monthly Reports</button></div>
      {tab === 'runs' ? <><div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric label="Payroll Runs" value={String(payroll.length)} icon={FileText} />
        <FinanceMetric label="Last Employee Count" value={String(totals.employees)} icon={Users} />
        <FinanceMetric label="Approved Payroll" value={money(totals.paid)} icon={Banknote} tone="text-[var(--mint)]" />
        <FinanceMetric label="Awaiting Approval" value={money(totals.pending)} icon={CheckCheck} tone="text-[var(--gold)]" />
      </div>
      <DataTable columns={columns} data={payroll} loading={isLoading && payroll.length === 0} searchKeys={['payroll_number', 'title', 'status']} summaryColumnCount={8} /></> : null}
      {tab === 'reports' ? <PayrollReportPanel /> : null}

      <Modal isOpen={generateOpen} onClose={() => { setGenerateOpen(false); setGenerateStep(0) }} title="Generate Monthly Payroll" size="xl">
        <div className="mb-5 border-s-4 border-[var(--accent)] ps-4 text-sm text-[var(--text-secondary)]"><p className="font-extrabold text-[var(--text-primary)]">Payroll is calculated automatically</p><p className="mt-1">Only approved attendance, leave, overtime, salary advances, bonuses, and deductions in this period are included.</p></div>
        <div className="mb-5 grid grid-cols-2 gap-2 border-y border-[var(--border-subtle)] py-3">
          {[{ label: 'Period & Employees', icon: Users }, { label: 'Payment & Review', icon: Banknote }].map((step, index) => { const StepIcon = step.icon; const active = generateStep === index; const complete = index < generateStep; return <button key={step.label} type="button" disabled={index > generateStep} onClick={() => { if (index < generateStep) { setGenerateStep(index); setError('') } }} className={`flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-extrabold ${active ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : complete ? 'border-[var(--mint)] bg-[var(--mint-soft)] text-[var(--mint)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)]'}`}>{complete ? <Check size={16} /> : <StepIcon size={16} />}<span className="truncate">{translate(step.label)}</span></button> })}
        </div>
        <InlineError message={generateOpen ? error : ''} />
        {generateStep === 0 ? <>
        <div className="mb-4 grid gap-3 md:grid-cols-2"><FormField label="Period Start" type="date" value={draft.period_start} onChange={(value) => setDraft({ ...draft, period_start: String(value) })} required /><FormField label="Period End" type="date" value={draft.period_end} onChange={(value) => setDraft({ ...draft, period_end: String(value) })} required /></div>
        <section className="mb-5 border-y border-[var(--border-subtle)] py-5" aria-labelledby="payroll-employee-scope">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p id="payroll-employee-scope" className="text-sm font-extrabold text-[var(--text-primary)]">{translate('Employees to Process')}</p>
              <p className="mt-1 text-xs text-[var(--text-muted)]">{translate('Choose all available employees or select specific employees.')}</p>
            </div>
            <div className="grid min-w-[280px] grid-cols-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-1" role="group" aria-label={translate('Employee Selection')}>
              <button
                type="button"
                aria-pressed={draft.employee_scope === 'all'}
                className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-extrabold transition-colors ${draft.employee_scope === 'all' ? 'bg-[var(--bg-elevated)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-muted)]'}`}
                onClick={() => setDraft({ ...draft, employee_scope: 'all', employee_ids: [] })}
              >
                <Users size={16} /> {translate('All Employees')}
              </button>
              <button
                type="button"
                aria-pressed={draft.employee_scope === 'selected'}
                className={`flex min-h-10 items-center justify-center gap-2 rounded-md px-3 text-sm font-extrabold transition-colors ${draft.employee_scope === 'selected' ? 'bg-[var(--bg-elevated)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-muted)]'}`}
                onClick={() => setDraft({ ...draft, employee_scope: 'selected' })}
              >
                <UserCheck size={16} /> {translate('Selected Employees')}
              </button>
            </div>
          </div>

          {draft.employee_scope === 'all' ? (
            <div className="mt-4 flex items-center gap-3 bg-[var(--accent-soft)] px-4 py-3 text-sm">
              <Users className="shrink-0 text-[var(--accent)]" size={20} />
              <div>
                <p className="font-extrabold text-[var(--text-primary)]">
                  {eligibleEmployeesLoading ? translate('Checking eligible employees...') : <>{attendanceReadyEmployees.length} of {eligibleEmployees.length} {translate('employees have complete attendance')}</>}
                </p>
                <p className={`mt-0.5 text-xs ${incompleteAttendanceEmployees.length > 0 ? 'font-bold text-[var(--coral)]' : 'text-[var(--text-muted)]'}`}>
                  {incompleteAttendanceEmployees.length > 0
                    ? `${incompleteAttendanceEmployees.length} ${translate('employees still need attendance completion or approval.')}`
                    : translate('All attendance is complete and approved for this period.')}
                </p>
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <div className="relative">
                <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" size={17} />
                <input
                  type="search"
                  value={employeeSearch}
                  onChange={(event) => setEmployeeSearch(event.target.value)}
                  placeholder={translate('Search employees...')}
                  aria-label={translate('Search employees')}
                  className="h-11 w-full rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] pe-3 ps-10 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent-soft)]"
                />
              </div>

              <div className="mt-3 flex min-h-9 flex-wrap items-center justify-between gap-2 text-sm">
                <label className="flex cursor-pointer items-center gap-2 font-bold text-[var(--text-secondary)]">
                  <input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={allFilteredEmployeesSelected} disabled={selectableFilteredEmployees.length === 0} onChange={toggleFilteredEmployees} />
                  {translate('Select all shown')}
                </label>
                <div className="flex items-center gap-3">
                  <span className="font-extrabold text-[var(--accent)]">{selectedPayrollEmployeeIds.length} {translate('selected')}</span>
                  {draft.employee_ids.length > 0 ? <button type="button" className="text-xs font-bold text-[var(--text-muted)] underline-offset-4 hover:underline" onClick={() => setDraft({ ...draft, employee_ids: [] })}>{translate('Clear')}</button> : null}
                </div>
              </div>

              <div className="mt-2 max-h-64 overflow-y-auto border border-[var(--border-subtle)] bg-[var(--bg-elevated)]">
                {eligibleEmployeesLoading ? <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">{translate('Checking eligible employees...')}</p> : null}
                {!eligibleEmployeesLoading && filteredEmployees.map((employee) => (
                  <label key={employee.id} className={`flex items-center gap-3 border-b border-[var(--border-subtle)] px-4 py-3 last:border-b-0 ${employee.attendance_ready ? 'cursor-pointer hover:bg-[var(--bg-muted)]' : 'cursor-not-allowed opacity-70'}`}>
                    <input type="checkbox" className="h-4 w-4 shrink-0 accent-[var(--accent)]" checked={selectedEmployeeIds.has(employee.id)} disabled={!employee.attendance_ready} onChange={() => toggleEmployee(employee.id)} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-extrabold text-[var(--text-primary)]">{employee.full_name}</span>
                      <span className="block truncate text-xs text-[var(--text-muted)]">{employee.employee_number}{employee.position?.title ? ` - ${employee.position.title}` : ''}</span>
                      {!employee.attendance_ready && employee.incomplete_attendance.length > 0 ? (
                        <span className="mt-1 block text-xs font-bold text-[var(--coral)]">
                          {employee.incomplete_attendance.map((issue) => `${dateValue(issue.date)}: ${translate(issue.reason)}`).join(' · ')}
                        </span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-end text-xs font-bold text-[var(--text-secondary)]">
                      <span className="block">{employee.salary_type === 'daily' ? `${money(employee.daily_rate)} / ${translate('day')}` : money(employee.base_salary)}</span>
                      <span className={`mt-1 block ${employee.attendance_ready ? 'text-[var(--mint)]' : 'text-[var(--coral)]'}`}>
                        {employee.attendance_ready ? translate('Attendance ready') : `${employee.incomplete_attendance_count} ${translate('attendance records incomplete')}`}
                      </span>
                    </span>
                  </label>
                ))}
                {!eligibleEmployeesLoading && filteredEmployees.length === 0 ? <p className="px-4 py-8 text-center text-sm text-[var(--text-muted)]">{translate(employeeSearch ? 'No employees match your search.' : 'No employees are available for this payroll period.')}</p> : null}
              </div>
            </div>
          )}

          {eligibleEmployeesError ? <p className="mt-3 text-sm font-bold text-[var(--coral)]">{translate('Unable to load eligible employees.')}</p> : null}
          {!payrollPeriodReady ? <p className="mt-3 text-sm font-bold text-[var(--coral)]">{translate('Choose a valid payroll period ending today or earlier.')}</p> : null}
        </section>
        </> : null}
        {generateStep === 1 ? <>
        <div className="mb-4 grid gap-x-8 sm:grid-cols-2"><Mini label="Period" value={`${dateValue(draft.period_start)} - ${dateValue(draft.period_end)}`} /><Mini label="Employees" value={String(payrollEmployeeCount)} /></div>
        <div className="grid gap-3 md:grid-cols-2"><FormField label="Payroll Title" value={draft.title} onChange={(value) => setDraft({ ...draft, title: String(value) })} required /><FormField label="Payment Date" type="date" value={draft.payment_date} onChange={(value) => setDraft({ ...draft, payment_date: String(value) })} required /><FormField label="Payment Method" type="select" value={draft.payment_method_id || ''} onChange={(value) => setDraft({ ...draft, payment_method_id: Number(value), accounting_account_id: 0 })} options={methods.map((item) => ({ value: item.id, label: item.name }))} required /><FormField label="Payment Account" type="select" value={draft.accounting_account_id || ''} onChange={(value) => setDraft({ ...draft, accounting_account_id: Number(value) })} options={compatibleAccounts.map((item) => ({ value: item.id, label: `${item.name} - Available ${money(item.current_balance)}` }))} placeholder={accountsFetching || refreshingAccounts ? 'Refreshing account balances...' : 'Select an option'} disabled={accountsFetching || refreshingAccounts} required /></div>
        {selectedAccount ? (
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-y border-[var(--border-subtle)] py-3 text-sm">
            <span className="font-bold text-[var(--text-secondary)]">Available Balance in {selectedAccount.name}</span>
            <span className="text-base font-extrabold text-[var(--mint)]">{money(selectedAccount.current_balance)}</span>
          </div>
        ) : null}
        <div className="mt-3"><FormField label="Notes" type="textarea" value={draft.notes} onChange={(value) => setDraft({ ...draft, notes: String(value) })} /></div>
        </> : null}
        <div className="mt-5 flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between"><button className="secondary-action justify-center" onClick={() => { setGenerateOpen(false); setGenerateStep(0) }}>{translate('Cancel')}</button><div className="flex justify-end gap-3">{generateStep > 0 ? <button type="button" className="secondary-action" onClick={() => { setGenerateStep(0); setError('') }}>{direction === 'rtl' ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}{translate('Back')}</button> : null}{generateStep === 0 ? <button type="button" className="primary-action" disabled={eligibleEmployeesLoading} onClick={continuePayroll}>{translate('Continue')}{direction === 'rtl' ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}</button> : <LoadingButton loading={generateState.isLoading} loadingLabel="Calculating..." onClick={generate}><Calculator size={16} />{translate('Calculate Payroll')}</LoadingButton>}</div></div>
      </Modal>

      <Modal isOpen={Boolean(viewing)} onClose={() => setViewing(null)} title={viewing?.payroll_number ?? 'Payroll'} size="xl">
        {viewing ? <><div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Mini label="Period" value={`${dateValue(viewing.period_start)} - ${dateValue(viewing.period_end)}`} /><Mini label="Employees" value={String(viewing.items.length)} /><Mini label="Payment Account" value={viewing.account?.name ?? '-'} /><Mini label="Net Payroll" value={money(viewing.total_net)} /></div><div className="overflow-x-auto"><table className="w-full min-w-[1440px] text-sm"><thead className="border-b text-xs uppercase text-[var(--text-muted)] elegant-divider"><tr><Th>Employee</Th><Th>Attendance</Th><Th>Base</Th><Th>Bonus</Th><Th>Overtime</Th><Th>Absence Deduction</Th><Th>Late Arrival</Th><Th>Advance</Th><Th>Tax</Th><Th>Recurring</Th><Th>Other</Th><Th>Net</Th><Th>Payslip</Th></tr></thead><tbody>{viewing.items.map((item) => <tr key={item.id ?? item.employee_name} className="border-b elegant-divider"><Td strong>{item.employee?.full_name || item.employee_name}<span className="block text-xs font-normal text-[var(--text-muted)]">{item.employee?.employee_number ?? '-'}</span></Td><Td>{item.present_days ?? 0}/{item.scheduled_days ?? 0} days<span className="block text-xs text-[var(--text-muted)]">{item.paid_leave_days ?? 0} paid leave · {item.overtime_hours ?? 0}h OT</span></Td><Td>{money(item.base_salary)}</Td><Td>{money(item.bonus)}</Td><Td>{money(item.overtime_amount)}</Td><Td>{money(item.absence_deduction)}<span className="block text-xs text-[var(--text-muted)]">{item.absent_days ?? 0} absent days</span></Td><Td>{money(item.late_deduction)}<span className="block text-xs text-[var(--text-muted)]">{item.late_minutes ?? 0} min</span></Td><Td>{money(item.advance_deduction)}</Td><Td>{money(item.tax_deduction)}</Td><Td>{money(item.recurring_deduction)}</Td><Td>{money(item.other_deduction)}</Td><Td strong>{money(item.net_amount)}</Td><Td><button type="button" className="icon-button h-8 w-8 text-[var(--accent)]" title="Print payslip" onClick={() => printPayslip(viewing, item)}><Printer size={15} /></button></Td></tr>)}</tbody></table></div></> : null}
      </Modal>

      <Modal isOpen={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject Payroll" size="sm"><InlineError message={rejecting ? error : ''} /><FormField label="Rejection Reason" type="textarea" value={rejectionReason} onChange={(value) => setRejectionReason(String(value))} required /><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setRejecting(null)}>Cancel</button><LoadingButton loading={rejectPayrollState.isLoading} loadingLabel="Rejecting..." onClick={() => rejecting && runAction(async () => { await rejectPayroll({ id: rejecting.id, rejection_reason: rejectionReason }).unwrap(); setRejecting(null) }, 'Unable to reject payroll.')}>Reject Payroll</LoadingButton></div></Modal>
      <ConfirmDialog isOpen={Boolean(confirmation)} onClose={() => setConfirmation(null)} onConfirm={() => confirmation?.action() ?? Promise.resolve()} title={confirmation?.title ?? 'Confirm Action'} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel} loadingLabel={confirmation?.loadingLabel} kind={confirmation?.kind} />
    </div>
  )
}

function Mini({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3"><p className="text-xs font-bold text-[var(--text-muted)]">{label}</p><p className="mt-1 font-extrabold">{value}</p></div> }
function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-3 text-start">{children}</th> }
function Td({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) { return <td className={`px-3 py-3 ${strong ? 'font-extrabold text-[var(--text-primary)]' : ''}`}>{children}</td> }
