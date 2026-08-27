'use client'

import Link from 'next/link'
import { DragEvent, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  ArrowLeft, Award, BriefcaseBusiness, CalendarClock, Check, Download, FileText, Gauge,
  Pencil, Plus, Star, Trash2, Upload, UserRound, WalletCards,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingButton } from '@/components/ui/AsyncButton'
import { FinanceMetric, FinanceStatus, InlineError, getApiErrorMessage, money } from '@/components/finance/FinanceUI'
import { downloadApiFile } from '@/lib/api'
import { useCalendar } from '@/context/CalendarContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import {
  useCreatePerformanceReviewMutation,
  useDeleteEmployeeDocumentMutation,
  useDeletePerformanceReviewMutation,
  useFinalizePerformanceReviewMutation,
  useGetMeQuery,
  useGetEmployeeQuery,
  useAdjustLeaveBalanceMutation,
  useUploadEmployeeDocumentsMutation,
  type EmployeeLeaveBalance,
  type PerformanceReview,
} from '@/src/store/waternetApi'

type Tab = 'overview' | 'terms' | 'documents' | 'attendance' | 'leave' | 'payroll' | 'performance'
type Confirmation =
  | { kind: 'delete-document'; id: number; name: string }
  | { kind: 'finalize-review' | 'delete-review'; review: PerformanceReview }

