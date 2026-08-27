'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  useCreateCustomerChargeTypeMutation,
  useDeleteCustomerChargeTypeMutation,
  useGetMeQuery,
  useGetSettingsQuery,
  useUpdateCustomerChargeTypeMutation,
  type CustomerChargeType,
} from '@/src/store/waternetApi'

const statusColor = { active: 'emerald', inactive: 'slate' } as const

const apiErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object' || !('data' in error)) return fallback
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } }).data
  const firstValidationError = data?.errors ? Object.values(data.errors).flat()[0] : undefined
  return firstValidationError || data?.message || fallback
}

export default function CustomerChargeTypesPage() {
  const { data, isLoading, isError } = useGetSettingsQuery()
  const { data: currentUser } = useGetMeQuery()
  const [createCustomerChargeType] = useCreateCustomerChargeTypeMutation()
  const [updateCustomerChargeType] = useUpdateCustomerChargeTypeMutation()
  const [deleteCustomerChargeType] = useDeleteCustomerChargeTypeMutation()
  const [current, setCurrent] = useState<Partial<CustomerChargeType>>({})
  const [modalOpen, setModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<CustomerChargeType | null>(null)
  const [error, setError] = useState('')

  const chargeTypes = data?.customer_charge_types ?? []
  const canManage = currentUser?.roles.some((role) => ['Admin', 'Super Admin'].includes(role)) ?? false
  const showSkeleton = isLoading && !data

  const columns: Column<CustomerChargeType>[] = [
    { key: 'name', label: 'Type Name' },
    { key: 'status', label: 'Status', render: (item) => <Badge color={statusColor[item.status]}>{item.status}</Badge> },
    { key: 'is_system', label: 'Kind', render: (item) => <Badge color={item.is_system ? 'blue' : 'slate'}>{item.is_system ? 'System' : 'Custom'}</Badge> },
    { key: 'charges_count', label: 'Used By', render: (item) => `${item.charges_count ?? 0} charges` },
    { key: 'description', label: 'Description' },
  ]

  const openCreate = () => {
    setError('')
    setCurrent({ status: 'active' })
    setModalOpen(true)
  }

  const openEdit = (item: CustomerChargeType) => {
    setError('')
    setCurrent(item)
    setModalOpen(true)
  }

  const save = async () => {
    setError('')
    if (!current.name?.trim()) {
      setError('Enter the charge type name.')
      return
    }

    try {
      if (current.id) {
        await updateCustomerChargeType({ id: current.id, body: current }).unwrap()
      } else {
        await createCustomerChargeType(current).unwrap()
      }
      setModalOpen(false)
      setCurrent({})
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to save customer charge type.'))
    }
  }

  const requestDelete = (item: CustomerChargeType) => {
    setError('')
    if (item.is_system) {
      setError('Required system charge types cannot be deleted.')
      return
    }
    setDeleteTarget(item)
  }

  const remove = async () => {
    if (!deleteTarget) return
    setError('')
    try {
      await deleteCustomerChargeType(deleteTarget.id).unwrap()
      setDeleteTarget(null)
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to delete this setting.'))
      setDeleteTarget(null)
    }
  }

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 p-6 lg:p-8">
      <PageHeader title="Customer Charge Types" subtitle="Manage the types available when staff add a charge to a customer">
        {canManage && (
          <button type="button" onClick={openCreate} className="primary-action text-sm">
            <Plus size={18} /> Add Charge Type
          </button>
        )}
      </PageHeader>

      {(error || isError) && (
        <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
          {error || 'Unable to load customer charge types.'}
        </div>
      )}

      <section id="charge-types">
        <DataTable
          columns={columns}
          data={chargeTypes}
          loading={showSkeleton}
          onEdit={canManage ? openEdit : undefined}
          onDelete={canManage ? requestDelete : undefined}
          searchKeys={['name', 'code', 'status']}
        />
      </section>

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={current.id ? 'Edit Customer Charge Type' : 'Add Customer Charge Type'}>
        {error && <p className="mb-4 text-sm font-bold text-[var(--coral)]">{error}</p>}
        <div className="space-y-4">
          <FormField label="Type Name" value={current.name ?? ''} onChange={(value) => setCurrent({ ...current, name: String(value) })} required />
          <FormField label="Description" type="textarea" value={current.description ?? ''} onChange={(value) => setCurrent({ ...current, description: String(value) })} />
          <FormField
            label="Status"
            type="select"
            value={current.status ?? 'active'}
            onChange={(value) => setCurrent({ ...current, status: value as CustomerChargeType['status'] })}
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
            disabled={Boolean(current.is_system)}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setModalOpen(false)} className="secondary-action">Cancel</button>
          <button type="button" onClick={save} className="primary-action">Save Charge Type</button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={remove}
        title="Delete Charge Type"
        message={`Delete ${deleteTarget?.name}?`}
      />
    </div>
  )
}
