'use client'

import { useState } from 'react'
import { Banknote, Download, FileBarChart, Percent, Printer, Users } from 'lucide-react'
import { FormField } from '@/components/ui/FormField'
import { LoadingButton } from '@/components/ui/AsyncButton'
import { FinanceMetric, InlineError, getApiErrorMessage, money } from '@/components/finance/FinanceUI'
import { useLanguage } from '@/context/LanguageContext'
import { useCalendar } from '@/context/CalendarContext'
import { useTrainingMode } from '@/context/TrainingModeContext'
import { downloadApiFile } from '@/lib/api'
import { useGetPayrollMonthlyReportQuery } from '@/src/store/waternetApi'

export function PayrollReportPanel() {
  const { direction, translate } = useLanguage()
  const { formatDate, formatDateTime } = useCalendar()
  const { businessDate } = useTrainingMode()
  const [filters, setFilters] = useState({ from: `${businessDate.slice(0, 7)}-01`, to: businessDate })
  const [range, setRange] = useState(filters)
  const [error, setError] = useState('')
  const { data: report, isLoading, isFetching, isError } = useGetPayrollMonthlyReportQuery(range)

  const generate = () => {
    if (!filters.from || !filters.to || filters.to < filters.from) { setError('Choose a valid payroll report date range.'); return }
    setError('')
    setRange({ ...filters })
  }
  const exportCsv = async () => {
    setError('')
    try { await downloadApiFile(`/payroll-reports/export?from=${encodeURIComponent(range.from)}&to=${encodeURIComponent(range.to)}`, `payroll-summary-${range.from}-to-${range.to}.csv`) }
    catch (exportError) { setError(getApiErrorMessage(exportError, 'Unable to export payroll report.')) }
  }

  const printReport = () => {
    if (!report) return
    const popup = window.open('', '_blank', 'width=1100,height=900')
    if (!popup) { setError('Allow pop-ups to print the payroll report.'); return }
    const escape = (value: unknown) => String(value ?? '').replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char] ?? char)
    const t = (value: string) => escape(translate(value))
    const monthRows = report.months.map((item) => `<tr><td>${escape(formatDate(`${item.month}-01`, 'month'))}</td><td>${item.runs}</td><td>${item.employees}</td><td class="num">${escape(money(item.gross_earnings))}</td><td class="num">${escape(money(item.absence_deduction))}</td><td class="num">${escape(money(item.late_deduction))}</td><td class="num">${escape(money(item.advance_deduction))}</td><td class="num">${escape(money(item.tax_deduction))}</td><td class="num">${escape(money(item.recurring_deduction))}</td><td class="num strong">${escape(money(item.net_payroll))}</td></tr>`).join('')
    const employeeRows = report.employees.map((item) => `<tr><td>${escape(item.employee_number)}</td><td>${escape(item.employee_name)}</td><td class="num">${escape(money(item.gross_earnings))}</td><td class="num">${escape(money(item.absence_deduction))}</td><td class="num">${escape(money(item.late_deduction))}</td><td class="num">${escape(money(item.advance_deduction))}</td><td class="num">${escape(money(item.tax_deduction))}</td><td class="num">${escape(money(item.recurring_deduction))}</td><td class="num">${escape(money(item.other_deduction))}</td><td class="num strong">${escape(money(item.net_paid))}</td></tr>`).join('')
    popup.document.write(`<!doctype html><html dir="${direction}"><head><meta charset="utf-8"><title>${t('Monthly Payroll Summary')}</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{font-family:Arial,Tahoma,sans-serif;color:#132238;margin:0}main{max-width:1100px;margin:auto}.head{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #1687a7;padding-bottom:16px}.brand{font-size:22px;font-weight:800;color:#0c6b87}.muted{font-size:12px;color:#637785}.title{text-align:${direction === 'rtl' ? 'left' : 'right'}}h1{margin:0;font-size:22px}.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:18px 0}.metric{border:1px solid #cad9e1;padding:12px}.metric b{display:block;font-size:11px;color:#617682}.metric span{display:block;font-size:17px;font-weight:800;margin-top:5px}h2{font-size:15px;margin:22px 0 8px}table{width:100%;border-collapse:collapse;font-size:9px}th,td{border:1px solid #c5d4dc;padding:6px;text-align:${direction === 'rtl' ? 'right' : 'left'}}th{background:#eaf7fb;color:#0c6b87}.num{text-align:right}.strong{font-weight:800}.foot{margin-top:20px;border-top:1px solid #c5d4dc;padding-top:8px;font-size:10px;color:#637785}@media print{main{max-width:none}}</style></head><body><main><div class="head"><div><div class="brand">${t('Water Supply Management System')}</div><div class="muted">${t('Human Resources & Payroll')}</div></div><div class="title"><h1>${t('Monthly Payroll Summary')}</h1><div class="muted">${escape(formatDate(range.from))} ${t('to')} ${escape(formatDate(range.to))}</div></div></div><div class="metrics"><div class="metric"><b>${t('Payroll Runs')}</b><span>${report.totals.runs}</span></div><div class="metric"><b>${t('Employees')}</b><span>${report.totals.employees}</span></div><div class="metric"><b>${t('Gross Earnings')}</b><span>${escape(money(report.totals.gross_earnings))}</span></div><div class="metric"><b>${t('Net Payroll')}</b><span>${escape(money(report.totals.net_payroll))}</span></div></div><h2>${t('Monthly Summary')}</h2><table><thead><tr><th>${t('Month')}</th><th>${t('Runs')}</th><th>${t('Employees')}</th><th>${t('Gross Earnings')}</th><th>${t('Absence')}</th><th>${t('Late Arrival')}</th><th>${t('Salary Advance')}</th><th>${t('Tax')}</th><th>${t('Recurring Deductions')}</th><th>${t('Net Payroll')}</th></tr></thead><tbody>${monthRows}</tbody></table><h2>${t('Employee Summary')}</h2><table><thead><tr><th>${t('Employee ID')}</th><th>${t('Employee')}</th><th>${t('Gross Earnings')}</th><th>${t('Absence')}</th><th>${t('Late Arrival')}</th><th>${t('Salary Advance')}</th><th>${t('Tax')}</th><th>${t('Recurring Deductions')}</th><th>${t('Other Deductions')}</th><th>${t('Net Paid')}</th></tr></thead><tbody>${employeeRows}</tbody></table><div class="foot">${t('Generated')}: ${escape(formatDateTime(report.generated_at))}</div></main><script>window.onload=()=>window.print()</script></body></html>`)
    popup.document.close()
  }

  return (
    <div className="space-y-5">
      <InlineError message={error || (isError ? 'Unable to generate payroll summary.' : '')} />
      <section className="tool-panel p-4"><div className="flex flex-col gap-3 lg:flex-row lg:items-end"><div className="grid flex-1 gap-3 sm:grid-cols-2"><FormField label="From" type="date" value={filters.from} onChange={(value) => setFilters({ ...filters, from: String(value) })} /><FormField label="To" type="date" value={filters.to} onChange={(value) => setFilters({ ...filters, to: String(value) })} /></div><LoadingButton className="primary-action" loading={isFetching && !isLoading} loadingLabel="Generating..." onClick={generate}><FileBarChart size={17} /> Generate Report</LoadingButton><button type="button" className="secondary-action" disabled={!report} onClick={() => void exportCsv()}><Download size={17} /> Excel / CSV</button><button type="button" className="secondary-action" disabled={!report} onClick={printReport}><Printer size={17} /> Print / PDF</button></div></section>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><FinanceMetric label="Payroll Runs" value={String(report?.totals.runs ?? 0)} icon={FileBarChart} /><FinanceMetric label="Employees Paid" value={String(report?.totals.employees ?? 0)} icon={Users} /><FinanceMetric label="Tax Deducted" value={money(report?.totals.tax_deduction)} icon={Percent} tone="text-[var(--gold)]" /><FinanceMetric label="Net Payroll" value={money(report?.totals.net_payroll)} icon={Banknote} tone="text-[var(--mint)]" /></div>
      <section className="tool-panel overflow-hidden"><div className="border-b p-4 elegant-divider"><h2 className="font-extrabold">Monthly Summary</h2><p className="text-xs text-[var(--text-muted)]">Approved payroll totals grouped by salary month</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1220px] text-sm"><thead className="border-b text-xs uppercase text-[var(--text-muted)] elegant-divider"><tr><Th>Month</Th><Th>Runs</Th><Th>Employees</Th><Th>Gross Earnings</Th><Th>Absence</Th><Th>Late Arrival</Th><Th>Salary Advance</Th><Th>Tax</Th><Th>Recurring Deductions</Th><Th>Net Payroll</Th></tr></thead><tbody>{isLoading ? <tr><td colSpan={10} className="p-8 text-center text-[var(--text-muted)]">Loading payroll summary...</td></tr> : report?.months.map((item) => <tr key={item.month} className="border-b elegant-divider"><Td strong>{formatDate(`${item.month}-01`, 'month')}</Td><Td>{item.runs}</Td><Td>{item.employees}</Td><Td>{money(item.gross_earnings)}</Td><Td>{money(item.absence_deduction)}</Td><Td>{money(item.late_deduction)}</Td><Td>{money(item.advance_deduction)}</Td><Td>{money(item.tax_deduction)}</Td><Td>{money(item.recurring_deduction)}</Td><Td strong>{money(item.net_payroll)}</Td></tr>)}</tbody></table></div></section>
      <section className="tool-panel overflow-hidden"><div className="border-b p-4 elegant-divider"><h2 className="font-extrabold">Employee Summary</h2><p className="text-xs text-[var(--text-muted)]">Gross earnings, deductions, and net pay by employee</p></div><div className="overflow-x-auto"><table className="w-full min-w-[1320px] text-sm"><thead className="border-b text-xs uppercase text-[var(--text-muted)] elegant-divider"><tr><Th>Employee ID</Th><Th>Employee</Th><Th>Gross Earnings</Th><Th>Absence</Th><Th>Late Arrival</Th><Th>Salary Advance</Th><Th>Tax</Th><Th>Recurring Deductions</Th><Th>Other Deductions</Th><Th>Net Paid</Th></tr></thead><tbody>{report?.employees.map((item) => <tr key={`${item.employee_id}-${item.employee_number}`} className="border-b elegant-divider"><Td>{item.employee_number}</Td><Td strong>{item.employee_name}</Td><Td>{money(item.gross_earnings)}</Td><Td>{money(item.absence_deduction)}</Td><Td>{money(item.late_deduction)}</Td><Td>{money(item.advance_deduction)}</Td><Td>{money(item.tax_deduction)}</Td><Td>{money(item.recurring_deduction)}</Td><Td>{money(item.other_deduction)}</Td><Td strong>{money(item.net_paid)}</Td></tr>)}</tbody></table></div></section>
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) { return <th className="px-3 py-3 text-start">{children}</th> }
function Td({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) { return <td className={`px-3 py-3 ${strong ? 'font-extrabold text-[var(--text-primary)]' : ''}`}>{children}</td> }
