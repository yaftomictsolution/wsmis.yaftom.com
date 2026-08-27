'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Boxes,
  Building2,
  CircleDollarSign,
  History,
  MapPin,
  Package,
  ScanBarcode,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Badge } from '@/components/ui/Badge'
import { StatsCard } from '@/components/StatsCard'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { DateText } from '@/components/ui/DateText'
import { useLanguage } from '@/context/LanguageContext'
import {
  useGetWarehouseDetailsQuery,
  type InventoryItem,
  type InventoryTransaction,
  type Meter,
} from '@/src/store/waternetApi'

const categories = ['pipe', 'meter', 'chemical', 'fuel', 'solar', 'technical', 'office', 'other']
const movementTypes: InventoryTransaction['type'][] = ['purchase', 'sale', 'internal_use', 'return', 'adjustment', 'transfer']

function formatAmount(value: number | string | undefined): string {
  return `AFN ${Number(value ?? 0).toLocaleString()}`
}

function movementVariant(type: InventoryTransaction['type']): 'blue' | 'emerald' | 'amber' | 'red' | 'slate' {
  if (type === 'purchase' || type === 'return') return 'blue'
  if (type === 'sale') return 'emerald'
  if (type === 'internal_use') return 'amber'
  if (type === 'adjustment') return 'red'
  return 'slate'
}

