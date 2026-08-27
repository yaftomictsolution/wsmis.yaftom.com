'use client'

import { useState } from 'react'
import { LoaderCircle, Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { SearchableSelect } from '@/components/ui/SearchableSelect'
import { Badge } from '@/components/ui/Badge'
import { DateText } from '@/components/ui/DateText'
import { useTrainingMode } from '@/context/TrainingModeContext'
import { useCalendar } from '@/context/CalendarContext'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import {
  useCreateMeterReadingMutation,
  useDeleteMeterReadingMutation,
  useGetBillingPeriodsQuery,
  useGetCustomersQuery,
  useGetMeterAssignmentsQuery,
  useGetMeterReadingsQuery,
  useGetServiceAreasQuery,
  type BillingPeriod,
  type MeterAssignment,
  type MeterReading,
} from '@/src/store/waternetApi'

type ReadingForm = Partial<MeterReading> & {
  due_date?: string
  service_area_id?: number
  service_area_mosque_id?: number
}

const readingStatusColor = { recorded: 'blue', reviewed: 'emerald' } as const
const dateValue = (value?: string) => (value ? value.slice(0, 10) : '')
const fallbackError = 'Unable to save meter reading. Check duplicate period readings and the current reading value.'
const workflowReadyStatuses = ['installation_pending', 'approved', 'signed', 'active']

const getApiErrorMessage = (err: unknown) => {
  if (!err || typeof err !== 'object' || !('data' in err)) return fallbackError

  const data = (err as { data?: unknown }).data
  if (!data || typeof data !== 'object') return fallbackError

  const message = (data as { message?: unknown }).message
  if (typeof message === 'string') return message

  const errors = (data as { errors?: unknown }).errors
  if (!errors || typeof errors !== 'object') return fallbackError

  for (const value of Object.values(errors as Record<string, unknown>)) {
    if (Array.isArray(value) && typeof value[0] === 'string') return value[0]
    if (typeof value === 'string') return value
  }

  return fallbackError
}

const defaultReadingDateForPeriod = (period: BillingPeriod | undefined, businessDate: string) => {
  if (!period) return businessDate

  const currentDate = businessDate
  const startsOn = dateValue(period.starts_on)
  const endsOn = dateValue(period.ends_on)

  if (currentDate < startsOn) return startsOn
  if (currentDate > endsOn) return endsOn

  return currentDate
}

const latestReadingForAssignment = (assignmentId: number | undefined, readings: MeterReading[]) => {
  if (!assignmentId) return undefined

  return readings
    .filter((reading) => reading.meter_assignment_id === assignmentId)
    .sort((left, right) => {
      const rightDate = dateValue(right.reading_date).localeCompare(dateValue(left.reading_date))
      return rightDate || right.id - left.id
    })[0]
}

const findDefaultPeriod = (periods: BillingPeriod[], businessDate: string) => {
  const currentDate = businessDate
  const openPeriods = periods.filter((period) => period.status === 'open')

  return openPeriods.find((period) => dateValue(period.starts_on) <= currentDate && dateValue(period.ends_on) >= currentDate)
    ?? openPeriods[0]
}

const customerName = (assignment: MeterAssignment) =>
  [assignment.customer?.name, assignment.customer?.last_name].filter(Boolean).join(' ') || 'Customer'

const assignmentLabel = (assignment: MeterAssignment) =>
  `${customerName(assignment)} - ${assignment.meter?.meter_number ?? 'Meter'}`

export default function MeterReadingsPage() {
  const { formatDate } = useCalendar()
  const { businessDate } = useTrainingMode()
  const { data = [], isLoading, isError } = useGetMeterReadingsQuery()
  const { data: periods = [], isLoading: arePeriodsLoading } = useGetBillingPeriodsQuery()
  const { data: assignments = [], isLoading: areAssignmentsLoading } = useGetMeterAssignmentsQuery()
  const { data: serviceAreas = [], isLoading: areServiceAreasLoading } = useGetServiceAreasQuery()
  const { data: customers = [], isLoading: areCustomersLoading } = useGetCustomersQuery()
  const [createMeterReading] = useCreateMeterReadingMutation()
  const [deleteMeterReading] = useDeleteMeterReadingMutation()
  const [current, setCurrent] = useState<ReadingForm>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [error, setError] = useState('')
  const showSkeleton = isLoading && data.length === 0
  const areReadingOptionsLoading = arePeriodsLoading || areAssignmentsLoading || areServiceAreasLoading || areCustomersLoading

  const activePeriods = periods.filter((period) => period.status === 'open')
  const activeAssignments = assignments.filter((assignment) =>
    assignment.status === 'active'
      && workflowReadyStatuses.includes(assignment.contract?.status ?? assignment.customer?.agreement_status ?? ''),
  )
  const selectedPeriod = activePeriods.find((period) => period.id === Number(current.billing_period_id))
  const selectedPeriodReadings = data.filter((reading) => reading.billing_period_id === Number(current.billing_period_id))
  const selectedPeriodReadingMap = new Map(selectedPeriodReadings.map((reading) => [reading.meter_assignment_id, reading]))
  const availableAssignments = activeAssignments.filter((assignment) => !selectedPeriodReadingMap.has(assignment.id))
  const alreadyReadAssignments = activeAssignments.filter((assignment) => selectedPeriodReadingMap.has(assignment.id))
  const selectedArea = serviceAreas.find((area) => area.id === Number(current.service_area_id))
  const availableMosques = current.service_area_id ? selectedArea?.mosques ?? [] : []
  const mosqueCustomers = customers.filter(
    (customer) => customer.service_area_id === Number(current.service_area_id)
      && customer.service_area_mosque_id === Number(current.service_area_mosque_id),
  )
  const selectedCustomer = mosqueCustomers.find((customer) => customer.id === Number(current.customer_id))
  const selectedRawAssignment = assignments.find(
    (assignment) => assignment.status === 'active' && assignment.customer_id === Number(current.customer_id),
  )
  const selectedActiveAssignment = activeAssignments.find(
    (assignment) => assignment.customer_id === Number(current.customer_id),
  )
  const selectedAssignment = availableAssignments.find(
    (assignment) => assignment.customer_id === Number(current.customer_id),
  )
  const selectedExistingReading = selectedActiveAssignment
    ? selectedPeriodReadingMap.get(selectedActiveAssignment.id)
    : undefined
  const latestReading = latestReadingForAssignment(selectedAssignment?.id, data)
  const previousReading = Number(latestReading?.current_reading ?? selectedAssignment?.initial_reading ?? 0)
  const hasCurrentReading = current.current_reading !== undefined && current.current_reading !== null && current.current_reading !== ''
  const currentReading = hasCurrentReading ? Number(current.current_reading) : undefined
  const consumptionPreview = currentReading === undefined ? undefined : Math.max(0, currentReading - previousReading)

  const columns: Column<MeterReading>[] = [
    { key: 'billing_period', label: 'Period', render: (item) => item.billing_period?.name ?? '-' },
    { key: 'customer', label: 'Customer', render: (item) => item.customer?.name ?? '-' },
    { key: 'meter', label: 'Meter', render: (item) => item.meter?.meter_number ?? '-' },
    { key: 'reading_date', label: 'Read Date', render: (item) => <DateText value={item.reading_date} /> },
    { key: 'previous_reading', label: 'Previous', render: (item) => `${Number(item.previous_reading).toLocaleString()} m3` },
    { key: 'current_reading', label: 'Current', render: (item) => `${Number(item.current_reading).toLocaleString()} m3` },
    { key: 'consumption', label: 'Usage', render: (item) => `${Number(item.consumption).toLocaleString()} m3` },
    { key: 'invoice', label: 'Invoice', render: (item) => item.invoice ? `${item.invoice.invoice_number} / AFN ${Number(item.invoice.remaining_amount).toLocaleString()}` : '-' },
    { key: 'status', label: 'Status', render: (item) => <Badge color={readingStatusColor[item.status]}>{item.status}</Badge> },
  ]

  const openNew = () => {
    const defaultPeriod = findDefaultPeriod(periods, businessDate)
    const readingDate = defaultReadingDateForPeriod(defaultPeriod, businessDate)

    setCurrent({
      billing_period_id: defaultPeriod?.id,
      meter_assignment_id: undefined,
      customer_id: undefined,
      service_area_id: undefined,
      service_area_mosque_id: undefined,
      current_reading: undefined,
      due_date: defaultPeriod ? dateValue(defaultPeriod.ends_on) : '',
      reading_date: readingDate,
      status: 'recorded',
    })
    setError('')
    setIsModalOpen(true)
  }

  const save = async () => {
    setError('')
    
    if (!current.billing_period_id) {
      setError('Select an open billing period before saving the reading.')
      return
    }
    if (!current.meter_assignment_id) {
      setError('Select the customer meter assignment before saving the reading.')
      return
    }
    if (!hasCurrentReading) {
      setError('Enter the new current meter reading before saving.')
      return
    }
    if (Number(current.current_reading) < previousReading) {
      setError(`Current reading cannot be less than previous reading (${previousReading.toLocaleString()} m3).`)
      return
    }
    try {
      await createMeterReading({
        billing_period_id: current.billing_period_id,
        meter_assignment_id: current.meter_assignment_id,
        reading_date: dateValue(current.reading_date) || businessDate,
        current_reading: Number(current.current_reading ?? 0),
        due_date: current.due_date || undefined,
        status: current.status ?? 'recorded',
        notes: current.notes,
      }).unwrap()

      setIsModalOpen(false)
      setCurrent({})
    } catch (err) {
      setError(getApiErrorMessage(err))
    }
  }

  const remove = async () => {
    if (!current.id) return

    try {
      await deleteMeterReading(current.id).unwrap()
      setIsDeleteOpen(false)
      setCurrent({})
    } catch {
      setError('A reading with payments cannot be deleted.')
      setIsDeleteOpen(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Meter Readings" subtitle="Record customer meter usage and automatically generate invoices">
        <button
          type="button"
          onClick={openNew}
          className="primary-action text-sm disabled:cursor-wait disabled:opacity-65"
          disabled={areReadingOptionsLoading}
          aria-busy={areReadingOptionsLoading}
        >
          {areReadingOptionsLoading ? <LoaderCircle size={18} className="animate-spin" /> : <Plus size={18} />}
          {areReadingOptionsLoading ? 'Loading Options...' : 'Record Reading'}
        </button>
      </PageHeader>
      {(error || isError) && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{error || 'Unable to load meter readings.'}</div>}
      <DataTable columns={columns} data={data} loading={showSkeleton} onDelete={(item) => { setCurrent(item); setIsDeleteOpen(true) }} searchKeys={['status', 'notes']} />
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="Record Meter Reading" size="xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            {activePeriods.length > 0 ? (
              <FormField
                label="Billing Period"
                type="select"
                value={current.billing_period_id ?? ''}
                onChange={(val) => {
                  const period = activePeriods.find((item) => item.id === Number(val))
                  const readingDate = defaultReadingDateForPeriod(period, businessDate)
                  setCurrent({
                    ...current,
                    billing_period_id: Number(val),
                    meter_assignment_id: undefined,
                    customer_id: undefined,
                    service_area_id: undefined,
                    service_area_mosque_id: undefined,
                    current_reading: undefined,
                    due_date: period ? dateValue(period.ends_on) : current.due_date,
                    reading_date: readingDate,
                  })
                }}
                options={activePeriods.map((period) => ({ value: period.id, label: `${period.name} (${period.code})` }))}
                required
              />
            ) : (
              <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3 text-sm font-bold text-[var(--text-secondary)]">
                No open billing period is available. Create one from Billing Periods first.
              </div>
            )}
          </div>
          {selectedPeriod && (
            <div className="md:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-sm font-bold text-[var(--text-secondary)]">
              Selected period dates: {formatDate(selectedPeriod.starts_on)} to {formatDate(selectedPeriod.ends_on)}
            </div>
          )}
          {selectedPeriod ? (
            <>
              <div className="md:col-span-2 grid grid-cols-1 gap-4 lg:grid-cols-3">
                <SearchableSelect
                  label="Service Area"
                  value={current.service_area_id}
                  onChange={(value) => setCurrent({
                    ...current,
                    service_area_id: Number(value),
                    service_area_mosque_id: undefined,
                    customer_id: undefined,
                    meter_assignment_id: undefined,
                    current_reading: undefined,
                  })}
                  options={serviceAreas.map((area) => ({
                    value: area.id,
                    label: area.name,
                    searchText: `${area.district ?? ''} ${area.street_block_village ?? ''}`,
                  }))}
                  searchPlaceholder="Search service areas..."
                  emptyMessage="No matching service area found."
                  required
                />
                <SearchableSelect
                  label="Mosque"
                  value={current.service_area_mosque_id}
                  onChange={(value) => setCurrent({
                    ...current,
                    service_area_mosque_id: Number(value),
                    customer_id: undefined,
                    meter_assignment_id: undefined,
                    current_reading: undefined,
                  })}
                  options={availableMosques.map((mosque) => ({
                    value: mosque.id ?? 0,
                    label: mosque.name,
                    searchText: mosque.notes,
                  }))}
                  placeholder="Select a mosque"
                  searchPlaceholder="Search mosques..."
                  emptyMessage="No mosque is registered in this service area."
                  disabled={!current.service_area_id}
                  required
                />
                <SearchableSelect
                  label="Customer"
                  value={current.customer_id}
                  onChange={(value) => {
                    const customerId = Number(value)
                    const assignment = availableAssignments.find((item) => item.customer_id === customerId)
                    setCurrent({
                      ...current,
                      customer_id: customerId,
                      meter_assignment_id: assignment?.id,
                      current_reading: undefined,
                    })
                  }}
                  options={mosqueCustomers.map((customer) => ({
                    value: customer.id,
                    label: `${[customer.name, customer.last_name].filter(Boolean).join(' ')}${customer.house_number ? ` (${customer.house_number})` : ''}`,
                    searchText: `${customer.subscription_code ?? ''} ${customer.phone ?? ''}`,
                  }))}
                  placeholder="Select a customer"
                  searchPlaceholder="Search customers..."
                  emptyMessage="No customer is registered under this mosque."
                  disabled={!current.service_area_mosque_id}
                  required
                />
              </div>
              {current.service_area_id && availableMosques.length === 0 && (
                <div className="md:col-span-2 rounded-lg border border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-bold text-[var(--gold)]">
                  No mosque is registered in this service area. Add a mosque from Service Areas first.
                </div>
              )}
              {selectedAssignment && (
                <div className="md:col-span-2 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3">
                  <div>
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">Selected Meter</p>
                    <p className="mt-1 text-sm font-extrabold text-[var(--text-primary)]">{assignmentLabel(selectedAssignment)}</p>
                  </div>
                  <Badge color="blue">{selectedAssignment.customer?.subscription_code ?? `CUS-${selectedAssignment.customer_id}`}</Badge>
                </div>
              )}
              {selectedCustomer && !selectedAssignment && (
                <div className="md:col-span-2 rounded-lg border border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-bold text-[var(--gold)]">
                  {selectedExistingReading
                    ? `${selectedCustomer.name} already has a reading for this billing period (${selectedExistingReading.invoice?.invoice_number ?? 'invoice created'}).`
                    : !selectedRawAssignment
                      ? `${selectedCustomer.name} does not have an active meter assignment.`
                      : !selectedActiveAssignment
                        ? `${selectedCustomer.name}'s contract is not ready for meter reading.`
                        : `${selectedCustomer.name}'s meter is not available for this billing period.`}
                </div>
              )}
              {alreadyReadAssignments.length > 0 && (
                <div className="md:col-span-2 rounded-lg border border-[var(--gold)]/60 bg-[var(--gold-soft)] p-4 text-sm text-[var(--text-secondary)]">
                  <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--gold)]">Already read for this period</p>
                  <div className="mt-3 grid gap-2">
                    {alreadyReadAssignments.map((assignment) => {
                      const reading = selectedPeriodReadingMap.get(assignment.id)

                      return (
                        <div key={assignment.id} className="flex flex-col gap-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                          <span className="font-extrabold text-[var(--text-primary)]">{assignmentLabel(assignment)}</span>
                          <span className="text-xs font-bold text-[var(--text-muted)]">
                            {reading ? `${formatDate(reading.reading_date)} - ${Number(reading.current_reading).toLocaleString()} m3${reading.invoice ? ` - ${reading.invoice.invoice_number}` : ''}` : 'Reading already exists'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </>
          ) : null}
          {selectedAssignment && (
            <div className="md:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
              <p className="mb-3 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">Reading Check</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">Previous Reading</p>
                  <p className="mt-1 text-base font-extrabold text-[var(--text-primary)]">{previousReading.toLocaleString()} m3</p>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">Minimum Current</p>
                  <p className="mt-1 text-base font-extrabold text-[var(--gold)]">{previousReading.toLocaleString()} m3</p>
                </div>
                <div className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[var(--text-muted)]">Usage Preview</p>
                  <p className="mt-1 text-base font-extrabold text-[var(--mint)]">{consumptionPreview === undefined ? 'Enter new reading' : `${consumptionPreview.toLocaleString()} m3`}</p>
                </div>
              </div>
            </div>
          )}
          <FormField label="Reading Date" type="date" value={dateValue(current.reading_date) || businessDate} onChange={(val) => setCurrent({ ...current, reading_date: val as string })} required />
          <FormField label="Current Reading" type="number" value={current.current_reading ?? ''} onChange={(val) => setCurrent({ ...current, current_reading: val === '' ? undefined : Number(val) })} min={previousReading} required />
          <FormField label="Invoice Due Date" type="date" value={dateValue(current.due_date)} onChange={(val) => setCurrent({ ...current, due_date: val as string })} />
          <FormField label="Status" type="select" value={current.status ?? 'recorded'} onChange={(val) => setCurrent({ ...current, status: val as MeterReading['status'] })} options={[{ value: 'recorded', label: 'Recorded' }, { value: 'reviewed', label: 'Reviewed' }]} />
          <div className="md:col-span-2">
            <FormField label="Notes" type="textarea" value={current.notes ?? ''} onChange={(val) => setCurrent({ ...current, notes: val as string })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setIsModalOpen(false)} className="secondary-action">Cancel</button>
          <button
            type="button"
            onClick={save}
            disabled={!current.billing_period_id || !current.meter_assignment_id || !hasCurrentReading}
            className="primary-action disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save Reading
          </button>
        </div>
      </Modal>
      <ConfirmDialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} onConfirm={remove} title="Delete Meter Reading" message="Deleting a reading also removes its invoice if no payment has been posted." />
    </div>
  )
}
