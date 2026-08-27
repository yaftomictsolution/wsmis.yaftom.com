'use client'

import { useEffect, useState } from 'react'
import { useDispatch } from 'react-redux'
import { CalendarDays, ExternalLink, GraduationCap, Plus, RotateCcw, Save, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { FormField } from '@/components/ui/FormField'
import { Badge } from '@/components/ui/Badge'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { LoadingButton } from '@/components/ui/AsyncButton'
import { FormSectionSkeleton } from '@/components/ui/Skeleton'
import { DashboardFishToggle } from '@/components/settings/DashboardFishToggle'
import { useCalendar } from '@/context/CalendarContext'
import { DatePickerField } from '@/components/ui/DatePickerField'
import { DateText } from '@/components/ui/DateText'
import {
  useCreateFinancialCategoryMutation,
  useCreateCustomerChargeTypeMutation,
  useCreatePaymentMethodMutation,
  useDeleteCustomerChargeTypeMutation,
  useDeleteFinancialCategoryMutation,
  useDeletePaymentMethodMutation,
  useGetMeQuery,
  useGetLeaveSettingsQuery,
  useGetSettingsQuery,
  useGetTrainingModeQuery,
  useAdvanceTrainingDataResetMutation,
  useStartTrainingDataResetMutation,
  useUpdateCustomerChargeTypeMutation,
  useUpdateFinancialCategoryMutation,
  useUpdatePaymentMethodMutation,
  useUpdateLeaveSettingsMutation,
  useUpdateSystemProfileMutation,
  useUpdateTrainingModeMutation,
  type CustomerChargeType,
  type FinancialCategory,
  type LeaveSettings,
  type PaymentMethod,
  type SystemProfile,
  type TrainingResetProgress,
  waternetApi,
} from '@/src/store/waternetApi'

const defaultProfile: SystemProfile = {
  company_name: 'WaterNet MIS',
  system_name: 'Water Supply Network Management System',
  currency: 'AFN',
  language: 'en',
  calendar_system: 'shamsi',
  show_gregorian_secondary: false,
  phone: '',
  address: '',
}

const defaultLeaveSettings: LeaveSettings = {
  annual_leave_days: 20,
  carry_forward_days: 5,
  sick_leave_days: 10,
  emergency_leave_days: 5,
}

const statusColor = { active: 'emerald', inactive: 'slate' } as const
const typeColor = { income: 'emerald', expense: 'amber' } as const

const apiErrorMessage = (error: unknown, fallback: string) => {
  if (!error || typeof error !== 'object' || !('data' in error)) return fallback
  const data = (error as { data?: { message?: string; errors?: Record<string, string[]> } }).data
  const firstValidationError = data?.errors ? Object.values(data.errors).flat()[0] : undefined
  return firstValidationError || data?.message || fallback
}

export default function SettingsPage() {
  const dispatch = useDispatch()
  const { setCalendarSystem, setShowGregorianSecondary } = useCalendar()
  const { data, isLoading, isError } = useGetSettingsQuery()
  const { data: trainingMode, isLoading: trainingModeLoading } = useGetTrainingModeQuery()
  const { data: currentUser } = useGetMeQuery()
  const canManageLeaveSettings = currentUser?.roles.some((role) => ['Admin', 'Super Admin'].includes(role)) ?? false
  const { data: leaveSettingsData, isLoading: leaveSettingsLoading, isError: leaveSettingsError } = useGetLeaveSettingsQuery(undefined, { skip: !canManageLeaveSettings })
  const [updateSystemProfile] = useUpdateSystemProfileMutation()
  const [updateTrainingMode, updateTrainingModeState] = useUpdateTrainingModeMutation()
  const [startTrainingDataReset] = useStartTrainingDataResetMutation()
  const [advanceTrainingDataReset] = useAdvanceTrainingDataResetMutation()
  const [updateLeaveSettings, updateLeaveSettingsState] = useUpdateLeaveSettingsMutation()
  const [createPaymentMethod] = useCreatePaymentMethodMutation()
  const [updatePaymentMethod] = useUpdatePaymentMethodMutation()
  const [deletePaymentMethod] = useDeletePaymentMethodMutation()
  const [createFinancialCategory] = useCreateFinancialCategoryMutation()
  const [updateFinancialCategory] = useUpdateFinancialCategoryMutation()
  const [deleteFinancialCategory] = useDeleteFinancialCategoryMutation()
  const [createCustomerChargeType] = useCreateCustomerChargeTypeMutation()
  const [updateCustomerChargeType] = useUpdateCustomerChargeTypeMutation()
  const [deleteCustomerChargeType] = useDeleteCustomerChargeTypeMutation()
  const [profileDraft, setProfileDraft] = useState<SystemProfile | null>(null)
  const [leaveSettingsDraft, setLeaveSettingsDraft] = useState<LeaveSettings | null>(null)
  const [paymentCurrent, setPaymentCurrent] = useState<Partial<PaymentMethod>>({})
  const [categoryCurrent, setCategoryCurrent] = useState<Partial<FinancialCategory>>({})
  const [chargeTypeCurrent, setChargeTypeCurrent] = useState<Partial<CustomerChargeType>>({})
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [categoryModalOpen, setCategoryModalOpen] = useState(false)
  const [chargeTypeModalOpen, setChargeTypeModalOpen] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'payment' | 'category' | 'chargeType'; id: number; name: string } | null>(null)
  const [trainingDraft, setTrainingDraft] = useState<{ enabled: boolean; business_date: string } | null>(null)
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetConfirmation, setResetConfirmation] = useState('')
  const [resetPassword, setResetPassword] = useState('')
  const [resetProgress, setResetProgress] = useState<TrainingResetProgress | null>(null)
  const [resetRunning, setResetRunning] = useState(false)
  const [resetError, setResetError] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const url = new URL(window.location.href)
    if (url.searchParams.get('training_reset') !== 'complete') return

    const messageTimer = window.setTimeout(() => {
      setMessage('Training records were reset successfully. The application is showing fresh data.')
    }, 0)
    url.searchParams.delete('training_reset')
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`)

    return () => window.clearTimeout(messageTimer)
  }, [])

  const profile = profileDraft ?? { ...defaultProfile, ...(data?.system.system_profile ?? {}) }
  const leaveSettings = leaveSettingsDraft ?? leaveSettingsData ?? defaultLeaveSettings
  const paymentMethods = data?.payment_methods ?? []
  const categories = data?.financial_categories.filter((category) => category.type === 'income') ?? []
  const chargeTypes = data?.customer_charge_types ?? []
  const canManageChargeTypes = currentUser?.roles.some((role) => ['Admin', 'Super Admin'].includes(role)) ?? false
  const showSkeleton = isLoading && !data
  const trainingForm = trainingDraft ?? {
    enabled: trainingMode?.enabled ?? false,
    business_date: trainingMode?.business_date ?? trainingMode?.real_date ?? '',
  }

  const paymentColumns: Column<PaymentMethod>[] = [
    { key: 'name', label: 'Method' },
    { key: 'code', label: 'Code' },
    { key: 'status', label: 'Status', render: (item) => <Badge color={statusColor[item.status]}>{item.status}</Badge> },
  ]

  const categoryColumns: Column<FinancialCategory>[] = [
    { key: 'name', label: 'Category' },
    { key: 'code', label: 'Code' },
    { key: 'type', label: 'Type', render: (item) => <Badge color={typeColor[item.type]}>{item.type}</Badge> },
    { key: 'status', label: 'Status', render: (item) => <Badge color={statusColor[item.status]}>{item.status}</Badge> },
  ]

  const chargeTypeColumns: Column<CustomerChargeType>[] = [
    { key: 'name', label: 'Type Name' },
    { key: 'status', label: 'Status', render: (item) => <Badge color={statusColor[item.status]}>{item.status}</Badge> },
    { key: 'is_system', label: 'Kind', render: (item) => <Badge color={item.is_system ? 'blue' : 'slate'}>{item.is_system ? 'System' : 'Custom'}</Badge> },
    { key: 'charges_count', label: 'Used By', render: (item) => `${item.charges_count ?? 0} charges` },
    { key: 'description', label: 'Description' },
  ]

  const setProfile = (nextProfile: SystemProfile) => {
    setProfileDraft(nextProfile)
  }

  const saveProfile = async () => {
    setMessage('')
    setError('')
    try {
      await updateSystemProfile(profile).unwrap()
      setCalendarSystem(profile.calendar_system)
      setShowGregorianSecondary(profile.show_gregorian_secondary)
      setMessage('System profile saved.')
      setProfileDraft(null)
    } catch {
      setError('Unable to save system profile.')
    }
  }

  const saveTrainingMode = async () => {
    setMessage('')
    setError('')
    try {
      await updateTrainingMode(trainingForm).unwrap()
      dispatch(waternetApi.util.resetApiState())
      setTrainingDraft(null)
      setMessage(trainingForm.enabled
        ? `Training business date changed to ${trainingForm.business_date}.`
        : 'Training mode disabled. The training site now uses the real date.')
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Unable to update training mode.'))
    }
  }

  const resetTraining = async () => {
    setMessage('')
    setError('')
    setResetError('')
    setResetRunning(true)
    try {
      let progress = resetProgress?.status === 'running'
        ? resetProgress
        : await startTrainingDataReset({ confirmation: resetConfirmation, password: resetPassword }).unwrap()

      setResetProgress(progress)
      while (progress.status !== 'completed') {
        progress = await advanceTrainingDataReset(progress.operation_id).unwrap()
        setResetProgress(progress)
      }

      setResetConfirmation('')
      setResetPassword('')
      await new Promise((resolve) => window.setTimeout(resolve, 700))

      const nextUrl = new URL('/dashboard/settings', window.location.origin)
      nextUrl.searchParams.set('training_reset', 'complete')
      nextUrl.hash = 'training-mode'
      window.location.replace(nextUrl.toString())
    } catch (resetError) {
      setResetRunning(false)
      setResetProgress(null)
      setResetError(apiErrorMessage(resetError, 'Unable to reset training records. Please try again.'))
    }
  }

  const saveLeaveSettings = async () => {
    setMessage('')
    setError('')
    try {
      await updateLeaveSettings(leaveSettings).unwrap()
      setMessage('Leave settings saved.')
      setLeaveSettingsDraft(null)
    } catch (saveError) {
      setError(apiErrorMessage(saveError, 'Unable to save leave settings.'))
    }
  }

  const savePayment = async () => {
    setError('')
    try {
      if (paymentCurrent.id) {
        await updatePaymentMethod({ id: paymentCurrent.id, body: paymentCurrent }).unwrap()
      } else {
        await createPaymentMethod(paymentCurrent).unwrap()
      }
      setPaymentModalOpen(false)
      setPaymentCurrent({})
    } catch {
      setError('Unable to save payment method.')
    }
  }

  const saveCategory = async () => {
    setError('')
    try {
      if (categoryCurrent.id) {
        await updateFinancialCategory({ id: categoryCurrent.id, body: categoryCurrent }).unwrap()
      } else {
        await createFinancialCategory(categoryCurrent).unwrap()
      }
      setCategoryModalOpen(false)
      setCategoryCurrent({})
    } catch {
      setError('Unable to save financial category.')
    }
  }

  const saveChargeType = async () => {
    setError('')
    if (!chargeTypeCurrent.name?.trim()) {
      setError('Enter the charge type name.')
      return
    }

    try {
      if (chargeTypeCurrent.id) {
        await updateCustomerChargeType({ id: chargeTypeCurrent.id, body: chargeTypeCurrent }).unwrap()
      } else {
        await createCustomerChargeType(chargeTypeCurrent).unwrap()
      }
      setChargeTypeModalOpen(false)
      setChargeTypeCurrent({})
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to save customer charge type.'))
    }
  }

  const remove = async () => {
    if (!deleteTarget) return
    setError('')
    try {
      if (deleteTarget.type === 'payment') {
        await deletePaymentMethod(deleteTarget.id).unwrap()
      } else if (deleteTarget.type === 'category') {
        await deleteFinancialCategory(deleteTarget.id).unwrap()
      } else {
        await deleteCustomerChargeType(deleteTarget.id).unwrap()
      }
      setDeleteTarget(null)
    } catch (err) {
      setError(apiErrorMessage(err, 'Unable to delete this setting.'))
      setDeleteTarget(null)
    }
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto space-y-6">
      <PageHeader title="Settings" subtitle="Manage system identity, training, leave rules, payment methods, financial categories, and customer charge types" />
      {message && <div className="rounded-lg border border-[var(--mint)] bg-[var(--mint-soft)] px-4 py-3 text-sm font-bold text-[var(--mint)]">{message}</div>}
      {(error || isError || leaveSettingsError) && <div className="rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{error || 'Unable to load settings.'}</div>}

      {trainingModeLoading && !trainingMode ? (
        <FormSectionSkeleton rows={2} />
      ) : trainingMode ? (
        <section id="training-mode" className="elegant-panel scroll-mt-6 p-5">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${trainingMode.environment === 'training' ? 'bg-amber-400 text-slate-950' : 'bg-[var(--accent-soft)] text-[var(--accent)]'}`}>
                  {trainingMode.environment === 'training' ? <GraduationCap size={20} /> : <ShieldCheck size={20} />}
                </span>
                <div>
                  <h2 className="text-lg font-extrabold text-[var(--text-primary)]">Training Mode</h2>
                  <p className="text-sm text-[var(--text-muted)]">
                    {trainingMode.environment === 'training'
                      ? 'Practice with an isolated database and a controlled business date.'
                      : 'Production always uses the real date and production records cannot be reset here.'}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2 text-xs font-extrabold">
                <span className="rounded-md bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-secondary)]">Environment: {trainingMode.environment}</span>
                <span className="rounded-md bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-secondary)]">Real date: <DateText value={trainingMode.real_date} /></span>
                <span className="rounded-md bg-[var(--bg-elevated)] px-3 py-2 text-[var(--text-secondary)]">Effective date: <DateText value={trainingMode.effective_date} /></span>
              </div>
            </div>

            {trainingMode.environment === 'production' ? (
              trainingMode.training_url ? (
                <a className="primary-action text-sm" href={trainingMode.training_url} target="_blank" rel="noreferrer">
                  <GraduationCap size={17} /> Open Training System <ExternalLink size={15} />
                </a>
              ) : (
                <span className="rounded-md border border-[var(--border-subtle)] px-3 py-2 text-xs font-bold text-[var(--text-muted)]">Training site is not configured.</span>
              )
            ) : null}
          </div>

          {trainingMode.environment === 'training' ? (
            <div className="mt-5 border-t border-[var(--border-subtle)] pt-5">
              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,0.7fr)_auto] md:items-end">
                <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-2.5">
                  <input
                    type="checkbox"
                    checked={trainingForm.enabled}
                    disabled={!trainingMode.can_manage}
                    onChange={(event) => setTrainingDraft({ ...trainingForm, enabled: event.target.checked })}
                    className="h-4 w-4 accent-amber-500"
                  />
                  <span>
                    <span className="block text-sm font-extrabold text-[var(--text-primary)]">Use controlled business date</span>
                    <span className="block text-xs font-bold text-[var(--text-muted)]">All dated workflows use this date by default.</span>
                  </span>
                </label>

                <div className="space-y-1.5">
                  <label htmlFor="training-business-date" className="block text-sm font-bold text-[var(--text-secondary)]">Business Date</label>
                  <DatePickerField
                    id="training-business-date"
                    value={trainingForm.business_date}
                    max={trainingMode.real_date}
                    disabled={!trainingMode.can_manage}
                    onChange={(businessDate) => setTrainingDraft({ ...trainingForm, business_date: businessDate })}
                    className="field-control px-4 py-2.5 text-sm"
                  />
                </div>

                {trainingMode.can_manage ? (
                  <LoadingButton loading={updateTrainingModeState.isLoading} onClick={saveTrainingMode} disabled={!trainingForm.business_date} className="primary-action text-sm">
                    <Save size={16} /> Apply
                  </LoadingButton>
                ) : null}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  ['1', 'July 1', 'Create the account, customer, contract, and purchases.'],
                  ['2', 'July 31', 'Record meter readings, charges, and customer payments.'],
                  ['3', 'August 2', 'Reconcile every active account, then close July.'],
                ].map(([step, date, description]) => (
                  <div key={step} className="flex gap-3 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-black text-slate-950">{step}</span>
                    <div>
                      <p className="text-sm font-extrabold text-[var(--text-primary)]">Business date: {date}</p>
                      <p className="mt-1 text-xs font-bold leading-5 text-[var(--text-muted)]">{description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {trainingMode.can_manage ? (
                <div className="mt-5 flex flex-col gap-3 rounded-md border border-red-500/30 bg-red-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-extrabold text-[var(--text-primary)]">Reset training records</p>
                    <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">Clears operational and financial data. Users, roles, permissions, and system catalogs remain.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setResetError('')
                      setResetProgress(null)
                      setResetModalOpen(true)
                    }}
                    className="secondary-action shrink-0 border-red-500/40 text-red-500"
                  >
                    <RotateCcw size={16} /> Reset Data
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="elegant-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg font-extrabold text-[var(--text-primary)]">Dashboard Appearance</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Show natural animated fish over the dashboard water. Water and waves stay visible when fish are off.
          </p>
          <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">
            Personal visual effects are saved in this browser.
          </p>
        </div>
        <DashboardFishToggle />
      </section>

      <section id="date-calendar" className="elegant-panel p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex max-w-2xl items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
              <CalendarDays size={20} />
            </span>
            <div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)]">Date & Calendar</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">Choose how dates appear and are selected. Database dates remain standard Gregorian dates for reliable calculations.</p>
            </div>
          </div>
          <button type="button" onClick={saveProfile} className="primary-action shrink-0 text-sm">
            <Save size={16} /> Save Calendar
          </button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-bold text-[var(--text-secondary)]">Calendar System</p>
            <div className="grid grid-cols-2 gap-2 rounded-lg bg-[var(--bg-elevated)] p-1.5">
              {([
                ['shamsi', 'Hijri Shamsi'],
                ['gregorian', 'Gregorian'],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setProfile({ ...profile, calendar_system: value })}
                  className={`min-h-10 rounded-md px-3 text-sm font-extrabold transition-colors ${profile.calendar_system === value ? 'bg-[var(--accent)] text-white shadow-sm' : 'text-[var(--text-muted)] hover:bg-[var(--bg-surface)]'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex min-h-[68px] cursor-pointer items-center gap-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-4 py-3">
            <input
              type="checkbox"
              checked={profile.show_gregorian_secondary}
              disabled={profile.calendar_system !== 'shamsi'}
              onChange={(event) => setProfile({ ...profile, show_gregorian_secondary: event.target.checked })}
              className="h-4 w-4 accent-[var(--accent)]"
            />
            <span>
              <span className="block text-sm font-extrabold text-[var(--text-primary)]">Show Gregorian date underneath</span>
              <span className="mt-0.5 block text-xs font-bold text-[var(--text-muted)]">Useful for finance, payroll, contracts, and cross-checking official records.</span>
            </span>
          </label>
        </div>
      </section>

      {showSkeleton ? (
        <FormSectionSkeleton rows={6} />
      ) : (
        <section className="elegant-panel p-5">
          <div className="mb-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-[var(--text-primary)]">System Profile</h2>
              <p className="text-sm text-[var(--text-muted)]">Used on reports, receipts, and dashboard branding.</p>
            </div>
            <button type="button" onClick={saveProfile} className="primary-action text-sm">
              <Save size={16} /> Save Profile
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Company Name" value={profile.company_name} onChange={(val) => setProfile({ ...profile, company_name: val as string })} required />
            <FormField label="System Name" value={profile.system_name} onChange={(val) => setProfile({ ...profile, system_name: val as string })} required />
            <FormField label="Currency" value={profile.currency} onChange={(val) => setProfile({ ...profile, currency: val as string })} required />
            <FormField label="Language" type="select" value={profile.language} onChange={(val) => setProfile({ ...profile, language: val as string })} options={[{ value: 'en', label: 'English' }, { value: 'fa', label: 'Dari' }]} required />
            <FormField label="Phone" value={profile.phone ?? ''} onChange={(val) => setProfile({ ...profile, phone: val as string })} />
            <FormField label="Address" value={profile.address ?? ''} onChange={(val) => setProfile({ ...profile, address: val as string })} />
          </div>
        </section>
      )}

      {canManageLeaveSettings ? leaveSettingsLoading && !leaveSettingsData ? (
        <FormSectionSkeleton rows={4} />
      ) : (
        <section id="leave-settings" className="elegant-panel p-5">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-extrabold text-[var(--text-primary)]">Leave Settings</h2>
            <LoadingButton className="primary-action text-sm" loading={updateLeaveSettingsState.isLoading} loadingLabel="Saving..." onClick={saveLeaveSettings}>
              <Save size={16} /> Save Leave Settings
            </LoadingButton>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <FormField label="Annual Leave Days" type="number" value={leaveSettings.annual_leave_days} onChange={(value) => setLeaveSettingsDraft({ ...leaveSettings, annual_leave_days: Number(value) })} min={0} max={365} required />
            <FormField label="Maximum Carry-Over" type="number" value={leaveSettings.carry_forward_days} onChange={(value) => setLeaveSettingsDraft({ ...leaveSettings, carry_forward_days: Number(value) })} min={0} max={Number(leaveSettings.annual_leave_days)} required />
            <FormField label="Sick Leave Days" type="number" value={leaveSettings.sick_leave_days} onChange={(value) => setLeaveSettingsDraft({ ...leaveSettings, sick_leave_days: Number(value) })} min={0} max={365} required />
            <FormField label="Emergency Leave Days" type="number" value={leaveSettings.emergency_leave_days} onChange={(value) => setLeaveSettingsDraft({ ...leaveSettings, emergency_leave_days: Number(value) })} min={0} max={365} required />
          </div>
        </section>
      ) : null}

      <section>
        <PageHeader title="Payment Methods">
          <button type="button" onClick={() => { setPaymentCurrent({ status: 'active' }); setPaymentModalOpen(true) }} className="primary-action text-sm">
            <Plus size={18} /> Add Method
          </button>
        </PageHeader>
        <DataTable columns={paymentColumns} data={paymentMethods} loading={showSkeleton} onEdit={(item) => { setPaymentCurrent(item); setPaymentModalOpen(true) }} onDelete={(item) => setDeleteTarget({ type: 'payment', id: item.id, name: item.name })} searchKeys={['name', 'code']} />
      </section>

      <section>
        <PageHeader title="Income Categories">
          <button type="button" onClick={() => { setCategoryCurrent({ status: 'active', type: 'income' }); setCategoryModalOpen(true) }} className="primary-action text-sm">
            <Plus size={18} /> Add Category
          </button>
        </PageHeader>
        <DataTable columns={categoryColumns} data={categories} loading={showSkeleton} onEdit={(item) => { setCategoryCurrent(item); setCategoryModalOpen(true) }} onDelete={(item) => setDeleteTarget({ type: 'category', id: item.id, name: item.name })} searchKeys={['name', 'code', 'type']} />
      </section>

      <section id="charge-types">
        <PageHeader title="Customer Charge Types">
          {canManageChargeTypes && (
            <button type="button" onClick={() => { setChargeTypeCurrent({ status: 'active' }); setChargeTypeModalOpen(true) }} className="primary-action text-sm">
              <Plus size={18} /> Add Charge Type
            </button>
          )}
        </PageHeader>
        <DataTable
          columns={chargeTypeColumns}
          data={chargeTypes}
          loading={showSkeleton}
          onEdit={canManageChargeTypes ? (item) => { setChargeTypeCurrent(item); setChargeTypeModalOpen(true) } : undefined}
          onDelete={canManageChargeTypes ? (item) => {
            if (item.is_system) {
              setError('Required system charge types cannot be deleted.')
              return
            }
            setDeleteTarget({ type: 'chargeType', id: item.id, name: item.name })
          } : undefined}
          searchKeys={['name', 'code', 'status']}
        />
      </section>

      <Modal isOpen={paymentModalOpen} onClose={() => setPaymentModalOpen(false)} title={paymentCurrent.id ? 'Edit Payment Method' : 'Add Payment Method'}>
        <div className="space-y-4">
          <FormField label="Name" value={paymentCurrent.name ?? ''} onChange={(val) => setPaymentCurrent({ ...paymentCurrent, name: val as string })} required />
          <FormField label="Code" value={paymentCurrent.code ?? ''} onChange={(val) => setPaymentCurrent({ ...paymentCurrent, code: val as string })} required />
          <FormField label="Status" type="select" value={paymentCurrent.status ?? 'active'} onChange={(val) => setPaymentCurrent({ ...paymentCurrent, status: val as PaymentMethod['status'] })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setPaymentModalOpen(false)} className="secondary-action">Cancel</button>
          <button type="button" onClick={savePayment} className="primary-action">Save Method</button>
        </div>
      </Modal>

      <Modal isOpen={categoryModalOpen} onClose={() => setCategoryModalOpen(false)} title={categoryCurrent.id ? 'Edit Income Category' : 'Add Income Category'}>
        <div className="space-y-4">
          <FormField label="Name" value={categoryCurrent.name ?? ''} onChange={(val) => setCategoryCurrent({ ...categoryCurrent, name: val as string })} required />
          <FormField label="Code" value={categoryCurrent.code ?? ''} onChange={(val) => setCategoryCurrent({ ...categoryCurrent, code: val as string })} required />
          <FormField label="Status" type="select" value={categoryCurrent.status ?? 'active'} onChange={(val) => setCategoryCurrent({ ...categoryCurrent, status: val as FinancialCategory['status'] })} options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]} />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setCategoryModalOpen(false)} className="secondary-action">Cancel</button>
          <button type="button" onClick={saveCategory} className="primary-action">Save Category</button>
        </div>
      </Modal>

      <Modal isOpen={chargeTypeModalOpen} onClose={() => setChargeTypeModalOpen(false)} title={chargeTypeCurrent.id ? 'Edit Customer Charge Type' : 'Add Customer Charge Type'}>
        <div className="space-y-4">
          <FormField label="Type Name" value={chargeTypeCurrent.name ?? ''} onChange={(val) => setChargeTypeCurrent({ ...chargeTypeCurrent, name: val as string })} required />
          <FormField label="Description" type="textarea" value={chargeTypeCurrent.description ?? ''} onChange={(val) => setChargeTypeCurrent({ ...chargeTypeCurrent, description: val as string })} />
          <FormField
            label="Status"
            type="select"
            value={chargeTypeCurrent.status ?? 'active'}
            onChange={(val) => setChargeTypeCurrent({ ...chargeTypeCurrent, status: val as CustomerChargeType['status'] })}
            options={[{ value: 'active', label: 'Active' }, { value: 'inactive', label: 'Inactive' }]}
            disabled={Boolean(chargeTypeCurrent.is_system)}
          />
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={() => setChargeTypeModalOpen(false)} className="secondary-action">Cancel</button>
          <button type="button" onClick={saveChargeType} className="primary-action">Save Charge Type</button>
        </div>
      </Modal>

      <Modal isOpen={resetModalOpen} onClose={() => { if (!resetRunning) setResetModalOpen(false) }} title="Reset Training Data" size="sm">
        <div className="space-y-4">
          <p className="text-sm font-bold leading-6 text-[var(--text-secondary)]">
            This permanently clears business records from the training database only. Your production database is not touched.
          </p>
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-[var(--text-secondary)]">
            Type <span className="font-mono font-extrabold text-[var(--text-primary)]">{trainingMode?.reset_confirmation}</span> to continue.
          </div>
          <FormField label="Confirmation" value={resetConfirmation} onChange={(value) => setResetConfirmation(String(value))} disabled={resetRunning} required />
          <FormField label="Your Password" type="password" value={resetPassword} onChange={(value) => setResetPassword(String(value))} disabled={resetRunning} required />

          {(resetRunning || resetProgress) && (
            <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4" aria-live="polite">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-extrabold text-[var(--text-primary)]">
                  {resetProgress?.message ?? 'Verifying reset confirmation...'}
                </p>
                <span className="shrink-0 text-sm font-black tabular-nums text-[var(--accent)]">
                  {resetProgress?.progress ?? 0}%
                </span>
              </div>
              <div
                className="mt-3 h-2.5 overflow-hidden rounded-full bg-[var(--border-subtle)]"
                role="progressbar"
                aria-label="Training data reset progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={resetProgress?.progress ?? 0}
              >
                <div
                  className="h-full rounded-full bg-amber-400 transition-[width] duration-300 ease-out"
                  style={{ width: `${resetProgress?.progress ?? 0}%` }}
                />
              </div>
              <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs font-bold text-[var(--text-muted)]">
                <span>
                  {resetProgress
                    ? `${resetProgress.cleared_tables} of ${resetProgress.total_tables} database tables cleared`
                    : 'Checking administrator credentials'}
                </span>
                <span>{resetProgress ? `${resetProgress.remaining_steps} steps remaining` : 'Please wait'}</span>
              </div>
            </div>
          )}

          {resetError && (
            <div className="rounded-md border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">
              {resetError}
            </div>
          )}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" className="secondary-action" disabled={resetRunning} onClick={() => setResetModalOpen(false)}>Cancel</button>
          <LoadingButton
            loading={resetRunning}
            loadingLabel={resetProgress?.status === 'completed' ? 'Reloading...' : 'Resetting...'}
            className="primary-action bg-red-600 text-white hover:bg-red-700"
            disabled={resetConfirmation !== trainingMode?.reset_confirmation || !resetPassword}
            onClick={resetTraining}
          >
            <RotateCcw size={16} /> Reset Training Data
          </LoadingButton>
        </div>
      </Modal>

      <ConfirmDialog isOpen={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)} onConfirm={remove} title="Delete Setting" message={`Delete ${deleteTarget?.name}?`} />
    </div>
  )
}
