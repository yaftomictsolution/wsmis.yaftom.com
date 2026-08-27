'use client'

import { useState } from 'react'
import { Landmark, Percent, Plus, ReceiptText } from 'lucide-react'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingButton } from '@/components/ui/AsyncButton'
import { FinanceMetric, FinanceStatus, InlineError, dateValue, getApiErrorMessage, money } from '@/components/finance/FinanceUI'
import { useTrainingMode } from '@/context/TrainingModeContext'
import {
  useCreateEmployeePayrollDeductionMutation,
  useCreatePayrollDeductionRuleMutation,
  useDeleteEmployeePayrollDeductionMutation,
  useDeletePayrollDeductionRuleMutation,
  useGetPayrollDeductionsQuery,
  useUpdateEmployeePayrollDeductionMutation,
  useUpdatePayrollDeductionRuleMutation,
  type Employee,
  type EmployeePayrollDeduction,
  type PayrollDeductionRule,
} from '@/src/store/waternetApi'

type Props = { employees: Employee[] }
type Draft = Record<string, string | number | undefined>
type DeleteTarget = { kind: 'rule'; item: PayrollDeductionRule } | { kind: 'assignment'; item: EmployeePayrollDeduction }

const blankRule = (): Draft => ({ code: '', name: '', type: 'tax', calculation_type: 'percentage', value: 0, threshold_amount: 0, maximum_amount: '', status: 'active', description: '' })
const blankAssignment = (businessDate: string): Draft => ({ employee_id: '', payroll_deduction_rule_id: '', override_value: '', effective_from: businessDate, effective_to: '', status: 'active', notes: '' })

