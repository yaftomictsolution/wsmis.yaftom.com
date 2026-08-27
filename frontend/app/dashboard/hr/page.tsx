'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  ArrowLeft, ArrowRight, Banknote, BriefcaseBusiness, Building2, Check, CircleDollarSign, ClipboardCheck, Clock, ContactRound, Download, Eye,
  FileBarChart, Gift, KeyRound, Pencil, Plus, Printer, ReceiptText, Send, ShieldCheck, Trash2, UserCheck,
  UserMinus, Users, WalletCards, X,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AsyncIconButton, LoadingButton } from '@/components/ui/AsyncButton'
import { FinanceMetric, FinanceStatus, InlineError, dateValue, getApiErrorMessage, hasRole, money } from '@/components/finance/FinanceUI'
import { useTrainingMode } from '@/context/TrainingModeContext'
import { useCalendar } from '@/context/CalendarContext'
import { useLanguage } from '@/context/LanguageContext'
import { PeoplePayrollFlow } from '@/components/hr/PeoplePayrollFlow'
import {
  useApproveSalaryAdvanceMutation,
  useCancelSalaryAdvanceMutation,
  useCreateDepartmentMutation,
  useCreateEmployeeAdjustmentMutation,
  useCreateEmployeeMutation,
  useCreateJobPositionMutation,
  useCreateSalaryAdvanceMutation,
  useDeleteDepartmentMutation,
  useDeleteEmployeeAdjustmentMutation,
  useDeleteEmployeeMutation,
  useDeleteJobPositionMutation,
  useGetAccountingAccountsQuery,
  useGetEmployeeAdjustmentsQuery,
  useGetEmployeesQuery,
  useGetHrReportQuery,
  useGetHrStructureQuery,
  useGetHrSummaryQuery,
  useGetMeQuery,
  useGetSalaryAdvancesQuery,
  useGetSettingsQuery,
  useRejectSalaryAdvanceMutation,
  useResolveEmployeeAdjustmentMutation,
  useReviewSalaryAdvanceMutation,
  useUpdateDepartmentMutation,
  useUpdateEmployeeMutation,
  useUpdateJobPositionMutation,
  type Department,
  type Employee,
  type EmployeeAdjustment,
  type HrReportRow,
  type JobPosition,
  type SalaryAdvance,
} from '@/src/store/waternetApi'

const PayrollDeductionPanel = dynamic(
  () => import('@/components/hr/PayrollDeductionPanel').then((module) => module.PayrollDeductionPanel),
  { loading: () => <div className="py-12 text-center text-sm font-bold text-[var(--text-muted)]">Loading deductions...</div> },
)
const TerminationPanel = dynamic(
  () => import('@/components/hr/TerminationPanel').then((module) => module.TerminationPanel),
  { loading: () => <div className="py-12 text-center text-sm font-bold text-[var(--text-muted)]">Loading settlements...</div> },
)

type Tab = 'employees' | 'structure' | 'advances' | 'adjustments' | 'deductions' | 'terminations' | 'reports'
type EmployeeDraft = Record<string, unknown>
type HrReportTableRow = HrReportRow & { id: number }

const blankEmployee = (businessDate: string): EmployeeDraft => ({
  first_name: '', last_name: '', father_name: '', phone: '', email: '', biometric_id: '', hire_date: businessDate,
  employment_type: 'permanent', salary_type: 'fixed', base_salary: 0, daily_rate: 0,
  overtime_rate_mode: 'automatic', overtime_hourly_rate: 0, standard_daily_hours: 8, work_start_time: '08:00', work_end_time: '16:00',
  work_days: [1, 2, 3, 4, 5, 6], status: 'active', login_enabled: false, login_status: 'inactive',
  login_role: '', login_password: '', login_password_confirmation: '',
})

const automaticOvertimeRate = (employee: EmployeeDraft) => {
  const dailyHours = Math.max(1, Number(employee.standard_daily_hours ?? 8))
  const dailySalary = employee.salary_type === 'daily' && Number(employee.daily_rate ?? 0) > 0
    ? Number(employee.daily_rate)
    : Number(employee.base_salary ?? 0) / 30

  return Math.round((dailySalary / dailyHours) * 100) / 100
}

