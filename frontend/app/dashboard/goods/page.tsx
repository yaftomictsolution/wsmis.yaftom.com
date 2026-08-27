'use client'

import { useState, useMemo } from 'react'
import { Plus, Search, Package } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { FormField } from '@/components/ui/FormField'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useLanguage } from '@/context/LanguageContext'
import {
  useGetGoodsQuery,
  useCreateGoodMutation,
  useUpdateGoodMutation,
  useDeleteGoodMutation,
  type Good,
} from '@/src/store/waternetApi'
import { StatsCard } from '@/components/StatsCard'

const categoryLabels: Record<string, string> = {
  pipe: 'Pipes',
  meter: 'Meters',
  chemical: 'Chemicals',
  fuel: 'Fuel',
  solar: 'Solar Equipment',
  technical: 'Technical Parts',
  office: 'Office Supplies',
  other: 'Other',
}

const unitOptions = ['piece', 'meter', 'liter', 'kg', 'set']

type GoodForm = {
  name: string
  code: string
  category: Good['category']
  unit: string
  default_cost: string
  default_price: string
  status: Good['status']
  description: string
}

type ApiMutationError = {
  data?: {
    errors?: Record<string, string[] | string>
    message?: string
  }
}

export default function GoodsPage() {
  const { t } = useLanguage()
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingGood, setEditingGood] = useState<Good | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [form, setForm] = useState<GoodForm>({
    name: '',
    code: '',
    category: 'pipe',
    unit: 'piece',
    default_cost: '',
    default_price: '',
    status: 'active',
    description: '',
  })

  const { data: goodsData, isLoading } = useGetGoodsQuery({ search, category: categoryFilter })
  const [createGood, { isLoading: isCreating }] = useCreateGoodMutation()
  const [updateGood, { isLoading: isUpdating }] = useUpdateGoodMutation()
  const [deleteGood] = useDeleteGoodMutation()

  const goods = useMemo(() => goodsData ?? [], [goodsData])

  const stats = useMemo(() => {
    const data = goods
    return {
      total: data.length,
      active: data.filter((g: Good) => g.status === 'active').length,
      categories: new Set(data.map((g: Good) => g.category)).size,
    }
  }, [goods])

  const resetForm = () => {
    setForm({ name: '', code: '', category: 'pipe', unit: 'piece', default_cost: '', default_price: '', status: 'active', description: '' })
    setEditingGood(null)
    setErrors({})
  }

  const openCreate = () => { resetForm(); setIsCreateOpen(true) }
  const openEdit = (good: Good) => {
    setEditingGood(good)
    setForm({
      name: good.name,
      code: good.code,
      category: good.category,
      unit: good.unit,
      default_cost: String(good.default_cost),
      default_price: String(good.default_price),
      status: good.status,
      description: good.description || '',
    })
    setErrors({})
    setIsCreateOpen(true)
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}

    if (!form.name.trim()) newErrors.name = 'Name is required'
    if (!form.code.trim()) newErrors.code = 'Code is required'
    if (!form.category) newErrors.category = 'Category is required'
    if (!form.unit) newErrors.unit = 'Unit is required'

    const cost = parseFloat(form.default_cost)
    if (isNaN(cost) || cost < 0) newErrors.default_cost = 'Cost must be 0 or greater'

    const price = parseFloat(form.default_price)
    if (isNaN(price) || price < 0) newErrors.default_price = 'Price must be 0 or greater'

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) return

    try {
      const payload = {
        ...form,
        default_cost: parseFloat(form.default_cost) || 0,
        default_price: parseFloat(form.default_price) || 0,
      }

      if (editingGood) {
        await updateGood({ id: editingGood.id, body: payload }).unwrap()
      } else {
        await createGood(payload).unwrap()
      }
      setIsCreateOpen(false)
      resetForm()
    } catch (err: unknown) {
      const apiError = err as ApiMutationError
      if (apiError.data?.errors) {
        const serverErrors: Record<string, string> = {}
        Object.entries(apiError.data.errors).forEach(([key, value]) => {
          serverErrors[key] = Array.isArray(value) ? value[0] : String(value)
        })
        setErrors(serverErrors)
      } else {
        setErrors({ general: apiError.data?.message || 'Unable to save the good.' })
      }
    }
  }

  const handleDelete = async (id: number) => {
    await deleteGood(id).unwrap()
  }

  const columns: Column<Good>[] = [
    { key: 'code', label: 'Code', render: (good) => <span className="font-mono text-xs">{good.code}</span> },
    { key: 'name', label: 'Name' },
    { key: 'category', label: 'Category', render: (good) => <Badge variant="blue">{categoryLabels[good.category]}</Badge> },
    { key: 'unit', label: 'Unit' },
    { key: 'default_cost', label: 'Cost (AFN)', render: (good) => Number(good.default_cost).toLocaleString() },
    { key: 'default_price', label: 'Price (AFN)', render: (good) => Number(good.default_price).toLocaleString() },
    { key: 'status', label: 'Status', render: (good) => (
      <Badge variant={good.status === 'active' ? 'emerald' : 'slate'}>{good.status}</Badge>
    )},
  ]

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
      <PageHeader title={t('goodsRegistration')} subtitle={t('productCatalog')} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title={t('totalGoods')} value={stats.total} icon={<Package className="h-5 w-5 text-[var(--accent)]" />} />
        <StatsCard title={t('active')} value={stats.active} icon={<Package className="h-5 w-5 text-[var(--mint)]" />} />
        <StatsCard title={t('categories')} value={stats.categories} icon={<Package className="h-5 w-5 text-[var(--gold)]" />} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--text-muted)]" />
          <input type="text" placeholder={t('searchGoods')} value={search} onChange={(e) => setSearch(e.target.value)} className="field-control h-10 ps-10 pe-3 text-sm w-full" />
        </div>
        <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="field-control h-10 px-3 text-sm">
          <option value="">{t('allCategories')}</option>
          {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <button onClick={openCreate} className="btn-primary h-10 px-4 text-sm flex items-center gap-2">
          <Plus className="h-4 w-4" /> {t('addGood')}
        </button>
      </div>

      <div className="elegant-panel p-4">
        <DataTable data={goods} columns={columns} isLoading={isLoading} searchKeys={['name', 'code']} onEdit={openEdit} onDelete={(g) => setDeleteConfirm(g.id)} emptyMessage={t('noGoodsFound')} />
      </div>

      <Modal isOpen={isCreateOpen} onClose={() => { setIsCreateOpen(false); resetForm() }} title={editingGood ? t('editGood') : t('registerNewGood')}>
        <div className="space-y-4">
          {errors.general && (
            <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{errors.general}</div>
          )}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FormField label={t('goodCode')} value={form.code} onChange={(v) => setForm({ ...form, code: String(v) })} placeholder="PIPE-001" required />
              {errors.code && <p className="text-xs text-[var(--coral)] mt-1">{t('codeRequired')}</p>}
            </div>
            <div>
              <FormField label={t('name')} value={form.name} onChange={(v) => setForm({ ...form, name: String(v) })} placeholder="PVC Pipe 4 inch" required />
              {errors.name && <p className="text-xs text-[var(--coral)] mt-1">{t('nameRequired')}</p>}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)]">{t('category')}</label>
              <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Good['category'] })} className="field-control h-10 px-3 text-sm w-full">
                {Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              {errors.category && <p className="text-xs text-[var(--coral)] mt-1">{t('categoryRequired')}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)]">{t('unit')}</label>
              <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="field-control h-10 px-3 text-sm w-full">
                {unitOptions.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              {errors.unit && <p className="text-xs text-[var(--coral)] mt-1">{t('unitRequired')}</p>}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)]">{t('defaultCost')}</label>
              <input type="number" min="0" step="0.01" value={form.default_cost} onChange={(e) => setForm({ ...form, default_cost: e.target.value })} placeholder="250" className="field-control h-10 px-3 text-sm w-full" />
              {errors.default_cost && <p className="text-xs text-[var(--coral)] mt-1">{t('costMustBeZero')}</p>}
            </div>
            <div>
              <label className="text-xs font-bold text-[var(--text-secondary)]">{t('defaultPrice')}</label>
              <input type="number" min="0" step="0.01" value={form.default_price} onChange={(e) => setForm({ ...form, default_price: e.target.value })} placeholder="350" className="field-control h-10 px-3 w-full text-sm" />
              {errors.default_price && <p className="text-xs text-[var(--coral)] mt-1">{t('priceMustBeZero')}</p>}
            </div>
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--text-secondary)]">{t('status')}</label>
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as Good['status'] })} className="field-control h-10 px-3 text-sm w-full">
              <option value="active">{t('active')}</option>
              <option value="inactive">{t('inactive')}</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-bold text-[var(--text-secondary)]">{t('description')}</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder={t('optionalDescription')} className="field-control px-3 py-2 text-sm w-full" rows={3} />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => { setIsCreateOpen(false); resetForm() }} className="btn-secondary h-10 px-4 text-sm">{t('cancel')}</button>
            <button onClick={handleSubmit} disabled={isCreating || isUpdating} className="btn-primary h-10 px-4 text-sm">
              {isCreating || isUpdating ? t('saving') : editingGood ? t('update') : t('register')}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog isOpen={deleteConfirm !== null} title={t('deleteGood')} message="Are you sure you want to delete this good?" onConfirm={() => deleteConfirm && handleDelete(deleteConfirm)} onCancel={() => setDeleteConfirm(null)} />
    </div>
  )
}
