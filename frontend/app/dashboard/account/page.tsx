'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Bell,
  CheckCircle2,
  Database,
  Globe2,
  LockKeyhole,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  UserRound,
  type LucideIcon,
} from 'lucide-react'

import { useLanguage, type Language } from '@/context/LanguageContext'
import { useCalendar } from '@/context/CalendarContext'
import { useTheme } from '@/context/ThemeContext'
import { FormField } from '@/components/ui/FormField'
import { FormSectionSkeleton } from '@/components/ui/Skeleton'
import { DashboardFishToggle } from '@/components/settings/DashboardFishToggle'
import { getAuthToken, setAuthSession } from '@/lib/api'
import { useGetMeQuery, useUpdateProfileMutation } from '@/src/store/waternetApi'

type ProfileForm = {
  name: string
  email: string
  phone: string
  current_password: string
  password: string
  password_confirmation: string
}

type AccountTab = 'profile' | 'system' | 'notifications' | 'security' | 'data'

type AccountTabConfig = {
  id: AccountTab
  label: string
  icon: LucideIcon
}

const emptyForm: ProfileForm = {
  name: '',
  email: '',
  phone: '',
  current_password: '',
  password: '',
  password_confirmation: '',
}

const accountTabs: AccountTabConfig[] = [
  { id: 'profile', label: 'Profile', icon: UserRound },
  { id: 'system', label: 'System', icon: Globe2 },
  { id: 'notifications', label: 'Notifications', icon: Bell },
  { id: 'security', label: 'Security', icon: LockKeyhole },
  { id: 'data', label: 'Data', icon: Database },
]

const defaultNotificationSettings = {
  billing: true,
  payments: true,
  readings: true,
}

type NotificationSettings = typeof defaultNotificationSettings

const readNotificationSettings = (): NotificationSettings => {
  if (typeof window === 'undefined') return defaultNotificationSettings

  try {
    const stored = window.localStorage.getItem('waternet_account_notifications')
    if (!stored) return defaultNotificationSettings

    return {
      ...defaultNotificationSettings,
      ...JSON.parse(stored),
    }
  } catch {
    return defaultNotificationSettings
  }
}

