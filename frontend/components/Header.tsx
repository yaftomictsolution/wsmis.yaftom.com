'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileSignature,
  FileText,
  Languages,
  LogOut,
  Moon,
  Settings,
  Sun,
  UserCircle,
  type LucideIcon,
} from 'lucide-react'
import { useDispatch } from 'react-redux'

import { useTheme } from '@/context/ThemeContext'
import { useLanguage, type Language } from '@/context/LanguageContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import { useRouter } from 'next/navigation'
import { apiRequest, clearAuthSession, getAuthToken, getStoredUser } from '@/lib/api'
import {
  waternetApi,
  useGetAssignedServiceRequestsQuery,
  useGetAccountingTransactionsQuery,
  useGetAccountReconciliationsQuery,
  useGetBillingPeriodsQuery,
  useGetCustomersQuery,
  useGetInvoicesQuery,
  useGetMeQuery,
  useGetFinancialClosingsQuery,
  useGetNotificationsQuery,
  useGetMeterAssignmentsQuery,
  useGetMetersQuery,
  useGetPaymentsQuery,
  useGetShareholderDistributionsQuery,
  useMarkAllNotificationsReadMutation,
  useMarkNotificationReadMutation,
} from '@/src/store/waternetApi'
import type { AppDispatch } from '@/src/store/store'

type NotificationTone = 'success' | 'warning' | 'info'

type DashboardNotification = {
  id: string
  title: string
  description: string
  time: string
  tone: NotificationTone
  unread?: boolean
  icon: LucideIcon
  href: string
  backendId?: string
}

type StoredUser = {
  name: string
  email: string
  roles?: Array<string | { name: string }>
}

const notificationToneStyles: Record<NotificationTone, { wrapper: string; icon: string }> = {
  success: {
    wrapper: 'bg-[var(--mint-soft)]',
    icon: 'text-[var(--mint)]',
  },
  warning: {
    wrapper: 'bg-[var(--gold-soft)]',
    icon: 'text-[var(--gold)]',
  },
  info: {
    wrapper: 'bg-[var(--accent-soft)]',
    icon: 'text-[var(--accent)]',
  },
}

const formatRelativeTime = (date: string | undefined, language: Language) => {
  const nowText = language === 'fa' ? 'اکنون' : 'Now'
  if (!date) return nowText

  const timestamp = new Date(date).getTime()
  if (Number.isNaN(timestamp)) return nowText

  const diffInSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  const minute = 60
  const hour = minute * 60
  const day = hour * 24

  if (language === 'fa') {
    if (diffInSeconds < minute) return 'همین حالا'
    if (diffInSeconds < hour) return `${Math.floor(diffInSeconds / minute)} دقیقه قبل`
    if (diffInSeconds < day) return `${Math.floor(diffInSeconds / hour)} ساعت قبل`
    return `${Math.floor(diffInSeconds / day)} روز قبل`
  }

  if (diffInSeconds < minute) return 'Just now'
  if (diffInSeconds < hour) return `${Math.floor(diffInSeconds / minute)} min ago`
  if (diffInSeconds < day) return `${Math.floor(diffInSeconds / hour)} hr ago`
  return `${Math.floor(diffInSeconds / day)} day ago`
}

const roleName = (role: string | { name?: string } | undefined) => {
  if (!role) return ''
  return typeof role === 'string' ? role : role.name ?? ''
}

const readStoredNotificationIds = (storageKey: string) => {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []
  } catch {
    return []
  }
}

const writeStoredNotificationIds = (storageKey: string, ids: string[]) => {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey, JSON.stringify(ids))
}

