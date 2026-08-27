'use client'

import { useState, useMemo } from 'react'
import { DollarSign, TrendingUp, TrendingDown, Wallet, Download, RefreshCw, ShieldAlert } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import { StatsCard } from '@/components/StatsCard'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend, AreaChart, Area } from 'recharts'
import { useGetFinancialReportQuery, useGetMeQuery } from '@/src/store/waternetApi'
import { downloadCsv, reportRange, type ReportRangePreset } from '@/lib/reporting'
import { useLanguage } from '@/context/LanguageContext'
import { useCalendar } from '@/context/CalendarContext'
import { getApiErrorMessage, InlineError } from '@/components/finance/FinanceUI'
import { DatePickerField } from '@/components/ui/DatePickerField'

const financialReportRoles = ['Accountant', 'Manager', 'Admin', 'Super Admin']

export default function FinancialReportsPage() {
  const { translate } = useLanguage()
  const { formatDate } = useCalendar()
  const [dateRange, setDateRange] = useState('last6months')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const { data: profile, isLoading: isProfileLoading, isError: isProfileError } = useGetMeQuery()
  const canViewFinancialReports = Boolean(profile && (
    profile.roles.some((role) => financialReportRoles.includes(role))
      || profile.permissions.includes('financial-reports.view')
  ))
  const selectedRange = useMemo(
    () => dateRange === 'custom'
      ? { from, to }
      : reportRange(dateRange as ReportRangePreset),
    [dateRange, from, to],
  )

  const { data, isLoading, isFetching, isError, error, refetch } = useGetFinancialReportQuery(
    selectedRange,
    {
      skip: isProfileLoading || !canViewFinancialReports || !selectedRange.from || !selectedRange.to,
      refetchOnMountOrArgChange: true,
    },
  )

  const reportData = data
  const summary = reportData?.summary
  const incomeByCategory = useMemo(() => reportData?.income_by_category ?? [], [reportData?.income_by_category])
  const expenseByCategory = useMemo(() => reportData?.expense_by_category ?? [], [reportData?.expense_by_category])
  const cashFlow = useMemo(() => reportData?.cash_flow ?? [], [reportData?.cash_flow])
  const localizedIncomeByCategory = useMemo(
    () => incomeByCategory.map((item) => ({ ...item, name: translate(item.name) })),
    [incomeByCategory, translate],
  )
  const localizedExpenseByCategory = useMemo(
    () => expenseByCategory.map((item) => ({ ...item, name: translate(item.name) })),
    [expenseByCategory, translate],
  )
  const totalIncome = Number(summary?.total_income ?? 0)
  const totalExpense = Number(summary?.total_expense ?? 0)
  const netProfit = Number(summary?.net_income ?? 0)
  const cashBalance = Number(summary?.cash_balance ?? 0)

  const incomeExpenseChartData = useMemo(() => {
    const monthlyData: Record<string, { month: string; income: number; expense: number }> = {}
    cashFlow.forEach((item) => {
      const monthKey = formatDate(item.date).slice(0, 7)
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { month: formatDate(item.date, 'month'), income: 0, expense: 0 }
      }
      monthlyData[monthKey].income += item.income
      monthlyData[monthKey].expense += item.outflow
    })
    return Object.values(monthlyData)
  }, [cashFlow, formatDate])

  const cashFlowChartData = useMemo(() => {
    return cashFlow.reduce<{ date: string; balance: number }[]>((rows, item) => {
      const balance = (rows.at(-1)?.balance ?? 0) + item.net
      return [
        ...rows,
        {
          date: formatDate(item.date),
          balance,
        },
      ]
    }, [])
  }, [cashFlow, formatDate])

  const accountBalances = useMemo(() => {
    return (reportData?.accounts ?? []).map((acc) => ({
      name: acc.name,
      balance: acc.closing_balance,
      type: acc.type,
    }))
  }, [reportData?.accounts])

  if (isProfileLoading || (canViewFinancialReports && isLoading)) {
    return (
      <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
        <PageHeader title="Financial Reports" subtitle="Income vs expense, profit & loss, cash flow, and account balances" />
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-8 w-8 animate-spin text-[var(--accent)]" />
          <span className="ms-3 text-[var(--text-muted)]">{translate('Loading financial data...')}</span>
        </div>
      </div>
    )
  }

  if (isProfileError || !profile || !canViewFinancialReports) {
    return (
      <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
        <PageHeader title="Financial Reports" subtitle="Income vs expense, profit & loss, cash flow, and account balances" />
        <div className="flex min-h-64 items-center justify-center border-y elegant-divider">
          <div className="max-w-xl text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-[var(--gold)]" />
            <h2 className="mt-4 text-lg font-extrabold text-[var(--text-primary)]">{translate('Financial report access is restricted')}</h2>
            <p className="mt-2 text-sm font-bold leading-6 text-[var(--text-muted)]">
              {translate('Only an Accountant, Manager, Admin, or a user granted Financial Reports view permission can open this report.')}
            </p>
          </div>
        </div>
      </div>
    )
  }

  const reportError = isError
    ? getApiErrorMessage(error, 'Unable to load financial report.')
    : ''

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
      <PageHeader title="Financial Reports" subtitle="Income vs expense, profit & loss, cash flow, and account balances" />
      {reportError ? (
        <div className="flex flex-wrap items-start gap-3">
          <div className="min-w-0 flex-1"><InlineError message={reportError} /></div>
          <button type="button" onClick={() => refetch()} disabled={isFetching} className="btn-secondary h-10 px-4 text-sm flex items-center gap-2">
            <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} /> {translate('Retry')}
          </button>
        </div>
      ) : null}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select value={dateRange} onChange={(e) => setDateRange(e.target.value)} className="field-control h-10 px-3 text-sm">
          <option value="last3months">{translate('Last 3 Months')}</option>
          <option value="last6months">{translate('Last 6 Months')}</option>
          <option value="lastyear">{translate('Last Year')}</option>
          <option value="custom">{translate('Custom Range')}</option>
        </select>
        {dateRange === 'custom' && (
          <>
            <DatePickerField id="financial-report-from" value={from} onChange={setFrom} className="field-control h-10 min-w-40 px-3 text-sm" />
            <DatePickerField id="financial-report-to" value={to} min={from || undefined} onChange={setTo} className="field-control h-10 min-w-40 px-3 text-sm" />
          </>
        )}
        <button
          type="button"
          onClick={() => downloadCsv(
            `financial-ledger-${selectedRange.from}-${selectedRange.to}.csv`,
            (reportData?.ledger ?? []).map((transaction) => ({
              number: transaction.transaction_number,
              date: transaction.transaction_date,
              type: transaction.type,
              title: transaction.title,
              category: transaction.category?.name ?? '',
              account: transaction.account?.name ?? '',
              amount: transaction.amount,
              status: transaction.status,
            })),
          )}
          disabled={!reportData?.ledger.length}
          className="btn-secondary h-10 px-4 text-sm flex items-center gap-2"
        >
          <Download className="h-4 w-4" /> {translate('Export')}
        </button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatsCard title="Total Income" value={`AFN ${Number(totalIncome).toLocaleString()}`} icon={<TrendingUp className="h-5 w-5 text-[var(--mint)]" />} />
        <StatsCard title="Total Expenses" value={`AFN ${Number(totalExpense).toLocaleString()}`} icon={<TrendingDown className="h-5 w-5 text-[var(--coral)]" />} />
        <StatsCard title="Net Profit" value={`AFN ${Number(netProfit).toLocaleString()}`} icon={<DollarSign className="h-5 w-5 text-[var(--accent)]" />} />
        <StatsCard title="Cash Balance" value={`AFN ${Number(cashBalance).toLocaleString()}`} icon={<Wallet className="h-5 w-5 text-[var(--gold)]" />} />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Income vs Expense Trend */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{translate('Income vs Expense Trend')}</h3>
          {incomeExpenseChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={incomeExpenseChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} labelStyle={{ fontWeight: 'bold' }} />
                <Legend />
                <Bar dataKey="income" name={translate('Income')} fill="#0d9488" radius={[4, 4, 0, 0]} />
                <Bar dataKey="expense" name={translate('Expense')} fill="#dc5f4a" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-[var(--text-muted)]">{translate('No transaction data available')}</div>
          )}
        </div>

        {/* Cash Flow */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{translate('Cash Flow')}</h3>
          {cashFlowChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={cashFlowChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0' }} labelStyle={{ fontWeight: 'bold' }} />
                <Area type="monotone" dataKey="balance" name={translate('Balance')} stroke="#0284c7" fill="#0284c7" fillOpacity={0.1} strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-[var(--text-muted)]">{translate('No transaction data available')}</div>
          )}
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Income by Category */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{translate('Income by Category')}</h3>
          {incomeByCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={localizedIncomeByCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="amount" nameKey="name">
                    {localizedIncomeByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#0284c7', '#0d9488', '#c58b14', '#dc5f4a', '#6366f1'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `AFN ${Number(value ?? 0).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {localizedIncomeByCategory.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: ['#0284c7', '#0d9488', '#c58b14', '#dc5f4a', '#6366f1'][index % 5] }} />
                    <span className="text-xs text-[var(--text-muted)]">{item.name}: AFN {Number(item.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">{translate('No income data available')}</div>
          )}
        </div>

        {/* Expense by Category */}
        <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
          <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{translate('Expense by Category')}</h3>
          {expenseByCategory.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={localizedExpenseByCategory} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={3} dataKey="amount" nameKey="name">
                    {localizedExpenseByCategory.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={['#dc5f4a', '#c58b14', '#0d9488', '#0284c7', '#6366f1'][index % 5]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `AFN ${Number(value ?? 0).toLocaleString()}`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap justify-center gap-3 mt-2">
                {localizedExpenseByCategory.map((item, index) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: ['#dc5f4a', '#c58b14', '#0d9488', '#0284c7', '#6366f1'][index % 5] }} />
                    <span className="text-xs text-[var(--text-muted)]">{item.name}: AFN {Number(item.amount).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-[var(--text-muted)]">{translate('No expense data available')}</div>
          )}
        </div>
      </div>

      {/* Account Balances */}
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-5">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{translate('Account Balances')}</h3>
        {accountBalances.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {accountBalances.map((account) => (
              <div key={account.name} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-4">
                <p className="text-xs font-medium text-[var(--text-muted)]">{translate(account.name)} ({translate(account.type.replaceAll('_', ' '))})</p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">AFN {Number(account.balance).toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-[var(--text-muted)]">{translate('No accounts found')}</div>
        )}
      </div>
    </div>
  )
}
