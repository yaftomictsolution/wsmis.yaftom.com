'use client'

import Link from 'next/link'
import {
  ArrowRight,
  BarChart3,
  ClipboardCheck,
  FileSignature,
  Gauge,
  Package,
  ReceiptText,
  RotateCcw,
  UserRound,
  Users,
  WalletCards,
} from 'lucide-react'
import { RecordPaymentButton } from '@/components/payments/RecordPaymentButton'
import { CashMovementChart } from '@/components/dashboard/CashMovementChart'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatsCard } from '@/components/StatsCard'
import { PanelSkeleton, StatCardSkeleton } from '@/components/ui/Skeleton'
import { useLanguage } from '@/context/LanguageContext'
import { useCalendar } from '@/context/CalendarContext'
import { visibleWorkspaces, visibleWorkspaceTabs } from '@/lib/workspaces'
import { useGetDashboardStatsQuery, useGetMeQuery, type DashboardStats } from '@/src/store/waternetApi'

const fallbackStats: DashboardStats = {
  users: 0,
  service_areas: 0,
  customers: 0,
  active_customers: 0,
  contracts_draft: 0,
  contracts_awaiting_installation: 0,
  deposits_requiring_refund: 0,
  customer_deposits_held: 0,
  meters: 0,
  available_meters: 0,
  assigned_meters: 0,
  billing_periods: 0,
  meter_readings: 0,
  invoices: 0,
  unpaid_invoices: 0,
  payments: 0,
  outstanding_balance: 0,
  monthly_cash_movement: [],
}

const accentClasses = {
  accent: 'bg-[var(--accent-soft)] text-[var(--accent)]',
  mint: 'bg-[var(--mint-soft)] text-[var(--mint)]',
  gold: 'bg-[var(--gold-soft)] text-[var(--gold)]',
  violet: 'bg-[var(--violet-soft)] text-[var(--violet)]',
  coral: 'bg-[var(--coral-soft)] text-[var(--coral)]',
} as const

