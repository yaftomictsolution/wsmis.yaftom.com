'use client'

import { useState } from 'react'
import { CircleDollarSign, Plus, Tags } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { FormField } from '@/components/ui/FormField'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingButton } from '@/components/ui/AsyncButton'
import { StatsCard } from '@/components/StatsCard'
import { getApiErrorMessage, hasRole } from '@/components/finance/FinanceUI'
import {
  useCreateFinancialCategoryMutation,
  useDeleteFinancialCategoryMutation,
  useGetFinancialCategoriesQuery,
  useGetMeQuery,
  useUpdateFinancialCategoryMutation,
  type FinancialCategory,
} from '@/src/store/waternetApi'

type ExpenseTypeDraft = {
  id?: number
  name: string
  code?: string
  description: string
  status: FinancialCategory['status']
}

const emptyDraft = (): ExpenseTypeDraft => ({
  name: '',
  description: '',
  status: 'active',
})

export default function ExpenseTypesPage() {
  const { data: expenseTypes = [], isLoading, isError } = useGetFinancialCategoriesQuery({ type: 'expense' })
  const { data: me } = useGetMeQuery()
  const [createType, createState] = useCreateFinancialCategoryMutation()
  const [updateType, updateState] = useUpdateFinancialCategoryMutation()
  const [deleteType] = useDeleteFinancialCategoryMutation()
  const [draft, setDraft] = useState<ExpenseTypeDraft>(emptyDraft())
  const [formOpen, setFormOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<FinancialCategory | null>(null)
  const [pageError, setPageError] = useState('')
  const [formError, setFormError] = useState('')

  const canManage = hasRole(me?.roles, ['Admin', 'Super Admin'])
  const activeCount = expenseTypes.filter((type) => type.status === 'active').length
  const usedCount = expenseTypes.filter((type) => Number(type.transactions_count ?? 0) > 0).length

  const columns: Column<FinancialCategory>[] = [
    { key: 'name', label: 'Expense Type', render: (type) => <span className="font-extrabold text-[var(--text-primary)]">{type.name}</span> },
    { key: 'status', label: 'Status', render: (type) => <Badge variant={type.status === 'active' ? 'emerald' : 'slate'}>{type.status}</Badge> },
    { key: 'transactions_count', label: 'Used By', render: (type) => `${Number(type.transactions_count ?? 0)} expenses` },
    { key: 'description', label: 'Description', render: (type) => type.description || '-' },
    { key: 'code', label: 'Code' },
  ]

  const openCreate = () => {
    setDraft(emptyDraft())
    setFormError('')
    setFormOpen(true)
  }

  const openEdit = (type: FinancialCategory) => {
    setDraft({
      id: type.id,
      name: type.name,
      code: type.code,
      description: type.description ?? '',
      status: type.status,
    })
    setFormError('')
    setFormOpen(true)
  }

  const save = async () => {
    setFormError('')
    if (!draft.name.trim()) {
      setFormError('Enter the expense type name.')
      return
    }

    const body: Partial<FinancialCategory> = {
      name: draft.name.trim(),
      code: draft.code,
      description: draft.description.trim() || undefined,
      type: 'expense',
      status: draft.status,
    }

    try {
      if (draft.id) await updateType({ id: draft.id, body }).unwrap()
      else await createType(body).unwrap()
      setFormOpen(false)
      setDraft(emptyDraft())
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Unable to save the expense type.'))
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setPageError('')
    try {
      await deleteType(deleteTarget.id).unwrap()
      setDeleteTarget(null)
    } catch (error) {
      setPageError(getApiErrorMessage(error, 'Unable to delete the expense type.'))
      setDeleteTarget(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-6 p-4 lg:p-8">
      <PageHeader title="Expense Types" subtitle="Manage the categories used when recording expenses">
        {canManage ? (
          <button type="button" onClick={openCreate} className="primary-action text-sm">
            <Plus size={18} /> New Expense Type
          </button>
        ) : null}
      </PageHeader>

      {pageError || isError ? (
        <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
          {pageError || 'Unable to load expense types.'}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-3">
        <StatsCard title="Expense Types" value={expenseTypes.length} icon={<Tags className="h-5 w-5 text-[var(--accent)]" />} />
        <StatsCard title="Active Types" value={activeCount} icon={<CircleDollarSign className="h-5 w-5 text-[var(--mint)]" />} />
        <StatsCard title="Types In Use" value={usedCount} icon={<CircleDollarSign className="h-5 w-5 text-[var(--gold)]" />} />
      </div>

      <DataTable
        columns={columns}
        data={expenseTypes}
        loading={isLoading && expenseTypes.length === 0}
        searchKeys={['name', 'code', 'status']}
        summaryColumnCount={4}
        onEdit={canManage ? openEdit : undefined}
        onDelete={canManage ? setDeleteTarget : undefined}
        emptyMessage="No expense types found"
      />

      <Modal isOpen={formOpen} onClose={() => setFormOpen(false)} title={draft.id ? 'Edit Expense Type' : 'New Expense Type'}>
        <div className="space-y-4">
          {formError ? (
            <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
              {formError}
            </div>
          ) : null}
          <FormField label="Expense Type Name" value={draft.name} onChange={(value) => setDraft({ ...draft, name: String(value) })} required />
          <FormField label="Description" type="textarea" value={draft.description} onChange={(value) => setDraft({ ...draft, description: String(value) })} />
          <FormField
            label="Status"
            type="select"
            value={draft.status}
            onChange={(value) => setDraft({ ...draft, status: value as FinancialCategory['status'] })}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
            ]}
          />
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" className="secondary-action" onClick={() => setFormOpen(false)}>Cancel</button>
            <LoadingButton
              className="primary-action"
              loading={createState.isLoading || updateState.isLoading}
              onClick={() => void save()}
            >
              Save Expense Type
            </LoadingButton>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title="Delete Expense Type"
        message={Number(deleteTarget?.transactions_count ?? 0) > 0
          ? 'This expense type is already in use and cannot be deleted. Set it inactive instead.'
          : `Delete ${deleteTarget?.name ?? 'this expense type'}?`}
        confirmLabel="Delete"
        onConfirm={remove}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
