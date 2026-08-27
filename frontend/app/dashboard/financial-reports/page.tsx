'use client'

import { useState } from 'react'
import { Banknote, Download, FileBarChart, Landmark, Printer, ReceiptText, RotateCcw, TrendingDown, TrendingUp, Users, WalletCards } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { PageHeader } from '@/components/ui/PageHeader'
import { FormField } from '@/components/ui/FormField'
import { FinanceMetric, FinanceStatus, InlineError, money } from '@/components/finance/FinanceUI'
import { useCalendar } from '@/context/CalendarContext'
import { useLanguage } from '@/context/LanguageContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import { useGetAccountingAccountsQuery, useGetFinancialReportQuery } from '@/src/store/waternetApi'

type ReportTab = 'overview' | 'profit_loss' | 'ledger' | 'outstanding' | 'controls'

export default function FinancialReportsPage() {
  const { translate } = useLanguage()
  const { formatDate: dateValue, formatDateTime } = useCalendar()
  const { businessDate } = useTrainingMode()
  const [filters, setFilters] = useState<{ from: string; to: string; account_id?: number }>({ from: `${businessDate.slice(0, 7)}-01`, to: businessDate })
  const [applied, setApplied] = useState(filters)
  const [tab, setTab] = useState<ReportTab>('overview')
  const { data: report, isLoading, isError, isFetching } = useGetFinancialReportQuery(applied)
  const { data: accounts = [] } = useGetAccountingAccountsQuery()
  const summary = report?.summary ?? {}

  const exportLedger = () => {
    if (!report) return
    const rows = [
      ['Transaction', 'Date', 'Type', 'Title', 'Category', 'Account', 'Amount', 'Reference'].map((heading) => translate(heading)),
      ...report.ledger.map((item) => [item.transaction_number, dateValue(item.transaction_date), translate(item.type), translate(item.title), translate(item.category?.name ?? ''), item.account?.name ?? '', String(item.amount), item.reference ?? '']),
    ]
    const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = `financial-ledger-${applied.from}-${applied.to}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const tabs: { id: ReportTab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'profit_loss', label: 'Profit & Loss' },
    { id: 'ledger', label: 'General Ledger' },
    { id: 'outstanding', label: 'Receivables' },
    { id: 'controls', label: 'Financial Controls' },
  ]

  return (
    <div className="mx-auto max-w-[1720px] p-6 lg:p-8">
      <PageHeader title={translate('Financial Reports')} subtitle={translate('Profit, cash flow, account balances, outstanding amounts, payroll, shareholders, and monthly controls')}>
        <button type="button" className="secondary-action text-sm" onClick={exportLedger}><Download size={17} /> {translate('Export CSV')}</button>
        <button type="button" className="primary-action text-sm" onClick={() => window.print()}><Printer size={17} /> {translate('Print Report')}</button>
      </PageHeader>
      <InlineError message={isError ? translate('Unable to generate financial report.') : ''} />

      <div className="mb-5 flex flex-col gap-3 border-y py-4 elegant-divider lg:flex-row lg:items-end">
        <div className="grid flex-1 gap-3 sm:grid-cols-3">
          <FormField label="From" type="date" value={filters.from} onChange={(value) => setFilters({ ...filters, from: String(value) })} />
          <FormField label="To" type="date" value={filters.to} onChange={(value) => setFilters({ ...filters, to: String(value) })} />
          <div className="space-y-1.5"><label className="text-sm font-bold text-[var(--text-secondary)]">{translate('Account')}</label><select className="field-control px-4 py-2.5 text-sm" value={filters.account_id ?? ''} onChange={(event) => setFilters({ ...filters, account_id: event.target.value ? Number(event.target.value) : undefined })}><option value="">{translate('All accounts')}</option>{accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}</select></div>
        </div>
        <button type="button" className="primary-action" onClick={() => setApplied({ ...filters })} disabled={isFetching}><FileBarChart size={17} /> {translate('Generate')}</button>
      </div>

      <section className="financial-report-print" aria-label={translate('Financial report')}>
        <div className="hidden print:block"><h1 className="text-xl font-extrabold">{translate('Water Supply Management System')}</h1><p className="mt-1 text-sm">{translate('Financial report')}: {applied.from} {translate('to')} {applied.to}</p></div>
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FinanceMetric label={translate('Total Income')} value={money(summary.total_income as number)} icon={TrendingUp} tone="text-[var(--mint)]" />
          <FinanceMetric label={translate('Total Expenses')} value={money(summary.total_expense as number)} icon={TrendingDown} tone="text-[var(--coral)]" />
          <FinanceMetric label={translate('Net Income')} value={money(summary.net_income as number)} icon={ReceiptText} />
          <FinanceMetric label={translate('Net Cash Flow')} value={money(summary.net_cash_flow as number)} icon={Banknote} tone="text-[var(--gold)]" />
          <FinanceMetric label={translate('Cash Balance')} value={money(summary.cash_balance as number)} icon={Banknote} />
          <FinanceMetric label={translate('Bank Balance')} value={money(summary.bank_balance as number)} icon={Landmark} />
          <FinanceMetric label={translate('Receivables')} value={money(summary.receivables as number)} icon={Users} tone="text-[var(--gold)]" />
          <FinanceMetric label={translate('Customer Deposits Held')} value={money(summary.customer_deposit_liability as number)} icon={WalletCards} tone="text-[var(--gold)]" />
          <FinanceMetric label={translate('Deposit Refunds Required')} value={money(summary.customer_deposits_requiring_refund as number)} icon={RotateCcw} tone="text-[var(--coral)]" />
          <FinanceMetric label={translate('Deposits Received')} value={money(summary.customer_deposits_received as number)} icon={Banknote} />
          <FinanceMetric label={translate('Deposits Refunded')} value={money(summary.customer_deposits_refunded as number)} icon={RotateCcw} />
        </div>

        <div className="report-tabs mb-5 flex flex-wrap gap-2 border-b pb-3 elegant-divider">{tabs.map((item) => <button type="button" key={item.id} className={tab === item.id ? 'primary-action min-h-0 px-4 py-2 text-xs' : 'secondary-action min-h-0 px-4 py-2 text-xs'} onClick={() => setTab(item.id)}>{translate(item.label)}</button>)}</div>

        {isLoading && !report ? <div className="elegant-panel p-12 text-center font-bold text-[var(--text-muted)]">{translate('Generating report...')}</div> : null}

        {report && tab === 'overview' ? <div className="space-y-6">
          <section><ReportHeading title="Daily Cash Flow" subtitle="Approved income and all cash outflows in the selected period" /><div className="h-80 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={report.cash_flow}><CartesianGrid stroke="var(--border-subtle)" vertical={false} /><XAxis dataKey="date" tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><YAxis tick={{ fill: 'var(--text-muted)', fontSize: 11 }} /><Tooltip contentStyle={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: 8 }} /><Bar dataKey="income" name={translate('Income')} fill="var(--mint)" radius={[4, 4, 0, 0]} /><Bar dataKey="outflow" name={translate('Outflow')} fill="var(--coral)" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></section>
          <section><ReportHeading title="Account Balances" subtitle="Opening balance and calculated closing balance through the report end date" /><SimpleTable headers={['Account', 'Type', 'Opening Balance', 'Closing Balance']} rows={report.accounts.map((account) => [account.name, account.type, money(account.opening_balance), money(account.closing_balance)])} /></section>
        </div> : null}

        {report && tab === 'profit_loss' ? <div className="grid gap-8 xl:grid-cols-2"><section><ReportHeading title="Income By Category" subtitle="Approved income grouped by financial category" /><SimpleTable headers={['Income Category', 'Amount']} rows={report.income_by_category.map((item) => [item.name, money(item.amount)])} total={money(summary.total_income as number)} /></section><section><ReportHeading title="Expenses By Category" subtitle="Approved expenses grouped by financial category" /><SimpleTable headers={['Expense Category', 'Amount']} rows={report.expense_by_category.map((item) => [item.name, money(item.amount)])} total={money(summary.total_expense as number)} /></section><section className="xl:col-span-2 border-t pt-5 elegant-divider"><div className="flex items-center justify-between"><div><p className="text-sm font-bold text-[var(--text-muted)]">Net Income</p><p className="mt-1 text-2xl font-extrabold">Income minus operating expenses</p></div><p className={`text-2xl font-extrabold ${Number(summary.net_income) >= 0 ? 'text-[var(--mint)]' : 'text-[var(--coral)]'}`}>{money(summary.net_income as number)}</p></div></section></div> : null}

        {report && tab === 'ledger' ? <section><ReportHeading title="General Ledger" subtitle={`${report.ledger.length} ${translate('approved entries')}`} /><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="border-y bg-[var(--bg-elevated)] text-xs uppercase text-[var(--text-muted)] elegant-divider"><tr>{['Transaction', 'Date', 'Type', 'Title', 'Category', 'Account', 'Amount', 'Reference'].map((heading) => <th key={heading} className="px-3 py-3 text-start">{translate(heading)}</th>)}</tr></thead><tbody>{report.ledger.map((item) => <tr key={item.id} className="border-b elegant-divider"><td className="px-3 py-3 font-bold">{item.transaction_number}</td><td className="px-3 py-3">{dateValue(item.transaction_date)}</td><td className="px-3 py-3"><FinanceStatus value={item.type} /></td><td className="px-3 py-3">{translate(item.title)}</td><td className="px-3 py-3">{translate(item.category?.name ?? '-')}</td><td className="px-3 py-3">{item.account?.name ?? '-'}</td><td className="px-3 py-3 font-extrabold">{money(item.amount)}</td><td className="px-3 py-3">{item.reference || '-'}</td></tr>)}</tbody></table></div></section> : null}

        {report && tab === 'outstanding' ? <section><ReportHeading title="Customer Receivables" subtitle="Current unpaid customer balances" /><SimpleTable headers={['Customer', 'Phone', 'Area', 'Outstanding']} rows={report.receivables.map((customer) => [customer.name, customer.phone || '-', customer.service_area?.name || '-', money(customer.current_balance)])} total={money(summary.receivables as number)} /></section> : null}

        {report && tab === 'controls' ? <div className="space-y-8"><section><ReportHeading title="Payroll Activity" subtitle="Payroll runs with payment dates in this report period" /><SimpleTable headers={['Payroll', 'Period', 'Net Amount', 'Status']} rows={report.payroll.map((item) => [item.payroll_number, `${dateValue(item.period_start)} - ${dateValue(item.period_end)}`, money(item.total_net), translate(item.status.replaceAll('_', ' '))])} /></section><section><ReportHeading title="Shareholder Distributions" subtitle="Profit allocations associated with financial periods in this range" /><SimpleTable headers={['Distribution', 'Period', 'Allocated', 'Paid', 'Status']} rows={report.shareholder_distributions.map((item) => [item.distribution_number, item.closing?.period_code || '-', money(item.allocated_amount), money(item.paid_amount), translate(item.status.replaceAll('_', ' '))])} /></section><div className="grid gap-8 xl:grid-cols-2"><section><ReportHeading title="Reconciliations" subtitle="Cash and bank controls" /><SimpleTable headers={['Account', 'Period End', 'Difference', 'Status']} rows={report.reconciliations.map((item) => [item.account?.name || '-', dateValue(item.period_end), money(item.difference), translate(item.status.replaceAll('_', ' '))])} /></section><section><ReportHeading title="Monthly Closings" subtitle="Financial periods and retained snapshots" /><SimpleTable headers={['Period', 'Net Income', 'Reconciled', 'Status']} rows={report.closings.map((item) => [item.period_code, money(item.net_income), translate(item.reconciliation_complete ? 'Yes' : 'No'), translate(item.status.replaceAll('_', ' '))])} /></section></div></div> : null}

        <footer className="mt-8 hidden border-t pt-4 text-xs text-slate-500 print:flex print:justify-between"><span>{translate('Generated')}: {formatDateTime(report?.generated_at)}</span><span>{translate('WSMIS Financial Control Report')}</span></footer>
      </section>
    </div>
  )
}

function ReportHeading({ title, subtitle }: { title: string; subtitle: string }) {
  const { translate } = useLanguage()
  return <div className="mb-4"><h2 className="text-lg font-extrabold text-[var(--text-primary)]">{translate(title)}</h2><p className="mt-1 text-sm font-bold text-[var(--text-muted)]">{translate(subtitle)}</p></div>
}

function SimpleTable({ headers, rows, total }: { headers: string[]; rows: (string | number)[][]; total?: string }) {
  const { translate } = useLanguage()
  return <div className="overflow-x-auto"><table className="w-full text-sm"><thead className="border-y bg-[var(--bg-elevated)] text-xs uppercase text-[var(--text-muted)] elegant-divider"><tr>{headers.map((heading) => <th key={heading} className="px-3 py-3 text-start">{translate(heading)}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex} className="border-b elegant-divider">{row.map((cell, cellIndex) => <td key={cellIndex} className={`px-3 py-3 ${cellIndex === row.length - 1 ? 'font-extrabold' : ''}`}>{translate(cell)}</td>)}</tr>)}{rows.length === 0 ? <tr><td colSpan={headers.length} className="px-3 py-8 text-center text-[var(--text-muted)]">{translate('No records for this period.')}</td></tr> : null}</tbody>{total ? <tfoot><tr className="border-t-2 font-extrabold elegant-divider"><td className="px-3 py-3" colSpan={Math.max(1, headers.length - 1)}>{translate('Total')}</td><td className="px-3 py-3">{total}</td></tr></tfoot> : null}</table></div>
}
