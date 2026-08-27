'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Activity, CalendarClock, Droplets, Plus, Settings, ShoppingCart, Sun, Wrench, Zap } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { StatsCard } from '@/components/StatsCard'
import { hasRole } from '@/components/finance/FinanceUI'
import { useLanguage, type TranslationKey } from '@/context/LanguageContext'
import {
  useCreateAssetMaintenanceMutation,
  useCreateAssetMutation,
  useDeleteAssetMaintenanceMutation,
  useDeleteAssetMutation,
  useGetAssetMaintenanceQuery,
  useGetAssetStatsQuery,
  useGetAssetsQuery,
  useGetMeQuery,
  useGetServiceAreasQuery,
  useGetSuppliersQuery,
  useUpdateAssetMaintenanceMutation,
  useUpdateAssetMutation,
  type Asset,
  type AssetMaintenance,
} from '@/src/store/waternetApi'

const assetTypeLabels: Record<Asset['type'], TranslationKey> = {
  well: 'wells',
  reservoir: 'reservoirs',
  generator: 'generators',
  solar: 'solar',
  technical: 'technical',
}

const assetTypeIcons: Record<Asset['type'], React.ReactNode> = {
  well: <Droplets className="h-4 w-4" />,
  reservoir: <Activity className="h-4 w-4" />,
  generator: <Zap className="h-4 w-4" />,
  solar: <Sun className="h-4 w-4" />,
  technical: <Settings className="h-4 w-4" />,
}

const statusColor: Record<Asset['status'], 'emerald' | 'slate' | 'amber' | 'red'> = {
  active: 'emerald',
  inactive: 'slate',
  maintenance: 'amber',
  retired: 'red',
}

const maintenanceColor: Record<AssetMaintenance['status'], 'blue' | 'amber' | 'emerald' | 'slate'> = {
  scheduled: 'blue',
  in_progress: 'amber',
  completed: 'emerald',
  cancelled: 'slate',
}

const maintenanceStatusLabels: Record<AssetMaintenance['status'], TranslationKey> = {
  scheduled: 'scheduled',
  in_progress: 'inProgress',
  completed: 'completed',
  cancelled: 'cancelled',
}

type AssetForm = {
  asset_code: string
  name: string
  type: Asset['type']
  status: Asset['status']
  service_area_id: string
  supplier_id: string
  address: string
  purchase_cost: string
  purchase_date: string
  warranty_expiry: string
  notes: string
}

type MaintenanceForm = {
  asset_id: string
  maintenance_type: AssetMaintenance['maintenance_type']
  title: string
  status: AssetMaintenance['status']
  performed_at: string
  next_due_date: string
  cost: string
  performed_by: string
  description: string
  notes: string
}

const emptyAsset: AssetForm = {
  asset_code: '',
  name: '',
  type: 'well',
  status: 'active',
  service_area_id: '',
  supplier_id: '',
  address: '',
  purchase_cost: '',
  purchase_date: '',
  warranty_expiry: '',
  notes: '',
}

const emptyMaintenance: MaintenanceForm = {
  asset_id: '',
  maintenance_type: 'preventive',
  title: '',
  status: 'scheduled',
  performed_at: '',
  next_due_date: '',
  cost: '',
  performed_by: '',
  description: '',
  notes: '',
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as { data?: { message?: string; errors?: Record<string, string[]> } }
  const validation = apiError.data?.errors
    ? Object.values(apiError.data.errors).flat()[0]
    : undefined

  return validation || apiError.data?.message || fallback
}