export default function AccountPage() {
  const { data: profile, isLoading, isError, isFetching, refetch } = useGetMeQuery()
  const [updateProfile, { isLoading: isSaving }] = useUpdateProfileMutation()
  const { language, setLanguage, translate } = useLanguage()
  const { formatDateTime } = useCalendar()
  const { theme, toggleTheme } = useTheme()
  const [activeTab, setActiveTab] = useState<AccountTab>('profile')
  const [formChanges, setFormChanges] = useState<Partial<ProfileForm>>({})
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [lastRefreshed, setLastRefreshed] = useState('')
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>(readNotificationSettings)

  const form = useMemo<ProfileForm>(() => ({
    ...emptyForm,
    name: profile?.name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    ...formChanges,
  }), [formChanges, profile])

  useEffect(() => {
    window.localStorage.setItem('waternet_account_notifications', JSON.stringify(notificationSettings))
  }, [notificationSettings])

  const roleText = profile?.roles?.join(', ') || 'User'
  const statusText = profile?.status ? profile.status.charAt(0).toUpperCase() + profile.status.slice(1) : 'Active'
  const permissionCount = profile?.permissions?.length ?? 0

  const initials = useMemo(() => {
    const source = form.name || profile?.name || 'User'
    return source
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase()
  }, [form.name, profile?.name])

  const persistProfile = async (includePassword = false) => {
    setMessage('')
    setError('')

    if (includePassword && !form.password) {
      setError('Enter a new password before saving security settings.')
      return
    }

    if (includePassword && form.password !== form.password_confirmation) {
      setError('New password and confirmation do not match.')
      return
    }

    try {
      const response = await updateProfile({
        name: form.name,
        email: form.email,
        phone: form.phone,
        current_password: includePassword ? form.current_password : undefined,
        password: includePassword ? form.password : undefined,
      }).unwrap()

      const nextToken = response.token ?? getAuthToken()
      if (nextToken) setAuthSession(nextToken, response.user)

      setFormChanges({
        name: response.user.name,
        email: response.user.email,
        phone: response.user.phone ?? '',
        current_password: '',
        password: '',
        password_confirmation: '',
      })

      setMessage(includePassword ? 'Security settings updated successfully.' : 'Profile updated successfully.')
    } catch {
      setError('Unable to update profile. Check your current password if you are changing the password.')
    }
  }

  const refreshProfile = async () => {
    setMessage('')
    setError('')

    const refreshed = await refetch()
    if (refreshed.error) {
      setError('Unable to load your profile.')
      return
    }

    const refreshedProfile = refreshed.data
    if (refreshedProfile) {
      setFormChanges((current) => ({
        name: refreshedProfile.name,
        email: refreshedProfile.email,
        phone: refreshedProfile.phone ?? '',
        current_password: current.current_password ?? '',
        password: current.password ?? '',
        password_confirmation: current.password_confirmation ?? '',
      }))
    }

    const refreshedAt = formatDateTime(new Date().toISOString(), 'Not available')
    setLastRefreshed(refreshedAt)
    setMessage('Profile refreshed.')
  }

  const toggleNotificationSetting = (key: keyof typeof notificationSettings) => {
    setNotificationSettings((current) => ({
      ...current,
      [key]: !current[key],
    }))
  }

  const sectionHeader = (title: string, subtitle: string, action?: ReactNode) => (
    <div className="flex flex-col gap-4 border-b pb-6 elegant-divider sm:flex-row sm:items-start sm:justify-between">
      <div>
        <h2 className="text-xl font-extrabold text-[var(--text-primary)]">{translate(title)}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-secondary)]">{translate(subtitle)}</p>
      </div>
      {action}
    </div>
  )

  const readonlyField = (label: string, value: string) => (
    <div className="space-y-1.5">
      <label className="block text-sm font-bold text-[var(--text-secondary)]">{translate(label)}</label>
      <input
        readOnly
        value={translate(value)}
        className="field-control bg-[var(--accent-soft)] px-4 py-2.5 text-sm font-bold text-[var(--text-primary)]"
      />
    </div>
  )

  const preferenceRow = (title: string, description: string, control: ReactNode) => (
    <div className="flex flex-col gap-4 border-b py-4 last:border-b-0 elegant-divider sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-sm font-extrabold text-[var(--text-primary)]">{translate(title)}</p>
        <p className="mt-1 text-xs leading-relaxed text-[var(--text-muted)]">{translate(description)}</p>
      </div>
      {control}
    </div>
  )

  const renderProfileSection = () => (
    <div>
      {sectionHeader(
        'Profile Information',
        'Update the account identity shown across the dashboard.',
        <button type="button" onClick={refreshProfile} disabled={isFetching} className="secondary-action text-sm">
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          {translate('Refresh Profile')}
        </button>,
      )}

      <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-5">
          <div className="avatar-mark flex h-24 w-24 shrink-0 items-center justify-center rounded-[26px] text-3xl font-extrabold sm:h-28 sm:w-28 sm:text-4xl">
            {initials}
          </div>
          <div>
            <h3 className="text-xl font-extrabold text-[var(--text-primary)]">{form.name || translate('My Account')}</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">{form.email || 'admin@example.com'}</p>
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[var(--mint)] bg-[var(--mint-soft)] px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-[var(--mint)]">
              <CheckCircle2 className="h-3.5 w-3.5" />
              {translate(statusText)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        <FormField label="Full Name" value={form.name} onChange={(val) => setFormChanges((current) => ({ ...current, name: val as string }))} required />
        <FormField label="Email" type="email" value={form.email} onChange={(val) => setFormChanges((current) => ({ ...current, email: val as string }))} required />
        <FormField label="Phone" value={form.phone} onChange={(val) => setFormChanges((current) => ({ ...current, phone: val as string }))} />
        {readonlyField('Role', roleText)}
      </div>

      <div className="mt-8 flex justify-end">
        <button type="button" onClick={() => persistProfile(false)} disabled={isSaving} className="primary-action min-w-36">
          <Save className="h-4 w-4" />
          {isSaving ? translate('Saving...') : translate('Save Profile')}
        </button>
      </div>
    </div>
  )

  const renderSystemSection = () => (
    <div>
      {sectionHeader('System Preferences', 'Local interface preferences for this dashboard.')}
      <div className="mt-6">
        {preferenceRow(
          'Theme',
          'Switch between the water light and deep water dark dashboard themes.',
          <button type="button" onClick={toggleTheme} className="secondary-action min-w-32 text-sm">
            <Settings className="h-4 w-4" />
            {translate(theme === 'dark' ? 'Dark' : 'Light')}
          </button>,
        )}
        {preferenceRow(
          'Language',
          'Choose the language used for dashboard labels and tables.',
          <div className="inline-flex overflow-hidden rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-1">
            {([
              { value: 'en', label: 'English' },
              { value: 'fa', label: 'Persian' },
            ] as Array<{ value: Language; label: string }>).map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setLanguage(item.value)}
                className={`rounded-md px-3 py-1.5 text-sm font-extrabold transition-colors ${
                  language === item.value
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {translate(item.label)}
              </button>
            ))}
          </div>,
        )}
        {preferenceRow(
          'Dashboard fish',
          'Show natural animated fish over the dashboard water. Water and waves stay visible when fish are off.',
          <DashboardFishToggle />,
        )}
        {preferenceRow(
          'Account Status',
          'Current backend account status returned by the Laravel API.',
          <span className="badge-base badge-mint">{translate(statusText)}</span>,
        )}
      </div>
    </div>
  )

  const renderNotificationsSection = () => (
    <div>
      {sectionHeader('Notification Settings', 'Choose which operational reminders are highlighted in your workspace.')}
      <div className="mt-6">
        {([
          ['billing', 'Billing reminders', 'Show invoice due date and overdue payment reminders.'],
          ['payments', 'Payment notices', 'Show receipt and collection updates after payments are posted.'],
          ['readings', 'Meter reading alerts', 'Show reminders for missing meter readings in open billing periods.'],
        ] as Array<[keyof typeof notificationSettings, string, string]>).map(([key, title, description]) =>
          preferenceRow(
            title,
            description,
            <button
              type="button"
              onClick={() => toggleNotificationSetting(key)}
              className={`relative h-7 w-12 rounded-full border transition-colors ${
                notificationSettings[key]
                  ? 'border-[var(--accent)] bg-[var(--accent)]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-muted)]'
              }`}
              aria-pressed={notificationSettings[key]}
            >
              <span
                className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                  notificationSettings[key] ? 'left-6' : 'left-1'
                }`}
              />
            </button>,
          ),
        )}
      </div>
    </div>
  )

  const renderSecuritySection = () => (
    <div>
      {sectionHeader('Security Settings', 'Update your password using your current password.')}
      <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
        <FormField
          label="Current Password"
          type="password"
          value={form.current_password}
          onChange={(val) => setFormChanges((current) => ({ ...current, current_password: val as string }))}
          placeholder="Required only when changing password"
        />
        <div className="hidden md:block" />
        <FormField
          label="New Password"
          type="password"
          value={form.password}
          onChange={(val) => setFormChanges((current) => ({ ...current, password: val as string }))}
          placeholder="Leave blank to keep password"
        />
        <FormField
          label="Confirm New Password"
          type="password"
          value={form.password_confirmation}
          onChange={(val) => setFormChanges((current) => ({ ...current, password_confirmation: val as string }))}
        />
      </div>
      <div className="mt-8 flex justify-end">
        <button type="button" onClick={() => persistProfile(true)} disabled={isSaving} className="primary-action min-w-40">
          <ShieldCheck className="h-4 w-4" />
          {isSaving ? translate('Saving...') : translate('Save Security')}
        </button>
      </div>
    </div>
  )

  const renderDataSection = () => (
    <div>
      {sectionHeader('Data Access', 'Review account access metadata and session information.')}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {[
          ['User ID', profile?.id ? `#${profile.id}` : 'Not available'],
          ['Permissions', `${permissionCount}`],
          ['Session', 'Authenticated'],
          ['Last Login', formatDateTime(profile?.last_login_at)],
          ['Last Refreshed', lastRefreshed || 'Not available'],
          ['Email', form.email || 'Not available'],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
            <p className="text-xs font-extrabold uppercase tracking-[0.12em] text-[var(--text-muted)]">{translate(label)}</p>
            <p className="mt-2 break-words text-sm font-bold text-[var(--text-primary)]">{translate(value)}</p>
          </div>
        ))}
      </div>
    </div>
  )

  const renderActiveSection = () => {
    if (activeTab === 'system') return renderSystemSection()
    if (activeTab === 'notifications') return renderNotificationsSection()
    if (activeTab === 'security') return renderSecuritySection()
    if (activeTab === 'data') return renderDataSection()
    return renderProfileSection()
  }

  return (
    <div className="mx-auto max-w-[1520px] p-5 sm:p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-normal text-[var(--text-primary)] sm:text-4xl">{translate('Settings')}</h1>
        <p className="mt-2 text-sm font-medium text-[var(--text-secondary)] sm:text-base">
          {translate('Manage your account and system preferences')}
        </p>
      </div>

      {message && <div className="mb-4 rounded-lg border border-[var(--mint)] bg-[var(--mint-soft)] px-4 py-3 text-sm font-bold text-[var(--mint)]">{translate(message)}</div>}
      {(error || isError) && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">{translate(error || 'Unable to load your profile.')}</div>}

      {isLoading && !profile ? (
        <FormSectionSkeleton rows={6} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <aside className="elegant-panel overflow-hidden">
            <div className="flex items-center gap-4 border-b p-6 elegant-divider">
              <div className="avatar-mark flex h-16 w-16 shrink-0 items-center justify-center rounded-[18px] text-xl font-extrabold">
                {initials}
              </div>
              <div className="min-w-0">
                <h2 className="truncate text-lg font-extrabold text-[var(--text-primary)]">{form.name || translate('My Account')}</h2>
                <p className="mt-1 truncate text-xs font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                  {translate(roleText)}
                </p>
              </div>
            </div>

            <nav className="space-y-2 p-3">
              {accountTabs.map((tab) => {
                const Icon = tab.icon
                const isActive = activeTab === tab.id

                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`nav-item w-full px-4 py-3 text-sm font-extrabold ${isActive ? 'nav-item-active' : ''}`}
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span>{translate(tab.label)}</span>
                  </button>
                )
              })}
            </nav>
          </aside>

          <section className="elegant-panel min-h-[520px] p-5 sm:p-7 lg:p-10">
            {renderActiveSection()}
          </section>
        </div>
      )}
    </div>
  )
}
