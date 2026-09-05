'use client'

import { useEffect, useState } from 'react'
import {
  CalendarCheck2, CalendarClock, CalendarOff, Check, Clock3, LogIn, LogOut, Pencil, Plus, Trash2, UploadCloud, UserCheck, X,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PeoplePayrollFlow } from '@/components/hr/PeoplePayrollFlow'
import { LoadingButton } from '@/components/ui/AsyncButton'
import { FinanceMetric, FinanceStatus, InlineError, dateValue, getApiErrorMessage, hasRole } from '@/components/finance/FinanceUI'
import { BiometricImportPanel } from '@/components/hr/BiometricImportPanel'
import { SchedulePanel } from '@/components/hr/SchedulePanel'
import { useTrainingMode } from '@/context/TrainingModeContext'
import { useCalendar } from '@/context/CalendarContext'
import {
  useCancelLeaveRequestMutation,
  useCheckInAttendanceMutation,
  useCheckOutAttendanceMutation,
  useCreateAttendanceRecordMutation,
  useCreateLeaveRequestMutation,
  useDeleteAttendanceRecordMutation,
  useGetAttendanceRecordsQuery,
  useGetEmployeesQuery,
  useGetLeaveRequestsQuery,
  useGetLeavePoliciesQuery,
  useGetMeQuery,
  useGetMyEmployeeProfileQuery,
  useResolveAttendanceRecordMutation,
  useResolveLeaveRequestMutation,
  useUpdateAttendanceRecordMutation,
  type AttendanceRecord,
  type LeaveRequest,
} from '@/src/store/waternetApi'

type Tab = 'attendance' | 'leave' | 'schedule' | 'biometric'

