'use client'

import { useMemo, useState } from 'react'
import { Gauge, LoaderCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { FormField } from '@/components/ui/FormField'
import { Modal } from '@/components/ui/Modal'
import { useCalendar } from '@/context/CalendarContext'
import { useLanguage } from '@/context/LanguageContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import {
  useCreateMeterReadingMutation,
  useGetBillingPeriodsQuery,
  type BillingPeriod,
  type MeterAssignment,
  type MeterReading,
} from '@/src/store/waternetApi'

type ReadingForm = {
  billing_period_id?: number
  reading_date: string
  current_reading?: number
  due_date: string
  notes: string
}

type CustomerMeterReadingModalProps = {
  isOpen: boolean
  onClose: () => void
  onSaved: () => void | Promise<unknown>
  customerName: string
  assignment?: MeterAssignment
  readings: MeterReading[]
}

const dateValue = (value?: string) => value?.slice(0, 10) ?? ''

const defaultReadingDateForPeriod = (period: BillingPeriod | undefined, businessDate: string) => {
  if (!period) return businessDate
  if (businessDate < dateValue(period.starts_on)) return dateValue(period.starts_on)
  if (businessDate > dateValue(period.ends_on)) return dateValue(period.ends_on)
  return businessDate
}

const findDefaultPeriod = (periods: BillingPeriod[], businessDate: string) => {
  const openPeriods = periods.filter((period) => period.status === 'open')
  return openPeriods.find((period) => dateValue(period.starts_on) <= businessDate && dateValue(period.ends_on) >= businessDate)
    ?? openPeriods[0]
}

const apiErrorMessage = (error: unknown) => {
  const fallback = 'Unable to save meter reading. Check duplicate period readings and the current reading value.'
  if (!error || typeof error !== 'object' || !('data' in error)) return fallback
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } }).data
  if (data?.errors) {
    const firstError = Object.values(data.errors).flat()[0]
    if (firstError) return firstError
  }
  return data?.message || fallback
}

