'use client'

import { Plus, Search, Building2, Phone, MapPin } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { FormField } from '@/components/ui/FormField'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/context/LanguageContext'
import {
  useGetSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
  type Supplier,
} from '@/src/store/waternetApi'
import { StatsCard } from '@/components/StatsCard'
import { useState } from 'react'

const supplierTypeLabels: Record<string, string> = {
  pipe: 'Pipe Supplier',
  meter: 'Meter Supplier',
  chemical: 'Chemical Supplier',
  fuel: 'Fuel Supplier',
  solar: 'Solar Equipment',
  technical: 'Technical Parts',
  other: 'Other',
}

const statusColor: Record<string, string> = {
  active: 'emerald',
  inactive: 'slate',
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as { data?: { message?: string; errors?: Record<string, string[]> } }
  return (apiError.data?.errors ? Object.values(apiError.data.errors).flat()[0] : undefined)
    || apiError.data?.message
    || fallback
}

export default function SuppliersPage() {
  const { t } = useLanguage()
  const [search, setSearch] = useState('')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    name: '',
    supplier_type: '',
    phone: '',
    address: '',
    status: 'active' as Supplier['status'],
    notes: '',
  })

  const { data: suppliersData, isLoading } = useGetSuppliersQuery({ search })
  const [createSupplier, { isLoading: isCreating }] = useCreateSupplierMutation()
  const [updateSupplier, { isLoading: isUpdating }] = useUpdateSupplierMutation()
  const [deleteSupplier] = useDeleteSupplierMutation()

  const suppliers = suppliersData ?? []

  const resetForm = () => {
    setForm({ name: '', supplier_type: '', phone: '', address: '', status: 'active', notes: '' })
    setEditingSupplier(null)
    setError('')
  }

  const openCreate = () => {
    resetForm()
    setIsCreateOpen(true)
  }

  const openEdit = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setForm({
      name: supplier.name,
      supplier_type: supplier.supplier_type ?? '',
      phone: supplier.phone ?? '',
      address: supplier.address ?? '',
      status: supplier.status,
      notes: supplier.notes ?? '',
    })
    setIsCreateOpen(true)
  }

  const handleSubmit = async () => {
    setError('')
    try {
      if (editingSupplier) {
        await updateSupplier({ id: editingSupplier.id, body: form }).unwrap()
      } else {
        await createSupplier(form).unwrap()
      }
      setIsCreateOpen(false)
      resetForm()
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to save the supplier.'))
    }
  }

  const handleDelete = async (id: number) => {
    await deleteSupplier(id).unwrap()
  }

  const columns: Column<Supplier>[] = [
    {
      key: 'name',
      label: 'Name',
      render: (supplier) => (
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[var(--text-muted)]" />
          <span className="font-bold">{supplier.name}</span>
        </div>
      ),
    },
    {
      key: 'supplier_type',
      label: 'Type',
      render: (supplier) => (
        <Badge variant="blue">
          {supplierTypeLabels[supplier.supplier_type ?? 'other'] ?? supplier.supplier_type ?? 'Other'}
        </Badge>
      ),
    },
    {
      key: 'phone',
      label: 'Phone',
      render: (supplier) => (
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-[var(--text-muted)]" />
          <span>{supplier.phone ?? '-'}</span>
        </div>
      ),
    },
    {
      key: 'address',
      label: 'Address',
      render: (supplier) => (
        <div className="flex items-center gap-2">
          <MapPin className="h-4 w-4 text-[var(--text-muted)]" />
          <span className="truncate max-w-[200px]">{supplier.address ?? '-'}</span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      render: (supplier) => (
        <Badge variant={statusColor[supplier.status] as 'emerald' | 'slate'}>
          {supplier.status}
        </Badge>
      ),
    },
  ]

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
      <PageHeader
        title={t('supplierManagement')}
        subtitle={t('manageSuppliers')}
      />

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title={t('totalSuppliers')} value={suppliers.length} icon={<Building2 className="h-5 w-5 text-[var(--accent)]" />} />
        <StatsCard title={t('active')} value={suppliers.filter(s => s.status === 'active').length} icon={<Building2 className="h-5 w-5 text-[var(--mint)]" />} />
        <StatsCard title={t('inactive')} value={suppliers.filter(s => s.status === 'inactive').length} icon={<Building2 className="h-5 w-5 text-[var(--coral)]" />} />
        <StatsCard title={t('supplierTypes')} value={new Set(suppliers.map((supplier) => supplier.supplier_type).filter(Boolean)).size} icon={<Building2 className="h-5 w-5 text-[var(--gold)]" />} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder={t('searchSuppliers')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="field-control h-10 ps-10 pe-3 text-sm w-full"
          />
        </div>
        <button onClick={openCreate} className="btn-primary h-10 px-4 text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" />
          {t('addSupplier')}
        </button>
      </div>

      {/* Table */}
      <div className="elegant-panel p-4">
        <DataTable
          data={suppliers}
          columns={columns}
          isLoading={isLoading}
          searchKeys={['name', 'phone', 'address']}
          onEdit={openEdit}
          onDelete={(s) => setDeleteConfirm(s.id)}
          emptyMessage={t('noSuppliersFound')}
        />
      </div>

      {/* Create/Edit Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => { setIsCreateOpen(false); resetForm() }}
        title={editingSupplier ? t('editSupplier') : t('createNewSupplier')}
      >
        <div className="space-y-4">
          {error && <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{error}</div>}
          <FormField
            label={t('supplierName')}
            value={form.name}
            onChange={(val) => setForm({ ...form, name: String(val) })}
            placeholder={t('ahmadPipesCo')}
            required
          />
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)]">{t('supplierType')}</label>
            <select
              value={form.supplier_type}
              onChange={(e) => setForm({ ...form, supplier_type: e.target.value })}
              className="field-control h-10 px-3 text-sm w-full"
            >
              <option value="">{t('selectType')}</option>
              <option value="pipe">{t('pipeSupplier')}</option>
              <option value="meter">{t('meterSupplier')}</option>
              <option value="chemical">{t('chemicalSupplier')}</option>
              <option value="fuel">{t('fuelSupplier')}</option>
              <option value="solar">{t('solarEquipment')}</option>
              <option value="technical">{t('technicalParts')}</option>
              <option value="other">{t('other')}</option>
            </select>
          </div>
          <FormField
            label={t('phoneNumber')}
            value={form.phone}
            onChange={(val) => setForm({ ...form, phone: String(val) })}
            placeholder="+93 700 000 000"
          />
          <FormField
            label={t('address')}
            value={form.address}
            onChange={(val) => setForm({ ...form, address: String(val) })}
            placeholder={t('kabulAfghanistan')}
            textarea
          />
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)]">{t('status')}</label>
            <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Supplier['status'] })} className="field-control h-10 w-full px-3 text-sm">
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
            </select>
          </div>
          <FormField
            label={t('notes')}
            value={form.notes}
            onChange={(val) => setForm({ ...form, notes: String(val) })}
            placeholder={t('additionalNotesSupplier')}
            textarea
          />
          <div className="flex justify-end gap-3 pt-4">
            <button
              onClick={() => { setIsCreateOpen(false); resetForm() }}
              className="btn-secondary h-10 px-4 text-sm"
            >
              {t('cancel')}
            </button>
            <button
              onClick={handleSubmit}
              disabled={(isCreating || isUpdating) || !form.name}
              className="btn-primary h-10 px-4 text-sm"
            >
              {isCreating || isUpdating ? t('saving') : editingSupplier ? t('update') : t('create')}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm !== null}
        title={t('deleteSupplier')}
        message="Are you sure you want to delete this supplier?"
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)}
        onCancel={() => setDeleteConfirm(null)}
      />
    </div>
  )
}
