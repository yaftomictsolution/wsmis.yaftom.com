'use client'

import { useMemo, useState } from 'react'
import { LoaderCircle, Plus, Trash2 } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  useCreateServiceAreaMutation,
  useDeleteServiceAreaMutation,
  useGetServiceAreasQuery,
  useUpdateServiceAreaMutation,
  type ServiceArea,
  type ServiceAreaMosque,
} from '@/src/store/waternetApi'

const statusColor = { active: 'emerald', inactive: 'slate' } as const

const apiError = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object' || !('data' in error)) return fallback

  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } }).data
  if (data?.errors) {
    const first = Object.values(data.errors).flat()[0]
    if (first) return first
  }

  return data?.message || fallback
}

const editableMosques = (area?: ServiceArea): ServiceAreaMosque[] => {
  if (area?.mosques?.length) return area.mosques.map((mosque) => ({ ...mosque }))
  if (area?.mosque_name) return [{ name: area.mosque_name, status: 'active' }]
  return [{ name: '', status: 'active' }]
}

export default function ServiceAreasPage() {
  const { data = [], isLoading, isError } = useGetServiceAreasQuery()
  const [createServiceArea, { isLoading: isCreating }] = useCreateServiceAreaMutation()
  const [updateServiceArea, { isLoading: isUpdating }] = useUpdateServiceAreaMutation()
  const [deleteServiceArea] = useDeleteServiceAreaMutation()
  const [current, setCurrent] = useState<Partial<ServiceArea>>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [error, setError] = useState('')
  const showSkeleton = isLoading && data.length === 0
  const isSaving = isCreating || isUpdating
  const tableData = useMemo(() => data.map((area) => ({
    ...area,
    mosque_names: area.mosques?.map((mosque) => mosque.name).join(' ') || area.mosque_name || '',
  })), [data])

  const columns: Column<ServiceArea>[] = [
    { key: 'name', label: 'Area' },
    {
      key: 'mosque_names',
      label: 'Mosques',
      render: (item) => {
        const mosques = item.mosques?.length
          ? item.mosques
          : item.mosque_name
            ? [{ name: item.mosque_name, status: 'active' as const }]
            : []

        if (!mosques.length) return '-'

        return (
          <div className="flex max-w-sm flex-wrap gap-1.5">
            {mosques.slice(0, 3).map((mosque, index) => (
              <span key={mosque.id ?? `${mosque.name}-${index}`} className="rounded border border-[var(--border-subtle)] bg-[var(--bg-muted)] px-2 py-1 text-xs font-bold text-[var(--text-secondary)]">
                {mosque.name}
              </span>
            ))}
            {mosques.length > 3 && (
              <span className="px-1 py-1 text-xs font-extrabold text-[var(--accent)]">+{mosques.length - 3}</span>
            )}
          </div>
        )
      },
    },
    { key: 'representative_name', label: 'Representative', render: (item) => item.representative_name || '-' },
    { key: 'households_count', label: 'Homes' },
    { key: 'rate_per_cubic_meter', label: 'Rate', render: (item) => `AFN ${Number(item.rate_per_cubic_meter).toLocaleString()} / m3` },
    { key: 'status', label: 'Status', render: (item) => <Badge color={statusColor[item.status]}>{item.status}</Badge> },
  ]

  const openForm = (area?: ServiceArea) => {
    setCurrent(area
      ? { ...area, mosques: editableMosques(area) }
      : { status: 'active', rate_per_cubic_meter: 0, households_count: 0, mosques: editableMosques() })
    setError('')
    setIsModalOpen(true)
  }

  const closeForm = () => {
    if (isSaving) return
    setIsModalOpen(false)
    setCurrent({})
    setError('')
  }

  const save = async () => {
    setError('')
    const mosques = (current.mosques ?? [])
      .map((mosque) => ({ ...mosque, name: mosque.name.trim() }))
      .filter((mosque) => mosque.name.length > 0)
    const normalizedNames = mosques.map((mosque) => mosque.name.toLocaleLowerCase())

    if (!current.name?.trim()) {
      setError('Enter the service area name.')
      return
    }
    if (new Set(normalizedNames).size !== normalizedNames.length) {
      setError('Mosque names must be unique within the service area.')
      return
    }

    try {
      const body = { ...current, name: current.name.trim(), mosques }
      if (current.id) {
        await updateServiceArea({ id: current.id, body }).unwrap()
      } else {
        await createServiceArea(body).unwrap()
      }
      setIsModalOpen(false)
      setCurrent({})
    } catch (requestError) {
      setError(apiError(requestError, 'Unable to save service area.'))
    }
  }

  const remove = async () => {
    if (!current.id) return

    if (Number(current.customers_count ?? 0) > 0) {
      if (current.status !== 'inactive') {
        await updateServiceArea({
          id: current.id,
          body: {
            status: 'inactive',
            inactive_reason: current.inactive_reason?.trim()
              || 'Deactivated because registered customers are assigned to this service area.',
          },
        }).unwrap()
      }
    } else {
      await deleteServiceArea(current.id).unwrap()
    }

    setCurrent({})
  }

  const addMosque = () => {
    setCurrent((area) => ({
      ...area,
      mosques: [...(area.mosques ?? []), { name: '', status: 'active' }],
    }))
  }

  const updateMosque = (index: number, changes: Partial<ServiceAreaMosque>) => {
    setCurrent((area) => ({
      ...area,
      mosques: (area.mosques ?? []).map((mosque, mosqueIndex) => (
        mosqueIndex === index ? { ...mosque, ...changes } : mosque
      )),
    }))
    setError('')
  }

  const removeMosque = (index: number) => {
    setCurrent((area) => ({
      ...area,
      mosques: (area.mosques ?? []).filter((_, mosqueIndex) => mosqueIndex !== index),
    }))
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Service Areas" subtitle="Manage zones, mosques, streets and water rates">
        <button type="button" onClick={() => openForm()} className="primary-action text-sm">
          <Plus size={18} /> Add Area
        </button>
      </PageHeader>

      {(error || isError) && !isModalOpen && (
        <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
          {error || 'Unable to load service areas.'}
        </div>
      )}

      <DataTable
        columns={columns}
        data={tableData}
        loading={showSkeleton}
        onEdit={openForm}
        onDelete={(item) => { setCurrent(item); setIsDeleteOpen(true) }}
        searchKeys={['name', 'mosque_names', 'representative_name']}
      />

      <Modal isOpen={isModalOpen} onClose={closeForm} title={current.id ? 'Edit Service Area' : 'Add Service Area'} size="xl">
        <div className="space-y-5">
          {error && (
            <div role="alert" className="rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField label="Area Name" value={current.name ?? ''} onChange={(value) => setCurrent({ ...current, name: String(value) })} required />
            <FormField label="District / Guzar" value={current.district ?? ''} onChange={(value) => setCurrent({ ...current, district: String(value) })} />
            <FormField label="Street / Block / Village" value={current.street_block_village ?? ''} onChange={(value) => setCurrent({ ...current, street_block_village: String(value) })} />
            <FormField label="Representative" value={current.representative_name ?? ''} onChange={(value) => setCurrent({ ...current, representative_name: String(value) })} />
            <FormField label="Representative Phone" value={current.representative_phone ?? ''} onChange={(value) => setCurrent({ ...current, representative_phone: String(value) })} />
            <FormField label="Households Count" type="number" value={current.households_count ?? 0} onChange={(value) => setCurrent({ ...current, households_count: Number(value) })} min={0} />
            <FormField label="Rate Per m3" type="number" value={current.rate_per_cubic_meter ?? 0} onChange={(value) => setCurrent({ ...current, rate_per_cubic_meter: Number(value) })} min={0} />
            <FormField label="Status" type="select" value={current.status ?? 'active'} onChange={(value) => setCurrent({ ...current, status: String(value) as ServiceArea['status'] })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
            <FormField label="Inactive Reason" value={current.inactive_reason ?? ''} onChange={(value) => setCurrent({ ...current, inactive_reason: String(value) })} />
            <div className="md:col-span-2">
              <FormField label="Notes" type="textarea" value={current.notes ?? ''} onChange={(value) => setCurrent({ ...current, notes: String(value) })} />
            </div>
          </div>

          <section className="border-t border-[var(--border-subtle)] pt-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-[var(--text-primary)]">Mosques in this Service Area</h3>
                <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">Add every mosque that belongs to this area.</p>
              </div>
              <button type="button" onClick={addMosque} className="secondary-action min-h-0 px-3 py-2 text-sm">
                <Plus size={16} /> Add Mosque
              </button>
            </div>

            {(current.mosques ?? []).length === 0 ? (
              <button type="button" onClick={addMosque} className="w-full border border-dashed border-[var(--border-color)] px-4 py-5 text-sm font-bold text-[var(--text-muted)] transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]">
                <Plus className="mx-auto mb-2 h-5 w-5" /> Add the first mosque
              </button>
            ) : (
              <div className="space-y-3">
                {(current.mosques ?? []).map((mosque, index) => (
                  <div key={mosque.id ?? `new-mosque-${index}`} className="grid grid-cols-1 items-end gap-3 border-b border-[var(--border-subtle)] pb-3 last:border-0 sm:grid-cols-[minmax(0,1fr)_130px_42px]">
                    <FormField label={`Mosque ${index + 1}`} value={mosque.name} onChange={(value) => updateMosque(index, { name: String(value) })} placeholder="Enter mosque name" />
                    <FormField
                      label="Status"
                      type="select"
                      value={mosque.status}
                      onChange={(value) => updateMosque(index, { status: String(value) as ServiceAreaMosque['status'] })}
                      options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
                    />
                    <button type="button" onClick={() => removeMosque(index)} className="icon-button mb-0.5 text-[var(--coral)]" title="Remove mosque" aria-label={`Remove mosque ${index + 1}`}>
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={closeForm} disabled={isSaving} className="secondary-action disabled:cursor-wait disabled:opacity-60">Cancel</button>
          <button type="button" onClick={save} disabled={isSaving} className="primary-action disabled:cursor-wait disabled:opacity-70">
            {isSaving && <LoaderCircle size={17} className="animate-spin" />}
            {isSaving ? 'Saving Area...' : 'Save Area'}
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={remove}
        title={Number(current.customers_count ?? 0) > 0 ? 'Deactivate Service Area' : 'Delete Service Area'}
        message={Number(current.customers_count ?? 0) > 0
          ? current.status === 'inactive'
            ? `${current.name} has ${current.customers_count} registered customer${Number(current.customers_count) === 1 ? '' : 's'} and cannot be deleted. It is already inactive, so its customer history remains protected.`
            : `${current.name} has ${current.customers_count} registered customer${Number(current.customers_count) === 1 ? '' : 's'} and cannot be deleted. Deactivate it to prevent new use while preserving all customer history.`
          : `Delete ${current.name}? This area has no registered customers.`}
        confirmLabel={Number(current.customers_count ?? 0) > 0
          ? current.status === 'inactive' ? 'Understood' : 'Deactivate'
          : 'Delete'}
        loadingLabel={Number(current.customers_count ?? 0) > 0 ? 'Deactivating...' : 'Deleting...'}
        kind={Number(current.customers_count ?? 0) > 0 ? 'primary' : 'danger'}
      />
    </div>
  )
}
