'use client'

import { useMemo, useState } from 'react'
import { HardHat, Users, Calendar, DollarSign, Download, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatsCard } from '@/components/StatsCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { useGetOperationalReportQuery } from '@/src/store/waternetApi'
import { downloadCsv, reportRange, type ReportRangePreset } from '@/lib/reporting'
import { useLanguage } from '@/context/LanguageContext'
import { InlineError } from '@/components/finance/FinanceUI'

export default function HRReportsPage() {
  const { translate } = useLanguage()
  const [dateRange, setDateRange] = useState('last6months')
  const range = useMemo(() => reportRange(dateRange as ReportRangePreset), [dateRange])
  const { data, isLoading, isError } = useGetOperationalReportQuery(
    { type: 'hr', ...range },
    { refetchOnMountOrArgChange: true },
  )
  const report = data?.hr
  const totals = report?.totals
  const payrollRuns = report?.payroll_trend ?? []
  const employeeByDepartment = useMemo(() => (report?.department_distribution ?? []).map((item, index) => ({
    ...item,
    name: translate(item.name),
    color: ['#0284c7', '#0d9488', '#c58b14', '#dc5f4a', '#6366f1'][index % 5],
  })), [report?.department_distribution, translate])
  const latestPayroll = payrollRuns.length > 0 ? Number(payrollRuns[payrollRuns.length - 1].amount) : 0
  const leaveChartData = useMemo(() => (report?.leave_balances ?? []).map((item) => ({
    ...item,
    type: translate(item.type),
  })), [report?.leave_balances, translate])

  if (isLoading) {
    return (
      <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
        <PageHeader title="HR Reports" subtitle="Employee directory, attendance, payroll, and leave balances" />
        <div className="flex items-center justify-center py-20 text-[var(--text-muted)]">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span className="ms-3">{translate('Loading HR report...')}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
      <PageHeader title="HR Reports" subtitle="Employee directory, attendance, payroll, and leave balances" />
      <InlineError message={isError ? 'Unable to load HR report.' : ''} />

      <div className="flex flex-wrap items-center gap-3">
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="field-control h-10 px-3 text-sm">
          <option value="last3months">{translate('Last 3 Months')}</option>
          <option value="last6months">{translate('Last 6 Months')}</option>
          <option value="lastyear">{translate('Last Year')}</option>
        </select>
        <button
          type="button"
          onClick={() => downloadCsv(`hr-report-${range.from}-${range.to}.csv`, payrollRuns)}
          disabled={!payrollRuns.length}
          className="btn-secondary h-10 px-4 text-sm flex items-center gap-2"
        >
          <Download className="h-4 w-4" /> {translate('Export')}
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total Employees" value={totals?.employees ?? 0} icon={<Users className="h-5 w-5 text-[var(--accent)]" />} />
        <StatsCard title="Active" value={totals?.active_employees ?? 0} icon={<HardHat className="h-5 w-5 text-[var(--mint)]" />} />
        <StatsCard title="Approved Leave Days" value={totals?.approved_leave_days ?? 0} icon={<Calendar className="h-5 w-5 text-[var(--gold)]" />} />
        <StatsCard title="Latest Payroll" value={`AFN ${latestPayroll.toLocaleString()}`} icon={<DollarSign className="h-5 w-5 text-[var(--violet)]" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{translate('Employees by Department')}</h3>
          {employeeByDepartment.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={employeeByDepartment} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="count" nameKey="name">
                    {employeeByDepartment.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {employeeByDepartment.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs text-[var(--text-muted)]">{item.name}: {item.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">{translate('No employee data available')}</div>
          )}
        </div>

        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{translate('Payroll Cost Trend')}</h3>
          {payrollRuns.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={payrollRuns.slice(-6).map((run) => ({ month: run.period, amount: Number(run.amount) }))}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
                <Bar dataKey="amount" name={translate('Payroll (AFN)')} fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">{translate('No payroll data available')}</div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{translate('Leave Balance')}</h3>
        {leaveChartData.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={leaveChartData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis dataKey="type" type="category" tick={{ fontSize: 12 }} width={80} />
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} />
              <Legend />
              <Bar dataKey="used" name={translate('Used Days')} fill="#dc5f4a" radius={[0, 4, 4, 0]} />
              <Bar dataKey="remaining" name={translate('Remaining Days')} fill="#0d9488" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">{translate('No leave data available')}</div>
        )}
      </div>
    </div>
  )
}