export default function DashboardPage() {
  const { translate } = useLanguage()
  const { formatDate } = useCalendar()
  const { data, isLoading, isError } = useGetDashboardStatsQuery()
  const { data: profile } = useGetMeQuery()
  const stats = data ?? fallbackStats
  const showSkeleton = isLoading && !data
  const availableWorkspaces = visibleWorkspaces(profile).filter((workspace) => workspace.id !== 'dashboard')
  const workspaceIds = new Set(availableWorkspaces.map((workspace) => workspace.id))
  const shortcutPriority = [
    'Customers', 'Meter Readings', 'Meter Assignments', 'All Invoices', 'All Payments',
    'Inventory', 'Warehouses', 'Accounts', 'Expenses', 'Employees', 'Attendance & Leave',
    'Payroll', 'Report Center', 'Settings',
  ]
  const moduleShortcuts = availableWorkspaces
    .flatMap((workspace) => visibleWorkspaceTabs(workspace, profile).map((tab) => ({ ...tab, accent: workspace.accent })))
    .sort((left, right) => {
      const leftIndex = shortcutPriority.indexOf(left.label)
      const rightIndex = shortcutPriority.indexOf(right.label)
      return (leftIndex === -1 ? shortcutPriority.length : leftIndex) - (rightIndex === -1 ? shortcutPriority.length : rightIndex)
    })
    .slice(0, 14)
  const cashMovement = (stats.monthly_cash_movement ?? []).map((point) => ({
    label: formatDate(point.period_start, 'month'),
    income: Number(point.income),
    expense: Number(point.expense),
    net: Number(point.net),
  }))
  const latestCashMovement = cashMovement.at(-1)
  const tasks = [
    {
      label: 'Draft customer contracts',
      description: 'Open the customer and confirm the next valid contract.',
      count: stats.contracts_draft,
      href: '/dashboard/customers',
      icon: FileSignature,
      workspace: 'customers',
      tone: 'slate',
    },
    {
      label: 'Meters awaiting installation',
      description: 'Assign and seal a purchased meter for these contracts.',
      count: stats.contracts_awaiting_installation,
      href: '/dashboard/meter-assignments',
      icon: Gauge,
      workspace: 'field',
      tone: 'accent',
    },
    {
      label: 'Unpaid customer invoices',
      description: 'Open the bill and receive a full or partial payment.',
      count: stats.unpaid_invoices,
      href: '/dashboard/invoices',
      icon: ReceiptText,
      workspace: 'customers',
      tone: 'coral',
    },
    {
      label: 'Refunds requiring attention',
      description: 'Review pending customer refunds and their source accounts.',
      count: stats.deposits_requiring_refund,
      href: '/dashboard/customers',
      icon: RotateCcw,
      workspace: 'customers',
      tone: 'gold',
    },
  ].filter((task) => workspaceIds.has(task.workspace))

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-7 p-4 lg:p-8">
      <PageHeader title="Daily Workspace" subtitle="Choose a work area or continue the records that need attention" />

      {isError && (
        <div className="rounded-lg border border-[var(--gold)] bg-[var(--gold-soft)] px-4 py-3 text-sm font-bold text-[var(--text-primary)]">
          {translate('Unable to load dashboard totals. You can still open a work area below.')}
        </div>
      )}

      <section aria-labelledby="quick-modules-title">
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 id="quick-modules-title" className="text-base font-extrabold text-[var(--text-primary)]">{translate('Module Shortcuts')}</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">{translate('Open common work directly from the dashboard.')}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-7">
          {moduleShortcuts.map((shortcut) => {
            const Icon = shortcut.icon
            return (
              <Link
                key={shortcut.path}
                href={shortcut.path}
                className="group flex min-h-24 min-w-0 flex-col items-center justify-center gap-2 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-4 text-center transition-colors hover:border-[var(--accent)] hover:bg-[var(--bg-elevated)]"
              >
                <span className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg ${accentClasses[shortcut.accent]}`}>
                  <Icon className="h-5 w-5" />
                </span>
                <span className="max-w-full text-xs font-extrabold text-[var(--text-primary)] sm:text-sm">{translate(shortcut.label)}</span>
              </Link>
            )
          })}
        </div>
      </section>

      <section aria-labelledby="overview-title">
        <h2 id="overview-title" className="mb-3 text-base font-extrabold text-[var(--text-primary)]">{translate('At a Glance')}</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {showSkeleton ? (
            Array.from({ length: 4 }).map((_, index) => <StatCardSkeleton key={index} />)
          ) : (
            <>
              <StatsCard title="Customers" value={stats.customers} change={`${stats.active_customers} active`} changeType="positive" icon={<Users className="h-5 w-5 text-[var(--accent)]" />} />
              <StatsCard title="Meters" value={stats.meters} change={`${stats.available_meters} available`} icon={<Gauge className="h-5 w-5 text-[var(--mint)]" />} />
              <StatsCard title="Unpaid Invoices" value={stats.unpaid_invoices} icon={<ReceiptText className="h-5 w-5 text-[var(--gold)]" />} />
              <StatsCard title="Outstanding Balance" value={`AFN ${Number(stats.outstanding_balance).toLocaleString()}`} icon={<WalletCards className="h-5 w-5 text-[var(--coral)]" />} />
            </>
          )}
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
        {showSkeleton ? <PanelSkeleton /> : (
          <section className="elegant-panel overflow-hidden" aria-labelledby="cash-movement-title">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[var(--border-subtle)] px-5 py-4">
              <div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-[var(--accent)]" />
                  <h2 id="cash-movement-title" className="text-base font-extrabold text-[var(--text-primary)]">{translate('Monthly Cash Movement')}</h2>
                </div>
                <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">{translate('Posted income and expenses for the last six months.')}</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-extrabold">
                <span className="flex items-center gap-1.5 text-[var(--mint)]"><span className="h-2.5 w-2.5 rounded-full bg-[var(--mint)]" />{translate('Income')}</span>
                <span className="flex items-center gap-1.5 text-[var(--coral)]"><span className="h-2.5 w-2.5 rounded-full bg-[var(--coral)]" />{translate('Expenses')}</span>
              </div>
            </div>
            <div className="px-3 pb-3 pt-1 sm:px-5">
              <CashMovementChart data={cashMovement} />
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--border-subtle)] px-1 pt-3 text-sm">
                <span className="font-bold text-[var(--text-muted)]">{translate('Current month net movement')}</span>
                <span className={`font-extrabold ${(latestCashMovement?.net ?? 0) >= 0 ? 'text-[var(--mint)]' : 'text-[var(--coral)]'}`}>
                  AFN {Number(latestCashMovement?.net ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
          </section>
        )}

        <section className="elegant-panel p-5" aria-labelledby="quick-actions-title">
          <h2 id="quick-actions-title" className="text-base font-extrabold text-[var(--text-primary)]">{translate('Quick Actions')}</h2>
          <div className="mt-4 space-y-2">
            {workspaceIds.has('customers') && (
              <Link href="/dashboard/customers" className="ghost-action w-full justify-start">
                <UserRound className="h-4 w-4 text-[var(--accent)]" />
                {translate('Find or Register Customer')}
              </Link>
            )}
            {workspaceIds.has('field') && (
              <Link href="/dashboard/meter-readings" className="ghost-action w-full justify-start">
                <ClipboardCheck className="h-4 w-4 text-[var(--accent)]" />
                {translate('Record Meter Reading')}
              </Link>
            )}
            <RecordPaymentButton className="ghost-action w-full justify-start" />
            {workspaceIds.has('inventory') && (
              <Link href="/dashboard/inventory-manager" className="ghost-action w-full justify-start">
                <Package className="h-4 w-4 text-[var(--accent)]" />
                {translate('Purchase or Issue Goods')}
              </Link>
            )}
          </div>
        </section>
      </div>

      {showSkeleton ? <PanelSkeleton /> : (
        <section className="elegant-panel overflow-hidden" aria-labelledby="today-title">
          <div className="border-b border-[var(--border-subtle)] px-5 py-4">
            <h2 id="today-title" className="text-base font-extrabold text-[var(--text-primary)]">{translate("Today's Work")}</h2>
            <p className="mt-1 text-sm font-semibold text-[var(--text-muted)]">{translate('Open the record and continue from its next valid step.')}</p>
          </div>
          <div className="grid divide-y divide-[var(--border-subtle)] lg:grid-cols-2 lg:divide-y-0">
            {tasks.map((task, index) => {
              const Icon = task.icon
              return (
                <Link key={task.label} href={task.href} className={`group flex items-center gap-4 px-5 py-4 hover:bg-[var(--bg-elevated)] ${index % 2 === 0 ? 'lg:border-e lg:border-[var(--border-subtle)]' : ''} ${index > 1 ? 'lg:border-t lg:border-[var(--border-subtle)]' : ''}`}>
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-lg bg-[var(--accent-soft)] text-[var(--accent)]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-extrabold text-[var(--text-primary)]">{translate(task.label)}</span>
                    <span className="mt-0.5 block text-xs font-semibold text-[var(--text-muted)]">{translate(task.description)}</span>
                  </span>
                  <span className="flex h-8 min-w-8 items-center justify-center rounded-md bg-[var(--bg-muted)] px-2 text-sm font-extrabold text-[var(--text-primary)]">{task.count}</span>
                  <ArrowRight className="h-4 w-4 flex-none text-[var(--text-muted)] group-hover:text-[var(--accent)] rtl:rotate-180" />
                </Link>
              )
            })}
            {tasks.length === 0 && <p className="px-5 py-8 text-center text-sm font-bold text-[var(--text-muted)] lg:col-span-2">{translate('No assigned work areas.')}</p>}
          </div>
        </section>
      )}
    </div>
  )
}
