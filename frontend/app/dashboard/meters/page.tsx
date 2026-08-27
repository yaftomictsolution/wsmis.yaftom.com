'use client'

import { useState } from 'react'
import { ArrowRight, Boxes, LoaderCircle, Plus, Wrench } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useTrainingMode } from '@/context/TrainingModeContext'

import {
  useCreateMeterMutation,
  useDeleteMeterMutation,
  useGetGoodsQuery,
  useGetMetersQuery,
  useGetWarehousesQuery,
  useReturnMeterToStockMutation,
  useUpdateMeterMutation,
  type Meter,
  type MeterOpeningPayload,
} from '@/src/store/waternetApi'

type OpeningMeterForm = {
  meter_number: string
  good_id: string
  warehouse_id: string
  purchase_cost: string
  received_at: string
  purchased_at: string
  type: string
  condition_notes: string
}

const emptyOpeningForm = (businessDate: string): OpeningMeterForm => ({
  meter_number: '',
  good_id: '',
  warehouse_id: '',
  purchase_cost: '0',
  received_at: businessDate,
  purchased_at: '',
  type: '',
  condition_notes: '',
})

const statusColor: Record<Meter['status'], 'emerald' | 'blue' | 'red' | 'amber' | 'slate'> = {
  available: 'emerald',
  installed: 'blue',
  broken: 'red',
  replaced: 'amber',
  inactive: 'slate',
  sold: 'slate',
  issued: 'slate',
}

function apiErrorMessage(error: unknown, fallback: string): string {
  const apiError = error as { data?: { message?: string; errors?: Record<string, string[]> } }
  return apiError?.data?.errors
    ? Object.values(apiError.data.errors).flat()[0] ?? fallback
    : apiError?.data?.message ?? fallback
}

function money(value: string | number | undefined): string {
  return `AFN ${Number(value ?? 0).toLocaleString()}`
}

