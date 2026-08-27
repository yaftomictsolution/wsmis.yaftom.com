'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Camera, Download, LoaderCircle, Plus, ShieldCheck, Upload } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { DateText } from '@/components/ui/DateText'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Badge } from '@/components/ui/Badge'
import { API_BASE_URL, getAuthToken } from '@/lib/api'
import { useLanguage } from '@/context/LanguageContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import {
  useCreateMeterAssignmentMutation,
  useDeleteMeterAssignmentMutation,
  useGetCustomersQuery,
  useGetMeterAssignmentsQuery,
  useGetMeterAssignersQuery,
  useGetMetersQuery,
  useGetWarehousesQuery,
  useResealMeterAssignmentMutation,
  useUpdateMeterAssignmentMutation,
  type MeterAssignment,
  type MeterSeal,
} from '@/src/store/waternetApi'

const assignmentStatusColor = { active: 'emerald', replaced: 'amber', removed: 'slate' } as const
const sealStatusColor = { intact: 'emerald', broken: 'red', replaced: 'amber', removed: 'slate' } as const
const invoiceStatusColor = { unpaid: 'red', partially_paid: 'amber', paid: 'emerald', cancelled: 'slate' } as const
const money = (value: string | number | undefined) => `AFN ${Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
const apiErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object' || !('data' in error)) return fallback
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } }).data
  const validationMessage = data?.errors ? Object.values(data.errors).flat()[0] : undefined
  return validationMessage || data?.message || fallback
}

const activeSeal = (assignment: Partial<MeterAssignment>) =>
  assignment.seals?.find((seal) => seal.status === 'intact') ?? assignment.seals?.[0]

const appendValue = (formData: FormData, key: string, value: unknown) => {
  if (value === undefined || value === null || value === '') return
  formData.append(key, String(value))
}

function SealPhotoDropZone({ file, onChange }: { file: File | null; onChange: (file: File | null) => void }) {
  const { translate } = useLanguage()

  return (
    <label
      className="flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--surface-soft)] px-5 py-4 text-center transition-colors hover:border-[var(--accent)] hover:bg-[var(--accent-soft)]"
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault()
        onChange(event.dataTransfer.files[0] ?? null)
      }}
    >
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
      {file ? <Camera className="h-6 w-6 text-[var(--mint)]" /> : <Upload className="h-6 w-6 text-[var(--accent)]" />}
      <span className="max-w-full break-words text-sm font-extrabold text-[var(--text-secondary)]">
        {file?.name ?? translate('Drop a seal photo here or click to select')}
      </span>
      <span className="text-xs font-bold text-[var(--text-muted)]">{translate('JPG, PNG or WebP, maximum 5 MB')}</span>
    </label>
  )
}

export default function MeterAssignmentsPage() {
  const { translate } = useLanguage()
  const { businessDate } = useTrainingMode()
  const searchParams = useSearchParams()
  const { data = [], isLoading, isError } = useGetMeterAssignmentsQuery()
  const { data: meterAssigners = [], isLoading: assignersLoading, isError: assignersError } = useGetMeterAssignersQuery()
  const { data: customers = [] } = useGetCustomersQuery()
  const { data: meters = [] } = useGetMetersQuery()
  const { data: warehouseData } = useGetWarehousesQuery({ status: 'active' })
  const [createMeterAssignment, { isLoading: isCreating }] = useCreateMeterAssignmentMutation()
  const [updateMeterAssignment, { isLoading: isUpdating }] = useUpdateMeterAssignmentMutation()
  const [resealMeterAssignment, { isLoading: isResealing }] = useResealMeterAssignmentMutation()
  const [deleteMeterAssignment] = useDeleteMeterAssignmentMutation()
  const [current, setCurrent] = useState<Partial<MeterAssignment>>({})
  const [resealTarget, setResealTarget] = useState<MeterAssignment | null>(null)
  const [resealForm, setResealForm] = useState({
    seal_number: '',
    sealed_at: businessDate,
    previous_seal_status: 'broken' as 'broken' | 'removed' | 'replaced',
    removal_reason: '',
    notes: '',
  })
  const [sealPhoto, setSealPhoto] = useState<File | null>(null)
  const [resealPhoto, setResealPhoto] = useState<File | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isResealOpen, setIsResealOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [removalForm, setRemovalForm] = useState({
    disposition: 'return_to_stock' as 'return_to_stock' | 'repair' | 'scrap',
    return_warehouse_id: '',
    reason: '',
  })
  const [prefillHandled, setPrefillHandled] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const showSkeleton = isLoading && data.length === 0
  const requestedCustomerId = Number(searchParams.get('customer') ?? 0)
  const requestedContractId = Number(searchParams.get('contract') ?? 0)
  const installableCustomers = customers.filter((customer) =>
    ['installation_pending', 'signed', 'active'].includes(customer.latest_contract?.status ?? customer.agreement_status ?? ''),
  )
  const warehouses = (warehouseData?.data ?? []).filter((warehouse) => warehouse.status === 'active')
  const availableMeterWarehouseIds = [...new Set(
    meters.filter((meter) => meter.status === 'available' && meter.current_warehouse_id).map((meter) => Number(meter.current_warehouse_id)),
  )]
  const singleAvailableWarehouseId = availableMeterWarehouseIds.length === 1 ? availableMeterWarehouseIds[0] : undefined
  const availableMeters = meters.filter((meter) => meter.status === 'available'
    && (!current.source_warehouse_id || meter.current_warehouse_id === current.source_warehouse_id))
  const singleAvailableMeter = availableMeters.length === 1 ? availableMeters[0] : undefined
  const singleMeterAssigner = meterAssigners.length === 1 ? meterAssigners[0] : undefined
  const selectedCustomerAssignment = data.find((assignment) =>
    assignment.status === 'active' && assignment.customer_id === Number(current.customer_id),
  )
  const isSaving = isCreating || isUpdating
  const installableCustomerOptions = useMemo(
    () => installableCustomers.map((customer) => ({
      value: customer.id,
      label: `${customer.name}${customer.house_number ? ` (${customer.house_number})` : ''}`,
    })),
    [installableCustomers],
  )
  const meterAssignerOptions = useMemo(
    () => meterAssigners.map((assigner) => ({
      value: assigner.id,
      label: `${assigner.employee_number} - ${assigner.name}${assigner.position ? ` (${assigner.position})` : ''}`,
      searchText: `${assigner.employee_number} ${assigner.name} ${assigner.email ?? ''} ${assigner.position ?? ''}`,
    })),
    [meterAssigners],
  )

  const columns: Column<MeterAssignment>[] = [
    { key: 'customer', label: 'Customer', render: (item) => item.customer?.name ?? '-' },
    { key: 'meter', label: 'Meter', render: (item) => item.meter?.meter_number ?? '-' },
    { key: 'source_warehouse', label: 'Issued From', render: (item) => item.source_warehouse?.name ?? '-' },
    { key: 'initial_reading', label: 'Initial Reading', render: (item) => `${Number(item.initial_reading).toLocaleString()} m3` },
    { key: 'installation_date', label: 'Installed', render: (item) => <DateText value={item.installation_date} /> },
    { key: 'seal', label: 'Current Seal', render: (item) => activeSeal(item)?.seal_number ?? item.seal_number ?? '-' },
    {
      key: 'seal_status',
      label: 'Seal Status',
      render: (item) => {
        const seal = activeSeal(item)
        return seal ? <Badge color={sealStatusColor[seal.status]}>{seal.status}</Badge> : '-'
      },
    },
    { key: 'installer', label: 'Meter Assigner', render: (item) => item.installer?.name ?? '-' },
    {
      key: 'replacement_billing',
      label: 'Replacement Billing',
      render: (item) => {
        const charge = item.replacement_charge
        const invoice = charge?.invoice
        if (!charge) return item.status === 'replaced' ? translate('No fee') : '-'

        return (
          <div className="min-w-28">
            <p className="font-mono text-xs font-extrabold text-[var(--text-primary)]">{invoice?.invoice_number ?? `CHG-${charge.id}`}</p>
            <p className="mt-1 text-xs font-bold text-[var(--text-secondary)]">{money(charge.amount)}</p>
            <div className="mt-1">
              <Badge color={invoiceStatusColor[invoice?.status ?? charge.payment_status ?? 'unpaid']}>{invoice?.status ?? charge.payment_status ?? 'unpaid'}</Badge>
            </div>
          </div>
        )
      },
    },
    {
      key: 'sealing',
      label: 'Sealing',
      render: (item) => item.status === 'active' ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            setResealTarget(item)
            setResealForm({ seal_number: '', sealed_at: businessDate, previous_seal_status: 'broken', removal_reason: '', notes: '' })
            setResealPhoto(null)
            setError('')
            setIsResealOpen(true)
          }}
          className="icon-button"
          title={translate('Replace Meter Seal')}
          aria-label={translate('Replace Meter Seal')}
        >
          <ShieldCheck className="h-4 w-4" />
        </button>
      ) : '-',
    },
    { key: 'status', label: 'Status', render: (item) => <Badge color={assignmentStatusColor[item.status]}>{item.status}</Badge> },
    { key: 'return_warehouse', label: 'Returned To', render: (item) => item.return_warehouse?.name ?? (item.removal_disposition ? item.removal_disposition.replaceAll('_', ' ') : '-') },
    {
      key: 'photo',
      label: 'Seal Photo',
      render: (item) => {
        const seal = activeSeal(item)
        return seal?.photo_original_name ? (
          <button type="button" onClick={(event) => { event.stopPropagation(); void downloadSealPhoto(seal) }} className="icon-button" title={translate('Download Seal Photo')} aria-label={translate('Download Seal Photo')}>
            <Download className="h-4 w-4" />
          </button>
        ) : '-'
      },
    },
  ]

  const openCreate = () => {
    setCurrent({
      status: 'active',
      initial_reading: 0,
      installation_date: businessDate,
      sealed_at: businessDate,
      meter_assigner_id: singleMeterAssigner?.id,
      source_warehouse_id: singleAvailableWarehouseId,
      meter_id: singleAvailableMeter?.id,
    })
    setSealPhoto(null)
    setError('')
    setNotice('')
    setIsModalOpen(true)
  }

  useEffect(() => {
    if (prefillHandled || !requestedCustomerId || customers.length === 0) return

    const customer = installableCustomers.find((item) => item.id === requestedCustomerId)
    if (!customer) return

    setCurrent({
      status: 'active',
      customer_id: customer.id,
      customer_contract_id: requestedContractId || customer.latest_contract?.id,
      source_warehouse_id: singleAvailableWarehouseId,
      meter_id: singleAvailableMeter?.id,
      initial_reading: 0,
      installation_date: businessDate,
      sealed_at: businessDate,
      meter_assigner_id: singleMeterAssigner?.id,
    })
    setSealPhoto(null)
    setError('')
    setNotice('')
    setIsModalOpen(true)
    setPrefillHandled(true)
  }, [businessDate, customers.length, installableCustomers, prefillHandled, requestedContractId, requestedCustomerId, singleAvailableMeter?.id, singleAvailableWarehouseId, singleMeterAssigner?.id])

  const openEdit = (item: MeterAssignment) => {
    setCurrent({
      ...item,
      customer_id: item.customer_id ?? item.customer?.id,
      meter_id: item.meter_id ?? item.meter?.id,
    })
    setSealPhoto(null)
    setError('')
    setNotice('')
    setIsModalOpen(true)
  }

  const save = async () => {
    setError('')
    setNotice('')
    const wasReplacement = !current.id && Boolean(selectedCustomerAssignment)
    const replacementFee = Number(current.replacement_fee ?? 0)

    try {
      if (current.id) {
        await updateMeterAssignment({
          id: current.id,
          body: {
            initial_reading: current.initial_reading,
            installation_date: current.installation_date,
            notes: current.notes,
          },
        }).unwrap()
      } else {
        if (!current.customer_id || !current.meter_assigner_id || !current.source_warehouse_id || !current.meter_id || !current.installation_date || !current.seal_number) {
          setError('Select the customer, Meter Assigner, source warehouse, and meter, then enter the installation date and unique seal number.')
          return
        }

        const body = new FormData()
        appendValue(body, 'customer_id', current.customer_id)
        appendValue(body, 'customer_contract_id', current.customer_contract_id)
        appendValue(body, 'meter_assigner_id', current.meter_assigner_id)
        appendValue(body, 'source_warehouse_id', current.source_warehouse_id)
        appendValue(body, 'meter_id', current.meter_id)
        appendValue(body, 'initial_reading', current.initial_reading ?? 0)
        appendValue(body, 'installation_date', current.installation_date)
        appendValue(body, 'seal_number', current.seal_number)
        appendValue(body, 'sealed_at', current.sealed_at ?? current.installation_date)
        appendValue(body, 'seal_notes', current.seal_notes)
        appendValue(body, 'notes', current.notes)
        if (selectedCustomerAssignment) {
          appendValue(body, 'previous_meter_disposition', current.previous_meter_disposition ?? 'repair')
          appendValue(body, 'return_warehouse_id', current.return_warehouse_id)
          appendValue(body, 'replacement_fee', replacementFee)
        }
        if (sealPhoto) body.append('seal_photo', sealPhoto)
        await createMeterAssignment(body).unwrap()
      }

      setIsModalOpen(false)
      setCurrent({})
      setSealPhoto(null)
      setNotice(current.id
        ? 'Meter assignment updated.'
        : wasReplacement
          ? replacementFee > 0
            ? 'Meter replaced and the replacement invoice was created.'
            : 'Meter replaced without a replacement fee.'
          : 'Meter installed, sealed, and activated successfully.')
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to save meter assignment.'))
    }
  }

  const saveReseal = async () => {
    if (!resealTarget || !resealForm.seal_number || !resealForm.sealed_at || !resealForm.removal_reason.trim()) {
      setError('Enter the new seal number, sealing date, and reason for replacing the previous seal.')
      return
    }

    setError('')
    setNotice('')
    const body = new FormData()
    appendValue(body, 'seal_number', resealForm.seal_number)
    appendValue(body, 'sealed_at', resealForm.sealed_at)
    appendValue(body, 'previous_seal_status', resealForm.previous_seal_status)
    appendValue(body, 'removal_reason', resealForm.removal_reason)
    appendValue(body, 'notes', resealForm.notes)
    if (resealPhoto) body.append('seal_photo', resealPhoto)

    try {
      await resealMeterAssignment({ id: resealTarget.id, body }).unwrap()
      setIsResealOpen(false)
      setResealTarget(null)
      setResealPhoto(null)
      setNotice('The previous seal was closed and the new seal was recorded in history.')
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to replace the meter seal.'))
    }
  }

  const remove = async () => {
    if (!current.id) return
    try {
      await deleteMeterAssignment({
        id: current.id,
        disposition: removalForm.disposition,
        return_warehouse_id: removalForm.disposition === 'return_to_stock' && removalForm.return_warehouse_id
          ? Number(removalForm.return_warehouse_id)
          : undefined,
        reason: removalForm.reason || 'Meter removed from customer assignment.',
      }).unwrap()
      setIsDeleteOpen(false)
      setCurrent({})
      setNotice(removalForm.disposition === 'return_to_stock'
        ? 'Meter removed and returned to warehouse stock.'
        : removalForm.disposition === 'repair'
          ? 'Meter removed and sent to repair.'
          : 'Meter removed and retired as scrap.')
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to remove meter assignment.'))
    }
  }

  const downloadSealPhoto = async (seal: MeterSeal) => {
    const token = getAuthToken()
    try {
      const response = await fetch(`${API_BASE_URL}/meter-seals/${seal.id}/photo`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      })
      if (!response.ok) throw new Error('Download failed')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = window.document.createElement('a')
      link.href = url
      link.download = seal.photo_original_name ?? `meter-seal-${seal.seal_number}`
      window.document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      setError('Unable to download the meter seal photograph.')
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Meter Assignments" subtitle="Install, seal, replace, and audit customer meters without losing history">
        <button type="button" onClick={openCreate} className="primary-action text-sm">
          <Plus size={18} /> Assign Meter
        </button>
      </PageHeader>

      {(error || isError || assignersError) && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]" role="alert">{translate(error || (assignersError ? 'Unable to load Meter Assigner employees.' : 'Unable to load meter assignments.'))}</div>}
      {notice && <div className="mb-4 rounded-lg border border-[var(--mint)] bg-[var(--mint-soft)] px-4 py-3 text-sm font-bold text-[var(--mint)]" role="status">{translate(notice)}</div>}

      <DataTable columns={columns} data={data} loading={showSkeleton} onEdit={openEdit} onDelete={(item) => {
        setCurrent(item)
        setRemovalForm({
          disposition: 'return_to_stock',
          return_warehouse_id: String(item.source_warehouse_id ?? item.meter?.source_warehouse_id ?? ''),
          reason: '',
        })
        setError('')
        setIsDeleteOpen(true)
      }} searchKeys={['seal_number', 'status']} summaryColumnCount={8} />

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={current.id ? 'Edit Meter Assignment' : 'Install and Seal Meter'} size="xl">
        {error && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{translate(error)}</div>}
        {current.id ? (
          <div className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2">
              <FormField label="Initial Reading" type="number" value={current.initial_reading ?? 0} onChange={(value) => setCurrent({ ...current, initial_reading: Number(value) })} />
              <FormField label="Installation Date" type="date" value={current.installation_date ?? businessDate} onChange={(value) => setCurrent({ ...current, installation_date: String(value) })} required />
              <FormField label="Notes" type="textarea" value={current.notes ?? ''} onChange={(value) => setCurrent({ ...current, notes: String(value) })} />
            </div>
            <div className="border-t border-[var(--border-color)] pt-4 text-sm font-bold text-[var(--text-muted)]">
              {translate('Seal records cannot be overwritten here. Use Replace Meter Seal to preserve the complete audit history.')}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="Customer"
              type="select"
              value={current.customer_id ?? ''}
              onChange={(value) => {
                const customer = installableCustomers.find((item) => item.id === Number(value))
                const activeAssignment = data.find((assignment) => assignment.status === 'active' && assignment.customer_id === Number(value))
                setCurrent({
                  ...current,
                  customer_id: Number(value),
                  customer_contract_id: customer?.latest_contract?.id,
                  previous_meter_disposition: activeAssignment ? 'repair' : undefined,
                  return_warehouse_id: activeAssignment?.source_warehouse_id,
                  replacement_fee: activeAssignment ? 0 : undefined,
                })
              }}
              options={installableCustomerOptions}
              required
            />
            <SearchableSelect
              label="Meter Assigner"
              value={current.meter_assigner_id}
              onChange={(value) => setCurrent({ ...current, meter_assigner_id: Number(value) })}
              options={meterAssignerOptions}
              placeholder={assignersLoading ? 'Loading Meter Assigners...' : 'Select Meter Assigner'}
              searchPlaceholder="Search Meter Assigner employees..."
              emptyMessage="No active Meter Assigner employee found."
              disabled={assignersLoading}
              required
            />
            <FormField
              label="Source Warehouse"
              type="select"
              value={current.source_warehouse_id ?? ''}
              onChange={(value) => {
                const warehouseId = Number(value)
                const warehouseMeters = meters.filter((meter) => meter.status === 'available' && meter.current_warehouse_id === warehouseId)
                setCurrent({ ...current, source_warehouse_id: warehouseId, meter_id: warehouseMeters.length === 1 ? warehouseMeters[0].id : undefined })
              }}
              options={warehouses.map((warehouse) => {
                const count = meters.filter((meter) => meter.status === 'available' && meter.current_warehouse_id === warehouse.id).length
                return { value: warehouse.id, label: `${warehouse.name} (${warehouse.code}) - ${count} available` }
              })}
              required
            />
            <FormField label="Meter Serial" type="select" value={current.meter_id ?? ''} onChange={(value) => setCurrent({ ...current, meter_id: Number(value) })} options={availableMeters.map((meter) => ({ value: meter.id, label: `${meter.meter_number} - ${meter.good?.name ?? meter.type ?? 'Meter'}` }))} required />
            {current.meter_id ? (
              <div className="border-y border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                {(() => {
                  const meter = meters.find((item) => item.id === Number(current.meter_id))
                  return meter ? `${meter.purchase_item?.request?.request_number ?? meter.source_type.replaceAll('_', ' ')} | ${meter.supplier?.name ?? 'No supplier'} | AFN ${Number(meter.purchase_cost).toLocaleString()}` : '-'
                })()}
              </div>
            ) : null}
            {installableCustomers.length === 0 && <div className="md:col-span-2 border-y border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-bold text-[var(--gold)]">{translate('Customer contract must be confirmed before meter installation and sealing.')}</div>}
            {selectedCustomerAssignment ? (
              <>
                <div className="md:col-span-2 border-y border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-bold text-[var(--gold)]">
                  {translate(`Replacing ${selectedCustomerAssignment.meter?.meter_number ?? 'the current meter'}`)}
                </div>
                <FormField
                  label="Previous Meter Destination"
                  type="select"
                  value={current.previous_meter_disposition ?? 'repair'}
                  onChange={(value) => setCurrent({ ...current, previous_meter_disposition: value as MeterAssignment['previous_meter_disposition'] })}
                  options={[
                    { value: 'return_to_stock', label: 'Return to warehouse stock' },
                    { value: 'repair', label: 'Send to repair' },
                    { value: 'scrap', label: 'Scrap / retire' },
                  ]}
                  required
                />
                <FormField
                  label="Meter Replacement Fee (AFN)"
                  type="number"
                  min={0}
                  value={current.replacement_fee ?? 0}
                  onChange={(value) => setCurrent({ ...current, replacement_fee: Number(value) })}
                  required
                />
                {current.previous_meter_disposition === 'return_to_stock' ? (
                  <FormField label="Return Warehouse" type="select" value={current.return_warehouse_id ?? ''} onChange={(value) => setCurrent({ ...current, return_warehouse_id: Number(value) })} options={warehouses.map((warehouse) => ({ value: warehouse.id, label: `${warehouse.name} (${warehouse.code})` }))} required />
                ) : <div />}
              </>
            ) : null}
            <FormField label="Initial Reading" type="number" min={0} value={current.initial_reading ?? 0} onChange={(value) => setCurrent({ ...current, initial_reading: Number(value) })} />
            <FormField label="Installation Date" type="date" value={current.installation_date ?? businessDate} onChange={(value) => setCurrent({ ...current, installation_date: String(value), sealed_at: String(value) })} required />
            <FormField label="Seal Number" value={current.seal_number ?? ''} onChange={(value) => setCurrent({ ...current, seal_number: String(value) })} placeholder="SEAL-000123" required />
            <FormField label="Sealing Date" type="date" value={current.sealed_at ?? current.installation_date ?? businessDate} onChange={(value) => setCurrent({ ...current, sealed_at: String(value) })} required />
            <div className="md:col-span-2"><SealPhotoDropZone file={sealPhoto} onChange={setSealPhoto} /></div>
            <div className="md:col-span-2"><FormField label="Seal Notes" type="textarea" value={current.seal_notes ?? ''} onChange={(value) => setCurrent({ ...current, seal_notes: String(value) })} /></div>
            <div className="md:col-span-2"><FormField label="Assignment Notes" type="textarea" value={current.notes ?? ''} onChange={(value) => setCurrent({ ...current, notes: String(value) })} /></div>
          </div>
        )}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setIsModalOpen(false)} className="secondary-action">{translate('Cancel')}</button>
          <button type="button" onClick={save} disabled={isSaving} className="primary-action disabled:cursor-not-allowed disabled:opacity-60">
            {isSaving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {translate(isSaving ? 'Saving...' : current.id ? 'Save Assignment' : 'Install and Seal')}
          </button>
        </div>
      </Modal>

      <Modal isOpen={isResealOpen} onClose={() => setIsResealOpen(false)} title="Replace Meter Seal" size="xl">
        {error && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{translate(error)}</div>}
        <div className="mb-5 border-y border-[var(--border-color)] bg-[var(--surface-soft)] px-4 py-3 text-sm text-[var(--text-secondary)]">
          <span className="font-extrabold">{translate('Current Seal')}:</span> {activeSeal(resealTarget ?? {})?.seal_number ?? resealTarget?.seal_number ?? '-'}
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField label="New Seal Number" value={resealForm.seal_number} onChange={(value) => setResealForm((currentForm) => ({ ...currentForm, seal_number: String(value) }))} placeholder="SEAL-000124" required />
          <FormField label="Sealing Date" type="date" value={resealForm.sealed_at} onChange={(value) => setResealForm((currentForm) => ({ ...currentForm, sealed_at: String(value) }))} required />
          <FormField label="Previous Seal Condition" type="select" value={resealForm.previous_seal_status} onChange={(value) => setResealForm((currentForm) => ({ ...currentForm, previous_seal_status: value as typeof currentForm.previous_seal_status }))} options={[{ value: 'broken', label: 'Broken' }, { value: 'removed', label: 'Removed' }, { value: 'replaced', label: 'Replaced' }]} required />
          <div className="md:col-span-2"><FormField label="Replacement Reason" type="textarea" value={resealForm.removal_reason} onChange={(value) => setResealForm((currentForm) => ({ ...currentForm, removal_reason: String(value) }))} rows={3} required /></div>
          <div className="md:col-span-2"><SealPhotoDropZone file={resealPhoto} onChange={setResealPhoto} /></div>
          <div className="md:col-span-2"><FormField label="New Seal Notes" type="textarea" value={resealForm.notes} onChange={(value) => setResealForm((currentForm) => ({ ...currentForm, notes: String(value) }))} rows={3} /></div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setIsResealOpen(false)} className="secondary-action">{translate('Cancel')}</button>
          <button type="button" onClick={saveReseal} disabled={isResealing} className="primary-action disabled:cursor-not-allowed disabled:opacity-60">
            {isResealing ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            {translate(isResealing ? 'Saving...' : 'Record New Seal')}
          </button>
        </div>
      </Modal>

      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Remove Meter Assignment" size="lg">
        {error && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{translate(error)}</div>}
        <div className="space-y-4">
          <div className="border-y border-[var(--border-subtle)] bg-[var(--surface-soft)] px-4 py-3">
            <p className="text-xs font-bold text-[var(--text-muted)]">{translate('Meter')}</p>
            <p className="mt-1 font-mono text-sm font-extrabold text-[var(--text-primary)]">{current.meter?.meter_number ?? '-'}</p>
          </div>
          <FormField
            label="Meter Destination"
            type="select"
            value={removalForm.disposition}
            onChange={(value) => setRemovalForm({ ...removalForm, disposition: value as typeof removalForm.disposition })}
            options={[
              { value: 'return_to_stock', label: 'Return to warehouse stock' },
              { value: 'repair', label: 'Send to repair' },
              { value: 'scrap', label: 'Scrap / retire' },
            ]}
            required
          />
          {removalForm.disposition === 'return_to_stock' ? (
            <FormField label="Return Warehouse" type="select" value={removalForm.return_warehouse_id} onChange={(value) => setRemovalForm({ ...removalForm, return_warehouse_id: String(value) })} options={warehouses.map((warehouse) => ({ value: warehouse.id, label: `${warehouse.name} (${warehouse.code})` }))} required />
          ) : null}
          <FormField label="Removal Reason" type="textarea" value={removalForm.reason} onChange={(value) => setRemovalForm({ ...removalForm, reason: String(value) })} required />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setIsDeleteOpen(false)} className="secondary-action">{translate('Cancel')}</button>
          <button type="button" onClick={remove} disabled={!removalForm.reason.trim() || (removalForm.disposition === 'return_to_stock' && !removalForm.return_warehouse_id)} className="primary-action disabled:cursor-not-allowed disabled:opacity-60">
            {translate('Confirm Removal')}
          </button>
        </div>
      </Modal>
    </div>
  )
}