export default function AttendancePage() {
  const { formatDate } = useCalendar()
  const { businessDate } = useTrainingMode()
  const { data: me } = useGetMeQuery()
  const canManage = hasRole(me?.roles, ['HR', 'Manager', 'Admin', 'Super Admin'])
  const canApprove = hasRole(me?.roles, ['Manager', 'Admin', 'Super Admin'])
  const [from, setFrom] = useState(`${businessDate.slice(0, 7)}-01`)
  const [to, setTo] = useState(businessDate)
  const { data: records = [], isLoading, isError } = useGetAttendanceRecordsQuery({ from, to })
  const { data: leave = [] } = useGetLeaveRequestsQuery()
  const { data: employees = [] } = useGetEmployeesQuery(undefined, { skip: !canManage })
  const { data: myEmployee } = useGetMyEmployeeProfileQuery()
  const [createAttendance, createAttendanceState] = useCreateAttendanceRecordMutation()
  const [updateAttendance, updateAttendanceState] = useUpdateAttendanceRecordMutation()
  const [deleteAttendance] = useDeleteAttendanceRecordMutation()
  const [resolveAttendance, resolveAttendanceState] = useResolveAttendanceRecordMutation()
  const [checkIn, checkInState] = useCheckInAttendanceMutation()
  const [checkOut, checkOutState] = useCheckOutAttendanceMutation()
  const [createLeave, createLeaveState] = useCreateLeaveRequestMutation()
  const [resolveLeave, resolveLeaveState] = useResolveLeaveRequestMutation()
  const [cancelLeave] = useCancelLeaveRequestMutation()
  const [tab, setTab] = useState<Tab>('attendance')
  const [attendanceOpen, setAttendanceOpen] = useState(false)
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, string | number>>({ attendance_date: businessDate, attendance_status: 'present', check_in: '08:00', check_out: '16:00' })
  const [leaveOpen, setLeaveOpen] = useState(false)
  const [leaveDraft, setLeaveDraft] = useState<Record<string, string | number>>({ leave_policy_id: '', start_date: businessDate, end_date: businessDate, reason: '' })
  const [leaveAttachment, setLeaveAttachment] = useState<File | null>(null)
  const [rejecting, setRejecting] = useState<{ kind: 'attendance' | 'leave'; id: number } | null>(null)
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
  const leaveYear = Number(String(leaveDraft.start_date).slice(0, 4)) || Number(businessDate.slice(0, 4))
  const selectedLeaveEmployeeId = canManage ? Number(leaveDraft.employee_id || 0) : Number(myEmployee?.id || 0)
  const { data: leavePolicyData } = useGetLeavePoliciesQuery({ year: leaveYear, ...(selectedLeaveEmployeeId ? { employee_id: selectedLeaveEmployeeId } : {}) })
  const supportedLeaveTypes = ['annual', 'sick', 'emergency', 'unpaid']
  const activeLeavePolicies = leavePolicyData?.policies.filter((policy) => policy.status === 'active' && supportedLeaveTypes.includes(policy.code)) ?? []
  const selectedLeavePolicy = activeLeavePolicies.find((policy) => policy.id === Number(leaveDraft.leave_policy_id))
  const selectedLeaveBalance = leavePolicyData?.balances.find((balance) => balance.employee_id === selectedLeaveEmployeeId && balance.leave_policy_id === Number(leaveDraft.leave_policy_id))

  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get('tab')
    if (!requested || !['leave', 'schedule', 'biometric'].includes(requested)) return
    const timer = window.setTimeout(() => setTab(requested as Tab), 0)
    return () => window.clearTimeout(timer)
  }, [])

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    try { await action() } catch (actionError) { setError(getApiErrorMessage(actionError, fallback)) }
  }

  const todayRecord = records.find((record) => record.employee_id === myEmployee?.id && dateValue(record.attendance_date) === businessDate)
  const attendanceSummary = {
    present: records.filter((item) => ['present', 'half_day'].includes(item.attendance_status) && item.approval_status === 'approved').length,
    absent: records.filter((item) => item.attendance_status === 'absent' && item.approval_status === 'approved').length,
    pending: records.filter((item) => item.approval_status === 'pending').length,
    overtime: records.filter((item) => item.approval_status === 'approved').reduce((sum, item) => sum + Number(item.overtime_minutes), 0),
  }

  const openAttendance = (record?: AttendanceRecord) => {
    setError('')
    setAttendanceDraft(record ? {
      id: record.id, employee_id: record.employee_id, attendance_date: dateValue(record.attendance_date),
      attendance_status: record.attendance_status, check_in: record.check_in?.slice(0, 5) ?? '',
      check_out: record.check_out?.slice(0, 5) ?? '', notes: record.notes ?? '',
    } : { attendance_date: businessDate, attendance_status: 'present', check_in: '08:00', check_out: '16:00' })
    setAttendanceOpen(true)
  }

  const saveAttendance = () => runAction(async () => {
    const body: Record<string, unknown> = { ...attendanceDraft }
    if (!body.check_in) delete body.check_in
    if (!body.check_out) delete body.check_out
    if (attendanceDraft.id) await updateAttendance({ id: Number(attendanceDraft.id), body }).unwrap()
    else await createAttendance(body).unwrap()
    setAttendanceOpen(false)
  }, 'Unable to save attendance.')

  const saveLeave = () => runAction(async () => {
    if (leaveAttachment) {
      const body = new FormData()
      Object.entries(leaveDraft).forEach(([key, value]) => body.append(key, String(value)))
      body.append('attachment', leaveAttachment)
      await createLeave(body).unwrap()
    } else {
      await createLeave(leaveDraft).unwrap()
    }
    setLeaveOpen(false)
    setLeaveAttachment(null)
  }, 'Unable to submit leave request.')

  const resolveRejection = () => runAction(async () => {
    if (!rejecting) return
    if (rejecting.kind === 'attendance') await resolveAttendance({ id: rejecting.id, action: 'reject', rejection_reason: rejectionReason }).unwrap()
    else await resolveLeave({ id: rejecting.id, action: 'reject', rejection_reason: rejectionReason }).unwrap()
    setRejecting(null)
  }, 'Unable to reject record.')

  const attendanceColumns: Column<AttendanceRecord>[] = [
    { key: 'attendance_date', label: 'Date', render: (item) => <span className="font-extrabold">{formatDate(item.attendance_date)}</span> },
    { key: 'employee', label: 'Employee', render: (item) => item.employee?.full_name ?? (`${item.employee?.first_name ?? ''} ${item.employee?.last_name ?? ''}`.trim() || '-') },
    { key: 'attendance_status', label: 'Attendance', render: (item) => <FinanceStatus value={item.attendance_status} /> },
    { key: 'check_in', label: 'Check In', render: (item) => item.check_in?.slice(0, 5) ?? '-' },
    { key: 'check_out', label: 'Check Out', render: (item) => item.check_out?.slice(0, 5) ?? '-' },
    { key: 'late_minutes', label: 'Late', render: (item) => `${item.late_minutes} min` },
    { key: 'overtime_minutes', label: 'Overtime', render: (item) => `${item.overtime_minutes} min` },
    { key: 'approval_status', label: 'Approval', render: (item) => <FinanceStatus value={item.approval_status} /> },
    { key: 'actions', label: 'Actions', render: (item) => <div className="flex gap-1.5">
      {canManage && item.source !== 'leave' ? <button type="button" className="icon-button h-8 w-8" title="Edit" onClick={() => openAttendance(item)}><Pencil size={14} /></button> : null}
      {canApprove && ['pending', 'rejected'].includes(item.approval_status) ? <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Approve" onClick={() => setConfirmation({ title: 'Approve Attendance', message: `Approve attendance for ${item.employee?.full_name ?? 'this employee'} on ${formatDate(item.attendance_date)}?`, confirmLabel: 'Approve', loadingLabel: 'Approving...', kind: 'approval', action: () => resolveAttendance({ id: item.id, action: 'approve' }).unwrap() })}><Check size={14} /></button> : null}
      {canApprove && item.approval_status === 'pending' ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Reject" onClick={() => { setError(''); setRejecting({ kind: 'attendance', id: item.id }); setRejectionReason('') }}><X size={14} /></button> : null}
      {item.source !== 'leave' && ((canManage && ['pending', 'rejected'].includes(item.approval_status)) || (canApprove && item.approval_status === 'approved')) ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Delete" onClick={() => setConfirmation({ title: 'Delete Attendance', message: item.approval_status === 'approved' ? `Permanently delete the approved attendance for ${item.employee?.full_name ?? 'this employee'} on ${formatDate(item.attendance_date)}? This is allowed only before payroll uses it.` : `Delete attendance for ${item.employee?.full_name ?? 'this employee'} on ${formatDate(item.attendance_date)}?`, confirmLabel: 'Delete', loadingLabel: 'Deleting...', kind: 'danger', action: () => deleteAttendance(item.id).unwrap() })}><Trash2 size={14} /></button> : null}
    </div> },
    { key: 'source', label: 'Source', render: (item) => item.source.replace('_', ' ') },
    { key: 'approver', label: 'Approved By', render: (item) => item.approver?.name ?? '-' },
    { key: 'notes', label: 'Notes', render: (item) => item.notes || '-' },
  ]

  const leaveColumns: Column<LeaveRequest>[] = [
    { key: 'leave_number', label: 'Request' },
    { key: 'employee', label: 'Employee', render: (item) => item.employee?.full_name ?? (`${item.employee?.first_name ?? ''} ${item.employee?.last_name ?? ''}`.trim() || '-') },
    { key: 'leave_type', label: 'Type', render: (item) => item.policy?.name ?? item.leave_type },
    { key: 'period', label: 'Period', render: (item) => `${formatDate(item.start_date)} - ${formatDate(item.end_date)}` },
    { key: 'total_days', label: 'Days' },
    { key: 'is_paid', label: 'Salary', render: (item) => item.is_paid ? 'Paid leave' : 'Unpaid leave' },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'actions', label: 'Actions', render: (item) => <div className="flex gap-1.5">
      {canApprove && item.status === 'pending' ? <button type="button" className="icon-button h-8 w-8 text-[var(--mint)]" title="Approve" onClick={() => setConfirmation({ title: 'Approve Leave Request', message: `Approve ${item.leave_number} for ${item.employee?.full_name ?? 'this employee'} from ${formatDate(item.start_date)} to ${formatDate(item.end_date)}?`, confirmLabel: 'Approve', loadingLabel: 'Approving...', kind: 'approval', action: () => resolveLeave({ id: item.id, action: 'approve' }).unwrap() })}><Check size={14} /></button> : null}
      {canApprove && item.status === 'pending' ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Reject" onClick={() => { setError(''); setRejecting({ kind: 'leave', id: item.id }); setRejectionReason('') }}><X size={14} /></button> : null}
      {['pending', 'approved'].includes(item.status) ? <button type="button" className="icon-button h-8 w-8 text-[var(--coral)]" title="Cancel leave" onClick={() => setConfirmation({ title: 'Cancel Leave Request', message: `Cancel ${item.leave_number}? Approved leave attendance will also be removed when allowed.`, confirmLabel: 'Cancel Leave', loadingLabel: 'Cancelling...', kind: 'danger', action: () => cancelLeave(item.id).unwrap() })}><Trash2 size={14} /></button> : null}
    </div> },
    { key: 'reason', label: 'Reason' },
    { key: 'reviewer', label: 'Reviewed By', render: (item) => item.reviewer?.name ?? '-' },
  ]

  return (
    <div className="mx-auto max-w-[1680px] p-6 lg:p-8">
      <PageHeader title="Attendance & Leave" subtitle="Daily check-in, approved attendance, overtime, absences, and employee leave">
        {canManage && tab === 'attendance' ? <button type="button" className="primary-action text-sm" onClick={() => openAttendance()}><Plus size={17} /> Add Attendance</button> : null}
        {tab === 'leave' ? <button type="button" className="primary-action text-sm" onClick={() => { setError(''); setLeaveDraft({ leave_policy_id: activeLeavePolicies[0]?.id ?? '', start_date: businessDate, end_date: businessDate, reason: '' }); setLeaveOpen(true) }}><Plus size={17} /> Request Leave</button> : null}
      </PageHeader>
      <PeoplePayrollFlow active="attendance" />
      <InlineError message={error || (isError ? 'Unable to load attendance.' : '')} />

      {myEmployee ? <section className="tool-panel mb-5 flex flex-col gap-4 p-4 md:flex-row md:items-center">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]"><Clock3 size={20} /></div>
        <div className="min-w-0 flex-1"><p className="font-extrabold">My attendance today</p><p className="text-sm text-[var(--text-muted)]">{todayRecord ? `${todayRecord.check_in?.slice(0, 5) ?? 'Not checked in'} · ${todayRecord.check_out?.slice(0, 5) ?? 'Not checked out'} · ${todayRecord.approval_status}` : 'No attendance recorded yet'}</p></div>
        <div className="flex gap-2">{!todayRecord?.check_in ? <LoadingButton className="primary-action text-sm" loading={checkInState.isLoading} loadingLabel="Checking in..." onClick={() => runAction(() => checkIn().unwrap(), 'Unable to check in.')}><LogIn size={17} /> Check In</LoadingButton> : null}{todayRecord?.check_in && !todayRecord.check_out ? <LoadingButton className="primary-action text-sm" loading={checkOutState.isLoading} loadingLabel="Checking out..." onClick={() => runAction(() => checkOut().unwrap(), 'Unable to check out.')}><LogOut size={17} /> Check Out</LoadingButton> : null}</div>
      </section> : null}

      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><FinanceMetric label="Present" value={String(attendanceSummary.present)} icon={UserCheck} tone="text-[var(--mint)]" /><FinanceMetric label="Absent" value={String(attendanceSummary.absent)} icon={CalendarOff} tone="text-[var(--coral)]" /><FinanceMetric label="Awaiting Approval" value={String(attendanceSummary.pending)} icon={CalendarCheck2} tone="text-[var(--gold)]" /><FinanceMetric label="Approved Overtime" value={`${Math.round(attendanceSummary.overtime / 60 * 10) / 10} hrs`} icon={Clock3} /></div>

      <div className="mb-5 space-y-3 border-b pb-3 elegant-divider">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-grid grid-cols-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-muted)] p-1">
            <button type="button" onClick={() => setTab('attendance')} className={`min-h-10 rounded-md px-4 text-sm font-extrabold ${tab === 'attendance' ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-muted)]'}`}>Attendance</button>
            <button type="button" onClick={() => setTab('leave')} className={`min-h-10 rounded-md px-4 text-sm font-extrabold ${tab === 'leave' ? 'bg-[var(--bg-surface)] text-[var(--accent)] shadow-sm' : 'text-[var(--text-muted)]'}`}>Leave Requests</button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setTab('schedule')} className={`secondary-action min-h-10 px-3 py-2 text-xs ${tab === 'schedule' ? 'border-[var(--accent)] text-[var(--accent)]' : ''}`}><CalendarClock size={15} /> Schedule & Holidays</button>
            {canManage ? <button type="button" onClick={() => setTab('biometric')} className={`secondary-action min-h-10 px-3 py-2 text-xs ${tab === 'biometric' ? 'border-[var(--accent)] text-[var(--accent)]' : ''}`}><UploadCloud size={15} /> Electronic Attendance</button> : null}
          </div>
        </div>
        {tab === 'attendance' ? <div className="grid w-full grid-cols-2 gap-2 sm:ms-auto sm:w-[328px]"><div className="min-w-0"><FormField label="From" type="date" value={from} onChange={(value) => setFrom(String(value))} /></div><div className="min-w-0"><FormField label="To" type="date" value={to} onChange={(value) => setTo(String(value))} /></div></div> : null}
      </div>
      {tab === 'attendance' ? <DataTable columns={attendanceColumns} data={records} loading={isLoading && !records.length} searchKeys={['attendance_date', 'attendance_status', 'approval_status', 'source']} summaryColumnCount={9} /> : null}
      {tab === 'leave' ? <DataTable columns={leaveColumns} data={leave} searchKeys={['leave_number', 'leave_type', 'status', 'reason']} summaryColumnCount={8} /> : null}
      {tab === 'schedule' ? <SchedulePanel employees={employees} canManage={canManage} /> : null}
      {tab === 'biometric' && canManage ? <BiometricImportPanel /> : null}

      <Modal isOpen={attendanceOpen} onClose={() => setAttendanceOpen(false)} title={attendanceDraft.id ? 'Edit Attendance' : 'Record Attendance'} size="lg"><InlineError message={attendanceOpen ? error : ''} /><div className="grid gap-3 md:grid-cols-2"><FormField label="Employee" type="select" value={attendanceDraft.employee_id ?? ''} onChange={(value) => setAttendanceDraft({ ...attendanceDraft, employee_id: Number(value) })} options={employees.filter((item) => item.status !== 'terminated').map((item) => ({ value: item.id, label: `${item.employee_number} · ${item.full_name}` }))} required /><FormField label="Date" type="date" value={attendanceDraft.attendance_date} onChange={(value) => setAttendanceDraft({ ...attendanceDraft, attendance_date: String(value) })} required /><FormField label="Status" type="select" value={attendanceDraft.attendance_status} onChange={(value) => setAttendanceDraft({ ...attendanceDraft, attendance_status: String(value) })} options={[{ value: 'present', label: 'Present' }, { value: 'absent', label: 'Absent' }, { value: 'half_day', label: 'Half Day' }, { value: 'holiday', label: 'Holiday' }]} required /><FormField label="Check In (HH:MM)" value={attendanceDraft.check_in ?? ''} onChange={(value) => setAttendanceDraft({ ...attendanceDraft, check_in: String(value) })} /><FormField label="Check Out (HH:MM)" value={attendanceDraft.check_out ?? ''} onChange={(value) => setAttendanceDraft({ ...attendanceDraft, check_out: String(value) })} /></div><div className="mt-3"><FormField label="Notes" type="textarea" value={attendanceDraft.notes ?? ''} onChange={(value) => setAttendanceDraft({ ...attendanceDraft, notes: String(value) })} /></div><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setAttendanceOpen(false)}>Cancel</button><LoadingButton loading={createAttendanceState.isLoading || updateAttendanceState.isLoading} loadingLabel={attendanceDraft.id ? 'Updating...' : 'Saving...'} onClick={saveAttendance}>Save For Approval</LoadingButton></div></Modal>
      <Modal isOpen={leaveOpen} onClose={() => setLeaveOpen(false)} title="Request Leave" size="lg">
        <InlineError message={leaveOpen ? error : ''} />
        <div className="grid gap-3 md:grid-cols-2">
          {canManage ? <FormField label="Employee" type="select" value={leaveDraft.employee_id ?? ''} onChange={(value) => setLeaveDraft({ ...leaveDraft, employee_id: Number(value) })} options={employees.filter((item) => item.status !== 'terminated').map((item) => ({ value: item.id, label: `${item.employee_number} · ${item.full_name}` }))} required /> : null}
          <FormField label="Leave Type" type="select" value={leaveDraft.leave_policy_id} onChange={(value) => setLeaveDraft({ ...leaveDraft, leave_policy_id: Number(value) })} options={activeLeavePolicies.map((policy) => ({ value: policy.id, label: policy.name }))} required />
          <FormField label="Start Date" type="date" value={leaveDraft.start_date} onChange={(value) => setLeaveDraft({ ...leaveDraft, start_date: String(value), end_date: String(value) })} required />
          <FormField label="End Date" type="date" value={leaveDraft.end_date} onChange={(value) => setLeaveDraft({ ...leaveDraft, end_date: String(value) })} required />
        </div>
        {selectedLeavePolicy?.tracks_balance && selectedLeaveBalance ? <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-sm"><span className="font-bold text-[var(--text-muted)]">Available</span><strong className="ms-2 text-[var(--accent)]">{Number(selectedLeaveBalance.available_days).toFixed(1)} days</strong></div> : null}
        {selectedLeavePolicy?.code === 'unpaid' ? <div className="mt-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3"><p className="text-sm font-extrabold text-[var(--text-primary)]">No yearly limit</p><p className="mt-1 text-xs text-[var(--text-muted)]">Approved days will be unpaid.</p></div> : null}
        <div className="mt-3"><FormField label="Reason" type="textarea" value={leaveDraft.reason} onChange={(value) => setLeaveDraft({ ...leaveDraft, reason: String(value) })} required /></div>
        <label className="mt-3 block text-sm font-bold text-[var(--text-secondary)]">Supporting document (optional)<input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={(event) => setLeaveAttachment(event.target.files?.[0] ?? null)} className="field-control mt-1.5 block w-full px-3 py-2 text-sm" /></label>
        <div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setLeaveOpen(false)}>Cancel</button><LoadingButton loading={createLeaveState.isLoading} loadingLabel="Submitting..." onClick={saveLeave}>Submit Request</LoadingButton></div>
      </Modal>
      <Modal isOpen={Boolean(rejecting)} onClose={() => setRejecting(null)} title="Reject Record" size="sm"><InlineError message={rejecting ? error : ''} /><FormField label="Rejection Reason" type="textarea" value={rejectionReason} onChange={(value) => setRejectionReason(String(value))} required /><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setRejecting(null)}>Cancel</button><LoadingButton loading={resolveAttendanceState.isLoading || resolveLeaveState.isLoading} loadingLabel="Rejecting..." onClick={resolveRejection}>Reject</LoadingButton></div></Modal>
      <ConfirmDialog isOpen={Boolean(confirmation)} onClose={() => setConfirmation(null)} onConfirm={() => confirmation?.action() ?? Promise.resolve()} title={confirmation?.title ?? 'Confirm Action'} message={confirmation?.message ?? ''} confirmLabel={confirmation?.confirmLabel} loadingLabel={confirmation?.loadingLabel} kind={confirmation?.kind} />
    </div>
  )
}