export default function MetersPage() {
  const { businessDate } = useTrainingMode()
  const { data = [], isLoading, isError } = useGetMetersQuery()
  const { data: goodsData = [] } = useGetGoodsQuery({ status: 'active' })
  const { data: warehousesData } = useGetWarehousesQuery({ status: 'active' })
  const [createMeter, { isLoading: isCreating }] = useCreateMeterMutation()
  const [updateMeter, { isLoading: isUpdating }] = useUpdateMeterMutation()
  const [deleteMeter, { isLoading: isRetiring }] = useDeleteMeterMutation()
  const [returnMeterToStock, { isLoading: isReturning }] = useReturnMeterToStockMutation()
  const [current, setCurrent] = useState<Partial<Meter>>({})
  const [openingForm, setOpeningForm] = useState<OpeningMeterForm>(() => emptyOpeningForm(businessDate))
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isRetireOpen, setIsRetireOpen] = useState(false)
  const [isRepairReturnOpen, setIsRepairReturnOpen] = useState(false)
  const [repairReturn, setRepairReturn] = useState({ warehouse_id: '', returned_at: businessDate, notes: '' })
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const showSkeleton = isLoading && data.length === 0
  const meterGoods = goodsData.filter((good) => good.category === 'meter')
  const warehouses = (warehousesData?.data ?? []).filter((warehouse) => warehouse.status === 'active')

  const columns: Column<Meter>[] = [
    { key: 'meter_number', label: 'Meter Serial', render: (meter) => <span className="font-mono text-xs font-extrabold text-[var(--text-primary)]">{meter.meter_number}</span> },
    { key: 'good', label: 'Product', render: (meter) => <div><p className="font-bold text-[var(--text-primary)]">{meter.good?.name ?? meter.type ?? '-'}</p><p className="font-mono text-xs text-[var(--text-muted)]">{meter.good?.code ?? '-'}</p></div> },
    { key: 'source', label: 'Purchase / Source', render: (meter) => <div><p className="font-bold text-[var(--text-primary)]">{meter.purchase_item?.request?.request_number ?? meter.source_type.replaceAll('_', ' ')}</p><p className="text-xs text-[var(--text-muted)]"><DateText value={meter.received_at ?? meter.purchased_at} /></p></div> },
    { key: 'supplier', label: 'Supplier', render: (meter) => meter.supplier?.name ?? '-' },
    { key: 'source_warehouse', label: 'Source Warehouse', render: (meter) => meter.source_warehouse ? `${meter.source_warehouse.name} (${meter.source_warehouse.code})` : '-' },
    { key: 'location', label: 'Current Location', render: (meter) => meter.current_warehouse ? `${meter.current_warehouse.name} (${meter.current_warehouse.code})` : meter.active_assignment?.customer?.name ?? meter.status.replaceAll('_', ' ') },
    { key: 'purchase_cost', label: 'Purchase Cost', render: (meter) => money(meter.purchase_cost) },
    { key: 'status', label: 'Status', render: (meter) => <Badge color={statusColor[meter.status]}>{meter.status.replaceAll('_', ' ')}</Badge> },
    {
      key: 'repair_return',
      label: 'Repair',
      render: (meter) => meter.status === 'broken' ? (
        <button
          type="button"
          className="icon-button"
          title="Return repaired meter to stock"
          aria-label={`Return ${meter.meter_number} to stock`}
          onClick={(event) => {
            event.stopPropagation()
            setCurrent(meter)
            setRepairReturn({ warehouse_id: String(meter.source_warehouse_id ?? ''), returned_at: businessDate, notes: '' })
            setError('')
            setIsRepairReturnOpen(true)
          }}
        >
          <Wrench className="h-4 w-4" />
        </button>
      ) : '-',
    },
  ]

  const saveOpeningMeter = async () => {
    
    setError('')
    setNotice('')
    if (!openingForm.meter_number.trim() || !openingForm.good_id || !openingForm.warehouse_id || !openingForm.received_at) {
      setError('Enter the meter serial, product, warehouse, cost, and received date.')
      return
    }
    const payload: MeterOpeningPayload = {
      meter_number: openingForm.meter_number.trim(),
      good_id: Number(openingForm.good_id),
      warehouse_id: Number(openingForm.warehouse_id),
      purchase_cost: Number(openingForm.purchase_cost || 0),
      received_at: openingForm.received_at,
      purchased_at: openingForm.purchased_at  || undefined,
      type: openingForm.type || undefined,
      condition_notes: openingForm.condition_notes || undefined,
    }
    try {
      await createMeter(payload).unwrap()
      setIsOpeningModalOpen(false)
      setOpeningForm(emptyOpeningForm(businessDate))
      setNotice('Opening meter stock registered and added to the selected warehouse.')
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to register opening meter stock.'))
    }
  }

  const saveEdit = async () => {
    if (!current.id || !current.meter_number?.trim()) return
    setError('')
    setNotice('')
    try {
      await updateMeter({ id: current.id, body: { meter_number: current.meter_number.trim(), type: current.type, condition_notes: current.condition_notes } }).unwrap()
      setIsEditModalOpen(false)
      setCurrent({})
      setNotice('Meter details updated.')
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to update the meter.'))
    }
  }

  const retire = async () => {
    if (!current.id) return
    setError('')
    try {
      await deleteMeter({ id: current.id, reason: 'Retired from the meter register by an administrator.' }).unwrap()
      setIsRetireOpen(false)
      setCurrent({})
      setNotice('Meter retired. Its purchase, warehouse, and assignment history remains available.')
    } catch (err) {
      setIsRetireOpen(false)
      setError(apiErrorMessage(err, 'Unable to retire the meter.'))
    }
  }

  const saveRepairReturn = async () => {
    if (!current.id || !repairReturn.warehouse_id || !repairReturn.returned_at || !repairReturn.notes.trim()) return
    setError('')
    try {
      await returnMeterToStock({
        id: current.id,
        warehouse_id: Number(repairReturn.warehouse_id),
        returned_at: repairReturn.returned_at,
        notes: repairReturn.notes,
      }).unwrap()
      setIsRepairReturnOpen(false)
      setCurrent({})
      setNotice('Repaired meter returned to available warehouse stock.')
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to return the repaired meter to stock.'))
    }
  }

  return (
    <div className="mx-auto max-w-[1800px] p-6 lg:p-8">
      {/* <PageHeader title="Meter Register" subtitle="Serialized purchase, warehouse, condition, and customer history">
        <button type="button" onClick={() => { setOpeningForm(emptyOpeningForm(businessDate)); setError(''); setNotice(''); setIsOpeningModalOpen(true) }} className="primary-action text-sm">
          <Plus size={18} /> Register Opening Meter
        </button>
      </PageHeader> */}

      {(error || isError) && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]" role="alert">{error || 'Unable to load the meter register.'}</div>}
      {notice && <div className="mb-4 rounded-lg border border-[var(--mint)] bg-[var(--mint-soft)] px-4 py-3 text-sm font-bold text-[var(--mint)]">{notice}</div>}

      <DataTable
        columns={columns}
        data={data}
        loading={showSkeleton}
        onEdit={(meter) => { setCurrent(meter); setError(''); setIsEditModalOpen(true) }}
        onDelete={(meter) => { setCurrent(meter); setIsRetireOpen(true) }}
        searchKeys={['meter_number', 'type', 'status']}
        summaryColumnCount={6}
        renderExpandedRow={(meter) => (
          <div className="divide-y divide-[var(--border-subtle)]">
            {(meter.movements ?? []).map((movement) => (
              <div key={movement.id} className="grid gap-2 px-4 py-3 text-sm md:grid-cols-[160px_1fr_auto_1fr] md:items-center">
                <Badge variant={movement.type.includes('purchase') || movement.type.includes('opening') ? 'blue' : movement.type.includes('installation') ? 'emerald' : movement.type.includes('repair') ? 'amber' : 'slate'}>{movement.type.replaceAll('_', ' ')}</Badge>
                <span className="text-[var(--text-secondary)]">{movement.from_warehouse?.name ?? movement.customer?.name ?? 'Register'}<ArrowRight className="mx-2 inline h-3.5 w-3.5 text-[var(--text-muted)]" />{movement.to_warehouse?.name ?? movement.customer?.name ?? movement.condition ?? '-'}</span>
                <span className="text-xs font-bold text-[var(--text-muted)]"><DateText value={movement.movement_date} /></span>
                <span className="text-[var(--text-secondary)]">{movement.notes || '-'}</span>
              </div>
            ))}
            {!meter.movements?.length && <p className="px-4 py-4 text-sm text-[var(--text-muted)]">No movement history.</p>}
          </div>
        )}
      />

      <Modal isOpen={isOpeningModalOpen} onClose={() => setIsOpeningModalOpen(false)} title="Register Opening Meter Stock" size="xl">
        {error && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{error}</div>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Meter Serial Number" value={openingForm.meter_number} onChange={(value) => setOpeningForm({ ...openingForm, meter_number: String(value) })} required />
          <FormField label="Meter Product" type="select" value={openingForm.good_id} onChange={(value) => { const good = meterGoods.find((item) => item.id === Number(value)); setOpeningForm({ ...openingForm, good_id: String(value), purchase_cost: good ? String(good.default_cost) : openingForm.purchase_cost, type: good?.name ?? openingForm.type }) }} options={meterGoods.map((good) => ({ value: good.id, label: `${good.name} (${good.code})` }))} required />
          <FormField label="Warehouse" type="select" value={openingForm.warehouse_id} onChange={(value) => setOpeningForm({ ...openingForm, warehouse_id: String(value) })} options={warehouses.map((warehouse) => ({ value: warehouse.id, label: `${warehouse.name} (${warehouse.code})` }))} required />
          <FormField label="Opening Cost" type="number" min={0} value={openingForm.purchase_cost} onChange={(value) => setOpeningForm({ ...openingForm, purchase_cost: String(value) })} required />
          <FormField label="Received Date" type="date" value={openingForm.received_at} onChange={(value) => setOpeningForm({ ...openingForm, received_at: String(value) })} required />
          <FormField label="Original Purchase Date" type="date" value={openingForm.purchased_at} onChange={(value) => setOpeningForm({ ...openingForm, purchased_at: String(value) })} />
          <FormField label="Meter Type / Model" value={openingForm.type} onChange={(value) => setOpeningForm({ ...openingForm, type: String(value) })} />
          <div className="md:col-span-2"><FormField label="Condition Notes" type="textarea" value={openingForm.condition_notes} onChange={(value) => setOpeningForm({ ...openingForm, condition_notes: String(value) })} /></div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setIsOpeningModalOpen(false)} className="secondary-action">Cancel</button>
          <button type="button" onClick={saveOpeningMeter} disabled={isCreating} className="primary-action disabled:opacity-60">{isCreating ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}{isCreating ? 'Saving...' : 'Register In Warehouse'}</button>
        </div>
      </Modal>

      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="Edit Meter Details" size="lg">
        {error && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{error}</div>}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="Meter Serial Number" value={current.meter_number ?? ''} onChange={(value) => setCurrent({ ...current, meter_number: String(value) })} required />
          <FormField label="Meter Type / Model" value={current.type ?? ''} onChange={(value) => setCurrent({ ...current, type: String(value) })} />
          <div className="md:col-span-2"><FormField label="Condition Notes" type="textarea" value={current.condition_notes ?? ''} onChange={(value) => setCurrent({ ...current, condition_notes: String(value) })} /></div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setIsEditModalOpen(false)} className="secondary-action">Cancel</button>
          <button type="button" onClick={saveEdit} disabled={isUpdating} className="primary-action disabled:opacity-60">{isUpdating && <LoaderCircle className="h-4 w-4 animate-spin" />}{isUpdating ? 'Saving...' : 'Save Meter'}</button>
        </div>
      </Modal>

      <Modal isOpen={isRepairReturnOpen} onClose={() => setIsRepairReturnOpen(false)} title="Return Repaired Meter" size="lg">
        {error && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{error}</div>}
        <div className="space-y-4">
          <div className="border-y border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 font-mono text-sm font-extrabold">{current.meter_number ?? '-'}</div>
          <FormField label="Return Warehouse" type="select" value={repairReturn.warehouse_id} onChange={(value) => setRepairReturn({ ...repairReturn, warehouse_id: String(value) })} options={warehouses.map((warehouse) => ({ value: warehouse.id, label: `${warehouse.name} (${warehouse.code})` }))} required />
          <FormField label="Return Date" type="date" value={repairReturn.returned_at} onChange={(value) => setRepairReturn({ ...repairReturn, returned_at: String(value) })} required />
          <FormField label="Repair Result / Condition" type="textarea" value={repairReturn.notes} onChange={(value) => setRepairReturn({ ...repairReturn, notes: String(value) })} required />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setIsRepairReturnOpen(false)} className="secondary-action">Cancel</button>
          <button type="button" onClick={saveRepairReturn} disabled={isReturning || !repairReturn.warehouse_id || !repairReturn.notes.trim()} className="primary-action disabled:opacity-60">
            {isReturning ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Wrench className="h-4 w-4" />}
            {isReturning ? 'Saving...' : 'Return To Stock'}
          </button>
        </div>
      </Modal>
      <ConfirmDialog isOpen={isRetireOpen} onClose={() => setIsRetireOpen(false)} onConfirm={retire} title="Retire Meter" message={`Retire ${current.meter_number ?? 'this meter'}? It will leave available stock, but its purchase and movement history will not be deleted.`} confirmLabel={isRetiring ? 'Retiring...' : 'Retire Meter'} />
    </div>
  )
}
