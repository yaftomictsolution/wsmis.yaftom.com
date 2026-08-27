'use client'

import { useMemo, useState } from 'react'
import { Users, TrendingUp, DollarSign, Activity, Download, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatsCard } from '@/components/StatsCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { useGetOperationalReportQuery } from '@/src/store/waternetApi'
import { downloadCsv, reportRange, type ReportRangePreset } from '@/lib/reporting'
import { useLanguage } from '@/context/LanguageContext'
import { InlineError } from '@/components/finance/FinanceUI'

export default function CustomerReportsPage() {
  const { translate } = useLanguage()
  const [dateRange, setDateRange] = useState('last6months')
  const range = useMemo(() => reportRange(dateRange as ReportRangePreset), [dateRange])
  const { data, isLoading, isError } = useGetOperationalReportQuery(
    { type: 'customer', ...range },
    { refetchOnMountOrArgChange: true },
  )
  const report = data?.customer
  const totals = report?.totals
  const customerStatusData = useMemo(() => (report?.status_distribution ?? []).map((item, index) => ({
    ...item,
    name: translate(item.name.replaceAll('_', ' ')),
    color: ['#0d9488', '#c58b14', '#dc5f4a', '#64748b', '#0284c7'][index % 5],
  })), [report?.status_distribution, translate])
  const customerBalanceData = report?.balance_distribution ?? []

  if (isLoading) {
    return (
      <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
        <PageHeader title="Customer Reports" subtitle="Customer registration, balances, payments, and connection status" />
        <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="ms-3">{translate('Loading customer report...')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
      <PageHeader title="Customer Reports" subtitle="Customer registration, balances, payments, and connection status" />
      <InlineError message={isError ? 'Unable to load customer report.' : ''} />

      <div className="flex flex-wrap items-center gap-3">
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="field-control h-10 px-3 text-sm">
          <option value="last3months">{translate('Last 3 Months')}</option>
          <option value="last6months">{translate('Last 6 Months')}</option>
          <option value="lastyear">{translate('Last Year')}</option>
        </select>
        <button
          type="button"
          onClick={() => downloadCsv(`customer-report-${range.from}-${range.to}.csv`, report?.rows ?? [])}
          disabled={!report?.rows.length}
          className="btn-secondary h-10 px-4 text-sm flex items-center gap-2"
        >
          <Download className="h-4 w-4" /> {translate('Export')}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total Customers" value={totals?.customers ?? 0} icon={<Users className="h-5 w-5 text-[var(--accent)]" />} />
        <StatsCard title="Active" value={totals?.active_customers ?? 0} icon={<Activity className="h-5 w-5 text-[var(--mint)]" />} />
        <StatsCard title="New in Period" value={totals?.new_customers ?? 0} icon={<TrendingUp className="h-5 w-5 text-[var(--gold)]" />} />
        <StatsCard title="Total Receivables" value={`AFN ${Number(totals?.receivables ?? 0).toLocaleString()}`} icon={<DollarSign className="h-5 w-5 text-[var(--violet)]" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{translate('Customer Status Distribution')}</h3>
          {customerStatusData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={customerStatusData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" nameKey="name">
                    {customerStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {customerStatusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-[var(--text-muted)]">{item.name}: {item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">{translate('No customer data available')}</div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{translate('Customer Balance Distribution')}</h3>
          {customerBalanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={customerBalanceData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="count" name={translate('Customer Count')} fill="#0d9488" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">{translate('No balance data available')}</div>
          )}
        </div>
      </div>
    </div>
  )
}
