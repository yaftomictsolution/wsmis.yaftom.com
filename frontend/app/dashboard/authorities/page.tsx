'use client'

import { BadgeCheck, LoaderCircle, Plus } from 'lucide-react'
import { useState } from 'react'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  useCreateAuthorityMutation,
  useDeleteAuthorityMutation,
  useGetAuthoritiesQuery,
  useUpdateAuthorityMutation,
  type Authority,
} from '@/src/store/waternetApi'

const statusColor = { active: 'emerald', inactive: 'slate' } as const

const apiError = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object' || !('data' in error)) return fallback
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } }).data
  const validationMessage = data?.errors ? Object.values(data.errors).flat()[0] : undefined
  return validationMessage || data?.message || fallback
}

export default function AuthoritiesPage() {
  const { data = [], isLoading, isError } = useGetAuthoritiesQuery()
  const [createAuthority, { isLoading: isCreating }] = useCreateAuthorityMutation()
  const [updateAuthority, { isLoading: isUpdating }] = useUpdateAuthorityMutation()
  const [deleteAuthority] = useDeleteAuthorityMutation()
  const [current, setCurrent] = useState<Partial<Authority>>({})
  const [formOpen, setFormOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [error, setError] = useState('')
  const isSaving = isCreating || isUpdating
  const contractCount = Number(current.contracts_count ?? 0)

  const columns: Column<Authority>[] = [
    { key: 'authority_number', label: 'Authority Number' },
    { key: 'name', label: 'Authority Name' },
    { key: 'father_name', label: 'Father Name', render: (item) => item.father_name || '-' },
    { key: 'title', label: 'Title / Position', render: (item) => item.title || '-' },
    { key: 'phone', label: 'Phone', render: (item) => item.phone || '-' },
    { key: 'contracts_count', label: 'Contracts', render: (item) => Number(item.contracts_count ?? 0) },
    { key: 'status', label: 'Status', render: (item) => <Badge color={statusColor[item.status]}>{item.status}</Badge> },
  ]

  const openForm = (authority?: Authority) => {
    setCurrent(authority ? { ...authority } : { status: 'active' })
    setError('')
    setFormOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setFormOpen(false)
    setCurrent({})
    setError('')
  }

  const save = async () => {
    if (!current.name?.trim()) {
      setError('Enter the authority name.')
      return
    }

    setError('')
    const body = {
      ...current,
      name: current.name.trim(),
      father_name: current.father_name?.trim(),
      title: current.title?.trim(),
      phone: current.phone?.trim(),
      status: current.status ?? 'active',
    }

    try {
      if (current.id) await updateAuthority({ id: current.id, body }).unwrap()
      else await createAuthority(body).unwrap()
      closeForm()
    } catch (requestError) {
      setError(apiError(requestError, 'Unable to save authority.'))
    }
  }

  const remove = async () => {
    if (!current.id) return

    if (contractCount > 0) {
      if (current.status !== 'inactive') {
        await updateAuthority({ id: current.id, body: { ...current, status: 'inactive' } }).unwrap()
      }
    } else {
      await deleteAuthority(current.id).unwrap()
    }
    setCurrent({})
  }

  return (
    <div className="mx-auto max-w-[1600px] p-6 lg:p-8">
      <PageHeader title="Authorities" subtitle="Manage the people allowed to grant customer contract discounts">
        <button type="button" onClick={() => openForm()} className="primary-action text-sm">
          <Plus size={18} /> Add Authority
        </button>
      </PageHeader>

      {(error || isError) && !formOpen && (
        <div role="alert" className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
          {error || 'Unable to load authorities.'}
        </div>
      )}

      <DataTable
        columns={columns}
        data={data}
        loading={isLoading && data.length === 0}
        onEdit={openForm}
        onDelete={(authority) => { setCurrent(authority); setDeleteOpen(true) }}
        searchKeys={['authority_number', 'name', 'father_name', 'title', 'phone', 'status']}
        summaryColumnCount={7}
      />

      <Modal isOpen={formOpen} onClose={closeForm} title={current.id ? 'Edit Authority' : 'Add Authority'} size="lg">
        <div className="space-y-5">
          {error && (
            <div role="alert" className="rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
              {error}
            </div>
          )}
          <div className="flex items-start gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--accent-soft)] p-4">
            <BadgeCheck className="mt-0.5 h-5 w-5 flex-none text-[var(--accent)]" />
            <p className="text-sm font-bold leading-6 text-[var(--text-secondary)]">
              Active authorities appear in the searchable discount dropdown when staff create or edit a customer contract.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label="Authority Name" value={current.name ?? ''} onChange={(value) => setCurrent({ ...current, name: String(value) })} required />
            <FormField label="Father Name" value={current.father_name ?? ''} onChange={(value) => setCurrent({ ...current, father_name: String(value) })} />
            <FormField label="Title / Position" value={current.title ?? ''} onChange={(value) => setCurrent({ ...current, title: String(value) })} />
            <FormField label="Phone" value={current.phone ?? ''} onChange={(value) => setCurrent({ ...current, phone: String(value) })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={closeForm} disabled={isSaving} className="secondary-action disabled:cursor-wait disabled:opacity-60">Cancel</button>
          <button type="button" onClick={save} disabled={isSaving} className="primary-action disabled:cursor-wait disabled:opacity-70">
            {isSaving && <LoaderCircle size={17} className="animate-spin" />}
            {isSaving ? 'Saving Authority...' : 'Save Authority'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={remove}
        title={contractCount > 0 ? 'Deactivate Authority' : 'Delete Authority'}
        message={contractCount > 0
          ? current.status === 'inactive'
            ? `${current.name} is used by ${contractCount} customer contract${contractCount === 1 ? '' : 's'} and is already inactive. Contract history remains protected.`
            : `${current.name} is used by ${contractCount} customer contract${contractCount === 1 ? '' : 's'} and cannot be deleted. Deactivate this authority while preserving contract history?`
          : `Delete ${current.name}? This authority is not used by any customer contract.`}
        confirmLabel={contractCount > 0 ? current.status === 'inactive' ? 'Understood' : 'Deactivate' : 'Delete'}
        loadingLabel={contractCount > 0 ? 'Deactivating...' : 'Deleting...'}
        kind={contractCount > 0 ? 'primary' : 'danger'}
      />
    </div>
  )
}
