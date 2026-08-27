'use client'

import {
  Users,
  DollarSign,
  Package,
  HardHat,
  Wrench,
  FileText,
  ArrowRight,
  Users2,
  Wallet,
  Activity,
  RefreshCw,
} from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import Link from 'next/link'
import { reportRange } from '@/lib/reporting'
import { useGetMeQuery, useGetOperationalReportQuery } from '@/src/store/waternetApi'
import { useLanguage } from '@/context/LanguageContext'

const financialReportRoles = ['Accountant', 'Manager', 'Admin', 'Super Admin']

type ReportCategory = {
  id: string
  title: string
  description: string
  icon: React.ReactNode
  href: string
  color: string
  bgColor: string
}

export default function ReportsPage() {
  const { t } = useLanguage()
  const { data: profile } = useGetMeQuery()
  const canViewFinancialReports = Boolean(profile && (
    profile.roles.some((role) => financialReportRoles.includes(role))
      || profile.permissions.includes('financial-reports.view')
  ))
  const reportCategories: ReportCategory[] = [
    {
      id: 'customer',
      title: t('customerReports'),
      description: t('customerReportsDesc'),
      icon: <Users className="h-6 w-6" />,
      href: '/dashboard/reports/customer',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      id: 'financial',
      title: t('financialReports'),
      description: t('financialReportsDesc'),
      icon: <DollarSign className="h-6 w-6" />,
      href: '/dashboard/reports/financial',
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-50',
    },
    {
      id: 'inventory',
      title: t('inventoryReports'),
      description: t('inventoryReportsDesc'),
      icon: <Package className="h-6 w-6" />,
      href: '/dashboard/reports/inventory',
      color: 'text-amber-600',
      bgColor: 'bg-amber-50',
    },
    {
      id: 'hr',
      title: t('hrReports'),
      description: t('hrReportsDesc'),
      icon: <HardHat className="h-6 w-6" />,
      href: '/dashboard/reports/hr',
      color: 'text-violet-600',
      bgColor: 'bg-violet-50',
    },
    {
      id: 'asset',
      title: t('assetReports'),
      description: t('assetReportsDesc'),
      icon: <Wrench className="h-6 w-6" />,
      href: '/dashboard/reports/asset',
      color: 'text-rose-600',
      bgColor: 'bg-rose-50',
    },
    {
      id: 'custom',
      title: t('customReports'),
      description: t('customReportsDesc'),
      icon: <FileText className="h-6 w-6" />,
      href: '/dashboard/reports/custom',
      color: 'text-slate-600',
      bgColor: 'bg-slate-50',
    },
  ].filter((category) => category.id !== 'financial' || canViewFinancialReports)
  const range = reportRange('last6months')
  const { data, isLoading } = useGetOperationalReportQuery(
    { type: 'overview', ...range },
    { refetchOnMountOrArgChange: true },
  )
  const summary = data?.summary

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
      <PageHeader title={t('reports')} subtitle={t('reportsCaption')} />

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users2 className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)]">{t('totalCustomers')}</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {isLoading ? '...' : Number(summary?.total_customers ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Wallet className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)]">{t('sixMonthRevenue')}</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {isLoading ? '...' : `AFN ${Number(summary?.revenue ?? 0).toLocaleString()}`}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Package className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)]">{t('inventoryItems')}</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {isLoading ? '...' : Number(summary?.inventory_items ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-50 flex items-center justify-center">
              <Activity className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--text-muted)]">{t('activeEmployees')}</p>
              <p className="text-xl font-bold text-[var(--text-primary)]">
                {isLoading ? '...' : Number(summary?.active_employees ?? 0).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Report Categories */}
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">{t('reportCategories')}</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {reportCategories.map((category) => (
            <Link
              key={category.id}
              href={category.href}
              className="group relative rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5 transition-all hover:shadow-lg hover:border-[var(--accent)] hover:-translate-y-0.5"
            >
              <div className="flex items-start gap-4">
                <div className={`h-12 w-12 rounded-xl ${category.bgColor} flex items-center justify-center ${category.color} transition-transform group-hover:scale-110`}>
                  {category.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--accent)] transition-colors">
                    {category.title}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--text-muted)] line-clamp-2">
                    {category.description}
                  </p>
                </div>
                <ArrowRight className="h-5 w-5 text-[var(--text-muted)] group-hover:text-[var(--accent)] group-hover:translate-x-1 transition-all" />
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Recent Reports */}
      <div>
        <h2 className="text-lg font-bold text-[var(--text-primary)] mb-4">{t('recentReports')}</h2>
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden">
          <div className="divide-y divide-[var(--border-subtle)]">
            {isLoading ? (
              <div className="flex items-center justify-center gap-2 p-8 text-sm text-[var(--text-muted)]">
                <RefreshCw className="h-4 w-4 animate-spin" />
                {t('loadingReportHistory')}
              </div>
            ) : data?.recent_reports?.length ? data.recent_reports.map((report) => (
              <div key={`${report.type}-${report.date}-${report.name}`} className="flex items-center justify-between p-4 hover:bg-[var(--bg-elevated)] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[var(--accent-soft)] flex items-center justify-center">
                    <FileText className="h-4 w-4 text-[var(--accent)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{report.name}</p>
                    <p className="text-xs text-[var(--text-muted)]">{report.type} | {report.date} | {report.status}</p>
                  </div>
                </div>
                <Link href={report.href} className="btn-secondary h-8 px-3 text-xs">{t('view')}</Link>
              </div>
            )) : (
              <div className="p-8 text-center text-sm text-[var(--text-muted)]">{t('noCompletedReport')}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