export function CustomerMeterReadingModal({
  isOpen,
  onClose,
  onSaved,
  customerName,
  assignment,
  readings,
}: CustomerMeterReadingModalProps) {
  const { formatDate } = useCalendar()
  const { translate } = useLanguage()
  const { businessDate } = useTrainingMode()
  const { data: periodData, isLoading: periodsLoading } = useGetBillingPeriodsQuery(undefined, { skip: !isOpen })
  const [createMeterReading, { isLoading: isSaving }] = useCreateMeterReadingMutation()
  const [form, setForm] = useState<ReadingForm>({ reading_date: '', due_date: '', notes: '' })
  const [error, setError] = useState('')
  const periods = useMemo(() => periodData ?? [], [periodData])
  const openPeriods = periods.filter((period) => period.status === 'open')
  const defaultPeriod = findDefaultPeriod(periods, businessDate)
  const selectedPeriod = openPeriods.find((period) => period.id === form.billing_period_id) ?? defaultPeriod
  const readingDate = form.reading_date || defaultReadingDateForPeriod(selectedPeriod, businessDate)
  const dueDate = form.due_date || (selectedPeriod ? dateValue(selectedPeriod.ends_on) : '')
  const assignmentReadings = readings.filter((reading) => reading.meter_assignment_id === assignment?.id)
  const existingReading = assignmentReadings.find((reading) => reading.billing_period_id === selectedPeriod?.id)
  const previousReadingRecord = [...assignmentReadings]
    .filter((reading) => !selectedPeriod || dateValue(reading.reading_date) < dateValue(selectedPeriod.starts_on))
    .sort((left, right) => dateValue(right.reading_date).localeCompare(dateValue(left.reading_date)) || right.id - left.id)[0]
  const previousReading = Number(previousReadingRecord?.current_reading ?? assignment?.initial_reading ?? 0)
  const consumption = form.current_reading === undefined ? undefined : Math.max(0, form.current_reading - previousReading)

  const close = () => {
    if (!isSaving) onClose()
  }

  const save = async () => {
    setError('')
    if (!assignment) {
      setError('This customer does not have an active meter assignment.')
      return
    }
    if (!selectedPeriod?.id) {
      setError('Select an open billing period before saving the reading.')
      return
    }
    if (existingReading) {
      setError('This meter already has a reading for the selected billing period.')
      return
    }
    if (form.current_reading === undefined) {
      setError('Enter the new current meter reading before saving.')
      return
    }
    if (form.current_reading < previousReading) {
      setError(`Current reading cannot be less than previous reading (${previousReading.toLocaleString()} m3).`)
      return
    }

    try {
      await createMeterReading({
        billing_period_id: selectedPeriod.id,
        meter_assignment_id: assignment.id,
        reading_date: readingDate,
        current_reading: form.current_reading,
        due_date: dueDate || undefined,
        status: 'recorded',
        notes: form.notes || undefined,
      }).unwrap()
      onClose()
      void onSaved()
    } catch (saveError) {
      setError(apiErrorMessage(saveError))
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={close} title="Record Meter Reading" size="lg">
      <div className="space-y-4">
        {error && (
          <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]" role="alert">
            {translate(error)}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--accent)]/30 bg-[var(--accent-soft)] px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--bg-surface)] text-[var(--accent)]">
              <Gauge className="h-4 w-4" />
            </span>
            <div>
              <p className="text-sm font-extrabold text-[var(--text-primary)]">{customerName}</p>
              <p className="mt-0.5 text-xs font-bold text-[var(--text-muted)]">{assignment?.meter?.meter_number ?? translate('No active meter')}</p>
            </div>
          </div>
          {assignment && <Badge color="blue">{translate('Active Meter')}</Badge>}
        </div>

        {periodsLoading ? (
          <div className="flex min-h-28 items-center justify-center text-[var(--text-muted)]">
            <LoaderCircle className="h-5 w-5 animate-spin" />
          </div>
        ) : openPeriods.length === 0 ? (
          <div className="rounded-lg border border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-bold text-[var(--gold)]">
            {translate('No open billing period is available. Create one from Billing Periods first.')}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <FormField
                label="Billing Period"
                type="select"
                value={selectedPeriod?.id ?? ''}
                onChange={(value) => {
                  const period = openPeriods.find((item) => item.id === Number(value))
                  setForm((current) => ({
                    ...current,
                    billing_period_id: Number(value),
                    reading_date: defaultReadingDateForPeriod(period, businessDate),
                    due_date: period ? dateValue(period.ends_on) : '',
                    current_reading: undefined,
                  }))
                  setError('')
                }}
                options={openPeriods.map((period) => ({ value: period.id, label: `${period.name} (${period.code})` }))}
                required
              />
            </div>

            {selectedPeriod && (
              <div className="md:col-span-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3 text-sm font-bold text-[var(--text-secondary)]">
                {translate('Selected period dates:')} {formatDate(selectedPeriod.starts_on)} {translate('to')} {formatDate(selectedPeriod.ends_on)}
              </div>
            )}

            {existingReading ? (
              <div className="md:col-span-2 rounded-lg border border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-bold text-[var(--gold)]">
                {translate('This meter already has a reading for the selected billing period.')} {existingReading.invoice?.invoice_number ?? ''}
              </div>
            ) : (
              <>
                <div className="md:col-span-2 grid grid-cols-3 gap-3">
                  <ReadingMetric label="Previous Reading" value={`${previousReading.toLocaleString()} m3`} />
                  <ReadingMetric label="Minimum Current" value={`${previousReading.toLocaleString()} m3`} />
                  <ReadingMetric label="Usage Preview" value={consumption === undefined ? '-' : `${consumption.toLocaleString()} m3`} />
                </div>
                <FormField label="Reading Date" type="date" value={readingDate} onChange={(value) => setForm((current) => ({ ...current, reading_date: String(value) }))} required />
                <FormField label="Current Reading" type="number" value={form.current_reading ?? ''} onChange={(value) => setForm((current) => ({ ...current, current_reading: value === '' ? undefined : Number(value) }))} min={previousReading} required />
                <FormField label="Invoice Due Date" type="date" value={dueDate} onChange={(value) => setForm((current) => ({ ...current, due_date: String(value) }))} />
                <div className="md:col-span-2">
                  <FormField label="Notes" type="textarea" value={form.notes} onChange={(value) => setForm((current) => ({ ...current, notes: String(value) }))} />
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex justify-end gap-3 border-t border-[var(--border-subtle)] pt-4">
          <button type="button" onClick={close} className="secondary-action" disabled={isSaving}>{translate('Cancel')}</button>
          <button
            type="button"
            onClick={save}
            className="primary-action disabled:cursor-not-allowed disabled:opacity-50"
            disabled={isSaving || periodsLoading || !assignment || !selectedPeriod || form.current_reading === undefined || Boolean(existingReading)}
          >
            {isSaving && <LoaderCircle className="h-4 w-4 animate-spin" />}
            {translate(isSaving ? 'Saving...' : 'Save Reading')}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function ReadingMetric({ label, value }: { label: string; value: string }) {
  const { translate } = useLanguage()
  return (
    <div className="min-w-0 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-3">
      <p className="text-[10px] font-extrabold uppercase text-[var(--text-muted)]">{translate(label)}</p>
      <p className="mt-1 break-words text-sm font-extrabold text-[var(--text-primary)]">{value}</p>
    </div>
  )
}
