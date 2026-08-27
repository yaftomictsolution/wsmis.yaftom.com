'use client'

import { useState } from 'react'
import { CalendarClock, CalendarDays, Plus, UsersRound } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingButton } from '@/components/ui/AsyncButton'
import { FinanceMetric, FinanceStatus, InlineError, dateValue, getApiErrorMessage } from '@/components/finance/FinanceUI'
import { useTrainingMode } from '@/context/TrainingModeContext'
import {
  useCreatePublicHolidayMutation,
  useCreateShiftAssignmentMutation,
  useCreateWorkShiftMutation,
  useDeletePublicHolidayMutation,
  useDeleteShiftAssignmentMutation,
  useDeleteWorkShiftMutation,
  useGetWorkSchedulesQuery,
  useUpdatePublicHolidayMutation,
  useUpdateShiftAssignmentMutation,
  useUpdateWorkShiftMutation,
  type Employee,
  type EmployeeShiftAssignment,
  type PublicHoliday,
  type WorkShift,
} from '@/src/store/waternetApi'

type Props = { employees: Employee[]; canManage: boolean }
type Section = 'shifts' | 'assignments' | 'holidays'
type Draft = Record<string, string | number | number[] | boolean | undefined>
type DeleteTarget = { kind: Section; id: number; label: string }

const days = [{ value: 1, label: 'Mon' }, { value: 2, label: 'Tue' }, { value: 3, label: 'Wed' }, { value: 4, label: 'Thu' }, { value: 5, label: 'Fri' }, { value: 6, label: 'Sat' }, { value: 7, label: 'Sun' }]
const blankShift = (): Draft => ({ code: '', name: '', start_time: '08:00', end_time: '16:00', break_minutes: 60, late_grace_minutes: 10, overtime_after_minutes: 0, status: 'active', notes: '' })
const blankAssignment = (businessDate: string): Draft => ({ employee_id: '', work_shift_id: '', effective_from: businessDate, effective_to: '', work_days: [1, 2, 3, 4, 5, 6], notes: '' })
const blankHoliday = (businessDate: string): Draft => ({ holiday_date: businessDate, name: '', is_paid: true, status: 'active', notes: '' })