export default function WarehouseDetailsPage() {
  const { translate } = useLanguage()
  const params = useParams<{ id: string }>()
  const warehouseId = Number(params.id)
  const [tab, setTab] = useState<'inventory' | 'meters' | 'movements'>('inventory')
  const [inventorySearch, setInventorySearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [category, setCategory] = useState('')
  const [stockStatus, setStockStatus] = useState<'available' | 'low' | 'out' | ''>('')
  const [inventoryPage, setInventoryPage] = useState(1)
  const [movementType, setMovementType] = useState<InventoryTransaction['type'] | ''>('')
  const [movementFrom, setMovementFrom] = useState('')
  const [movementTo, setMovementTo] = useState('')
  const [movementPage, setMovementPage] = useState(1)
  const [meterSearch, setMeterSearch] = useState('')
  const [meterStatus, setMeterStatus] = useState<Meter['status'] | ''>('')
  const [meterPage, setMeterPage] = useState(1)

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(inventorySearch.trim())
      setInventoryPage(1)
    }, 250)

    return () => window.clearTimeout(timeout)
  }, [inventorySearch])

  const { data, isLoading, isFetching, isError } = useGetWarehouseDetailsQuery({
    id: warehouseId,
    inventory_search: debouncedSearch || undefined,
    category: category || undefined,
    stock_status: stockStatus || undefined,
    inventory_page: inventoryPage,
    inventory_per_page: 10,
    movement_type: movementType || undefined,
    movement_from: movementFrom || undefined,
    movement_to: movementTo || undefined,
    movement_page: movementPage,
    movement_per_page: 10,
    meter_search: meterSearch || undefined,
    meter_status: meterStatus || undefined,
    meter_page: meterPage,
    meter_per_page: 10,
  }, {
    skip: !Number.isFinite(warehouseId) || warehouseId <= 0,
  })

  const warehouse = data?.warehouse
  const inventory = data?.inventory
  const movements = data?.movements
  const meters = data?.meters

  const inventoryColumns: Column<InventoryItem>[] = [
    {
      key: 'name',
      label: 'Product',
      render: (item) => (
        <div className="min-w-0 text-start">
          <p className="truncate font-bold text-[var(--text-primary)]">{item.good?.name ?? item.name}</p>
          <p className="font-mono text-xs text-[var(--text-muted)]">{item.good?.code ?? item.code}</p>
        </div>
      ),
    },
    { key: 'category', label: 'Category', render: (item) => <Badge variant="blue">{translate(item.category)}</Badge> },
    {
      key: 'quantity',
      label: 'Available',
      render: (item) => {
        const quantity = Number(item.quantity)
        const low = quantity <= Number(item.reorder_level)
        return <span className={`font-extrabold ${quantity <= 0 ? 'text-[var(--coral)]' : low ? 'text-[var(--gold)]' : 'text-[var(--mint)]'}`}>{quantity.toLocaleString()} {translate(item.unit)}</span>
      },
    },
    { key: 'unit_cost', label: 'Unit Cost', render: (item) => formatAmount(item.unit_cost) },
    { key: 'total_value', label: 'Stock Value', render: (item) => <span className="font-bold text-[var(--text-primary)]">{formatAmount(Number(item.quantity) * Number(item.unit_cost))}</span> },
    { key: 'unit_price', label: 'Sale Price', render: (item) => formatAmount(item.unit_price) },
    { key: 'reorder_level', label: 'Reorder Level', render: (item) => `${Number(item.reorder_level).toLocaleString()} ${translate(item.unit)}` },
    { key: 'supplier', label: 'Supplier', render: (item) => item.supplier?.name ?? '-' },
    {
      key: 'stock_status',
      label: 'Stock Status',
      render: (item) => {
        const quantity = Number(item.quantity)
        if (quantity <= 0) return <Badge variant="red">{translate('Out of stock')}</Badge>
        if (quantity <= Number(item.reorder_level)) return <Badge variant="amber">{translate('Low stock')}</Badge>
        return <Badge variant="emerald">{translate('Available')}</Badge>
      },
    },
  ]

  const movementColumns: Column<InventoryTransaction>[] = [
    { key: 'type', label: 'Movement', render: (movement) => <Badge variant={movementVariant(movement.type)}>{translate(movement.type.replaceAll('_', ' '))}</Badge> },
    {
      key: 'inventory_item',
      label: 'Product',
      render: (movement) => (
        <div className="min-w-0 text-start">
          <p className="truncate font-bold text-[var(--text-primary)]">{movement.inventory_item?.good?.name ?? movement.inventory_item?.name ?? '-'}</p>
          <p className="font-mono text-xs text-[var(--text-muted)]">{movement.inventory_item?.good?.code ?? movement.inventory_item?.code ?? '-'}</p>
        </div>
      ),
    },
    {
      key: 'quantity',
      label: 'Quantity',
      render: (movement) => {
        const quantity = Number(movement.quantity)
        return <span className={`font-extrabold ${quantity < 0 ? 'text-[var(--coral)]' : 'text-[var(--mint)]'}`}>{quantity > 0 ? '+' : ''}{quantity.toLocaleString()} {translate(movement.inventory_item?.unit ?? '')}</span>
      },
    },
    { key: 'total_amount', label: 'Amount', render: (movement) => formatAmount(movement.total_amount) },
    { key: 'transaction_date', label: 'Date', render: (movement) => <DateText value={movement.transaction_date} /> },
    { key: 'creator', label: 'Recorded By', render: (movement) => movement.creator?.name ?? '-' },
    { key: 'reference_id', label: 'Reference', render: (movement) => movement.reference_id ? `#${movement.reference_id}` : '-' },
    { key: 'notes', label: 'Notes', render: (movement) => movement.notes || '-' },
  ]

  const meterColumns: Column<Meter>[] = [
    { key: 'meter_number', label: 'Meter Serial', render: (meter) => <span className="font-mono text-xs font-extrabold text-[var(--text-primary)]">{meter.meter_number}</span> },
    { key: 'good', label: 'Product', render: (meter) => <div><p className="font-bold text-[var(--text-primary)]">{meter.good?.name ?? meter.type ?? '-'}</p><p className="font-mono text-xs text-[var(--text-muted)]">{meter.good?.code ?? '-'}</p></div> },
    { key: 'source', label: 'Purchase / Source', render: (meter) => meter.purchase_item?.request?.request_number ?? translate(meter.source_type.replaceAll('_', ' ')) },
    { key: 'supplier', label: 'Supplier', render: (meter) => meter.supplier?.name ?? '-' },
    { key: 'purchase_cost', label: 'Cost', render: (meter) => formatAmount(meter.purchase_cost) },
    { key: 'received_at', label: 'Received', render: (meter) => <DateText value={meter.received_at} /> },
    { key: 'condition_notes', label: 'Condition', render: (meter) => meter.condition_notes || '-' },
    { key: 'status', label: 'Status', render: (meter) => <Badge variant={meter.status === 'available' ? 'emerald' : meter.status === 'broken' ? 'red' : 'slate'}>{translate(meter.status.replaceAll('_', ' '))}</Badge> },
  ]

  if (isError) {
    return (
      <div className="relative mx-auto min-h-full max-w-[1600px] p-4 lg:p-8">
        <div role="alert" className="rounded-lg border border-[var(--coral)]/30 bg-[var(--coral-soft)] p-5 text-sm font-bold text-[var(--coral)]">
          {translate('Unable to load this warehouse.')}
        </div>
      </div>
    )
  }

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
      <Link href="/dashboard/warehouses" className="ghost-action inline-flex min-h-0 items-center gap-2 px-2 py-1.5 text-sm">
        <ArrowLeft className="h-4 w-4" /> {translate('Back to Warehouses')}
      </Link>

      <PageHeader
        title={warehouse?.name ?? translate('Warehouse')}
        subtitle={warehouse ? `${warehouse.code} | ${translate('Inventory and movement history')}` : translate('Loading warehouse inventory...')}
      />

      <div className="elegant-panel grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="flex min-w-0 items-start gap-3">
          <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-[var(--accent)]" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--text-muted)]">{translate('Status')}</p>
            <div className="mt-1"><Badge variant={warehouse?.status === 'active' ? 'emerald' : 'slate'}>{translate(warehouse?.status ?? '-')}</Badge></div>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-3">
          <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[var(--mint)]" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--text-muted)]">{translate('Address')}</p>
            <p className="mt-1 truncate text-sm font-bold text-[var(--text-secondary)]">{warehouse?.address || '-'}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-3">
          <Package className="mt-0.5 h-5 w-5 shrink-0 text-[var(--gold)]" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--text-muted)]">{translate('Service Area')}</p>
            <p className="mt-1 truncate text-sm font-bold text-[var(--text-secondary)]">{warehouse?.service_area?.name ?? translate('Not assigned')}</p>
          </div>
        </div>
        <div className="flex min-w-0 items-start gap-3">
          <History className="mt-0.5 h-5 w-5 shrink-0 text-[var(--coral)]" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-[var(--text-muted)]">{translate('Last Movement')}</p>
            <p className="mt-1 text-sm font-bold text-[var(--text-secondary)]"><DateText value={data?.summary.last_movement_at} empty={translate('No movements')} /></p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatsCard title="Products" value={data?.summary.products_count ?? 0} icon={<Boxes className="h-5 w-5 text-[var(--accent)]" />} />
        <StatsCard title="Total Quantity" value={Number(data?.summary.total_quantity ?? 0).toLocaleString()} icon={<Package className="h-5 w-5 text-[var(--mint)]" />} />
        <StatsCard title="Stock Value" value={formatAmount(data?.summary.stock_value)} icon={<CircleDollarSign className="h-5 w-5 text-[var(--gold)]" />} />
        <StatsCard title="Low Stock" value={data?.summary.low_stock_count ?? 0} icon={<AlertTriangle className="h-5 w-5 text-[var(--coral)]" />} />
        <StatsCard title="Available Meter Serials" value={data?.summary.available_meter_serials ?? 0} icon={<ScanBarcode className="h-5 w-5 text-[var(--accent)]" />} />
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[var(--border-subtle)] pb-3">
        <button type="button" onClick={() => setTab('inventory')} className={`flex h-10 items-center gap-2 px-4 text-sm ${tab === 'inventory' ? 'btn-primary' : 'btn-secondary'}`}>
          <Package className="h-4 w-4" /> {translate('Products')}
        </button>
        <button type="button" onClick={() => setTab('meters')} className={`flex h-10 items-center gap-2 px-4 text-sm ${tab === 'meters' ? 'btn-primary' : 'btn-secondary'}`}>
          <ScanBarcode className="h-4 w-4" /> {translate('Meter Serials')}
        </button>
        <button type="button" onClick={() => setTab('movements')} className={`flex h-10 items-center gap-2 px-4 text-sm ${tab === 'movements' ? 'btn-primary' : 'btn-secondary'}`}>
          <History className="h-4 w-4" /> {translate('Movements')}
        </button>
      </div>

      {tab === 'inventory' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(240px,1fr)_220px_220px]">
            <input
              value={inventorySearch}
              onChange={(event) => setInventorySearch(event.target.value)}
              className="field-control h-10 px-3 text-sm"
              placeholder={translate('Search products...')}
            />
            <select value={category} onChange={(event) => { setCategory(event.target.value); setInventoryPage(1) }} className="field-control h-10 px-3 text-sm">
              <option value="">{translate('All categories')}</option>
              {categories.map((item) => <option key={item} value={item}>{translate(item)}</option>)}
            </select>
            <select value={stockStatus} onChange={(event) => { setStockStatus(event.target.value as typeof stockStatus); setInventoryPage(1) }} className="field-control h-10 px-3 text-sm">
              <option value="">{translate('All stock')}</option>
              <option value="available">{translate('Available')}</option>
              <option value="low">{translate('Low stock')}</option>
              <option value="out">{translate('Out of stock')}</option>
            </select>
          </div>
          <DataTable
            key="warehouse-inventory"
            data={inventory?.data ?? []}
            columns={inventoryColumns}
            isLoading={isLoading || isFetching}
            searchable={false}
            newestFirst={false}
            summaryColumnCount={5}
            serverPagination={inventory ? {
              currentPage: inventory.current_page,
              lastPage: inventory.last_page,
              perPage: inventory.per_page,
              total: inventory.total,
              onPageChange: setInventoryPage,
            } : undefined}
            emptyMessage="No products found in this warehouse"
          />
        </div>
      ) : tab === 'meters' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <input value={meterSearch} onChange={(event) => { setMeterSearch(event.target.value); setMeterPage(1) }} className="field-control h-10 px-3 text-sm" placeholder={translate('Search meter serials...')} />
            <select value={meterStatus} onChange={(event) => { setMeterStatus(event.target.value as typeof meterStatus); setMeterPage(1) }} className="field-control h-10 px-3 text-sm">
              <option value="">{translate('All meter statuses')}</option>
              <option value="available">{translate('Available')}</option>
              <option value="broken">{translate('Broken')}</option>
            </select>
          </div>
          <DataTable
            key="warehouse-meter-serials"
            data={meters?.data ?? []}
            columns={meterColumns}
            isLoading={isLoading || isFetching}
            searchable={false}
            newestFirst={false}
            summaryColumnCount={5}
            serverPagination={meters ? {
              currentPage: meters.current_page,
              lastPage: meters.last_page,
              perPage: meters.per_page,
              total: meters.total,
              onPageChange: setMeterPage,
            } : undefined}
            emptyMessage="No serialized meters found in this warehouse"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <select value={movementType} onChange={(event) => { setMovementType(event.target.value as typeof movementType); setMovementPage(1) }} className="field-control h-10 px-3 text-sm">
              <option value="">{translate('All movement types')}</option>
              {movementTypes.map((item) => <option key={item} value={item}>{translate(item.replaceAll('_', ' '))}</option>)}
            </select>
            <DatePickerField id="warehouse-movement-from" value={movementFrom} onChange={(value) => { setMovementFrom(value); setMovementPage(1) }} className="field-control h-10 px-3 text-sm" />
            <DatePickerField id="warehouse-movement-to" value={movementTo} min={movementFrom || undefined} onChange={(value) => { setMovementTo(value); setMovementPage(1) }} className="field-control h-10 px-3 text-sm" />
          </div>
          <DataTable
            key="warehouse-movements"
            data={movements?.data ?? []}
            columns={movementColumns}
            isLoading={isLoading || isFetching}
            searchable={false}
            newestFirst={false}
            summaryColumnCount={5}
            serverPagination={movements ? {
              currentPage: movements.current_page,
              lastPage: movements.last_page,
              perPage: movements.per_page,
              total: movements.total,
              onPageChange: setMovementPage,
            } : undefined}
            emptyMessage="No warehouse movements found"
          />
        </div>
      )}
    </div>
  )
}