export function PayrollDeductionPanel({ employees }: Props) {
  const { businessDate } = useTrainingMode()
  const { data, isLoading, isError } = useGetPayrollDeductionsQuery()
  const [createRule, createRuleState] = useCreatePayrollDeductionRuleMutation()
  const [updateRule, updateRuleState] = useUpdatePayrollDeductionRuleMutation()
  const [deleteRule] = useDeletePayrollDeductionRuleMutation()
  const [createAssignment, createAssignmentState] = useCreateEmployeePayrollDeductionMutation()
  const [updateAssignment, updateAssignmentState] = useUpdateEmployeePayrollDeductionMutation()
  const [deleteAssignment] = useDeleteEmployeePayrollDeductionMutation()
  const [ruleOpen, setRuleOpen] = useState(false)
  const [ruleDraft, setRuleDraft] = useState<Draft>(blankRule())
  const [assignmentOpen, setAssignmentOpen] = useState(false)
  const [assignmentDraft, setAssignmentDraft] = useState<Draft>(blankAssignment(businessDate))
  const [deleting, setDeleting] = useState<DeleteTarget | null>(null)
  const [error, setError] = useState('')

  const runAction = async (action: () => Promise<unknown>, fallback: string) => {
    setError('')
    try { await action() } catch (actionError) { setError(getApiErrorMessage(actionError, fallback)) }
  }

  const openRule = (item?: PayrollDeductionRule) => {
    setError('')
    setRuleDraft(item ? { ...item, maximum_amount: item.maximum_amount ?? '' } : blankRule())
    setRuleOpen(true)
  }
  const openAssignment = (item?: EmployeePayrollDeduction) => {
    setError('')
    setAssignmentDraft(item ? {
      id: item.id, employee_id: item.employee_id, payroll_deduction_rule_id: item.payroll_deduction_rule_id,
      effective_from: dateValue(item.effective_from), effective_to: item.effective_to ? dateValue(item.effective_to) : '',
      override_value: item.override_value ?? '', status: item.status, notes: item.notes ?? '',
    } : blankAssignment(businessDate))
    setAssignmentOpen(true)
  }

  const saveRule = () => runAction(async () => {
    if (!ruleDraft.code || !ruleDraft.name) throw new Error('Code and deduction name are required.')
    const body = { ...ruleDraft } as Partial<PayrollDeductionRule>
    if (ruleDraft.id) await updateRule({ id: Number(ruleDraft.id), body }).unwrap()
    else await createRule(body).unwrap()
    setRuleOpen(false)
  }, 'Unable to save payroll deduction rule.')

  const saveAssignment = () => runAction(async () => {
    if (!assignmentDraft.employee_id || !assignmentDraft.payroll_deduction_rule_id || !assignmentDraft.effective_from) throw new Error('Employee, rule, and effective date are required.')
    const body = { ...assignmentDraft }
    if (assignmentDraft.id) await updateAssignment({ id: Number(assignmentDraft.id), body }).unwrap()
    else await createAssignment(body).unwrap()
    setAssignmentOpen(false)
  }, 'Unable to save employee payroll deduction.')

  const rules = data?.rules ?? []
  const assignments = data?.assignments ?? []
  const activeRules = rules.filter((item) => item.status === 'active')
  const taxAssignments = assignments.filter((item) => item.status === 'active' && item.rule?.type === 'tax').length

  const ruleColumns: Column<PayrollDeductionRule>[] = [
    { key: 'name', label: 'Deduction Rule', render: (item) => <div><p className="font-extrabold text-[var(--text-primary)]">{item.name}</p><p className="text-xs text-[var(--text-muted)]">{item.code}</p></div> },
    { key: 'type', label: 'Type', render: (item) => <FinanceStatus value={item.type} /> },
    { key: 'value', label: 'Calculation', render: (item) => item.calculation_type === 'percentage' ? `${Number(item.value).toFixed(2)}%` : money(item.value) },
    { key: 'threshold_amount', label: 'Starts Above', render: (item) => money(item.threshold_amount) },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'maximum_amount', label: 'Maximum', render: (item) => item.maximum_amount ? money(item.maximum_amount) : 'No maximum' },
    { key: 'employee_deductions_count', label: 'Employees', render: (item) => item.employee_deductions_count ?? 0 },
  ]

  const assignmentColumns: Column<EmployeePayrollDeduction>[] = [
    { key: 'employee', label: 'Employee', render: (item) => <div><p className="font-extrabold text-[var(--text-primary)]">{item.employee?.full_name || `${item.employee?.first_name ?? ''} ${item.employee?.last_name ?? ''}`}</p><p className="text-xs text-[var(--text-muted)]">{item.employee?.employee_number}</p></div> },
    { key: 'rule', label: 'Rule', render: (item) => item.rule?.name ?? '-' },
    { key: 'override_value', label: 'Applied Value', render: (item) => { const value = item.override_value ?? item.rule?.value ?? 0; return item.rule?.calculation_type === 'percentage' ? `${Number(value).toFixed(2)}%` : money(value) } },
    { key: 'effective_from', label: 'Effective From', render: (item) => <DateText value={item.effective_from} /> },
    { key: 'status', label: 'Status', render: (item) => <FinanceStatus value={item.status} /> },
    { key: 'effective_to', label: 'Effective To', render: (item) => <DateText value={item.effective_to} empty="Ongoing" /> },
    { key: 'assigner', label: 'Assigned By', render: (item) => item.assigner?.name ?? '-' },
  ]

  return (
    <div className="space-y-5">
      <InlineError message={error || (isError ? 'Unable to load payroll deductions.' : '')} />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><FinanceMetric label="Active Rules" value={String(activeRules.length)} icon={ReceiptText} /><FinanceMetric label="Employee Assignments" value={String(assignments.filter((item) => item.status === 'active').length)} icon={Landmark} /><FinanceMetric label="Tax Assignments" value={String(taxAssignments)} icon={Percent} tone="text-[var(--gold)]" /><FinanceMetric label="Recurring Rules" value={String(activeRules.filter((item) => item.type !== 'tax').length)} icon={ReceiptText} tone="text-[var(--mint)]" /></div>

      <section className="tool-panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 elegant-divider"><div><h2 className="font-extrabold">Deduction Rules</h2><p className="text-xs text-[var(--text-muted)]">Fixed or percentage tax, insurance, pension, and recurring deductions</p></div><button type="button" className="secondary-action min-h-0 px-3 py-2 text-xs" onClick={() => openRule()}><Plus size={15} /> New Rule</button></div><DataTable columns={ruleColumns} data={rules} loading={isLoading} searchKeys={['code', 'name', 'type', 'status']} summaryColumnCount={5} onEdit={openRule} onDelete={(item) => setDeleting({ kind: 'rule', item })} /></section>

      <section className="tool-panel overflow-hidden"><div className="flex flex-wrap items-center justify-between gap-3 border-b p-4 elegant-divider"><div><h2 className="font-extrabold">Employee Deductions</h2><p className="text-xs text-[var(--text-muted)]">Rules are snapshotted into each payroll for a complete audit trail</p></div><button type="button" className="secondary-action min-h-0 px-3 py-2 text-xs" onClick={() => openAssignment()}><Plus size={15} /> Assign Deduction</button></div><DataTable columns={assignmentColumns} data={assignments} loading={isLoading} searchKeys={['effective_from', 'effective_to', 'status']} summaryColumnCount={5} onEdit={openAssignment} onDelete={(item) => setDeleting({ kind: 'assignment', item })} /></section>

      <Modal isOpen={ruleOpen} onClose={() => setRuleOpen(false)} title={ruleDraft.id ? 'Edit Deduction Rule' : 'New Deduction Rule'} size="lg">
        <InlineError message={ruleOpen ? error : ''} />
        <div className="grid gap-3 md:grid-cols-2"><FormField label="Code" value={String(ruleDraft.code ?? '')} onChange={(value) => setRuleDraft({ ...ruleDraft, code: value })} required /><FormField label="Name" value={String(ruleDraft.name ?? '')} onChange={(value) => setRuleDraft({ ...ruleDraft, name: value })} required /><FormField label="Type" type="select" value={String(ruleDraft.type)} onChange={(value) => setRuleDraft({ ...ruleDraft, type: value })} options={[{ value: 'tax', label: 'Tax' }, { value: 'insurance', label: 'Insurance' }, { value: 'pension', label: 'Pension' }, { value: 'other', label: 'Other' }]} required /><FormField label="Calculation" type="select" value={String(ruleDraft.calculation_type)} onChange={(value) => setRuleDraft({ ...ruleDraft, calculation_type: value, value: 0 })} options={[{ value: 'percentage', label: 'Percentage' }, { value: 'fixed', label: 'Fixed Amount' }]} required /><FormField label={ruleDraft.calculation_type === 'percentage' ? 'Percentage' : 'Fixed Amount'} type="number" min={0} max={ruleDraft.calculation_type === 'percentage' ? 100 : undefined} value={Number(ruleDraft.value)} onChange={(value) => setRuleDraft({ ...ruleDraft, value })} required /><FormField label="Apply Above Salary" type="number" min={0} value={Number(ruleDraft.threshold_amount)} onChange={(value) => setRuleDraft({ ...ruleDraft, threshold_amount: value })} /><FormField label="Maximum Deduction" type="number" min={0} value={ruleDraft.maximum_amount as string | number} onChange={(value) => setRuleDraft({ ...ruleDraft, maximum_amount: value })} /><FormField label="Status" type="select" value={String(ruleDraft.status)} onChange={(value) => setRuleDraft({ ...ruleDraft, status: value })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /></div><div className="mt-3"><FormField label="Description" type="textarea" value={String(ruleDraft.description ?? '')} onChange={(value) => setRuleDraft({ ...ruleDraft, description: value })} /></div><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setRuleOpen(false)}>Cancel</button><LoadingButton className="primary-action" loading={createRuleState.isLoading || updateRuleState.isLoading} loadingLabel="Saving..." onClick={saveRule}>Save Rule</LoadingButton></div>
      </Modal>

      <Modal isOpen={assignmentOpen} onClose={() => setAssignmentOpen(false)} title={assignmentDraft.id ? 'Edit Employee Deduction' : 'Assign Employee Deduction'} size="lg">
        <InlineError message={assignmentOpen ? error : ''} />
        <div className="grid gap-3 md:grid-cols-2"><FormField label="Employee" type="select" value={assignmentDraft.employee_id as string | number} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, employee_id: Number(value) })} options={employees.filter((item) => item.status !== 'terminated').map((item) => ({ value: item.id, label: `${item.employee_number} · ${item.full_name}` }))} required /><FormField label="Deduction Rule" type="select" value={assignmentDraft.payroll_deduction_rule_id as string | number} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, payroll_deduction_rule_id: Number(value), override_value: '' })} options={activeRules.map((item) => ({ value: item.id, label: `${item.name} · ${item.calculation_type === 'percentage' ? `${item.value}%` : money(item.value)}` }))} required /><FormField label="Override Value" type="number" min={0} value={assignmentDraft.override_value as string | number} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, override_value: value })} /><FormField label="Status" type="select" value={String(assignmentDraft.status)} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, status: value })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} /><FormField label="Effective From" type="date" value={String(assignmentDraft.effective_from)} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, effective_from: value })} required /><FormField label="Effective To" type="date" value={String(assignmentDraft.effective_to ?? '')} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, effective_to: value })} /></div><div className="mt-3"><FormField label="Notes" type="textarea" value={String(assignmentDraft.notes ?? '')} onChange={(value) => setAssignmentDraft({ ...assignmentDraft, notes: value })} /></div><div className="mt-5 flex justify-end gap-3"><button className="secondary-action" onClick={() => setAssignmentOpen(false)}>Cancel</button><LoadingButton className="primary-action" loading={createAssignmentState.isLoading || updateAssignmentState.isLoading} loadingLabel="Saving..." onClick={saveAssignment}>Save Assignment</LoadingButton></div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return
          if (deleting.kind === 'rule') await deleteRule(deleting.item.id).unwrap()
          else await deleteAssignment(deleting.item.id).unwrap()
        }}
        title="Delete Payroll Deduction"
        message="Delete this record? Records already used by payroll must be made inactive instead."
        loadingLabel="Deleting..."
      />
    </div>
  )
}