export function SchedulePanel({ employees, canManage }: Props) {
  const { businessDate } = useTrainingMode()
  const { data, isLoading, isError } = useGetWorkSchedulesQuery()
  const [section, setSection] = useState<Section>('assignments')
  const [createShift, createShiftState] = useCreateWorkShiftMutation()
  const [updateShift, updateShiftState] = useUpdateWorkShiftMutation()
  const [deleteShift] = useDeleteWorkShiftMutation()
  const [createAssignment, createAssignmentState] = useCreateShiftAssignmentMutation()
  const [updateAssignment, updateAssignmentState] = useUpdateShiftAssignmentMutation()
  const [deleteAssignment] = useDeleteShiftAssignmentMutation()
  const [createHoliday, createHolidayState] = useCreatePublicHolidayMutation()
  const [updateHoliday, updateHolidayState] = useUpdatePublicHolidayMutation()
  const [deleteHoliday] = useDeletePublicHolidayMutation()
  const [shiftOpen, setShiftOpen] = useState(false)
  const [shiftDraft, setShiftDraft] = useState<Draft>(blankShift())
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [assignmentDraft, setAssignmentDraft] = useState<Draft>(blankAssignment(businessDate))
  const [holidayOpen, setHolidayOpen] = useState(false)
  const [holidayDraft, setHolidayDraft] = useState<Draft>(blankHoliday(businessDate))
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  const [error, setError] = useState('')

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    try { await action() } catch (actionError) { setError(getApiErrorMessage(actionError, fallback)) }
  }
  const shifts = data?.shifts ?? []
  const assignments = data?.assignments ?? []
  const holidays = data?.holidays ?? []
  const activeShifts = shifts.filter((item) => item.status === 'active')

  const openShift = (item?: WorkShift) => { setError(''); setShiftDraft(item ? { ...item, start_time: item.start_time.slice(0, 5), end_time: item.end_time.slice(0, 5) } : blankShift()); setShiftOpen(true) }
  const openAssignment = (item?: EmployeeShiftAssignment) => { setAssignmentDraft(item ? {
    id: item.id, employee_id: item.employee_id, work_shift_id: item.work_shift_id, work_days: item.work_days,
    effective_from: dateValue(item.effective_from), effective_to: item.effective_to ? dateValue(item.effective_to) : '', notes: item.notes ?? '',
  } : blankAssignment(businessDate)); setError(''); setAssignmentOpen(true) }
  const openHoliday = (item?: PublicHoliday) => { setError(''); setHolidayDraft(item ? { ...item, holiday_date: dateValue(item.holiday_date) } : blankHoliday(businessDate)); setHolidayOpen(true) }

  const saveShift = () => runAction(async () => {
    if (!shiftDraft.code || !shiftDraft.name) throw new Error('Shift code and name are required.')
    const body = { ...shiftDraft } as Partial<WorkShift>
    if (shiftDraft.id) await updateShift({ id: Number(shiftDraft.id), body }).unwrap()
    else await createShift(body).unwrap()
    setShiftOpen(false)
  }, 'Unable to save work shift.')
  const saveAssignment = () => runAction(async () => {
    if (!assignmentDraft.employee_id || !assignmentDraft.work_shift_id || !(assignmentDraft.work_days as number[])?.length) throw new Error('Employee, shift, and working days are required.')
    const body = { ...assignmentDraft }
    if (assignmentDraft.id) await updateAssignment({ id: Number(assignmentDraft.id), body }).unwrap()
    else await createAssignment(body).unwrap()
    setAssignmentOpen(false)
  }, 'Unable to save shift assignment.')
  const saveHoliday = () => runAction(async () => {
    if (!holidayDraft.name || !holidayDraft.holiday_date) throw new Error('Holiday name and date are required.')
    const body = { ...holidayDraft } as Partial<PublicHoliday>
    if (holidayDraft.id) await updateHoliday({ id: Number(holidayDraft.id), body }).unwrap()
    else await createHoliday(body).unwrap()
    setHolidayOpen(false)
  }, 'Unable to save public holiday.')

  const shiftColumns: Column<WorkShift>[] = [
    { key: 'name', label: 'Shift', render: (item) => <div><p className="font-extrabold text-[var(--text-primary)]">{item.name}</p><p className="text-xs text-[var(--text-muted)]">{item.code}</p></div> },
    { key: 'hours', label: 'Hours', render: (item) => `${item.start_time.slice(0, 5)} - ${item.end_time.slice(0, 5)}` },
    { key: 'break_minutes', label: 'Break', render: (item) => `${item.break_minutes} min` },
    { key: 'late_grace_minutes', label: 'Late Grace', render: (item) => `${item.late_grace_minutes} min` },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'overtime_after_minutes', label: 'Overtime Starts After', render: (item) => `${item.overtime_after_minutes} min` },
    { key: 'assignments_count', label: 'Assignments', render: (item) => item.assignments_count ?? 0 },
  ]
  const assignmentColumns: Column<EmployeeShiftAssignment>[] = [
    { key: 'employee', label: 'Employee', render: (item) => <div><p className="font-extrabold text-[var(--text-primary)]">{item.employee?.full_name || `${item.employee?.first_name ?? ''} ${item.employee?.last_name ?? ''}`}</p><p className="text-xs text-[var(--text-muted)]">{item.employee?.employee_number}</p></div> },
    { key: 'shift', label: 'Shift', render: (item) => item.shift?.name ?? '-' },
    { key: 'work_days', label: 'Working Days', render: (item) => item.work_days.map((day) => days.find((option) => option.value === day)?.label).filter(Boolean).join(', ') },
    { key: 'effective_from', label: 'Effective From', render: (item) => <DateText value={item.effective_from} /> },
    { key: 'effective_to', label: 'Effective To', render: (item) => <DateText value={item.effective_to} empty="Ongoing" /> },
    { key: 'assigner', label: 'Assigned By', render: (item) => item.assigner?.name ?? '-' },
  ]
  const holidayColumns: Column<PublicHoliday>[] = [
    { key: 'holiday_date', label: 'Date', render: (item) => <DateText value={item.holiday_date} className="font-extrabold" /> },
    { key: 'name', label: 'Public Holiday' },
    { key: 'is_paid', label: 'Payroll Treatment', render: (item) => item.is_paid ? 'Paid holiday' : 'Unpaid holiday' },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'notes', label: 'Notes', render: (item) => item.notes || '-' },
  ]

  const remove = () => {
    if (!deleting) return Promise.resolve()
    if (deleting.kind === 'shifts') return deleteShift(deleting.id).unwrap()
    if (deleting.kind === 'assignments') return deleteAssignment(deleting.id).unwrap()
    return deleteHoliday(deleting.id).unwrap()
  }

  return (
    <div className="space-y-5">
      <InlineError message={error || (isError ? 'Unable to load shifts and public holidays.' : '')} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"><FinanceMetric label="Active Shifts" value={String(activeShifts.length)} icon={CalendarClock} /><FinanceMetric label="Roster Assignments" value={String(assignments.length)} icon={UsersRound} /><FinanceMetric label="Public Holidays" value={String(holidays.filter((item) => item.status === 'active').length)} icon={CalendarDays} tone="text-[var(--mint)]" /></div>
      <div className="flex flex-wrap gap-2 border-b pb-3 elegant-divider">{([{ key: 'assignments', label: 'Employee Roster', icon: UsersRound }, { key: 'shifts', label: 'Work Shifts', icon: CalendarClock }, { key: 'holidays', label: 'Public Holidays', icon: CalendarDays }] as const).map(({ key, label, icon: Icon }) => <button key={key} type="button" onClick={() => setSection(key)} className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-extrabold ${section === key ? 'bg-[var(--accent-soft)] text-[var(--accent)] ring-1 ring-[var(--accent)]' : 'text-[var(--text-muted)]'}`}><Icon size={16} />{label}</button>)}</div>

      {section === 'shifts' ? <section className="tool-panel overflow-hidden"><div className="flex items-center justify-between gap-3 border-b p-4 elegant-divider"><div><h2 className="font-extrabold">Work Shifts</h2><p className="text-xs text-[var(--text-muted)]">Hours, break, grace, and overtime rules</p></div>{canManage ? <button type="button" className="secondary-action min-h-0 px-3 py-2 text-xs" onClick={() => openShift()}><Plus size={15} /> New Shift</button> : null}</div><DataTable columns={shiftColumns} data={shifts} loading={isLoading} searchKeys={['code', 'name', 'status']} summaryColumnCount={5} onEdit={canManage ? openShift : undefined} onDelete={canManage ? (item) => setDeleting({ kind: 'shifts', id: item.id, label: item.name }) : undefined} /></section> : null}
      {section === 'assignments' ? <section className="tool-panel overflow-hidden"><div className="flex items-center justify-between gap-3 border-b p-4 elegant-divider"><div><h2 className="font-extrabold">Employee Roster</h2><p className="text-xs text-[var(--text-muted)]">Effective shift and working days by employee</p></div>{canManage ? <button type="button" className="secondary-action min-h-0 px-3 py-2 text-xs" onClick={() => openAssignment()}><Plus size={15} /> Assign Shift</button> : null}</div><DataTable columns={assignmentColumns} data={assignments} loading={isLoading} searchKeys={['effective_from', 'effective_to']} summaryColumnCount={5} onEdit={canManage ? openAssignment : undefined} onDelete={canManage ? (item) => setDeleting({ kind: 'assignments', id: item.id, label: item.employee?.full_name ?? 'shift assignment' }) : undefined} /></section> : null}
      {section === 'holidays' ? <section className="tool-panel overflow-hidden"><div className="flex items-center justify-between gap-3 border-b p-4 elegant-divider"><div><h2 className="font-extrabold">Public Holidays</h2><p className="text-xs text-[var(--text-muted)]">Paid and unpaid company holidays used by attendance and payroll</p></div>{canManage ? <button type="button" className="secondary-action min-h-0 px-3 py-2 text-xs" onClick={() => openHoliday()}><Plus size={15} /> Add Holiday</button> : null}</div><DataTable columns={holidayColumns} data={holidays} loading={isLoading} searchKeys={['holiday_date', 'name', 'status']} summaryColumnCount={4} onEdit={canManage ? openHoliday : undefined} onDelete={canManage ? (item) => setDeleting({ kind: 'holidays', id: item.id, label: item.name }) : undefined} /></section> : null}

      <Modal isOpen={shiftOpen} onClose={() => setShiftOpen(false)} title={shiftDraft.id ? 'Edit Work Shift' : 'New Work Shift'} size="lg"><InlineError message={shiftOpen ? error : ''} /><div className="grid gap-3 md:grid-cols-2"><FormField label="Code" value={String(shiftDraft.code ?? '')} onChange={(value) => setShiftDraft({ ...shiftDraft, code: value })} required /><FormField label="Shift Name" value={String(shiftDraft.name ?? '')} onChange={(value) => setShiftDraft({ ...shiftDraft, name: value })} required /><FormField label="Start Time" value={String(shiftDraft.start_time)} onChange={(value) => setShiftDraft({ ...shiftDraft, start_time: value })} required /><FormField label="End Time" value={String(shiftDraft.end_time)} onChange={(value) => setShiftDraft({ ...shiftDraft, end_time: value })} required /><FormField label="Break Minutes" type="number" min={0} max={240} value={Number(shiftDraft.break_minutes)} onChange={(value) => setShiftDraft({ ...shiftDraft, break_minutes: value })} /><FormField label="Late Grace Minutes" type="number" min={0} max={120} value={Number(shiftDraft.late_grace_minutes)} onChange={(value) => setShiftDraft({ ...shiftDraft, late_grace_minutes: value })} /><FormField label="Overtime Grace Minutes" type="number" min={0} max={240} value={Number(shiftDraft.overtime_after_minutes)} onChange={(value) => setShiftDraft({ ...shiftDraft, overtime_after_minutes: value })} /><FormField label="Status" type="select" value={String(shiftDraft.status)} onChange={(value) => setShiftDraft({ ...shiftDraft, status: value })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></div><div className="mt-3"><FormField label="Notes" type="textarea" value={String(shiftDraft.notes ?? '')} onChange={(value) => setShiftDraft({ ...shiftDraft, notes: value })} /></div><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setShiftOpen(false)}>Cancel</button><LoadingButton loading={createShiftState.isLoading || updateShiftState.isLoading} loadingLabel={shiftDraft.id ? 'Updating...' : 'Saving...'} onClick={saveShift}>Save Shift</LoadingButton></div></Modal>

      <Modal isOpen={assignmentOpen} onClose={() => setAssignmentOpen(false)} title={assignmentDraft.id ? 'Edit Shift Assignment' : 'Assign Employee Shift'} size="lg"><InlineError message={assignmentOpen ? error : ''} /><div className="grid gap-3 md:grid-cols-2"><FormField label="Employee" type="select" value={assignmentDraft.employee_id as string | number} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, employee_id: Number(value) })} options={employees.filter((item) => item.status !== 'terminated').map((item) => ({ value: item.id, label: `${item.employee_number} · ${item.full_name}` }))} required /><FormField label="Work Shift" type="select" value={assignmentDraft.work_shift_id as string | number} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, work_shift_id: Number(value) })} options={activeShifts.map((item) => ({ value: item.id, label: `${item.name} · ${item.start_time.slice(0, 5)}-${item.end_time.slice(0, 5)}` }))} required /><FormField label="Effective From" type="date" value={String(assignmentDraft.effective_from)} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, effective_from: value })} required /><FormField label="Effective To" type="date" value={String(assignmentDraft.effective_to ?? '')} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, effective_to: value })} /></div><div className="mt-4"><p className="mb-2 text-sm font-bold text-[var(--text-secondary)]">Working Days *</p><div className="flex flex-wrap gap-2">{days.map((day) => { const selected = (assignmentDraft.work_days as number[] ?? []).includes(day.value); return <button key={day.value} type="button" onClick={() => setAssignmentDraft({ ...assignmentDraft, work_days: selected ? (assignmentDraft.work_days as number[]).filter((value) => value !== day.value) : [...(assignmentDraft.work_days as number[] ?? []), day.value] })} className={`h-9 min-w-12 rounded-lg border px-3 text-xs font-extrabold ${selected ? 'border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]' : 'border-[var(--border-subtle)] text-[var(--text-muted)]'}`}>{day.label}</button> })}</div></div><div className="mt-3"><FormField label="Notes" type="textarea" value={String(assignmentDraft.notes ?? '')} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, notes: value })} /></div><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setAssignmentOpen(false)}>Cancel</button><LoadingButton loading={createAssignmentState.isLoading || updateAssignmentState.isLoading} loadingLabel={assignmentDraft.id ? 'Updating...' : 'Saving...'} onClick={saveAssignment}>Save Assignment</LoadingButton></div></Modal>

      <Modal isOpen={holidayOpen} onClose={() => setHolidayOpen(false)} title={holidayDraft.id ? 'Edit Public Holiday' : 'Add Public Holiday'} size="md"><InlineError message={holidayOpen ? error : ''} /><div className="space-y-3"><FormField label="Holiday Name" value={String(holidayDraft.name ?? '')} onChange={(value) => setHolidayDraft({ ...holidayDraft, name: value })} required /><FormField label="Holiday Date" type="date" value={String(holidayDraft.holiday_date)} onChange={(value) => setHolidayDraft({ ...holidayDraft, holiday_date: value })} required /><FormField label="Status" type="select" value={String(holidayDraft.status)} onChange={(value) => setHolidayDraft({ ...holidayDraft, status: value })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /><label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-3 py-2.5 text-sm font-bold"><input type="checkbox" checked={Boolean(holidayDraft.is_paid)} onChange={(event) => setHolidayDraft({ ...holidayDraft, is_paid: event.target.checked })} className="h-4 w-4 accent-[var(--accent)]" />Paid Holiday</label><FormField label="Notes" type="textarea" value={String(holidayDraft.notes ?? '')} onChange={(value) => setHolidayDraft({ ...holidayDraft, notes: value })} /></div><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setHolidayOpen(false)}>Cancel</button><LoadingButton loading={createHolidayState.isLoading || updateHolidayState.isLoading} loadingLabel={holidayDraft.id ? 'Updating...' : 'Saving...'} onClick={saveHoliday}>Save Holiday</LoadingButton></div></Modal>

      <ConfirmDialog isOpen={Boolean(deleting)} onClose={() => setDeleting(null)} onConfirm={remove} title="Confirm Delete" message={`Delete ${deleting?.label ?? 'this record'}? Historical records may need to be made inactive instead.`} loadingLabel="Deleting..." />
    </div>
  )
}