export function Header() {
  const { businessDate } = useTrainingMode()
  const router = useRouter()
  const dispatch = useDispatch<AppDispatch>()
  const hasToken = Boolean(getAuthToken())
  const [time, setTime] = useState<string | null>(null)
  const [isLanguageOpen, setIsLanguageOpen] = useState(false)
  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [user, setUser] = useState<StoredUser | null>(null)
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([])
  const languageMenuRef = useRef<HTMLDivElement>(null)
  const notificationMenuRef = useRef<HTMLDivElement>(null)
  const profileMenuRef = useRef<HTMLDivElement>(null)
  const notificationDetailsEnabled = hasToken && isNotificationsOpen
  const { data: profile } = useGetMeQuery(undefined, { skip: !hasToken })
  const { data: backendNotifications = [] } = useGetNotificationsQuery(undefined, {
    skip: !hasToken,
    pollingInterval: 10000,
    refetchOnFocus: true,
    refetchOnReconnect: true,
  })
  const [markNotificationRead] = useMarkNotificationReadMutation()
  const [markAllNotificationsRead] = useMarkAllNotificationsReadMutation()
  const financeEnabled = Boolean(profile?.roles.some((role) => ['Accountant', 'Manager', 'Admin', 'Super Admin'].includes(roleName(role))))
  const paymentsEnabled = Boolean(
    profile?.roles.some((role) => ['Collector', 'Accountant', 'Manager', 'Admin', 'Super Admin'].includes(roleName(role)))
    || profile?.permissions.includes('payments.view'),
  )
  const { data: customers = [] } = useGetCustomersQuery(undefined, { skip: !notificationDetailsEnabled })
  const { data: invoices = [] } = useGetInvoicesQuery(undefined, { skip: !notificationDetailsEnabled })
  const { data: meterAssignments = [] } = useGetMeterAssignmentsQuery(undefined, { skip: !notificationDetailsEnabled })
  const { data: meters = [] } = useGetMetersQuery(undefined, { skip: !notificationDetailsEnabled })
  const { data: billingPeriods = [] } = useGetBillingPeriodsQuery(undefined, { skip: !notificationDetailsEnabled })
  const { data: payments = [] } = useGetPaymentsQuery(undefined, { skip: !notificationDetailsEnabled || !paymentsEnabled })
  const { data: assignedServiceRequests = [] } = useGetAssignedServiceRequestsQuery(undefined, {
    skip: !notificationDetailsEnabled,
    pollingInterval: 30000,
  })
  const { data: accountingTransactions = [] } = useGetAccountingTransactionsQuery(undefined, { skip: !notificationDetailsEnabled || !financeEnabled, pollingInterval: 30000 })
  const { data: shareholderDistributions = [] } = useGetShareholderDistributionsQuery(undefined, { skip: !notificationDetailsEnabled || !financeEnabled, pollingInterval: 30000 })
  const { data: reconciliations = [] } = useGetAccountReconciliationsQuery(undefined, { skip: !notificationDetailsEnabled || !financeEnabled, pollingInterval: 30000 })
  const { data: financialClosings = [] } = useGetFinancialClosingsQuery(undefined, { skip: !notificationDetailsEnabled || !financeEnabled, pollingInterval: 30000 })
  const { theme, toggleTheme } = useTheme()
  const { language, direction, setLanguage, t, translate } = useLanguage()
  const currentRoles = useMemo(
    () => (profile?.roles ?? user?.roles ?? []).map((role) => roleName(role)).filter(Boolean),
    [profile?.roles, user?.roles],
  )
  const currentPermissions = profile?.permissions ?? []
  const currentUserKey = profile?.id ? `user-${profile.id}` : user?.email ? `email-${user.email}` : 'guest'
  const notificationStorageKey = `waternet_read_notifications_${currentUserKey}`
  const isAdminLike = currentRoles.some((role) => ['Admin', 'Super Admin'].includes(role))
  const isManagerLike = currentRoles.includes('Manager') || isAdminLike
  const canSee = (roles: string[] = [], permissions: string[] = []) =>
    isAdminLike ||
    roles.some((role) => currentRoles.includes(role)) ||
    permissions.some((permission) => currentPermissions.includes(permission))
  const canManageInvoices = canSee(['Manager', 'Accountant', 'Collector'], ['invoices.view', 'payments.view'])
  const canManageMeterAssignments = canSee(['Manager', 'Technician'], ['meter-assignments.view'])
  const canManageBillingPeriods = canSee(['Manager', 'Accountant', 'Meter Reader'], ['billing-periods.view'])
  const canManageMeters = canSee(['Manager', 'Technician', 'Warehouse Officer'], ['meters.view'])
  const canSeePayments = canSee(['Manager', 'Accountant', 'Collector'], ['payments.view'])
  const canManageDeposits = canSee(['Manager', 'Accountant', 'Collector'], ['customer-deposits.view', 'customer-deposits.update'])

  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString([], { hour12: false }))
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    setUser(getStoredUser<StoredUser>())
  }, [])

  useEffect(() => {
    setReadNotificationIds(readStoredNotificationIds(notificationStorageKey))
  }, [notificationStorageKey])

  useEffect(() => {
    if (!isLanguageOpen && !isNotificationsOpen && !isProfileOpen) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node

      if (languageMenuRef.current && !languageMenuRef.current.contains(target)) {
        setIsLanguageOpen(false)
      }

      if (notificationMenuRef.current && !notificationMenuRef.current.contains(target)) {
        setIsNotificationsOpen(false)
      }

      if (profileMenuRef.current && !profileMenuRef.current.contains(target)) {
        setIsProfileOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsLanguageOpen(false)
        setIsNotificationsOpen(false)
        setIsProfileOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isLanguageOpen, isNotificationsOpen, isProfileOpen])

  const markNotificationsRead = (ids: string[]) => {
    setReadNotificationIds((current) => {
      const next = Array.from(new Set([...current, ...ids]))
      writeStoredNotificationIds(notificationStorageKey, next)
      return next
    })
  }

  const notifications = useMemo<DashboardNotification[]>(() => {
    const isPersian = language === 'fa'
    const nowText = isPersian ? 'اکنون' : 'Now'
    const confirmedCustomers = customers.filter((customer) => (customer.latest_contract?.status ?? customer.agreement_status) === 'installation_pending')
    const refundRequiredDeposits = customers.flatMap((customer) =>
      (customer.latest_contract?.deposits ?? [])
        .filter((deposit) => deposit.status === 'refund_required')
        .map((deposit) => ({ customer, deposit })),
    )
    const activeAssignmentCustomerIds = new Set(
      meterAssignments
        .filter((assignment) => assignment.status === 'active')
        .map((assignment) => assignment.customer_id),
    )
    const customersWaitingForMeters = confirmedCustomers.filter((customer) => !activeAssignmentCustomerIds.has(customer.id))
    const today = new Date(`${businessDate}T00:00:00`)
    today.setHours(0, 0, 0, 0)
    const overdueInvoices = invoices.filter((invoice) => {
      if (!invoice.due_date || ['paid', 'cancelled'].includes(invoice.status)) return false
      const dueDate = new Date(invoice.due_date)
      dueDate.setHours(0, 0, 0, 0)
      return dueDate < today
    })
    const unpaidInvoices = invoices.filter((invoice) => ['unpaid', 'partially_paid'].includes(invoice.status))
    const openBillingPeriods = billingPeriods.filter((period) => period.status === 'open')
    const availableMeters = meters.filter((meter) => meter.status === 'available')
    const latestPayment = [...payments]
      .filter((payment) => payment.status === 'posted')
      .sort((left, right) => new Date(right.paid_at).getTime() - new Date(left.paid_at).getTime())[0]
    const activeAssignedServiceRequests = assignedServiceRequests.filter((request) =>
      ['assigned', 'in_progress'].includes(request.status),
    )

    const nextNotifications: DashboardNotification[] = []

    backendNotifications
      .filter((notification) => !notification.read_at)
      .forEach((notification) => {
        nextNotifications.push({
          id: `database-${notification.id}`,
          backendId: notification.id,
          title: notification.data.title ?? (isPersian ? 'قرارداد جدید مشتری' : 'New customer contract'),
          description: notification.data.message ?? (isPersian ? 'یک قرارداد مشتری تأیید شد.' : 'A customer contract was confirmed.'),
          time: formatRelativeTime(notification.created_at, language),
          tone: 'info',
          unread: true,
          icon: FileSignature,
          href: notification.data.href ?? '/dashboard/customers',
        })
      })

    if (isManagerLike) {
      const actionableStatuses = isAdminLike ? ['pending_review', 'pending_approval'] : ['pending_review']
      const actionableTransactions = accountingTransactions.filter((transaction) => actionableStatuses.includes(transaction.status))
      const payrollApprovals = actionableTransactions.filter((transaction) => transaction.source_type === 'payroll_run')
      const shareholderPayments = actionableTransactions.filter((transaction) => transaction.source_type === 'shareholder_payment')
      const otherFinanceApprovals = actionableTransactions.filter((transaction) => !['payroll_run', 'shareholder_payment'].includes(transaction.source_type ?? ''))

      if (otherFinanceApprovals.length > 0) {
        nextNotifications.push({
          id: `finance-approvals-${currentRoles.join('-')}-${otherFinanceApprovals.map((item) => `${item.id}-${item.status}`).join('-')}`,
          title: isPersian ? 'معاملات مالی در انتظار بررسی' : 'Financial transactions need action',
          description: isPersian ? `${otherFinanceApprovals.length} معامله مالی در انتظار اقدام شما است.` : `${otherFinanceApprovals.length} financial transaction${otherFinanceApprovals.length === 1 ? '' : 's'} waiting for your action.`,
          time: nowText,
          tone: 'warning',
          unread: true,
          icon: AlertTriangle,
          href: '/dashboard/finance-transactions',
        })
      }
      if (payrollApprovals.length > 0) {
        nextNotifications.push({
          id: `payroll-approvals-${currentRoles.join('-')}-${payrollApprovals.map((item) => `${item.id}-${item.status}`).join('-')}`,
          title: isPersian ? 'معاشات در انتظار تأیید' : 'Payroll needs approval',
          description: isPersian ? `${payrollApprovals.length} پرداخت معاش در انتظار اقدام شما است.` : `${payrollApprovals.length} payroll run${payrollApprovals.length === 1 ? '' : 's'} waiting for your action.`,
          time: nowText,
          tone: 'warning',
          unread: true,
          icon: AlertTriangle,
          href: '/dashboard/payroll',
        })
      }
      if (shareholderPayments.length > 0) {
        nextNotifications.push({
          id: `shareholder-payments-${currentRoles.join('-')}-${shareholderPayments.map((item) => `${item.id}-${item.status}`).join('-')}`,
          title: isPersian ? 'پرداخت سهم‌دار در انتظار تأیید' : 'Shareholder payment needs approval',
          description: isPersian ? `${shareholderPayments.length} پرداخت سهم‌دار در انتظار اقدام شما است.` : `${shareholderPayments.length} shareholder payment${shareholderPayments.length === 1 ? '' : 's'} waiting for your action.`,
          time: nowText,
          tone: 'warning',
          unread: true,
          icon: AlertTriangle,
          href: '/dashboard/shareholders',
        })
      }

      const controlGroups = [
        { records: shareholderDistributions, label: isPersian ? 'توزیع سود' : 'profit distribution', href: '/dashboard/shareholders' },
        { records: reconciliations, label: isPersian ? 'تطبیق حساب' : 'account reconciliation', href: '/dashboard/reconciliation' },
        { records: financialClosings, label: isPersian ? 'بستن ماه' : 'monthly closing', href: '/dashboard/month-closing' },
      ]
      controlGroups.forEach((group) => {
        const pending = group.records.filter((record) => actionableStatuses.includes(record.status))
        if (pending.length === 0) return
        nextNotifications.push({
          id: `finance-control-${group.href}-${currentRoles.join('-')}-${pending.map((record) => `${record.id}-${record.status}`).join('-')}`,
          title: isPersian ? `${group.label} در انتظار اقدام` : `${group.label} needs action`,
          description: isPersian ? `${pending.length} مورد در انتظار بررسی یا تأیید شما است.` : `${pending.length} item${pending.length === 1 ? '' : 's'} waiting for your review or approval.`,
          time: nowText,
          tone: 'warning',
          unread: true,
          icon: AlertTriangle,
          href: group.href,
        })
      })
    }

    activeAssignedServiceRequests.slice(0, 3).forEach((request) => {
      const typeLabel = request.type.replace(/_/g, ' ')
      const customerName = request.customer?.name ?? (isPersian ? 'Ù…Ø´ØªØ±ÛŒ' : 'Customer')

      nextNotifications.push({
        id: `assigned-service-request-${request.id}-${request.status}-${request.assigned_at ?? request.requested_at}`,
        title: isPersian ? 'Ø¯Ø±Ø®ÙˆØ§Ø³Øª Ø®Ø¯Ù…Øª Ø¨Ù‡ Ø´Ù…Ø§ ØªØ®ØµÛŒØµ Ø´Ø¯' : 'Service request assigned to you',
        description: `${customerName}: ${typeLabel} (${request.priority})`,
        time: formatRelativeTime(request.assigned_at ?? request.requested_at, language),
        tone: request.priority === 'urgent' || request.priority === 'high' ? 'warning' : 'info',
        unread: true,
        icon: AlertTriangle,
        href: `/dashboard/customers/${request.customer_id}?tab=requests`,
      })
    })

    if (canManageDeposits && refundRequiredDeposits.length > 0) {
      const first = refundRequiredDeposits[0]
      nextNotifications.push({
        id: `deposit-refunds-${refundRequiredDeposits.map(({ deposit }) => deposit.id).join('-')}`,
        title: isPersian ? 'بازپرداخت سپرده مشتری لازم است' : 'Customer deposit refund required',
        description: isPersian
          ? `${refundRequiredDeposits.length} سپرده قرارداد ردشده باید از حساب دریافت‌کننده اصلی بازپرداخت شود.`
          : `${refundRequiredDeposits.length} rejected-contract deposit${refundRequiredDeposits.length === 1 ? '' : 's'} must be refunded from the original receiving account.`,
        time: nowText,
        tone: 'warning',
        unread: true,
        icon: AlertTriangle,
        href: `/dashboard/customers/${first.customer.id}?tab=deposits`,
      })
    }

    if (canManageInvoices && overdueInvoices.length > 0) {
      nextNotifications.push({
        id: `overdue-invoices-${overdueInvoices.map((invoice) => invoice.id).join('-')}`,
        title: isPersian ? 'بل‌های سررسید گذشته' : 'Overdue invoices',
        description: isPersian
          ? `${overdueInvoices.length} بل از تاریخ پرداخت گذشته است.`
          : `${overdueInvoices.length} invoice${overdueInvoices.length === 1 ? '' : 's'} passed the due date.`,
        time: nowText,
        tone: 'warning',
        unread: true,
        icon: Clock,
        href: '/dashboard/invoices',
      })
    } else if (canManageInvoices && unpaidInvoices.length > 0) {
      nextNotifications.push({
        id: `unpaid-invoices-${unpaidInvoices.map((invoice) => invoice.id).join('-')}`,
        title: isPersian ? 'بل‌های پرداخت‌نشده' : 'Unpaid invoices',
        description: isPersian
          ? `${unpaidInvoices.length} بل هنوز نیاز به پرداخت دارد.`
          : `${unpaidInvoices.length} invoice${unpaidInvoices.length === 1 ? '' : 's'} still need payment.`,
        time: nowText,
        tone: 'info',
        unread: true,
        icon: FileText,
        href: '/dashboard/invoices',
      })
    }

    if (canManageMeterAssignments && customersWaitingForMeters.length > 0) {
      nextNotifications.push({
        id: `meters-needed-${customersWaitingForMeters.map((customer) => customer.id).join('-')}`,
        title: isPersian ? 'نصب میتر در انتظار است' : 'Meter assignment pending',
        description: isPersian
          ? `${customersWaitingForMeters.length} مشتری تاییدشده هنوز به میتر فعال نیاز دارد.`
          : `${customersWaitingForMeters.length} confirmed customer${customersWaitingForMeters.length === 1 ? '' : 's'} still need an active meter.`,
        time: nowText,
        tone: 'warning',
        unread: true,
        icon: AlertTriangle,
        href: '/dashboard/meter-assignments',
      })
    }

    if (canManageBillingPeriods && openBillingPeriods.length > 0) {
      nextNotifications.push({
        id: `open-billing-periods-${openBillingPeriods.map((period) => period.id).join('-')}`,
        title: isPersian ? 'دوره بل باز' : 'Open billing period',
        description: isPersian
          ? `${openBillingPeriods.length} دوره بل برای قرائت میتر آماده است.`
          : `${openBillingPeriods.length} billing period${openBillingPeriods.length === 1 ? '' : 's'} ready for meter readings.`,
        time: nowText,
        tone: 'info',
        icon: FileText,
        href: '/dashboard/billing-periods',
      })
    }

    if (canManageMeters && availableMeters.length < 3) {
      nextNotifications.push({
        id: `low-meter-stock-${availableMeters.length}`,
        title: isPersian ? 'موجودی میتر کم است' : 'Low available meter stock',
        description: isPersian
          ? `${availableMeters.length} میتر آماده باقی مانده است.`
          : `${availableMeters.length} available meter${availableMeters.length === 1 ? '' : 's'} remaining.`,
        time: nowText,
        tone: 'warning',
        icon: AlertTriangle,
        href: '/dashboard/meters',
      })
    }

    if (canSeePayments && latestPayment) {
      nextNotifications.push({
        id: `latest-payment-${latestPayment.id}`,
        title: isPersian ? 'پرداخت دریافت شد' : 'Payment received',
        description: isPersian
          ? `${latestPayment.customer?.name ?? 'مشتری'} مبلغ ${Number(latestPayment.amount).toLocaleString()} افغانی پرداخت کرد.`
          : `${latestPayment.customer?.name ?? 'Customer'} paid AFN ${Number(latestPayment.amount).toLocaleString()}.`,
        time: formatRelativeTime(latestPayment.paid_at, language),
        tone: 'success',
        icon: CheckCircle2,
        href: '/dashboard/payments',
      })
    }

    if (nextNotifications.length === 0) {
      nextNotifications.push({
        id: 'all-clear',
        title: isPersian ? 'اطلاعیه فوری وجود ندارد' : 'No urgent updates',
        description: isPersian ? 'جریان کاری فعلی سیستم آبرسانی به‌روز است.' : 'Your current water supply workflow is up to date.',
        time: nowText,
        tone: 'success',
        icon: CheckCircle2,
        href: '/dashboard',
      })
    }

    return nextNotifications.slice(0, 6)
  }, [
    billingPeriods,
    backendNotifications,
    businessDate,
    accountingTransactions,
    assignedServiceRequests,
    canManageBillingPeriods,
    canManageInvoices,
    canManageMeterAssignments,
    canManageMeters,
    canManageDeposits,
    canSeePayments,
    customers,
    invoices,
    financialClosings,
    isAdminLike,
    isManagerLike,
    language,
    meterAssignments,
    meters,
    payments,
    reconciliations,
    shareholderDistributions,
    currentRoles,
  ])

  const visibleNotifications = notifications.filter((item) => !readNotificationIds.includes(item.id))
  const unreadCount = visibleNotifications.filter((item) => item.unread).length
  const emptyNotificationText = language === 'fa' ? 'اطلاعیه‌ای برای نمایش نیست.' : 'No notifications to show.'

  const toggleNotifications = () => {
    setIsNotificationsOpen((isOpen) => {
      const nextState = !isOpen
      if (nextState) {
        setIsLanguageOpen(false)
        setIsProfileOpen(false)
      }
      return nextState
    })
  }

  const toggleProfileMenu = () => {
    setIsProfileOpen((isOpen) => {
      const nextState = !isOpen
      if (nextState) {
        setIsLanguageOpen(false)
        setIsNotificationsOpen(false)
      }
      return nextState
    })
  }

  const selectLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage)
    setIsLanguageOpen(false)
  }

  const handleLogout = async () => {
    setIsProfileOpen(false)
    try {
      await apiRequest('/auth/logout', { method: 'POST' })
    } finally {
      clearAuthSession()
      dispatch(waternetApi.util.resetApiState())
      router.replace('/login')
    }
  }

  const displayName = profile?.name ?? user?.name ?? 'WaterNet User'
  const displayRole = roleName(profile?.roles?.[0] ?? user?.roles?.[0]) || 'User'
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header className="app-header">
      <div className="flex-1" />

      <div className="flex items-center gap-2 sm:gap-3">
        <div className="hidden md:flex items-center gap-2">
          <div className="secondary-action min-w-[86px] px-3 py-1.5 text-sm font-mono">
            <Clock className="h-3.5 w-3.5 text-[var(--accent)]" />
            {time ?? '--:--:--'}
          </div>
          <button
            onClick={toggleTheme}
            className="icon-button"
            type="button"
            title={t('toggleTheme')}
            aria-label={t('toggleTheme')}
          >
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>

        <div ref={languageMenuRef} className="relative">
          <button
            type="button"
            onClick={() => {
              setIsLanguageOpen((isOpen) => !isOpen)
              setIsNotificationsOpen(false)
              setIsProfileOpen(false)
            }}
            className="secondary-action gap-2 px-2 py-1.5 text-sm sm:px-3"
            aria-expanded={isLanguageOpen}
            aria-haspopup="menu"
            aria-label={t('language')}
          >
            <Languages className="h-4 w-4 text-[var(--accent)]" />
            <span className="hidden xl:inline">{t('language')}</span>
            <span className="min-w-14 text-sm font-extrabold text-[var(--text-primary)]">
              {language === 'fa' ? t('dari') : t('english')}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[var(--text-muted)]" />
          </button>

          {isLanguageOpen ? (
            <div className={`elegant-panel absolute ${direction === 'rtl' ? 'left-0' : 'right-0'} top-[calc(100%+10px)] z-50 w-40 overflow-hidden bg-[var(--bg-surface)] p-1 text-[var(--text-primary)]`}>
              {([
                { value: 'en', label: t('english') },
                { value: 'fa', label: t('dari') },
              ] as const).map((item) => (
                <button
                  key={item.value}
                  type="button"
                  onClick={() => selectLanguage(item.value)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm font-extrabold transition-colors ${
                    language === item.value
                      ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                      : 'text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  <span>{item.label}</span>
                  {language === item.value ? <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div ref={notificationMenuRef} className="relative">
          <button
            type="button"
            onClick={toggleNotifications}
            aria-expanded={isNotificationsOpen}
            aria-haspopup="menu"
            className="icon-button relative"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 ? (
              <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--coral)] px-1 text-[9px] font-extrabold leading-none text-white ring-2 ring-[var(--bg-elevated)]">
                {unreadCount}
              </span>
            ) : null}
          </button>

          {isNotificationsOpen ? (
            <div className={`elegant-panel absolute ${direction === 'rtl' ? 'left-0' : 'right-0'} top-[calc(100%+10px)] z-50 w-[min(92vw,380px)] overflow-hidden`}>
              <div className="flex items-center justify-between border-b px-4 py-3 elegant-divider">
                <div>
                  <p className="text-sm font-extrabold text-[var(--text-primary)]">{t('notifications')}</p>
                  <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">{unreadCount} {t('unreadUpdates')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    markNotificationsRead(visibleNotifications.map((item) => item.id))
                    void markAllNotificationsRead()
                  }}
                  className="ghost-action min-h-0 px-2 py-1 text-[10px] uppercase tracking-[0.12em]"
                >
                  {t('clear')}
                </button>
              </div>
              <div className="max-h-80 space-y-1.5 overflow-y-auto p-2">
                {visibleNotifications.map((notification) => {
                  const Icon = notification.icon
                  const tone = notificationToneStyles[notification.tone]

                  return (
                    <button
                      key={notification.id}
                      type="button"
                      onClick={() => {
                        markNotificationsRead([notification.id])
                        if (notification.backendId) void markNotificationRead(notification.backendId)
                        setIsNotificationsOpen(false)
                        router.push(notification.href)
                      }}
                      className={`w-full flex items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-elevated)] ${
                          notification.unread ? 'border-[var(--accent)] bg-[var(--accent-soft)]' : 'border-transparent'
                      }`}
                    >
                      <span className={`mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg ${tone.wrapper}`}>
                        <Icon className={`h-4 w-4 ${tone.icon}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-xs font-extrabold text-[var(--text-primary)]">{notification.title}</span>
                        <span className="mt-0.5 block text-[11px] leading-relaxed text-[var(--text-muted)]">{notification.description}</span>
                      </span>
                      <span className="mt-0.5 whitespace-nowrap text-[10px] text-[var(--text-muted)]">{notification.time}</span>
                    </button>
                  )
                })}
                {visibleNotifications.length === 0 ? (
                  <div className="rounded-lg px-3 py-6 text-center text-xs font-bold text-[var(--text-muted)]">
                    {emptyNotificationText}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <div className="hidden h-8 w-px bg-[var(--border-subtle)] sm:block" />

        <div ref={profileMenuRef} className="relative">
          <button
            type="button"
            onClick={toggleProfileMenu}
            aria-expanded={isProfileOpen}
            aria-haspopup="menu"
            className="ghost-action p-1.5"
          >
            <div className="avatar-mark flex h-8 w-8 items-center justify-center rounded-lg text-[11px] font-extrabold">
              {initials}
            </div>
            <div className={`hidden sm:block ${direction === 'rtl' ? 'text-right' : 'text-left'}`}>
              <p className="text-xs font-extrabold leading-none text-[var(--text-primary)]">{displayName}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--text-muted)]">{translate(displayRole)}</p>
            </div>
            <ChevronDown size={14} className="hidden text-[var(--text-muted)] sm:block" />
          </button>

          {isProfileOpen ? (
            <div className={`elegant-panel absolute ${direction === 'rtl' ? 'left-0' : 'right-0'} top-[calc(100%+10px)] z-50 w-[min(88vw,260px)] p-2`}>
              <div className="border-b px-2 pb-3 pt-2 elegant-divider">
                <p className="text-sm font-extrabold text-[var(--text-primary)]">{displayName}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--text-muted)]">{translate(displayRole)}</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false)
                  router.push('/dashboard/account')
                }}
                className="ghost-action mt-2 w-full justify-start text-xs"
              >
                <UserCircle className="h-4 w-4 text-[var(--text-muted)]" />
                {t('myProfile')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsProfileOpen(false)
                  router.push('/dashboard/settings')
                }}
                className="ghost-action w-full justify-start text-xs"
              >
                <Settings className="h-4 w-4 text-[var(--text-muted)]" />
                {t('accountSettings')}
              </button>

              <div className="mt-2 border-t pt-2 elegant-divider">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold text-[var(--coral)] transition-colors hover:bg-[var(--coral-soft)]"
                >
                  <LogOut className="h-4 w-4" />
                  {t('logout')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