export default function AssetsPage() {
  const { t, translate } = useLanguage()
  const [tab, setTab] = useState<'assets' | 'maintenance'>('assets')
  const [assetModalOpen, setAssetModalOpen] = useState(false)
  const [maintenanceModalOpen, setMaintenanceModalOpen] = useState(false)
  const [editingAsset, setEditingAsset] = useState<Asset | null>(null)
  const [editingMaintenance, setEditingMaintenance] = useState<AssetMaintenance | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'asset' | 'maintenance'; id: number } | null>(null)
  const [assetForm, setAssetForm] = useState<AssetForm>(emptyAsset)
  const [maintenanceForm, setMaintenanceForm] = useState<MaintenanceForm>(emptyMaintenance)
  const [formError, setFormError] = useState('')

  const { data: assets = [], isLoading: assetsLoading } = useGetAssetsQuery({})
  const { data: me } = useGetMeQuery()
  const { data: assetStats } = useGetAssetStatsQuery()
  const { data: maintenance = [], isLoading: maintenanceLoading } = useGetAssetMaintenanceQuery({}, { skip: tab !== 'maintenance' })
  const { data: serviceAreas = [] } = useGetServiceAreasQuery(undefined, { skip: !assetModalOpen })
  const { data: suppliers = [] } = useGetSuppliersQuery({}, { skip: !assetModalOpen })
  const [createAsset, { isLoading: creatingAsset }] = useCreateAssetMutation()
  const [updateAsset, { isLoading: updatingAsset }] = useUpdateAssetMutation()
  const [deleteAsset] = useDeleteAssetMutation()
  const [createMaintenance, { isLoading: creatingMaintenance }] = useCreateAssetMaintenanceMutation()
  const [updateMaintenance, { isLoading: updatingMaintenance }] = useUpdateAssetMaintenanceMutation()
  const [deleteMaintenance] = useDeleteAssetMaintenanceMutation()

  const activeSuppliers = suppliers.filter((supplier) => supplier.status === 'active')
  const canPurchaseAssets = hasRole(me?.roles, ['Accountant', 'Manager', 'Admin', 'Super Admin'])
  const stats = useMemo(() => ({
    total: assetStats?.total ?? assets.length,
    active: assetStats?.active ?? assets.filter((asset) => asset.status === 'active').length,
    maintenance: assetStats?.maintenance ?? assets.filter((asset) => asset.status === 'maintenance').length,
    value: Number(assetStats?.total_value ?? assets.reduce((sum, asset) => sum + Number(asset.purchase_cost || 0), 0)),
  }), [assetStats, assets])

  const assetColumns: Column<Asset>[] = [
    { key: 'asset_code', label: t('assetCode'), render: (asset) => <span className="font-mono text-xs font-bold">{asset.asset_code}</span> },
    { key: 'name', label: t('assetName') },
    {
      key: 'type',
      label: t('assetType'),
      render: (asset) => <div className="flex items-center justify-center gap-2">{assetTypeIcons[asset.type]}<span>{t(assetTypeLabels[asset.type])}</span></div>,
    },
    { key: 'status', label: t('status'), render: (asset) => <Badge variant={statusColor[asset.status]}>{t(asset.status)}</Badge> },
    { key: 'purchase_cost', label: t('purchaseCost'), render: (asset) => `AFN ${Number(asset.purchase_cost || 0).toLocaleString()}` },
    { key: 'purchase', label: t('source'), render: (asset) => asset.purchase?.purchase_number ?? t('existingAsset') },
    { key: 'purchase_account', label: t('purchaseAccount'), render: (asset) => asset.purchase?.account?.name ?? '-' },
    { key: 'service_area', label: t('serviceArea'), render: (asset) => asset.service_area?.name ?? '-' },
    { key: 'supplier', label: t('supplier'), render: (asset) => asset.supplier?.name ?? '-' },
    { key: 'address', label: t('assetLocation'), render: (asset) => asset.address || '-' },
    { key: 'warranty_expiry', label: t('warranty'), render: (asset) => <DateText value={asset.warranty_expiry} /> },
    { key: 'notes', label: t('notes'), render: (asset) => asset.notes || '-' },
  ]

  const maintenanceColumns: Column<AssetMaintenance>[] = [
    { key: 'asset', label: translate('Asset'), render: (record) => record.asset ? `${record.asset.asset_code} - ${record.asset.name}` : '-' },
    { key: 'title', label: t('work') },
    { key: 'maintenance_type', label: t('maintenanceType'), render: (record) => <Badge variant="blue">{t(record.maintenance_type)}</Badge> },
    { key: 'performed_at', label: t('maintenanceDate'), render: (record) => <DateText value={record.performed_at} /> },
    { key: 'status', label: t('status'), render: (record) => <Badge variant={maintenanceColor[record.status]}>{t(maintenanceStatusLabels[record.status])}</Badge> },
    { key: 'next_due_date', label: t('nextDue'), render: (record) => <DateText value={record.next_due_date} /> },
    { key: 'cost', label: t('cost'), render: (record) => `AFN ${Number(record.cost || 0).toLocaleString()}` },
    { key: 'performed_by', label: t('performedBy'), render: (record) => record.performed_by || '-' },
    { key: 'description', label: t('description'), render: (record) => record.description || '-' },
    { key: 'notes', label: t('notes'), render: (record) => record.notes || '-' },
  ]

  const openNewAsset = () => {
    setEditingAsset(null)
    setAssetForm(emptyAsset)
    setFormError('')
    setAssetModalOpen(true)
  }

  const openEditAsset = (asset: Asset) => {
    setEditingAsset(asset)
    setAssetForm({
      asset_code: asset.asset_code,
      name: asset.name,
      type: asset.type,
      status: asset.status,
      service_area_id: String(asset.service_area_id ?? ''),
      supplier_id: String(asset.supplier_id ?? ''),
      address: asset.address ?? '',
      purchase_cost: asset.purchase_cost == null ? '' : String(asset.purchase_cost),
      purchase_date: asset.purchase_date?.slice(0, 10) ?? '',
      warranty_expiry: asset.warranty_expiry?.slice(0, 10) ?? '',
      notes: asset.notes ?? '',
    })
    setFormError('')
    setAssetModalOpen(true)
  }

  const openNewMaintenance = (asset?: Asset) => {
    setEditingMaintenance(null)
    setMaintenanceForm({ ...emptyMaintenance, asset_id: asset ? String(asset.id) : '' })
    setFormError('')
    setMaintenanceModalOpen(true)
  }

  const openEditMaintenance = (record: AssetMaintenance) => {
    setEditingMaintenance(record)
    setMaintenanceForm({
      asset_id: String(record.asset_id),
      maintenance_type: record.maintenance_type,
      title: record.title,
      status: record.status,
      performed_at: record.performed_at?.slice(0, 10) ?? '',
      next_due_date: record.next_due_date?.slice(0, 10) ?? '',
      cost: record.cost == null ? '' : String(record.cost),
      performed_by: record.performed_by ?? '',
      description: record.description ?? '',
      notes: record.notes ?? '',
    })
    setFormError('')
    setMaintenanceModalOpen(true)
  }

  const saveAsset = async () => {
    setFormError('')
    const body: Partial<Asset> = {
      asset_code: assetForm.asset_code.trim(),
      name: assetForm.name.trim(),
      type: assetForm.type,
      status: assetForm.status,
      service_area_id: assetForm.service_area_id ? Number(assetForm.service_area_id) : undefined,
      supplier_id: assetForm.supplier_id ? Number(assetForm.supplier_id) : undefined,
      address: assetForm.address || undefined,
      purchase_cost: assetForm.purchase_cost === '' ? undefined : Number(assetForm.purchase_cost),
      purchase_date: assetForm.purchase_date || undefined,
      warranty_expiry: assetForm.warranty_expiry || undefined,
      notes: assetForm.notes || undefined,
    }

    try {
      if (editingAsset) await updateAsset({ id: editingAsset.id, body }).unwrap()
      else await createAsset(body).unwrap()
      setAssetModalOpen(false)
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Unable to save the asset.'))
    }
  }

  const saveMaintenance = async () => {
    setFormError('')
    const body: Partial<AssetMaintenance> = {
      asset_id: Number(maintenanceForm.asset_id),
      maintenance_type: maintenanceForm.maintenance_type,
      title: maintenanceForm.title.trim(),
      status: maintenanceForm.status,
      performed_at: maintenanceForm.performed_at,
      next_due_date: maintenanceForm.next_due_date || undefined,
      cost: maintenanceForm.cost === '' ? undefined : Number(maintenanceForm.cost),
      performed_by: maintenanceForm.performed_by || undefined,
      description: maintenanceForm.description || undefined,
      notes: maintenanceForm.notes || undefined,
    }

    try {
      if (editingMaintenance) await updateMaintenance({ id: editingMaintenance.id, body }).unwrap()
      else await createMaintenance(body).unwrap()
      setMaintenanceModalOpen(false)
    } catch (error) {
      setFormError(apiErrorMessage(error, 'Unable to save the maintenance record.'))
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    if (deleteTarget.type === 'asset') await deleteAsset(deleteTarget.id).unwrap()
    else await deleteMaintenance(deleteTarget.id).unwrap()
  }

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
      <PageHeader title={t('assets')} subtitle={t('assetManagement')}>
        {canPurchaseAssets ? (
          <Link href="/dashboard/inventory-manager?view=asset-purchases" className="primary-action text-sm">
            <ShoppingCart className="h-4 w-4" /> {t('assetPurchases')}
          </Link>
        ) : null}
      </PageHeader>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title={t('activeAssets')} value={stats.active} icon={<Activity className="h-5 w-5 text-[var(--mint)]" />} />
        <StatsCard title={t('underMaintenance')} value={stats.maintenance} icon={<Wrench className="h-5 w-5 text-[var(--amber)]" />} />
        <StatsCard title={t('totalAssets')} value={stats.total} icon={<CalendarClock className="h-5 w-5 text-[var(--accent)]" />} />
        <StatsCard title={t('registeredValue')} value={`AFN ${stats.value.toLocaleString()}`} icon={<Zap className="h-5 w-5 text-[var(--gold)]" />} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
          <button type="button" onClick={() => setTab('assets')} className={`h-9 px-4 text-sm font-bold ${tab === 'assets' ? 'rounded-md bg-[var(--accent)] text-white' : 'text-[var(--text-muted)]'}`}>{t('assetRegister')}</button>
          <button type="button" onClick={() => setTab('maintenance')} className={`h-9 px-4 text-sm font-bold ${tab === 'maintenance' ? 'rounded-md bg-[var(--accent)] text-white' : 'text-[var(--text-muted)]'}`}>{t('maintenance')}</button>
        </div>
        <button type="button" onClick={tab === 'assets' ? openNewAsset : () => openNewMaintenance()} className="btn-primary flex h-10 items-center gap-2 px-4 text-sm">
          <Plus className="h-4 w-4" /> {tab === 'assets' ? t('registerAsset') : t('scheduleMaintenance')}
        </button>
      </div>

      {tab === 'assets' ? (
        <DataTable
          data={assets}
          columns={assetColumns}
          isLoading={assetsLoading}
          searchKeys={['asset_code', 'name']}
          summaryColumnCount={7}
          onEdit={openEditAsset}
          onView={(asset) => openNewMaintenance(asset)}
          viewLabel={t('scheduleMaintenance')}
          onDelete={(asset) => setDeleteTarget({ type: 'asset', id: asset.id })}
          emptyMessage={t('noAssetsFound')}
        />
      ) : (
        <DataTable
          data={maintenance}
          columns={maintenanceColumns}
          isLoading={maintenanceLoading}
          searchKeys={['title', 'performed_by']}
          summaryColumnCount={5}
          onEdit={openEditMaintenance}
          onDelete={(record) => setDeleteTarget({ type: 'maintenance', id: record.id })}
          emptyMessage={t('noMaintenanceRecordsFound')}
        />
      )}

      <Modal isOpen={assetModalOpen} onClose={() => setAssetModalOpen(false)} title={editingAsset ? t('editAsset') : t('registerAsset')} size="lg">
        <div className="space-y-4">
          {formError && <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{formError}</div>}
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t('assetCode')} value={assetForm.asset_code} onChange={(value) => setAssetForm({ ...assetForm, asset_code: String(value) })} required />
            <FormField label={t('assetName')} value={assetForm.name} onChange={(value) => setAssetForm({ ...assetForm, name: String(value) })} required />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5 text-xs font-bold text-[var(--text-secondary)]">{t('assetType')}<select value={assetForm.type} onChange={(event) => setAssetForm({ ...assetForm, type: event.target.value as Asset['type'] })} className="field-control h-10 w-full px-3 text-sm">{Object.entries(assetTypeLabels).map(([value, label]) => <option key={value} value={value}>{t(label)}</option>)}</select></label>
            <label className="space-y-1.5 text-xs font-bold text-[var(--text-secondary)]">{t('status')}<select value={assetForm.status} onChange={(event) => setAssetForm({ ...assetForm, status: event.target.value as Asset['status'] })} className="field-control h-10 w-full px-3 text-sm"><option value="active">{t('active')}</option><option value="inactive">{t('inactive')}</option><option value="maintenance">{t('maintenance')}</option><option value="retired">{t('retired')}</option></select></label>
          </div>
          <label className="space-y-1.5 text-xs font-bold text-[var(--text-secondary)]">{t('serviceArea')}<select value={assetForm.service_area_id} onChange={(event) => setAssetForm({ ...assetForm, service_area_id: event.target.value })} className="field-control h-10 w-full px-3 text-sm"><option value="">{t('noServiceArea')}</option>{serviceAreas.map((area) => <option key={area.id} value={area.id}>{area.name}</option>)}</select></label>
          <FormField label={t('address')} value={assetForm.address} onChange={(value) => setAssetForm({ ...assetForm, address: String(value) })} />
          {editingAsset && !editingAsset.asset_purchase_id ? (
            <div className="grid gap-4 md:grid-cols-3">
              <label className="space-y-1.5 text-xs font-bold text-[var(--text-secondary)]">{t('legacySupplier')}<select value={assetForm.supplier_id} onChange={(event) => setAssetForm({ ...assetForm, supplier_id: event.target.value })} className="field-control h-10 w-full px-3 text-sm"><option value="">{t('noSupplierRecorded')}</option>{activeSuppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select></label>
              <FormField label={t('historicalCost')} type="number" value={assetForm.purchase_cost} onChange={(value) => setAssetForm({ ...assetForm, purchase_cost: String(value) })} />
              <FormField label={t('historicalPurchaseDate')} type="date" value={assetForm.purchase_date} onChange={(value) => setAssetForm({ ...assetForm, purchase_date: String(value) })} />
            </div>
          ) : null}
          <FormField label={t('warrantyExpiry')} type="date" value={assetForm.warranty_expiry} onChange={(value) => setAssetForm({ ...assetForm, warranty_expiry: String(value) })} />
          <FormField label={t('notes')} value={assetForm.notes} onChange={(value) => setAssetForm({ ...assetForm, notes: String(value) })} textarea />
          <div className="flex justify-end gap-3 pt-3"><button type="button" onClick={() => setAssetModalOpen(false)} className="btn-secondary h-10 px-4 text-sm">{t('cancel')}</button><button type="button" onClick={() => void saveAsset()} disabled={creatingAsset || updatingAsset || !assetForm.asset_code.trim() || !assetForm.name.trim()} className="btn-primary h-10 px-4 text-sm">{creatingAsset || updatingAsset ? t('saving') : t('saveAsset')}</button></div>
        </div>
      </Modal>

      <Modal isOpen={maintenanceModalOpen} onClose={() => setMaintenanceModalOpen(false)} title={editingMaintenance ? t('editMaintenance') : t('scheduleMaintenance')} size="lg">
        <div className="space-y-4">
          {formError && <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{formError}</div>}
          <label className="space-y-1.5 text-xs font-bold text-[var(--text-secondary)]">{translate('Asset')}<select value={maintenanceForm.asset_id} disabled={Boolean(editingMaintenance)} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, asset_id: event.target.value })} className="field-control h-10 w-full px-3 text-sm"><option value="">{t('selectAsset')}</option>{assets.filter((asset) => asset.status !== 'retired').map((asset) => <option key={asset.id} value={asset.id}>{asset.asset_code} - {asset.name}</option>)}</select></label>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t('workTitle')} value={maintenanceForm.title} onChange={(value) => setMaintenanceForm({ ...maintenanceForm, title: String(value) })} required />
            <label className="space-y-1.5 text-xs font-bold text-[var(--text-secondary)]">{t('maintenanceType')}<select value={maintenanceForm.maintenance_type} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, maintenance_type: event.target.value as AssetMaintenance['maintenance_type'] })} className="field-control h-10 w-full px-3 text-sm"><option value="preventive">{t('preventive')}</option><option value="corrective">{t('corrective')}</option><option value="emergency">{t('emergency')}</option></select></label>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-1.5 text-xs font-bold text-[var(--text-secondary)]">{t('status')}<select value={maintenanceForm.status} onChange={(event) => setMaintenanceForm({ ...maintenanceForm, status: event.target.value as AssetMaintenance['status'] })} className="field-control h-10 w-full px-3 text-sm"><option value="scheduled">{t('scheduled')}</option><option value="in_progress">{t('inProgress')}</option><option value="completed">{t('completed')}</option><option value="cancelled">{t('cancelled')}</option></select></label>
            <FormField label={t('maintenanceDate')} type="date" value={maintenanceForm.performed_at} onChange={(value) => setMaintenanceForm({ ...maintenanceForm, performed_at: String(value) })} required />
            <FormField label={t('nextDue')} type="date" value={maintenanceForm.next_due_date} onChange={(value) => setMaintenanceForm({ ...maintenanceForm, next_due_date: String(value) })} />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <FormField label={t('cost')} type="number" value={maintenanceForm.cost} onChange={(value) => setMaintenanceForm({ ...maintenanceForm, cost: String(value) })} />
            <FormField label={t('performedBy')} value={maintenanceForm.performed_by} onChange={(value) => setMaintenanceForm({ ...maintenanceForm, performed_by: String(value) })} />
          </div>
          <FormField label={t('description')} value={maintenanceForm.description} onChange={(value) => setMaintenanceForm({ ...maintenanceForm, description: String(value) })} textarea />
          <FormField label={t('notes')} value={maintenanceForm.notes} onChange={(value) => setMaintenanceForm({ ...maintenanceForm, notes: String(value) })} textarea />
          <div className="flex justify-end gap-3 pt-3"><button type="button" onClick={() => setMaintenanceModalOpen(false)} className="btn-secondary h-10 px-4 text-sm">{t('cancel')}</button><button type="button" onClick={() => void saveMaintenance()} disabled={creatingMaintenance || updatingMaintenance || !maintenanceForm.asset_id || !maintenanceForm.title.trim() || !maintenanceForm.performed_at} className="btn-primary h-10 px-4 text-sm">{creatingMaintenance || updatingMaintenance ? t('saving') : t('saveMaintenance')}</button></div>
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={deleteTarget !== null}
        title={deleteTarget?.type === 'asset' ? t('deleteAsset') : t('deleteMaintenanceRecord')}
        message={deleteTarget?.type === 'asset' ? 'Delete this asset? Assets with maintenance history cannot be deleted.' : 'Delete this maintenance record?'}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
