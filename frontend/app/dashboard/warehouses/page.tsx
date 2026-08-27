'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Building2, AlertTriangle, ArrowRight, Boxes, CircleDollarSign } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/context/LanguageContext'
import {
  useGetWarehousesQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
  useDeleteWarehouseMutation,
  useGetWarehouseDetailsQuery,
  type Warehouse,
} from '@/src/store/waternetApi'
import { StatsCard } from '@/components/StatsCard'

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

function formatAmount(value: number | string | undefined): string {
  return `AFN ${Number(value ?? 0).toLocaleString()}`
}

function WarehouseInventoryPreview({ warehouse }: { warehouse: Warehouse }) {
  const router = useRouter()
  const { t } = useLanguage()
  const { data, isLoading } = useGetWarehouseDetailsQuery({
    id: warehouse.id,
    inventory_per_page: 4,
    movement_per_page: 1,
  })
  const products = data?.inventory.data ?? []

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">{t('address')}</p>
          <p className="mt-2 text-sm font-bold text-[var(--text-secondary)]">{warehouse.address || '-'}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">{t('serviceArea')}</p>
          <p className="mt-2 text-sm font-bold text-[var(--text-secondary)]">{warehouse.service_area?.name ?? t('notAssigned')}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">{t('lowStock')} / {t('outOfStock')}</p>
          <p className="mt-2 text-sm font-bold text-[var(--text-secondary)]">{Number(warehouse.low_stock_count ?? 0)} / {Number(warehouse.out_of_stock_count ?? 0)}</p>
        </div>
        <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
          <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">{t('lastMovement')}</p>
          <p className="mt-2 text-sm font-bold text-[var(--text-secondary)]"><DateText value={warehouse.last_movement_at} empty={t('noMovements')} /></p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--border-subtle)]">
        <div className="hidden grid-cols-[minmax(0,1fr)_auto_auto_auto] gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-4 py-3 text-xs font-extrabold text-[var(--text-muted)] sm:grid">
          <span>{t('product')}</span>
          <span>{t('available')}</span>
          <span>{t('unitCost')}</span>
          <span>{t('stockValue')}</span>
        </div>
        {isLoading ? (
          <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">{t('loadingWarehouseProducts')}</div>
        ) : products.length ? (
          <div className="divide-y divide-[var(--border-subtle)]">
            {products.map((item) => (
              <div key={item.id} className="grid items-center gap-3 px-4 py-3 text-sm sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
                <div className="min-w-0">
                  <p className="truncate font-bold text-[var(--text-primary)]">{item.good?.name ?? item.name}</p>
                  <p className="font-mono text-xs text-[var(--text-muted)]">{item.good?.code ?? item.code}</p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:block"><span className="text-xs font-bold text-[var(--text-muted)] sm:hidden">Available</span><span className="font-bold text-[var(--text-secondary)]">{Number(item.quantity).toLocaleString()} {item.unit}</span></div>
                <div className="flex items-center justify-between gap-3 sm:block"><span className="text-xs font-bold text-[var(--text-muted)] sm:hidden">Unit Cost</span><span className="text-[var(--text-secondary)]">{formatAmount(item.unit_cost)}</span></div>
                <div className="flex items-center justify-between gap-3 sm:block"><span className="text-xs font-bold text-[var(--text-muted)] sm:hidden">Stock Value</span><span className="font-bold text-[var(--text-primary)]">{formatAmount(Number(item.quantity) * Number(item.unit_cost))}</span></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-center text-sm text-[var(--text-muted)]">{t('noProductsStored')}</div>
        )}
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={() => router.push(`/dashboard/warehouses/${warehouse.id}`)} className="btn-secondary flex h-9 items-center gap-2 px-3 text-sm">
          {t('viewInventory')} <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

export default function WarehousesPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<{ name: string; code: string; address: string; status: Warehouse['status']; notes: string }>({ name: '', code: '', address: '', status: 'active', notes: '' })
  const [error, setError] = useState('')

  const { data: warehousesData, isLoading } = useGetWarehousesQuery({ search })
  const [createWarehouse, { isLoading: isCreating }] = useCreateWarehouseMutation()
  const [updateWarehouse, { isLoading: isUpdating }] = useUpdateWarehouseMutation()
  const [deleteWarehouse] = useDeleteWarehouseMutation()

  const warehouses = warehousesData?.data ?? []
  const summary = warehousesData?.summary

  const resetForm = () => {
    setForm({ name: '', code: '', address: '', status: 'active', notes: '' })
    setEditingWarehouse(null)
    setError('')
  }

  const openCreate = () => { resetForm(); setIsCreateOpen(true) }
  const openEdit = (warehouse: Warehouse) => {
    setEditingWarehouse(warehouse)
    setForm({ name: warehouse.name, code: warehouse.code, address: warehouse.address ?? '', status: warehouse.status, notes: warehouse.notes ?? '' })
    setIsCreateOpen(true)
  }

  const handleSubmit = async () => {
    setError('')
    try {
      if (editingWarehouse) {
        await updateWarehouse({ id: editingWarehouse.id, body: form }).unwrap()
      } else {
        await createWarehouse(form).unwrap()
      }
      setIsCreateOpen(false)
      resetForm()
    } catch (requestError) {
      setError(apiErrorMessage(requestError, 'Unable to save the warehouse.'))
    }
  }

  const handleDelete = async (id: number) => {
    await deleteWarehouse(id).unwrap()
  }

  const columns: Column<Warehouse>[] = [
    { key: 'name', label: 'Warehouse', render: (w) => (
      <div className="flex items-center justify-center gap-2">
        <Building2 className="h-4 w-4 shrink-0 text-[var(--text-muted)]" />
        <div className="min-w-0 text-start">
          <p className="truncate font-bold text-[var(--text-primary)]">{w.name}</p>
          <p className="font-mono text-xs text-[var(--text-muted)]">{w.code}</p>
        </div>
      </div>
    )},
    { key: 'products_count', label: 'Products', render: (w) => <span className="font-extrabold text-[var(--text-primary)]">{Number(w.products_count ?? 0).toLocaleString()}</span> },
    { key: 'total_quantity', label: 'Total Quantity', render: (w) => <span className="font-bold">{Number(w.total_quantity ?? 0).toLocaleString()}</span> },
    { key: 'stock_value', label: 'Stock Value', render: (w) => <span className="font-bold text-[var(--accent)]">{formatAmount(w.stock_value)}</span> },
    { key: 'stock_health', label: 'Stock Health', render: (w) => {
      const out = Number(w.out_of_stock_count ?? 0)
      const low = Number(w.low_stock_count ?? 0)
      if (out > 0) return <Badge variant="red">{out} out of stock</Badge>
      if (low > 0) return <Badge variant="amber">{low} low stock</Badge>
      return <Badge variant={statusColor[w.status] as 'emerald' | 'slate'}>{w.status === 'active' ? 'Healthy' : 'Inactive'}</Badge>
    } },
  ]

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
      <PageHeader title={t('warehouses')} subtitle={t('warehouseManagement')} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title={t('totalWarehouses')} value={summary?.total_warehouses ?? warehouses.length} icon={<Building2 className="h-5 w-5 text-[var(--accent)]" />} />
        <StatsCard title={t('productsInStock')} value={summary?.products_count ?? 0} icon={<Boxes className="h-5 w-5 text-[var(--mint)]" />} />
        <StatsCard title={t('stockValue')} value={formatAmount(summary?.stock_value)} icon={<CircleDollarSign className="h-5 w-5 text-[var(--gold)]" />} />
        <StatsCard title={t('lowStockProducts')} value={summary?.low_stock_count ?? 0} icon={<AlertTriangle className="h-5 w-5 text-[var(--coral)]" />} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <input type="text" placeholder={t('searchWarehouses')} value={search} onChange={(e) => setSearch(e.target.value)} className="field-control h-10 ps-4 pe-3 text-sm w-full" />
        </div>
        <button onClick={openCreate} className="btn-primary h-10 px-4 text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" /> {t('addWarehouse')}
        </button>
      </div>

      <DataTable
        data={warehouses}
        columns={columns}
        isLoading={isLoading}
        searchable={false}
        newestFirst={false}
        summaryColumnCount={columns.length}
        renderExpandedRow={(warehouse) => <WarehouseInventoryPreview warehouse={warehouse} />}
        onView={(warehouse) => router.push(`/dashboard/warehouses/${warehouse.id}`)}
        viewLabel={t('viewInventory')}
        onEdit={openEdit}
        onDelete={(warehouse) => setDeleteConfirm(warehouse.id)}
        emptyMessage={t('noWarehousesFound')}
      />

      <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); resetForm() }} title={editingWarehouse ? t('editWarehouse') : t('addWarehouse')}>
        <div className="space-y-4">
          {error && <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{error}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t('warehouseName')} value={form.name} onChange={(v) => setForm({ ...form, name: String(v) })} placeholder={t('mainWarehouse')} required />
            <FormField label={t('code')} value={form.code} onChange={(v) => setForm({ ...form, code: String(v) })} placeholder="WH-001" required />
          </div>
          <FormField label={t('address')} value={form.address} onChange={(v) => setForm({ ...form, address: String(v) })} placeholder={t('kabulAfghanistan')} />
          <div className="max-w-sm space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)]">{t('status')}</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Warehouse['status'] })} className="field-control h-10 w-full px-3 text-sm">
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
            </select>
          </div>
          <FormField label={t('notes')} value={form.notes} onChange={(v) => setForm({ ...form, notes: String(v) })} placeholder={t('additionalNotes')} textarea />
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { setIsCreateOpen(false); resetForm() }} className="btn-secondary h-10 px-4 text-sm">{t('cancel')}</button>
            <button onClick={handleSubmit} disabled={(isCreating || isUpdating) || !form.name || !form.code} className="btn-primary h-10 px-4 text-sm">
              {isCreating || isUpdating ? t('saving') : editingWarehouse ? t('update') : t('create')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={deleteConfirm !== null} title={t('deleteWarehouse')} message="Are you sure you want to delete this warehouse?" onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
    </div>
  )
}