const weekDays = [
  { value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' },
  { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 7, label: 'Sun' },
]

const newestFirst = <T extends { id: number },>(items: T[] | undefined) => [...(items ?? [])].sort((left, right) => right.id - left.id)

const employeeFormSteps = [
  { label: 'Personal', icon: ContactRound },
  { label: 'Employment', icon: BriefcaseBusiness },
  { label: 'Pay & Schedule', icon: WalletCards },
  { label: 'Login & Review', icon: KeyRound },
] as const

export default function HrPage() {
  const { businessDate } = useTrainingMode()
  const { formatDate, formatDateTime } = useCalendar()
  const { direction, translate } = useLanguage()
  const [tab, setTab] = useState<Tab>('employees')
  const [employeeOpen, setEmployeeOpen] = useState(false)
  const [employeeStep, setEmployeeStep] = useState(0)
  const [employeeDraft, setEmployeeDraft] = useState<EmployeeDraft>(blankEmployee(businessDate))
  const [positionOpen, setPositionOpen] = useState(false)
  const [positionDraft, setPositionDraft] = useState<Partial<JobPosition>>({ code: '', title: '', status: 'active' })
  const [advanceOpen, setAdvanceOpen] = useState(false)
  const [advanceDraft, setAdvanceDraft] = useState<Record<string, string | number>>({ payment_date: businessDate, deduction_start_date: businessDate, amount: 0, reason: '' })
  const { data: summary } = useGetHrSummaryQuery()
  const { data: employees = [], isLoading, isError } = useGetEmployeesQuery()
  const { data: structure } = useGetHrStructureQuery(undefined, { skip: tab !== 'structure' && !employeeOpen && !positionOpen })
  const { data: advances = [] } = useGetSalaryAdvancesQuery(undefined, { skip: tab !== 'advances' })
  const { data: adjustments = [] } = useGetEmployeeAdjustmentsQuery(undefined, { skip: tab !== 'adjustments' })
  const [reportFilters, setReportFilters] = useState({ from: `${businessDate.slice(0, 7)}-01`, to: businessDate })
  const [reportRange, setReportRange] = useState(reportFilters)
  const { data: report, isLoading: reportLoading, isFetching: reportFetching, isError: reportError, refetch: refetchReport } = useGetHrReportQuery(reportRange, { skip: tab !== 'reports' })
  const { data: settings } = useGetSettingsQuery(undefined, { skip: !advanceOpen })
  const { data: accounts = [] } = useGetAccountingAccountsQuery(undefined, { skip: !advanceOpen })
  const { data: me } = useGetMeQuery()

  const [createEmployee, createEmployeeState] = useCreateEmployeeMutation()
  const [updateEmployee, updateEmployeeState] = useUpdateEmployeeMutation()
  const [deleteEmployee] = useDeleteEmployeeMutation()
  const [createDepartment, createDepartmentState] = useCreateDepartmentMutation()
  const [updateDepartment, updateDepartmentState] = useUpdateDepartmentMutation()
  const [deleteDepartment] = useDeleteDepartmentMutation()
  const [createPosition, createPositionState] = useCreateJobPositionMutation()
  const [updatePosition, updatePositionState] = useUpdateJobPositionMutation()
  const [deletePosition] = useDeleteJobPositionMutation()
  const [createAdvance, createAdvanceState] = useCreateSalaryAdvanceMutation()
  const [reviewAdvance] = useReviewSalaryAdvanceMutation()
  const [approveAdvance] = useApproveSalaryAdvanceMutation()
  const [rejectAdvance, rejectAdvanceState] = useRejectSalaryAdvanceMutation()
  const [cancelAdvance] = useCancelSalaryAdvanceMutation()
  const [createAdjustment, createAdjustmentState] = useCreateEmployeeAdjustmentMutation()
  const [resolveAdjustment, resolveAdjustmentState] = useResolveEmployeeAdjustmentMutation()
  const [deleteAdjustment] = useDeleteEmployeeAdjustmentMutation()

  const [departmentOpen, setDepartmentOpen] = useState(false)
  const [departmentDraft, setDepartmentDraft] = useState<Partial<Department>>({ code: '', name: '', status: 'active' })
  const [adjustmentOpen, setAdjustmentOpen] = useState(false)
  const [adjustmentDraft, setAdjustmentDraft] = useState<Record<string, string | number>>({ type: 'bonus', amount: 0, effective_date: businessDate, title: '' })
  const [rejecting, setRejecting] = useState<{ kind: 'advance' | 'adjustment'; id: number } | null>(null)
  const [rejectionReason, setRejectionReason] = useState('')
  const [confirmation, setConfirmation] = useState<{
    title: string
    message: string
    confirmLabel: string
    loadingLabel: string
    kind: 'danger' | 'approval' | 'primary'
    action: () => Promise<unknown>
  } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab') as Tab | null
    if (!requested || !['employees', 'structure', 'advances', 'adjustments', 'deductions', 'terminations', 'reports'].includes(requested)) return
    const timer = window.setTimeout(() => setTab(requested), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const isManager = hasRole(me?.roles, ['Manager', 'Admin', 'Super Admin'])
  const isAdmin = hasRole(me?.roles, ['Admin', 'Super Admin'])
  const loginEnabled = employeeDraft.login_enabled === true
  const methods = settings?.payment_methods.filter((method) => method.status === 'active') ?? []
  const selectedMethod = methods.find((method) => method.id === Number(advanceDraft.payment_method_id))
  const expectedAccountType = selectedMethod?.code === 'bank_transfer' ? 'bank' : selectedMethod?.code === 'mobile_money' ? 'mobile_money' : selectedMethod?.code === 'check' ? 'check' : selectedMethod?.code === 'online_payment' ? 'online' : 'cash'
  const compatibleAccounts = accounts.filter((account) => account.status === 'active' && account.type === expectedAccountType)
  const activeEmployees = employees.filter((employee) => ['active', 'on_leave'].includes(employee.status))
  const reportRows: HrReportTableRow[] = (report?.rows ?? []).map((row) => ({ ...row, id: row.employee_id }))
  const reportTotals = reportRows.reduce((totals, row) => ({
    present: totals.present + row.present_days,
    absent: totals.absent + row.absent_days,
    leave: totals.leave + row.leave_days,
    overtime: totals.overtime + row.overtime_minutes,
    salary: totals.salary + row.net_salary,
    advances: totals.advances + row.advance_balance,
  }), { present: 0, absent: 0, leave: 0, overtime: 0, salary: 0, advances: 0 })

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    try { await action() } catch (actionError) { setError(getApiErrorMessage(actionError, fallback)) }
  }

  const openEmployee = (employee?: Employee) => {
    setError('')
    setEmployeeStep(0)
    setEmployeeDraft(employee ? {
      ...employee,
      date_of_birth: dateValue(employee.date_of_birth) === '-' ? '' : dateValue(employee.date_of_birth),
      hire_date: dateValue(employee.hire_date),
      termination_date: dateValue(employee.termination_date) === '-' ? '' : dateValue(employee.termination_date),
      work_start_time: employee.work_start_time?.slice(0, 5),
      work_end_time: employee.work_end_time?.slice(0, 5),
      login_enabled: employee.user?.status === 'active',
      login_status: employee.user?.status ?? 'inactive',
      login_role: employee.user?.roles?.[0]?.name ?? '',
      login_password: '',
      login_password_confirmation: '',
      overtime_rate_mode: Number(employee.overtime_hourly_rate) > 0 ? 'custom' : 'automatic',
    } : blankEmployee(businessDate))
    setEmployeeOpen(true)
  }

  const closeEmployee = () => {
    if (createEmployeeState.isLoading || updateEmployeeState.isLoading) return
    setEmployeeOpen(false)
    setEmployeeStep(0)
    setError('')
  }

  const openDepartment = (department?: Department) => {
    setError('')
    setDepartmentDraft(department ?? { code: '', name: '', status: 'active' })
    setDepartmentOpen(true)
  }

  const openPosition = (position?: JobPosition) => {
    setError('')
    setPositionDraft(position ?? { code: '', title: '', status: 'active' })
    setPositionOpen(true)
  }

  const openAdvance = () => {
    setError('')
    setAdvanceDraft({ payment_date: businessDate, deduction_start_date: businessDate, amount: 0, reason: '' })
    setAdvanceOpen(true)
  }

  const openAdjustment = () => {
    setError('')
    setAdjustmentDraft({ type: 'bonus', amount: 0, effective_date: businessDate, title: '' })
    setAdjustmentOpen(true)
  }

  const getEmployeeStepError = (step: number) => {
    if (step === 0 && !String(employeeDraft.first_name ?? '').trim()) return 'Enter the employee first name.'
    if (step === 1 && (!employeeDraft.hire_date || !employeeDraft.employment_type || !employeeDraft.status)) return 'Complete the required employment fields.'
    if (step === 2 && (!employeeDraft.salary_type || !employeeDraft.work_start_time || !employeeDraft.work_end_time)) return 'Complete the required salary and schedule fields.'
    if (step === 2 && (employeeDraft.work_days as number[] ?? []).length === 0) return 'Select at least one working day.'
    if (step === 3 && loginEnabled && (!employeeDraft.email || !employeeDraft.login_role)) return 'Email and role are required when login access is enabled.'
    if (step === 3 && loginEnabled && !employeeDraft.user_id && !employeeDraft.login_password) return 'Enter a password for the new employee login account.'
    if (step === 3 && loginEnabled && employeeDraft.login_password !== employeeDraft.login_password_confirmation) return 'Login password and confirmation do not match.'
    return ''
  }

  const continueEmployee = () => {
    const stepError = getEmployeeStepError(employeeStep)
    if (stepError) {
      setError(stepError)
      return
    }
    setError('')
    setEmployeeStep((step) => Math.min(step + 1, employeeFormSteps.length - 1))
  }

  const saveEmployee = async () => {
    for (let step = 0; step < employeeFormSteps.length; step += 1) {
      const stepError = getEmployeeStepError(step)
      if (stepError) {
        setEmployeeStep(step)
        setError(stepError)
        return
      }
    }
    const body = { ...employeeDraft }
    delete body.user_id
    delete body.user
    delete body.overtime_rate_mode
    body.login_enabled = loginEnabled
    if (employeeDraft.overtime_rate_mode !== 'custom') body.overtime_hourly_rate = 0
    if (!loginEnabled) {
      delete body.login_password
      delete body.login_password_confirmation
      delete body.login_role
      delete body.login_status
    }
    for (const key of ['job_position_id', 'service_area_id', 'referred_by_shareholder_id']) {
      if (!body[key]) body[key] = undefined
    }
    await runAction(async () => {
      if (employeeDraft.id) await updateEmployee({ id: Number(employeeDraft.id), body }).unwrap()
      else await createEmployee(body).unwrap()
      setEmployeeOpen(false)
      setEmployeeStep(0)
    }, 'Unable to save employee.')
  }

  const employeeColumns: Column<Employee>[] = [
    { key: 'employee_number', label: 'Employee ID' },
    { key: 'full_name', label: 'Employee', render: (item) => <div><p className="font-extrabold text-[var(--text-primary)]">{item.full_name}</p><p className="text-xs text-[var(--text-muted)]">{item.phone || item.email || '-'}</p></div> },
    { key: 'position', label: 'Position', render: (item) => <div><p className="font-bold">{item.position?.title ?? '-'}</p><p className="text-xs text-[var(--text-muted)]">{item.position?.department?.name ?? '-'}</p></div> },
    { key: 'service_area', label: 'Assigned Area', render: (item) => item.service_area?.name ?? '-' },
    { key: 'salary_type', label: 'Salary', render: (item) => <div><p className="font-bold">{item.salary_type === 'daily' ? money(item.daily_rate) + ' / day' : money(item.base_salary)}</p><p className="text-xs capitalize text-[var(--text-muted)]">{item.salary_type}</p></div> },
    { key: 'hire_date', label: 'Hired', render: (item) => <DateText value={item.hire_date} /> },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'actions', label: 'Actions', render: (item) => <div className="flex gap-1.5">
      <Link href={`/dashboard/hr/${item.id}`} className="icon-button h-8 w-8" title="Employee profile"><Eye size={14} /></Link>
      <button type="button" className="icon-button h-8 w-8" title="Edit employee" onClick={() => openEmployee(item)}><Pencil size={14} /></button>
      <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete employee" onClick={() => setConfirmation({ title: 'Confirm Delete', message: `Delete ${item.full_name}? This cannot be undone.`, confirmLabel: 'Delete', loadingLabel: 'Deleting...', kind: 'danger', action: () => deleteEmployee(item.id).unwrap() })}><Trash2 size={14} /></button>
    </div> },
    { key: 'employment_type', label: 'Employment', render: (item) => item.employment_type },
    { key: 'user', label: 'Login Access', render: (item) => item.user ? <div><p className="font-bold">{item.user.email}</p><p className="text-xs capitalize text-[var(--text-muted)]">{item.user.status} · {item.user.roles?.[0]?.name ?? 'No role'}</p></div> : 'No login account' },
    { key: 'documents_count', label: 'Documents', render: (item) => item.documents_count ?? 0 },
  ]

  const advanceColumns: Column<SalaryAdvance>[] = [
    { key: 'advance_number', label: 'Advance Number' },
    { key: 'employee', label: 'Employee', render: (item) => item.employee?.full_name ?? `${item.employee?.first_name ?? ''} ${item.employee?.last_name ?? ''}` },
    { key: 'payment_date', label: 'Paid On', render: (item) => <DateText value={item.payment_date} /> },
    { key: 'amount', label: 'Amount', render: (item) => money(item.amount) },
    { key: 'remaining_amount', label: 'Remaining', render: (item) => <span className="font-extrabold">{money(item.remaining_amount)}</span> },
    { key: 'account', label: 'Account', render: (item) => item.account?.name ?? '-' },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'actions', label: 'Workflow', render: (item) => <div className="flex gap-1.5">
      {item.status === 'pending_review' && isManager ? <AsyncIconButton title="Review" onAction={() => runAction(() => reviewAdvance(item.id).unwrap(), 'Unable to review advance.')}><Send size={14} /></AsyncIconButton> : null}
      {['pending_review', 'pending_approval'].includes(item.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Approve" onClick={() => setConfirmation({ title: 'Approve Salary Advance', message: `Approve ${item.advance_number} for ${item.employee?.full_name ?? 'this employee'}? The account balance will be updated.`, confirmLabel: 'Approve', loadingLabel: 'Approving...', kind: 'approval', action: () => approveAdvance(item.id).unwrap() })}><Check size={14} /></button> : null}
      {['pending_review', 'pending_approval'].includes(item.status) && isAdmin ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Reject" onClick={() => { setError(''); setRejecting({ kind: 'advance', id: item.id }); setRejectionReason('') }}><X size={14} /></button> : null}
      {item.status === 'approved' && isAdmin ? <button type="button" className="icon-button h-8 w-8" title="Reverse" onClick={() => setConfirmation({ title: 'Reverse Salary Advance', message: `Reverse ${item.advance_number}? This will reverse its accounting effect.`, confirmLabel: 'Reverse', loadingLabel: 'Reversing...', kind: 'danger', action: () => cancelAdvance(item.id).unwrap() })}><Trash2 size={14} /></button> : null}
    </div> },
    { key: 'reason', label: 'Reason', render: (item) => item.reason || '-' },
    { key: 'deduction_start_date', label: 'Deduction Starts', render: (item) => <DateText value={item.deduction_start_date} /> },
  ]

  const adjustmentColumns: Column<EmployeeAdjustment>[] = [
    { key: 'adjustment_number', label: 'Reference' },
    { key: 'employee', label: 'Employee', render: (item) => item.employee?.full_name ?? `${item.employee?.first_name ?? ''} ${item.employee?.last_name ?? ''}` },
    { key: 'type', label: 'Type', render: (item) => <FinanceStatus value={item.type} /> },
    { key: 'title', label: 'Reason' },
    { key: 'effective_date', label: 'Payroll Month', render: (item) => <DateText value={item.effective_date} /> },
    { key: 'amount', label: 'Amount', render: (item) => money(item.amount) },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'actions', label: 'Actions', render: (item) => <div className="flex gap-1.5">
      {item.status === 'pending' && isManager ? <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Approve" onClick={() => setConfirmation({ title: 'Approve Salary Adjustment', message: `Approve ${item.adjustment_number} for ${item.employee?.full_name ?? 'this employee'}? It will be included in the next eligible payroll.`, confirmLabel: 'Approve', loadingLabel: 'Approving...', kind: 'approval', action: () => resolveAdjustment({ id: item.id, action: 'approve' }).unwrap() })}><Check size={14} /></button> : null}
      {item.status === 'pending' && isManager ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Reject" onClick={() => { setError(''); setRejecting({ kind: 'adjustment', id: item.id }); setRejectionReason('') }}><X size={14} /></button> : null}
      {!item.payroll_item_id && item.status !== 'applied' ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete" onClick={() => setConfirmation({ title: 'Confirm Delete', message: `Delete ${item.adjustment_number}? This cannot be undone.`, confirmLabel: 'Delete', loadingLabel: 'Deleting...', kind: 'danger', action: () => deleteAdjustment(item.id).unwrap() })}><Trash2 size={14} /></button> : null}
    </div> },
    { key: 'approver', label: 'Approved By', render: (item) => item.approver?.name ?? '-' },
  ]

  const reportColumns: Column<HrReportTableRow>[] = [
    { key: 'employee_number', label: 'Employee ID' },
    { key: 'employee_name', label: 'Employee', render: (item) => <div><p className="font-extrabold text-[var(--text-primary)]">{item.employee_name}</p><p className="text-xs text-[var(--text-muted)]">{item.position || '-'}</p></div> },
    { key: 'department', label: 'Department', render: (item) => item.department || '-' },
    { key: 'present_days', label: 'Present Days' },
    { key: 'absent_days', label: 'Absent Days' },
    { key: 'net_salary', label: 'Net Salary', render: (item) => <span className="font-extrabold">{money(item.net_salary)}</span> },
    { key: 'leave_days', label: 'Leave Days' },
    { key: 'late_minutes', label: 'Late Minutes' },
    { key: 'overtime_minutes', label: 'Overtime Minutes' },
    { key: 'advance_balance', label: 'Advance Balance', render: (item) => money(item.advance_balance) },
    { key: 'average_rating', label: 'Average Rating', render: (item) => item.average_rating == null ? '-' : `${item.average_rating} / 5` },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
  ]

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'employees', label: 'Employees', icon: Users },
    { key: 'structure', label: 'Departments & Positions', icon: Building2 },
    { key: 'advances', label: 'Salary Advances', icon: CircleDollarSign },
    { key: 'adjustments', label: 'Bonuses & Deductions', icon: Gift },
    { key: 'deductions', label: 'Payroll Deductions', icon: ReceiptText },
    { key: 'terminations', label: 'Final Settlements', icon: UserMinus },
    { key: 'reports', label: 'HR Reports', icon: FileBarChart },
  ]
  const dailyHrTabs = tabs.filter((item) => ['employees', 'advances', 'adjustments'].includes(item.key))
  const hrToolTabs = tabs.filter((item) => !['employees', 'advances', 'adjustments'].includes(item.key))

  const exportHrReport = () => {
    if (!report) return
    const rows = [
      ['Employee ID', 'Employee', 'Department', 'Position', 'Present Days', 'Absent Days', 'Leave Days', 'Late Minutes', 'Overtime Minutes', 'Net Salary', 'Advance Balance', 'Average Rating', 'Status'],
      ...report.rows.map((item) => [item.employee_number, item.employee_name, item.department ?? '', item.position ?? '', item.present_days, item.absent_days, item.leave_days, item.late_minutes, item.overtime_minutes, item.net_salary, item.advance_balance, item.average_rating ?? '', item.status]),
    ]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `hr-report-${reportRange.from}-${reportRange.to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const generateReport = () => {
    if (!reportFilters.from || !reportFilters.to || reportFilters.to < reportFilters.from) {
      setError('Choose a valid report date range.')
      return
    }
    setError('')
    if (reportFilters.from === reportRange.from && reportFilters.to === reportRange.to) {
      void refetchReport()
      return
    }
    setReportRange({ ...reportFilters })
  }

  const saveDepartment = () => runAction(async () => {
    if (departmentDraft.id) await updateDepartment({ id: departmentDraft.id, body: departmentDraft }).unwrap()
    else await createDepartment(departmentDraft).unwrap()
    setDepartmentOpen(false)
  }, 'Unable to save department.')

  const savePosition = () => runAction(async () => {
    if (positionDraft.id) await updatePosition({ id: positionDraft.id, body: positionDraft }).unwrap()
    else await createPosition(positionDraft).unwrap()
    setPositionOpen(false)
  }, 'Unable to save position.')

  const saveAdvance = () => runAction(async () => {
    await createAdvance(advanceDraft).unwrap()
    setAdvanceOpen(false)
  }, 'Unable to create salary advance.')

  const saveAdjustment = () => runAction(async () => {
    await createAdjustment(adjustmentDraft).unwrap()
    setAdjustmentOpen(false)
  }, 'Unable to create salary adjustment.')

  return (
    <div className="mx-auto max-w-[1680px] p-6 lg:p-8">
      <PageHeader title="Human Resources" subtitle="Employees, attendance-linked salaries, advances, bonuses, deductions, and employment records">
        {tab === 'employees' ? <button type="button" className="primary-action text-sm" onClick={() => openEmployee()}><Plus size={17} /> Add Employee</button> : null}
        {tab === 'advances' ? <button type="button" className="primary-action text-sm" onClick={openAdvance}><Plus size={17} /> New Advance</button> : null}
        {tab === 'adjustments' ? <button type="button" className="primary-action text-sm" onClick={openAdjustment}><Plus size={17} /> New Adjustment</button> : null}
        {tab === 'reports' ? <button type="button" className="secondary-action text-sm" onClick={exportHrReport} disabled={!report}><Download size={17} /> Export CSV</button> : null}
        {tab === 'reports' ? <button type="button" className="primary-action text-sm" onClick={() => window.print()} disabled={!report}><Printer size={17} /> Print Report</button> : null}
      </PageHeader>
      <PeoplePayrollFlow active="employees" />
      <InlineError message={error || (isError ? 'Unable to load employee records.' : '') || (tab === 'reports' && reportError ? 'Unable to generate HR report.' : '')} />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric label="Active Employees" value={String(summary?.active_employees ?? 0)} hint={`${summary?.total_employees ?? 0} total records`} icon={ContactRound} />
        <FinanceMetric label="Present Today" value={String(summary?.present_today ?? 0)} hint={`${summary?.pending_attendance ?? 0} awaiting approval`} icon={UserCheck} tone="text-[var(--mint)]" />
        <FinanceMetric label="Pending Leave" value={String(summary?.pending_leave ?? 0)} icon={ShieldCheck} tone="text-[var(--gold)]" />
        <FinanceMetric label="Outstanding Advances" value={money(summary?.outstanding_advances)} icon={Banknote} tone="text-[var(--coral)]" />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-3 elegant-divider">
        <div className="flex flex-wrap gap-2">
          {dailyHrTabs.map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => setTab(key)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-extrabold transition ${tab === key ? 'bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}><Icon size={16} />{translate(label)}</button>)}
        </div>
        <label className="flex min-w-52 items-center gap-2 text-xs font-extrabold text-[var(--text-muted)]">
          <span className="shrink-0">{translate('More HR Tools')}</span>
          <select value={hrToolTabs.some((item) => item.key === tab) ? tab : ''} onChange={(event) => { if (event.target.value) setTab(event.target.value as Tab) }} className="field-control h-10 min-w-0 px-3 text-sm font-bold">
            <option value="">{translate('Select tool')}</option>
            {hrToolTabs.map((item) => <option key={item.key} value={item.key}>{translate(item.label)}</option>)}
          </select>
        </label>
      </div>

      {tab === 'employees' ? <DataTable columns={employeeColumns} data={employees} loading={isLoading && employees.length === 0} searchKeys={['employee_number', 'full_name', 'phone', 'email', 'status']} summaryColumnCount={8} /> : null}

      {tab === 'structure' ? <div className="grid gap-6 xl:grid-cols-2">
        <section className="tool-panel overflow-hidden">
          <div className="flex items-center justify-between border-b p-4 elegant-divider"><div><h2 className="font-extrabold">Departments</h2><p className="text-xs text-[var(--text-muted)]">Organizational units</p></div><button type="button" className="secondary-action min-h-0 px-3 py-2 text-xs" onClick={() => openDepartment()}><Plus size={15} /> Department</button></div>
          <div className="divide-y elegant-divider">{newestFirst(structure?.departments).map((item) => <div key={item.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-extrabold">{item.name}</p><p className="text-xs text-[var(--text-muted)]">{item.code} · {item.positions_count ?? 0} positions</p></div><div className="flex gap-1"><button type="button" className="icon-button h-8 w-8" title="Edit department" onClick={() => openDepartment(item)}><Pencil size={14} /></button><button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete department" onClick={() => setConfirmation({ title: 'Confirm Delete', message: `Delete ${item.name}? This cannot be undone.`, confirmLabel: 'Delete', loadingLabel: 'Deleting...', kind: 'danger', action: () => deleteDepartment(item.id).unwrap() })}><Trash2 size={14} /></button></div></div>)}</div>
        </section>
        <section className="tool-panel overflow-hidden">
          <div className="flex items-center justify-between border-b p-4 elegant-divider"><div><h2 className="font-extrabold">Job Positions</h2><p className="text-xs text-[var(--text-muted)]">Employee responsibilities</p></div><button type="button" className="secondary-action min-h-0 px-3 py-2 text-xs" onClick={() => openPosition()}><Plus size={15} /> Position</button></div>
          <div className="divide-y elegant-divider">{newestFirst(structure?.positions).map((item) => <div key={item.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-extrabold">{item.title}</p><p className="text-xs text-[var(--text-muted)]">{item.department?.name ?? 'No department'} · {item.employees_count ?? 0} employees</p></div><div className="flex gap-1"><button type="button" className="icon-button h-8 w-8" title="Edit position" onClick={() => openPosition(item)}><Pencil size={14} /></button><button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete position" onClick={() => setConfirmation({ title: 'Confirm Delete', message: `Delete ${item.title}? This cannot be undone.`, confirmLabel: 'Delete', loadingLabel: 'Deleting...', kind: 'danger', action: () => deletePosition(item.id).unwrap() })}><Trash2 size={14} /></button></div></div>)}</div>
        </section>
      </div> : null}

      {tab === 'advances' ? <DataTable columns={advanceColumns} data={advances} searchKeys={['advance_number', 'status', 'reason']} summaryColumnCount={8} /> : null}
      {tab === 'adjustments' ? <DataTable columns={adjustmentColumns} data={adjustments} searchKeys={['adjustment_number', 'title', 'type', 'status']} summaryColumnCount={8} /> : null}
      {tab === 'deductions' ? <PayrollDeductionPanel employees={employees} /> : null}
      {tab === 'terminations' ? <TerminationPanel employees={employees} /> : null}

      {tab === 'reports' ? <section className="financial-report-print" aria-label="HR report">
        <div className="hidden print:block"><h1 className="text-xl font-extrabold">Water Supply Management System</h1><p className="mt-1 text-sm">HR report: {formatDate(reportRange.from)} to {formatDate(reportRange.to)}</p></div>
        <div className="no-print mb-5 flex flex-col gap-3 border-y py-4 elegant-divider lg:flex-row lg:items-end">
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <FormField label="From" type="date" value={reportFilters.from} onChange={(value) => setReportFilters({ ...reportFilters, from: String(value) })} />
            <FormField label="To" type="date" value={reportFilters.to} onChange={(value) => setReportFilters({ ...reportFilters, to: String(value) })} />
          </div>
          <LoadingButton className="primary-action" loading={reportFetching && !reportLoading} loadingLabel="Generating..." onClick={generateReport}><FileBarChart size={17} /> Generate Report</LoadingButton>
        </div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FinanceMetric label="Employees In Report" value={String(reportRows.length)} hint={`${reportTotals.leave} leave days`} icon={Users} />
          <FinanceMetric label="Present Days" value={String(reportTotals.present)} hint={`${reportTotals.absent} absent days`} icon={UserCheck} tone="text-[var(--mint)]" />
          <FinanceMetric label="Overtime Hours" value={(reportTotals.overtime / 60).toFixed(1)} hint={`${reportRows.reduce((sum, row) => sum + row.late_minutes, 0)} late minutes`} icon={Clock} tone="text-[var(--gold)]" />
          <FinanceMetric label="Net Salary Paid" value={money(reportTotals.salary)} hint={`${money(reportTotals.advances)} advances outstanding`} icon={Banknote} tone="text-[var(--coral)]" />
        </div>
        <div className="no-print">
          <DataTable columns={reportColumns} data={reportRows} loading={reportLoading && reportRows.length === 0} searchKeys={['employee_number', 'employee_name', 'department', 'position', 'status']} summaryColumnCount={6} />
        </div>
        <div className="hidden print:block">
          <table className="w-full text-xs"><thead><tr>{['Employee ID', 'Employee', 'Department', 'Present', 'Absent', 'Leave', 'Late', 'Overtime', 'Net Salary', 'Advance', 'Rating'].map((label) => <th key={label} className="border px-2 py-2 text-start">{label}</th>)}</tr></thead><tbody>{reportRows.map((item) => <tr key={item.id}><td className="border px-2 py-2">{item.employee_number}</td><td className="border px-2 py-2">{item.employee_name}</td><td className="border px-2 py-2">{item.department || '-'}</td><td className="border px-2 py-2">{item.present_days}</td><td className="border px-2 py-2">{item.absent_days}</td><td className="border px-2 py-2">{item.leave_days}</td><td className="border px-2 py-2">{item.late_minutes}</td><td className="border px-2 py-2">{item.overtime_minutes}</td><td className="border px-2 py-2">{money(item.net_salary)}</td><td className="border px-2 py-2">{money(item.advance_balance)}</td><td className="border px-2 py-2">{item.average_rating ?? '-'}</td></tr>)}</tbody></table>
        </div>
        <footer className="mt-8 hidden border-t pt-4 text-xs text-slate-500 print:flex print:justify-between"><span>Generated: {formatDateTime(report?.generated_at)}</span><span>WSMIS Human Resources Report</span></footer>
      </section> : null}

      <Modal isOpen={employeeOpen} onClose={closeEmployee} title={employeeDraft.id ? 'Edit Employee' : 'Register Employee'} size="xl">
        <div className="space-y-5">
          <InlineError message={error} />
          <nav aria-label={translate('Employee registration steps')} className="border-y border-[var(--border-subtle)] py-4">
            <ol className="grid grid-cols-4 gap-1 sm:gap-3">
              {employeeFormSteps.map((step, index) => {
                const StepIcon = step.icon
                const isActive = employeeStep === index
                const isComplete = index < employeeStep
                return <li key={step.label} className="min-w-0"><button type="button" disabled={index > employeeStep} aria-current={isActive ? 'step' : undefined} onClick={() => { if (index < employeeStep) { setEmployeeStep(index); setError('') } }} className={`flex w-full min-w-0 flex-col items-center gap-2 text-center disabled:cursor-default ${isActive ? 'text-[var(--accent)]' : isComplete ? 'text-[var(--mint)]' : 'text-[var(--text-muted)]'}`}><span className={`flex h-9 w-9 items-center justify-center rounded-full border ${isActive ? 'border-[var(--accent)] bg-[var(--accent)] text-white' : isComplete ? 'border-[var(--mint)] bg-[var(--mint-soft)] text-[var(--mint)]' : 'border-[var(--border-strong)] bg-[var(--bg-elevated)]'}`}>{isComplete ? <Check size={16} /> : <StepIcon size={16} />}</span><span className="hidden max-w-full truncate text-xs font-extrabold sm:block">{translate(step.label)}</span></button></li>
              })}
            </ol>
            <p className="mt-3 text-center text-sm font-extrabold text-[var(--text-primary)] sm:hidden">{translate('Step')} {employeeStep + 1} / {employeeFormSteps.length}: {translate(employeeFormSteps[employeeStep].label)}</p>
          </nav>

          {employeeStep === 0 ? <section><div className="mb-3 flex items-center gap-2"><ContactRound size={17} className="text-[var(--accent)]" /><h3 className="text-sm font-extrabold text-[var(--text-primary)]">{translate('Identity & Contact')}</h3></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FormField label="First Name" value={String(employeeDraft.first_name ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, first_name: value })} required />
            <FormField label="Last Name" value={String(employeeDraft.last_name ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, last_name: value })} />
            <FormField label="Father Name" value={String(employeeDraft.father_name ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, father_name: value })} />
            <FormField label="Tazkira Number" value={String(employeeDraft.tazkira_number ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, tazkira_number: value })} />
            <FormField label="Phone" value={String(employeeDraft.phone ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, phone: value })} />
            <FormField label="Gender" type="select" value={String(employeeDraft.gender ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, gender: value })} options={[{ value: 'male', label: 'Male' }, { value: 'female', label: 'Female' }, { value: 'other', label: 'Other' }]} />
            <FormField label="Date of Birth" type="date" value={String(employeeDraft.date_of_birth ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, date_of_birth: value })} />
            <FormField label="Biometric ID" value={String(employeeDraft.biometric_id ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, biometric_id: value })} placeholder="Device employee code" />
            <div className="md:col-span-2 xl:col-span-3"><FormField label="Address / Notes" type="textarea" value={String(employeeDraft.address ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, address: value })} /></div>
          </div></section> : null}

          {employeeStep === 1 ? <section><div className="mb-3 flex items-center gap-2"><BriefcaseBusiness size={17} className="text-[var(--accent)]" /><h3 className="text-sm font-extrabold">{translate('Employment')}</h3></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FormField label="Position" type="select" value={Number(employeeDraft.job_position_id ?? '') || ''} onChange={(value) => setEmployeeDraft({ ...employeeDraft, job_position_id: Number(value) })} options={(structure?.positions ?? []).filter((item) => item.status === 'active').map((item) => ({ value: item.id, label: item.title }))} />
            <FormField label="Assigned Area" type="select" value={Number(employeeDraft.service_area_id ?? '') || ''} onChange={(value) => setEmployeeDraft({ ...employeeDraft, service_area_id: Number(value) })} options={(structure?.service_areas ?? []).map((item) => ({ value: item.id, label: item.name }))} />
            <FormField label="Referred By Shareholder" type="select" value={Number(employeeDraft.referred_by_shareholder_id ?? '') || ''} onChange={(value) => setEmployeeDraft({ ...employeeDraft, referred_by_shareholder_id: Number(value) })} options={(structure?.shareholders ?? []).map((item) => ({ value: item.id, label: `${item.shareholder_number} · ${item.name}` }))} />
            <FormField label="Hire Date" type="date" value={String(employeeDraft.hire_date ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, hire_date: value })} required />
            <FormField label="Employment Type" type="select" value={String(employeeDraft.employment_type ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, employment_type: value })} options={['permanent', 'contract', 'temporary', 'daily'].map((value) => ({ value, label: value }))} required />
            <FormField label="Status" type="select" value={String(employeeDraft.status ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, status: value })} options={(employeeDraft.status === 'terminated' ? ['terminated'] : ['active', 'on_leave', 'suspended']).map((value) => ({ value, label: value.replace('_', ' ') }))} disabled={employeeDraft.status === 'terminated'} required />
          </div></section> : null}

          {employeeStep === 2 ? <section><div className="mb-3 flex items-center gap-2"><WalletCards size={17} className="text-[var(--accent)]" /><h3 className="text-sm font-extrabold">{translate('Salary & Schedule')}</h3></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <FormField label="Salary Type" type="select" value={String(employeeDraft.salary_type ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, salary_type: value })} options={[{ value: 'fixed', label: 'Fixed monthly' }, { value: 'daily', label: 'Daily wage' }, { value: 'attendance', label: 'Based on attendance' }]} required />
            <FormField label="Monthly Salary" type="number" min={0} value={Number(employeeDraft.base_salary ?? 0)} onChange={(value) => setEmployeeDraft({ ...employeeDraft, base_salary: value })} required />
            <FormField label="Daily Rate" type="number" min={0} value={Number(employeeDraft.daily_rate ?? 0)} onChange={(value) => setEmployeeDraft({ ...employeeDraft, daily_rate: value })} />
            <FormField label="Overtime Rate" type="select" value={String(employeeDraft.overtime_rate_mode ?? 'automatic')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, overtime_rate_mode: value, overtime_hourly_rate: value === 'automatic' ? 0 : employeeDraft.overtime_hourly_rate })} options={[{ value: 'automatic', label: 'Automatic' }, { value: 'custom', label: 'Custom' }]} />
            <FormField label="Overtime Hourly Rate" type="number" min={0} value={employeeDraft.overtime_rate_mode === 'custom' ? Number(employeeDraft.overtime_hourly_rate ?? 0) : automaticOvertimeRate(employeeDraft)} onChange={(value) => setEmployeeDraft({ ...employeeDraft, overtime_hourly_rate: value })} disabled={employeeDraft.overtime_rate_mode !== 'custom'} />
            <FormField label="Daily Hours" type="number" value={Number(employeeDraft.standard_daily_hours ?? 8)} onChange={(value) => setEmployeeDraft({ ...employeeDraft, standard_daily_hours: value })} />
            <FormField label="Work Starts" value={String(employeeDraft.work_start_time ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, work_start_time: value })} required />
            <FormField label="Work Ends" value={String(employeeDraft.work_end_time ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, work_end_time: value })} required />
          </div><div className="mt-4"><p className="mb-2 text-sm font-bold text-[var(--text-secondary)]">{translate('Working Days')} *</p><div className="flex flex-wrap gap-2">{weekDays.map((day) => { const selected = (employeeDraft.work_days as number[] ?? []).includes(day.value); return <button key={day.value} type="button" onClick={() => setEmployeeDraft({ ...employeeDraft, work_days: selected ? (employeeDraft.work_days as number[]).filter((value) => value !== day.value) : [...(employeeDraft.work_days as number[] ?? []), day.value] })} className={`h-9 min-w-12 rounded-lg border px-3 text-xs font-extrabold ${selected ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)]'}`}>{translate(day.label)}</button> })}</div></div></section> : null}

          {employeeStep === 3 ? <section className="space-y-5"><div><div className="mb-3 flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><KeyRound size={17} className="text-[var(--accent)]" /><h3 className="text-sm font-extrabold">{translate('Login Credentials')}</h3></div><label className="inline-flex cursor-pointer items-center gap-2 text-sm font-bold text-[var(--text-secondary)]"><input type="checkbox" className="h-4 w-4 accent-[var(--accent)]" checked={loginEnabled} onChange={(event) => { const enabled = event.target.checked; setError(''); setEmployeeDraft((current) => ({ ...current, login_enabled: enabled, login_status: enabled ? 'active' : 'inactive', login_role: enabled ? current.login_role : '', login_password: '', login_password_confirmation: '' })) }} />{translate('Allow Login')}</label></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3"><FormField label={loginEnabled ? 'Email / Login Email' : 'Email'} type="email" value={String(employeeDraft.email ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, email: value })} required={loginEnabled} />{loginEnabled ? <><FormField label="System Role" type="select" value={String(employeeDraft.login_role ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, login_role: value })} options={(structure?.roles ?? []).map((role) => ({ value: role.name, label: role.name }))} required /><FormField label="Login Password" type="password" value={String(employeeDraft.login_password ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, login_password: value })} placeholder={employeeDraft.user_id ? 'Leave blank to keep current password' : 'Minimum 8 characters'} required={!employeeDraft.user_id} /><FormField label="Confirm Login Password" type="password" value={String(employeeDraft.login_password_confirmation ?? '')} onChange={(value) => setEmployeeDraft({ ...employeeDraft, login_password_confirmation: value })} required={Boolean(employeeDraft.login_password)} /></> : null}</div></div>
            <div className="border-t border-[var(--border-subtle)] pt-4"><div className="mb-3 flex items-center gap-2"><ClipboardCheck size={17} className="text-[var(--accent)]" /><h3 className="text-sm font-extrabold">{translate('Review Employee')}</h3></div><dl className="grid gap-x-8 sm:grid-cols-2">{[
              ['Employee', [employeeDraft.first_name, employeeDraft.last_name].filter(Boolean).join(' ') || '-'],
              ['Phone', String(employeeDraft.phone || '-')],
              ['Position', structure?.positions?.find((item) => item.id === Number(employeeDraft.job_position_id))?.title ?? '-'],
              ['Employment Type', String(employeeDraft.employment_type || '-')],
              ['Monthly Salary', money(Number(employeeDraft.base_salary ?? 0))],
              ['Work Schedule', `${employeeDraft.work_start_time ?? '-'} - ${employeeDraft.work_end_time ?? '-'}`],
              ['Login Access', loginEnabled ? `${employeeDraft.email} · ${employeeDraft.login_role}` : translate('No login account')],
            ].map(([label, value]) => <div key={String(label)} className="border-b border-[var(--border-subtle)] py-3"><dt className="text-xs font-extrabold text-[var(--text-muted)]">{translate(String(label))}</dt><dd className="mt-1 break-words text-sm font-extrabold text-[var(--text-primary)]">{value}</dd></div>)}</dl></div>
          </section> : null}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-[var(--border-subtle)] pt-5 sm:flex-row sm:items-center sm:justify-between"><button type="button" className="secondary-action justify-center" onClick={closeEmployee}>{translate('Cancel')}</button><div className="flex justify-end gap-3">{employeeStep > 0 ? <button type="button" className="secondary-action" onClick={() => { setEmployeeStep((step) => Math.max(0, step - 1)); setError('') }}>{direction === 'rtl' ? <ArrowRight size={16} /> : <ArrowLeft size={16} />}{translate('Back')}</button> : null}{employeeStep < employeeFormSteps.length - 1 ? <button type="button" className="primary-action" onClick={continueEmployee}>{translate('Continue')}{direction === 'rtl' ? <ArrowLeft size={16} /> : <ArrowRight size={16} />}</button> : <LoadingButton loading={createEmployeeState.isLoading || updateEmployeeState.isLoading} loadingLabel={employeeDraft.id ? 'Updating...' : 'Saving...'} onClick={saveEmployee}><Check size={16} />{translate('Save Employee')}</LoadingButton>}</div></div>
      </Modal>

      <Modal isOpen={departmentOpen} onClose={() => setDepartmentOpen(false)} title={departmentDraft.id ? 'Edit Department' : 'New Department'} size="sm"><InlineError message={departmentOpen ? error : ''} /><div className="space-y-3"><FormField label="Code" value={departmentDraft.code ?? ''} onChange={(value) => setDepartmentDraft({ ...departmentDraft, code: String(value) })} required /><FormField label="Name" value={departmentDraft.name ?? ''} onChange={(value) => setDepartmentDraft({ ...departmentDraft, name: String(value) })} required /><FormField label="Status" type="select" value={departmentDraft.status ?? 'active'} onChange={(value) => setDepartmentDraft({ ...departmentDraft, status: String(value) as Department['status'] })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /><FormField label="Description" type="textarea" value={departmentDraft.description ?? ''} onChange={(value) => setDepartmentDraft({ ...departmentDraft, description: String(value) })} /></div><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setDepartmentOpen(false)}>Cancel</button><LoadingButton loading={createDepartmentState.isLoading || updateDepartmentState.isLoading} loadingLabel={departmentDraft.id ? 'Updating...' : 'Saving...'} onClick={saveDepartment}>Save</LoadingButton></div></Modal>
      <Modal isOpen={positionOpen} onClose={() => setPositionOpen(false)} title={positionDraft.id ? 'Edit Position' : 'New Position'} size="sm"><InlineError message={positionOpen ? error : ''} /><div className="space-y-3"><FormField label="Department" type="select" value={positionDraft.department_id ?? ''} onChange={(value) => setPositionDraft({ ...positionDraft, department_id: Number(value) })} options={(structure?.departments ?? []).map((item) => ({ value: item.id, label: item.name }))} /><FormField label="Code" value={positionDraft.code ?? ''} onChange={(value) => setPositionDraft({ ...positionDraft, code: String(value) })} required /><FormField label="Title" value={positionDraft.title ?? ''} onChange={(value) => setPositionDraft({ ...positionDraft, title: String(value) })} required /><FormField label="Status" type="select" value={positionDraft.status ?? 'active'} onChange={(value) => setPositionDraft({ ...positionDraft, status: String(value) as JobPosition['status'] })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /><FormField label="Description" type="textarea" value={positionDraft.description ?? ''} onChange={(value) => setPositionDraft({ ...positionDraft, description: String(value) })} /></div><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setPositionOpen(false)}>Cancel</button><LoadingButton loading={createPositionState.isLoading || updatePositionState.isLoading} loadingLabel={positionDraft.id ? 'Updating...' : 'Saving...'} onClick={savePosition}>Save</LoadingButton></div></Modal>
      <Modal isOpen={advanceOpen} onClose={() => setAdvanceOpen(false)} title="New Salary Advance" size="lg"><InlineError message={advanceOpen ? error : ''} /><div className="grid gap-3 md:grid-cols-2"><FormField label="Employee" type="select" value={advanceDraft.employee_id ?? ''} onChange={(value) => setAdvanceDraft({ ...advanceDraft, employee_id: Number(value) })} options={activeEmployees.map((item) => ({ value: item.id, label: `${item.employee_number} · ${item.full_name}` }))} required /><FormField label="Amount" type="number" value={advanceDraft.amount} onChange={(value) => setAdvanceDraft({ ...advanceDraft, amount: Number(value) })} required /><FormField label="Payment Date" type="date" value={advanceDraft.payment_date} onChange={(value) => setAdvanceDraft({ ...advanceDraft, payment_date: String(value), deduction_start_date: String(value) })} required /><FormField label="Deduct From Payroll Starting" type="date" value={advanceDraft.deduction_start_date} onChange={(value) => setAdvanceDraft({ ...advanceDraft, deduction_start_date: String(value) })} required /><FormField label="Payment Method" type="select" value={advanceDraft.payment_method_id ?? ''} onChange={(value) => setAdvanceDraft({ ...advanceDraft, payment_method_id: Number(value), accounting_account_id: '' })} options={methods.map((item) => ({ value: item.id, label: item.name }))} required /><FormField label="Payment Account" type="select" value={advanceDraft.accounting_account_id ?? ''} onChange={(value) => setAdvanceDraft({ ...advanceDraft, accounting_account_id: Number(value) })} options={compatibleAccounts.map((item) => ({ value: item.id, label: `${item.name} · ${money(item.current_balance)}` }))} required /></div><div className="mt-3"><FormField label="Reason" type="textarea" value={advanceDraft.reason} onChange={(value) => setAdvanceDraft({ ...advanceDraft, reason: String(value) })} required /></div><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setAdvanceOpen(false)}>Cancel</button><LoadingButton loading={createAdvanceState.isLoading} loadingLabel="Sending..." onClick={saveAdvance}>Send For Review</LoadingButton></div></Modal>
      <Modal isOpen={adjustmentOpen} onClose={() => setAdjustmentOpen(false)} title="New Bonus or Deduction" size="lg"><InlineError message={adjustmentOpen ? error : ''} /><div className="grid gap-3 md:grid-cols-2"><FormField label="Employee" type="select" value={adjustmentDraft.employee_id ?? ''} onChange={(value) => setAdjustmentDraft({ ...adjustmentDraft, employee_id: Number(value) })} options={activeEmployees.map((item) => ({ value: item.id, label: `${item.employee_number} · ${item.full_name}` }))} required /><FormField label="Type" type="select" value={adjustmentDraft.type} onChange={(value) => setAdjustmentDraft({ ...adjustmentDraft, type: String(value) })} options={[{ value: 'bonus', label: 'Bonus' }, { value: 'deduction', label: 'Deduction' }]} required /><FormField label="Title" value={adjustmentDraft.title} onChange={(value) => setAdjustmentDraft({ ...adjustmentDraft, title: String(value) })} required /><FormField label="Amount" type="number" value={adjustmentDraft.amount} onChange={(value) => setAdjustmentDraft({ ...adjustmentDraft, amount: Number(value) })} required /><FormField label="Effective Date" type="date" value={adjustmentDraft.effective_date} onChange={(value) => setAdjustmentDraft({ ...adjustmentDraft, effective_date: String(value) })} required /></div><div className="mt-3"><FormField label="Notes" type="textarea" value={adjustmentDraft.notes ?? ''} onChange={(value) => setAdjustmentDraft({ ...adjustmentDraft, notes: String(value) })} /></div><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setAdjustmentOpen(false)}>Cancel</button><LoadingButton loading={createAdjustmentState.isLoading} onClick={saveAdjustment}>Save Adjustment</LoadingButton></div></Modal>
      <Modal isOpen={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject HR Record" size="sm"><InlineError message={rejecting ? error : ''} /><FormField label="Rejection Reason" type="textarea" value={rejectionReason} onChange={(value) => setRejectionReason(String(value))} required /><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setRejecting(null)}>Cancel</button><LoadingButton loading={rejectAdvanceState.isLoading || resolveAdjustmentState.isLoading} loadingLabel="Rejecting..." onClick={() => rejecting && runAction(async () => { if (rejecting.kind === 'advance') await rejectAdvance({ id: rejecting.id, rejection_reason: rejectionReason }).unwrap(); else await resolveAdjustment({ id: rejecting.id, action: 'reject', rejection_reason: rejectionReason }).unwrap(); setRejecting(null) }, 'Unable to reject record.')}>Reject</LoadingButton></div></Modal>
      <ConfirmDialog isOpen={Boolean(confirmation)} onClose={() => setConfirmation(null)} onConfirm={() => confirmation?.action() ?? Promise.resolve()} title={confirmation?.title ?? 'Confirm Action'} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel} loadingLabel={confirmation?.loadingLabel} kind={confirmation?.kind} />
    </div>
  )
}