export default function EmployeeProfilePage() {
  const { businessDate } = useTrainingMode()
  const { formatDate: dateValue } = useCalendar()
  const params = useParams<{ id: string }>()
  const employeeId = Number(params.id)
  const { data: employee, isLoading, isError } = useGetEmployeeQuery(employeeId)
  const { data: me } = useGetMeQuery()
  const [adjustLeaveBalance, adjustLeaveBalanceState] = useAdjustLeaveBalanceMutation()
  const [uploadDocuments, uploadState] = useUploadEmployeeDocumentsMutation()
  const [deleteDocument] = useDeleteEmployeeDocumentMutation()
  const [createReview, createReviewState] = useCreatePerformanceReviewMutation()
  const [finalizeReview] = useFinalizePerformanceReviewMutation()
  const [deleteReview] = useDeletePerformanceReviewMutation()
  const [tab, setTab] = useState<Tab>('overview')
  const [dragging, setDragging] = useState(false)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [balanceToAdjust, setBalanceToAdjust] = useState<EmployeeLeaveBalance | null>(null)
  const [balanceAdjustment, setBalanceAdjustment] = useState({ adjustment_days: 0, notes: '' })
  const [reviewDraft, setReviewDraft] = useState<Record<string, string | number>>({ period_start: `${businessDate.slice(0, 7)}-01`, period_end: businessDate, rating: 3 })
  const [documentType, setDocumentType] = useState('other')
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    try { await action() } catch (actionError) { setError(getApiErrorMessage(actionError, fallback)) }
  }

  const upload = async (files: File[]) => {
    if (!files.length) return
    const body = new FormData()
    files.slice(0, 10).forEach((file) => body.append('documents[]', file))
    body.append('document_type', documentType)
    await runAction(() => uploadDocuments({ employeeId, body }).unwrap(), 'Unable to upload employee documents.')
  }

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setDragging(false)
    void upload(Array.from(event.dataTransfer.files))
  }

  const saveReview = () => runAction(async () => {
    await createReview({ employeeId, body: reviewDraft }).unwrap()
    setReviewOpen(false)
  }, 'Unable to save performance review.')

  const saveBalanceAdjustment = () => runAction(async () => {
    if (!balanceToAdjust) return
    await adjustLeaveBalance({
      employee_id: employeeId,
      leave_policy_id: balanceToAdjust.leave_policy_id,
      year: balanceToAdjust.year,
      adjustment_days: balanceAdjustment.adjustment_days,
      notes: balanceAdjustment.notes,
    }).unwrap()
    setBalanceToAdjust(null)
  }, 'Unable to adjust leave balance.')

  if (isLoading && !employee) return <div className="mx-auto max-w-[1500px] p-8"><div className="h-72 animate-pulse rounded-lg bg-[var(--bg-elevated)]" /></div>
  if (!employee) return <div className="mx-auto max-w-[1500px] p-8"><InlineError message={isError ? 'Unable to load employee profile.' : 'Employee not found.'} /></div>

  const initials = `${employee.first_name[0] ?? ''}${employee.last_name?.[0] ?? ''}`.toUpperCase()
  const totalAdvance = employee.salary_advances?.reduce((sum, item) => sum + Number(item.remaining_amount), 0) ?? 0
  const latestPayroll = employee.payroll_items?.[0]
  const canManageLeave = me?.roles.some((role) => ['HR', 'Manager', 'Admin', 'Super Admin'].includes(role)) ?? false
  const visibleLeaveBalances = employee.leave_balances?.filter((item) => item.policy?.tracks_balance && ['annual', 'sick', 'emergency'].includes(item.policy.code)) ?? []
  const tabs: { key: Tab; label: string }[] = [
    { key: 'overview', label: 'Overview' }, { key: 'terms', label: 'Employment Terms' }, { key: 'documents', label: 'Documents' },
    { key: 'attendance', label: 'Attendance' }, { key: 'leave', label: 'Leave' },
    { key: 'payroll', label: 'Payroll History' }, { key: 'performance', label: 'Performance' },
  ]

  return (
    <div className="mx-auto max-w-[1500px] p-6 lg:p-8">
      <PageHeader title="Employee Profile" subtitle="Employment, documents, attendance, payroll, and performance history">
        <Link href="/dashboard/hr" className="secondary-action text-sm"><ArrowLeft size={17} /> Employees</Link>
      </PageHeader>
      <InlineError message={error} />

      <section className="tool-panel mb-5 p-5">
        <div className="flex flex-col gap-5 md:flex-row md:items-center">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-2xl font-extrabold text-[var(--accent)] ring-1 ring-[var(--accent)]">{initials}</div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-3"><h1 className="text-2xl font-extrabold text-[var(--text-primary)]">{employee.full_name}</h1><FinanceStatus value={employee.status} /></div>
            <p className="mt-1 font-bold text-[var(--text-secondary)]">{employee.employee_number} · {employee.position?.title ?? 'Position not assigned'}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{employee.position?.department?.name ?? 'No department'} · {employee.service_area?.name ?? 'No service area'}</p>
          </div>
          <div className="grid min-w-[260px] grid-cols-2 gap-3 text-sm"><div><p className="text-xs font-bold text-[var(--text-muted)]">Phone</p><p className="mt-1 font-extrabold">{employee.phone || '-'}</p></div><div><p className="text-xs font-bold text-[var(--text-muted)]">Hired</p><p className="mt-1 font-extrabold">{dateValue(employee.hire_date)}</p></div><div><p className="text-xs font-bold text-[var(--text-muted)]">Login</p><p className="mt-1 truncate font-extrabold">{employee.user?.name ?? 'Not linked'}</p></div><div><p className="text-xs font-bold text-[var(--text-muted)]">Schedule</p><p className="mt-1 font-extrabold">{employee.work_start_time.slice(0, 5)} - {employee.work_end_time.slice(0, 5)}</p></div></div>
        </div>
      </section>

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <FinanceMetric label="Salary" value={employee.salary_type === 'daily' ? `${money(employee.daily_rate)} / day` : money(employee.base_salary)} hint={employee.salary_type.replace('_', ' ')} icon={WalletCards} />
        <FinanceMetric label="Recent Attendance" value={String(employee.attendance_records?.length ?? 0)} hint="Latest 60 records" icon={CalendarClock} tone="text-[var(--mint)]" />
        <FinanceMetric label="Advance Balance" value={money(totalAdvance)} icon={BriefcaseBusiness} tone="text-[var(--gold)]" />
        <FinanceMetric label="Last Net Salary" value={money(latestPayroll?.net_amount)} icon={Gauge} tone="text-[var(--accent)]" />
      </div>

      <div className="mb-5 flex flex-wrap gap-2 border-b pb-3 elegant-divider">{tabs.map((item) => <button key={item.key} type="button" onClick={() => setTab(item.key)} className={`rounded-lg px-3 py-2 text-sm font-extrabold ${tab === item.key ? 'bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]' : 'text-[var(--text-muted)] hover:bg-[var(--bg-elevated)]'}`}>{item.label}</button>)}</div>

      {tab === 'overview' ? <div className="grid gap-5 xl:grid-cols-2">
        <section className="tool-panel p-5"><h2 className="mb-4 flex items-center gap-2 font-extrabold"><UserRound size={18} className="text-[var(--accent)]" /> Personal Information</h2><div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Info label="Father Name" value={employee.father_name} /><Info label="Tazkira" value={employee.tazkira_number} /><Info label="Date of Birth" value={dateValue(employee.date_of_birth)} /><Info label="Gender" value={employee.gender} /><Info label="Email" value={employee.email} /><Info label="Secondary Phone" value={employee.secondary_phone} /><Info label="Biometric ID" value={employee.biometric_id} /><Info label="Address" value={employee.address} wide /><Info label="Emergency Contact" value={[employee.emergency_contact_name, employee.emergency_contact_phone].filter(Boolean).join(' · ')} wide />
        </div></section>
        <section className="tool-panel p-5"><h2 className="mb-4 flex items-center gap-2 font-extrabold"><BriefcaseBusiness size={18} className="text-[var(--accent)]" /> Employment & Salary</h2><div className="grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Info label="Employment Type" value={employee.employment_type} /><Info label="Salary Method" value={employee.salary_type} /><Info label="Monthly Salary" value={money(employee.base_salary)} /><Info label="Daily Rate" value={money(employee.daily_rate)} /><Info label="Overtime Rate" value={`${money(employee.effective_overtime_hourly_rate)} / hour · ${employee.overtime_rate_source}`} /><Info label="Daily Hours" value={String(employee.standard_daily_hours)} /><Info label="Referred By" value={employee.referring_shareholder?.name} /><Info label="Bank Account" value={[employee.bank_name, employee.bank_account_number].filter(Boolean).join(' · ')} /><Info label="Notes" value={employee.notes} wide />
        </div></section>
      </div> : null}

      {tab === 'terms' ? <div className="grid gap-5 xl:grid-cols-2">
        <section className="tool-panel overflow-hidden"><div className="border-b p-4 elegant-divider"><h2 className="font-extrabold">Shift History</h2><p className="text-xs text-[var(--text-muted)]">Dated roster assignments used for attendance</p></div><div className="divide-y elegant-divider">{employee.shift_assignments?.length ? employee.shift_assignments.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-extrabold">{item.shift?.name ?? '-'}</p><p className="text-xs text-[var(--text-muted)]">{item.work_days.join(', ')} working days</p></div><p className="text-sm font-bold">{dateValue(item.effective_from)} - {item.effective_to ? dateValue(item.effective_to) : 'Ongoing'}</p></div>) : <Empty label="No shift assignments." />}</div></section>
        <section className="tool-panel overflow-hidden">
          <div className="border-b p-4 elegant-divider"><h2 className="font-extrabold">Leave Balances</h2><p className="text-xs text-[var(--text-muted)]">Available paid leave for this year</p></div>
          <div className="divide-y elegant-divider">{visibleLeaveBalances.length ? visibleLeaveBalances.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-4 p-4"><div className="min-w-[150px] flex-1"><p className="font-extrabold">{item.policy?.name ?? '-'}</p><p className="text-xs text-[var(--text-muted)]">{item.year}</p></div><div className="text-end"><p className="text-xs font-bold text-[var(--text-muted)]">Used</p><p className="font-extrabold">{Number(item.used_days).toFixed(1)}</p></div><div className="text-end"><p className="text-xs font-bold text-[var(--text-muted)]">Available</p><p className="font-extrabold text-[var(--accent)]">{Number(item.available_days).toFixed(1)}</p></div>{canManageLeave ? <button type="button" className="secondary-action min-h-0 px-3 py-2 text-xs" onClick={() => { setBalanceToAdjust(item); setBalanceAdjustment({ adjustment_days: Number(item.adjustment_days), notes: item.notes ?? '' }) }}><Pencil size={14} /> Adjust</button> : null}</div>) : <Empty label="No leave balances." />}</div>
        </section>
        <section className="tool-panel overflow-hidden"><div className="border-b p-4 elegant-divider"><h2 className="font-extrabold">Recurring Payroll Deductions</h2><p className="text-xs text-[var(--text-muted)]">Tax and recurring rules assigned to this employee</p></div><div className="divide-y elegant-divider">{employee.payroll_deductions?.length ? employee.payroll_deductions.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-extrabold">{item.rule?.name ?? '-'}</p><p className="text-xs text-[var(--text-muted)]">{item.rule?.type} · {item.rule?.calculation_type}</p></div><div className="text-end"><FinanceStatus value={item.status} /><p className="mt-1 text-xs text-[var(--text-muted)]">{dateValue(item.effective_from)} - {item.effective_to ? dateValue(item.effective_to) : 'Ongoing'}</p></div></div>) : <Empty label="No recurring deductions." />}</div></section>
        <section className="tool-panel overflow-hidden"><div className="border-b p-4 elegant-divider"><h2 className="font-extrabold">Final Settlement History</h2><p className="text-xs text-[var(--text-muted)]">Termination and reversal audit records</p></div><div className="divide-y elegant-divider">{employee.terminations?.length ? employee.terminations.map((item) => <div key={item.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-extrabold">{item.termination_number}</p><p className="text-xs text-[var(--text-muted)]">{dateValue(item.last_working_date)} · {item.termination_type.replaceAll('_', ' ')}</p></div><div className="text-end"><FinanceStatus value={item.status} /><p className="mt-1 font-extrabold">{money(item.net_settlement)}</p></div></div>) : <Empty label="No final settlement history." />}</div></section>
      </div> : null}

      {tab === 'documents' ? <section className="tool-panel overflow-hidden">
        <div className="grid gap-4 border-b p-5 elegant-divider md:grid-cols-[220px_1fr]"><FormField label="Document Type" type="select" value={documentType} onChange={(value) => setDocumentType(String(value))} options={['contract', 'tazkira', 'certificate', 'photo', 'guarantee', 'other'].map((value) => ({ value, label: value }))} /><div onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={onDrop} onClick={() => inputRef.current?.click()} className={`flex min-h-24 cursor-pointer items-center justify-center rounded-lg border-2 border-dashed px-5 text-center transition ${dragging ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-[var(--border-subtle)] bg-[var(--bg-elevated)]'}`}><div><Upload className="mx-auto mb-2 text-[var(--accent)]" size={22} /><p className="text-sm font-extrabold">Drop employee files here or click to browse</p><p className="mt-1 text-xs text-[var(--text-muted)]">Up to 10 PDF, image, Word, or Excel files</p></div><input ref={inputRef} className="hidden" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx" onChange={(event) => void upload(Array.from(event.target.files ?? []))} /></div></div>
        {uploadState.isLoading ? <div className="border-b px-5 py-3 text-sm font-bold text-[var(--accent)] elegant-divider">Uploading documents...</div> : null}
        <div className="divide-y elegant-divider">{employee.documents?.length ? employee.documents.map((document) => <div key={document.id} className="flex items-center gap-4 p-4"><span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><FileText size={19} /></span><div className="min-w-0 flex-1"><p className="truncate font-extrabold">{document.original_name}</p><p className="text-xs text-[var(--text-muted)]">{document.document_type} · {(document.size / 1024).toFixed(1)} KB · {dateValue(document.created_at)}</p></div><button type="button" className="icon-button h-9 w-9" title="Download" onClick={() => runAction(() => downloadApiFile(`/employee-documents/${document.id}/download`, document.original_name), 'Unable to download document.')}><Download size={15} /></button><button type="button" className="icon-button h-9 w-9 text-[var(--coral)]" title="Delete" onClick={() => setConfirmation({ kind: 'delete-document', id: document.id, name: document.original_name })}><Trash2 size={15} /></button></div>) : <Empty label="No employee documents uploaded." />}</div>
      </section> : null}

      {tab === 'attendance' ? <section className="tool-panel overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b text-xs uppercase text-[var(--text-muted)] elegant-divider"><tr><Th>Date</Th><Th>Status</Th><Th>Check In</Th><Th>Check Out</Th><Th>Late</Th><Th>Overtime</Th><Th>Approval</Th></tr></thead><tbody>{employee.attendance_records?.map((record) => <tr key={record.id} className="border-b elegant-divider"><Td strong>{dateValue(record.attendance_date)}</Td><Td><FinanceStatus value={record.attendance_status} /></Td><Td>{record.check_in?.slice(0, 5) ?? '-'}</Td><Td>{record.check_out?.slice(0, 5) ?? '-'}</Td><Td>{record.late_minutes} min</Td><Td>{record.overtime_minutes} min</Td><Td><FinanceStatus value={record.approval_status} /></Td></tr>)}</tbody></table>{!employee.attendance_records?.length ? <Empty label="No attendance history." /> : null}</section> : null}

      {tab === 'leave' ? <section className="tool-panel overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="border-b text-xs uppercase text-[var(--text-muted)] elegant-divider"><tr><Th>Request</Th><Th>Type</Th><Th>Period</Th><Th>Days</Th><Th>Paid</Th><Th>Status</Th><Th>Reviewed By</Th></tr></thead><tbody>{employee.leave_requests?.map((leave) => <tr key={leave.id} className="border-b elegant-divider"><Td strong>{leave.leave_number}</Td><Td>{leave.policy?.name ?? leave.leave_type}</Td><Td>{dateValue(leave.start_date)} - {dateValue(leave.end_date)}</Td><Td>{leave.total_days}</Td><Td>{leave.is_paid ? 'Yes' : 'No'}</Td><Td><FinanceStatus value={leave.status} /></Td><Td>{leave.reviewer?.name ?? '-'}</Td></tr>)}</tbody></table>{!employee.leave_requests?.length ? <Empty label="No leave requests." /> : null}</section> : null}

      {tab === 'payroll' ? <section className="tool-panel overflow-x-auto"><table className="w-full min-w-[900px] text-sm"><thead className="border-b text-xs uppercase text-[var(--text-muted)] elegant-divider"><tr><Th>Payroll</Th><Th>Period</Th><Th>Base</Th><Th>Bonus + OT</Th><Th>Deductions</Th><Th>Net</Th><Th>Status</Th></tr></thead><tbody>{employee.payroll_items?.map((item) => <tr key={item.id} className="border-b elegant-divider"><Td strong>{item.payroll_run?.payroll_number ?? '-'}</Td><Td>{dateValue(item.payroll_run?.period_start)} - {dateValue(item.payroll_run?.period_end)}</Td><Td>{money(item.base_salary)}</Td><Td>{money(Number(item.bonus) + Number(item.overtime_amount))}</Td><Td>{money(Number(item.absence_deduction ?? 0) + Number(item.late_deduction ?? 0) + Number(item.advance_deduction) + Number(item.tax_deduction ?? 0) + Number(item.recurring_deduction ?? 0) + Number(item.other_deduction))}</Td><Td strong>{money(item.net_amount)}</Td><Td><FinanceStatus value={item.payment_status ?? item.payroll_run?.status ?? 'pending'} /></Td></tr>)}</tbody></table>{!employee.payroll_items?.length ? <Empty label="No payroll history." /> : null}</section> : null}

      {tab === 'performance' ? <section className="tool-panel overflow-hidden"><div className="flex items-center justify-between border-b p-4 elegant-divider"><div><h2 className="font-extrabold">Performance Reviews</h2><p className="text-xs text-[var(--text-muted)]">Goals, achievements, and concerns remain in the employee history</p></div><button type="button" className="secondary-action min-h-0 px-3 py-2 text-xs" onClick={() => { setReviewDraft({ period_start: `${businessDate.slice(0, 7)}-01`, period_end: businessDate, rating: 3 }); setReviewOpen(true) }}><Plus size={15} /> New Review</button></div><div className="divide-y elegant-divider">{employee.performance_reviews?.length ? employee.performance_reviews.map((review) => <ReviewRow key={review.id} review={review} onFinalize={() => setConfirmation({ kind: 'finalize-review', review })} onDelete={() => setConfirmation({ kind: 'delete-review', review })} />) : <Empty label="No performance reviews." />}</div></section> : null}

      <Modal isOpen={Boolean(balanceToAdjust)} onClose={() => setBalanceToAdjust(null)} title="Adjust Leave Balance" size="sm">
        <InlineError message={balanceToAdjust ? error : ''} />
        <div className="space-y-4">
          <FormField label="Adjustment Days" type="number" value={balanceAdjustment.adjustment_days} onChange={(value) => setBalanceAdjustment({ ...balanceAdjustment, adjustment_days: Number(value) })} min={-365} max={365} required />
          <FormField label="Reason / Notes" type="textarea" value={balanceAdjustment.notes} onChange={(value) => setBalanceAdjustment({ ...balanceAdjustment, notes: String(value) })} />
        </div>
        <div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setBalanceToAdjust(null)}>Cancel</button><LoadingButton className="primary-action" loading={adjustLeaveBalanceState.isLoading} loadingLabel="Saving..." onClick={saveBalanceAdjustment}>Save Adjustment</LoadingButton></div>
      </Modal>
      <Modal isOpen={reviewOpen} onClose={() => setReviewOpen(false)} title="New Performance Review" size="lg"><InlineError message={reviewOpen ? error : ''} /><div className="grid gap-3 md:grid-cols-3"><FormField label="Period Start" type="date" value={reviewDraft.period_start} onChange={(value) => setReviewDraft({ ...reviewDraft, period_start: String(value) })} required /><FormField label="Period End" type="date" value={reviewDraft.period_end} onChange={(value) => setReviewDraft({ ...reviewDraft, period_end: String(value) })} required /><FormField label="Rating" type="number" value={reviewDraft.rating} onChange={(value) => setReviewDraft({ ...reviewDraft, rating: Number(value) })} min={1} max={5} required /></div><div className="mt-3 grid gap-3 md:grid-cols-2"><FormField label="Achievements" type="textarea" value={reviewDraft.achievements ?? ''} onChange={(value) => setReviewDraft({ ...reviewDraft, achievements: String(value) })} /><FormField label="Concerns" type="textarea" value={reviewDraft.concerns ?? ''} onChange={(value) => setReviewDraft({ ...reviewDraft, concerns: String(value) })} /><FormField label="Next Goals" type="textarea" value={reviewDraft.goals ?? ''} onChange={(value) => setReviewDraft({ ...reviewDraft, goals: String(value) })} /><FormField label="Notes" type="textarea" value={reviewDraft.notes ?? ''} onChange={(value) => setReviewDraft({ ...reviewDraft, notes: String(value) })} /></div><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setReviewOpen(false)}>Cancel</button><LoadingButton className="primary-action" loading={createReviewState.isLoading} loadingLabel="Saving..." onClick={saveReview}>Save Draft</LoadingButton></div></Modal>

      <ConfirmDialog
        isOpen={Boolean(confirmation)}
        onClose={() => setConfirmation(null)}
        onConfirm={async () => {
          if (!confirmation) return
          if (confirmation.kind === 'delete-document') {
            await deleteDocument({ id: confirmation.id, employeeId }).unwrap()
          } else if (confirmation.kind === 'finalize-review') {
            await finalizeReview({ id: confirmation.review.id, employeeId }).unwrap()
          } else {
            await deleteReview({ id: confirmation.review.id, employeeId }).unwrap()
          }
        }}
        kind={confirmation?.kind === 'finalize-review' ? 'approval' : 'danger'}
        title={confirmation?.kind === 'delete-document' ? 'Delete Employee Document' : confirmation?.kind === 'finalize-review' ? 'Finalize Performance Review' : 'Delete Performance Review'}
        message={confirmation?.kind === 'delete-document'
          ? `Delete ${confirmation.name}? This file cannot be recovered.`
          : confirmation?.kind === 'finalize-review'
            ? 'Finalize this performance review? It will become part of the employee record and can no longer be edited.'
            : 'Delete this draft performance review? This action cannot be undone.'}
        confirmLabel={confirmation?.kind === 'finalize-review' ? 'Finalize Review' : 'Delete'}
        loadingLabel={confirmation?.kind === 'finalize-review' ? 'Finalizing...' : 'Deleting...'}
      />
    </div>
  )
}

function Info({ label, value, wide = false }: { label: string; value?: string; wide?: boolean }) {
  return <div className={wide ? 'sm:col-span-2' : ''}><p className="text-xs font-bold text-[var(--text-muted)]">{label}</p><p className="mt-1 break-words font-extrabold text-[var(--text-primary)]">{value || '-'}</p></div>
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-4 py-3 text-start">{children}</th> }
function Td({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) { return <td className={`px-4 py-3 ${strong ? 'font-extrabold text-[var(--text-primary)]' : ''}`}>{children}</td> }
function Empty({ label }: { label: string }) { return <div className="p-10 text-center text-sm font-bold text-[var(--text-muted)]">{label}</div> }

function ReviewRow({ review, onFinalize, onDelete }: { review: PerformanceReview; onFinalize: () => void; onDelete: () => void }) {
  const { formatDate: dateValue } = useCalendar()
  return <div className="p-4"><div className="flex flex-wrap items-start gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--gold-soft)] text-[var(--gold)]"><Award size={20} /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-extrabold">{dateValue(review.period_start)} - {dateValue(review.period_end)}</p><FinanceStatus value={review.status} /></div><div className="mt-2 flex gap-1">{[1, 2, 3, 4, 5].map((value) => <Star key={value} size={15} className={value <= review.rating ? 'fill-[var(--gold)] text-[var(--gold)]' : 'text-[var(--border-subtle)]'} />)}</div><p className="mt-2 text-sm text-[var(--text-secondary)]">{review.achievements || review.goals || 'No review notes.'}</p><p className="mt-1 text-xs text-[var(--text-muted)]">Reviewed by {review.reviewer?.name ?? '-'}</p></div>{review.status === 'draft' ? <div className="flex gap-1"><button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Finalize" onClick={onFinalize}><Check size={14} /></button><button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete" onClick={onDelete}><Trash2 size={14} /></button></div> : null}</div></div>
}
