'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Badge } from '@/components/ui/Badge'
import { DateText } from '@/components/ui/DateText'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useCalendar } from '@/context/CalendarContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import { calendarMonthBounds, getShamsiParts } from '@/lib/dates'
import {
  useCreateBillingPeriodMutation,
  useDeleteBillingPeriodMutation,
  useGetBillingPeriodsQuery,
  useUpdateBillingPeriodMutation,
  type BillingPeriod,
} from '@/src/store/waternetApi'

const statusColor = { open: 'emerald', closed: 'slate', locked: 'amber' } as const
const dateValue = (value?: string) => (value ? value.slice(0, 10) : '')

export default function BillingPeriodsPage() {
  const { businessDate } = useTrainingMode()
  const { calendarSystem, formatDate } = useCalendar()
  const { data = [], isLoading, isError } = useGetBillingPeriodsQuery()
  const [createBillingPeriod] = useCreateBillingPeriodMutation()
  const [updateBillingPeriod] = useUpdateBillingPeriodMutation()
  const [deleteBillingPeriod] = useDeleteBillingPeriodMutation()
  const [current, setCurrent] = useState<Partial<BillingPeriod>>({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [error, setError] = useState('')
  const showSkeleton = isLoading && data.length === 0

  const columns: Column<BillingPeriod>[] = [
    { key: 'name', label: 'Period' },
    { key: 'code', label: 'Code' },
    { key: 'starts_on', label: 'Start', render: (item) => <DateText value={item.starts_on} /> },
    { key: 'ends_on', label: 'End', render: (item) => <DateText value={item.ends_on} /> },
    { key: 'meter_readings_count', label: 'Readings', render: (item) => item.meter_readings_count ?? 0 },
    { key: 'invoices_count', label: 'Invoices', render: (item) => item.invoices_count ?? 0 },
    { key: 'status', label: 'Status', render: (item) => <Badge color={statusColor[item.status]}>{item.status}</Badge> },
  ]

  const openNew = () => {
    const shamsi = getShamsiParts(businessDate)
    const code = calendarSystem === 'shamsi' && shamsi
      ? `${shamsi.year}-${shamsi.month}`
      : businessDate.slice(0, 7)
    const bounds = calendarMonthBounds(businessDate, calendarSystem)
    setCurrent({
      name: `${formatDate(businessDate, 'month')} Billing`,
      code,
      starts_on: bounds.period_start,
      ends_on: bounds.period_end,
      status: 'open',
    })
    setIsModalOpen(true)
  }

  const save = async () => {
    setError('')
    try {
      const payload = {
        ...current,
        starts_on: dateValue(current.starts_on),
        ends_on: dateValue(current.ends_on),
      }

      if (current.id) {
        await updateBillingPeriod({ id: current.id, body: payload }).unwrap()
      } else {
        await createBillingPeriod(payload).unwrap()
      }

      setIsModalOpen(false)
      setCurrent({})
    } catch {
      setError('Unable to save billing period.')
    }
  }

  const remove = async () => {
    if (!current.id) return
    try {
      await deleteBillingPeriod(current.id).unwrap()
      setIsDeleteOpen(false)
      setCurrent({})
    } catch {
      setError('A billing period with readings or invoices cannot be deleted.')
      setIsDeleteOpen(false)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Billing Periods" subtitle="Open monthly billing windows for meter readings and invoices">
        <button type="button" onClick={openNew} className="primary-action text-sm">
          <Plus size={18} /> Add Period
        </button>
      </PageHeader>
      {(error || isError) && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{error || 'Unable to load billing periods.'}</div>}
      <DataTable columns={columns} data={data} loading={showSkeleton} onEdit={(item) => { setCurrent(item); setIsModalOpen(true) }} onDelete={(item) => { setCurrent(item); setIsDeleteOpen(true) }} searchKeys={['name', 'code', 'status']} />
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={current.id ? 'Edit Billing Period' : 'Add Billing Period'} size="lg">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField label="Name" value={current.name ?? ''} onChange={(val) => setCurrent({ ...current, name: val as string })} required />
          <FormField label="Code" value={current.code ?? ''} onChange={(val) => setCurrent({ ...current, code: val as string })} placeholder="2026-06" required />
          <FormField label="Starts On" type="date" value={dateValue(current.starts_on)} onChange={(val) => setCurrent({ ...current, starts_on: val as string })} required />
          <FormField label="Ends On" type="date" value={dateValue(current.ends_on)} onChange={(val) => setCurrent({ ...current, ends_on: val as string })} required />
          <FormField label="Status" type="select" value={current.status ?? 'open'} onChange={(val) => setCurrent({ ...current, status: val as BillingPeriod['status'] })} options={[{ value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }, { value: 'locked', label: 'Locked' }]} />
          <div className="md:col-span-2">
            <FormField label="Notes" type="textarea" value={current.notes ?? ''} onChange={(val) => setCurrent({ ...current, notes: val as string })} />
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setIsModalOpen(false)} className="secondary-action">Cancel</button>
          <button type="button" onClick={save} className="primary-action">Save Period</button>
        </div>
      </Modal>
      <ConfirmDialog isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} onConfirm={remove} title="Delete Billing Period" message={`Delete ${current.name}?`} />
    </div>
  )
}
