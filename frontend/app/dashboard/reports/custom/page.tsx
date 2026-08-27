'use client'

import { useState } from 'react'
import { FileText, Download, Printer, RefreshCw } from 'lucide-react'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  useLazyGetFinancialReportQuery,
  useLazyGetOperationalReportQuery,
} from '@/src/store/waternetApi'
import { downloadCsv } from '@/lib/reporting'
import { useLanguage } from '@/context/LanguageContext'
import { InlineError } from '@/components/finance/FinanceUI'
import { DatePickerField } from '@/components/ui/DatePickerField'

const humanizeReportKey = (key: string) => key
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (letter) => letter.toUpperCase())

export default function CustomReportsPage() {
  const { language, translate } = useLanguage()
  const [reportType, setReportType] = useState('financial')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [generatedType, setGeneratedType] = useState('')
  const [message, setMessage] = useState('')
  const [loadOperational, operational] = useLazyGetOperationalReportQuery()
  const [loadFinancial, financial] = useLazyGetFinancialReportQuery()

  const handleGenerate = async () => {
    if (!dateFrom || !dateTo || dateFrom > dateTo) {
      setMessage('Select a valid From Date and To Date.')
      return
    }

    setMessage('')
    setGeneratedType(reportType)
    if (reportType === 'financial') {
      await loadFinancial({ from: dateFrom, to: dateTo })
      return
    }

    await loadOperational({
      type: reportType as 'customer' | 'inventory' | 'hr' | 'asset',
      from: dateFrom,
      to: dateTo,
    })
  }

  const summary = generatedType === 'financial'
    ? financial.data?.summary
    : generatedType === 'customer'
      ? operational.data?.customer?.totals
      : generatedType === 'inventory'
        ? operational.data?.inventory?.totals
        : generatedType === 'hr'
          ? operational.data?.hr?.totals
          : generatedType === 'asset'
            ? operational.data?.asset?.totals
            : undefined
  const rows: Record<string, unknown>[] = generatedType === 'financial'
    ? (financial.data?.ledger ?? []).map((transaction) => ({
        number: transaction.transaction_number,
        date: transaction.transaction_date,
        type: transaction.type,
        title: transaction.title,
        amount: transaction.amount,
        status: transaction.status,
      }))
    : generatedType === 'customer'
      ? operational.data?.customer?.rows ?? []
      : generatedType === 'inventory'
        ? operational.data?.inventory?.stock_levels ?? []
        : generatedType === 'hr'
          ? operational.data?.hr?.payroll_trend ?? []
          : generatedType === 'asset'
            ? operational.data?.asset?.rows ?? []
            : []
  const isLoading = operational.isFetching || financial.isFetching
  const hasError = generatedType === 'financial' ? financial.isError : operational.isError
  const numberLocale = language === 'fa' ? 'fa-AF' : 'en-US'

  return (
    <div className="relative mx-auto min-h-full max-w-[1600px] space-y-6 p-4 lg:p-8">
      <PageHeader title="Custom Reports" subtitle="Create custom reports with date range, filters, and export options" />

      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <h3 className="text-sm font-bold text-[var(--text-primary)] mb-4">{translate('Report Configuration')}</h3>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)]">{translate('Report Type')}</label>
            <select value={reportType} onChange={(e) => setReportType(e.target.value)} className="field-control h-10 px-3 text-sm w-full">
              <option value="financial">{translate('Financial Report')}</option>
              <option value="customer">{translate('Customer Report')}</option>
              <option value="inventory">{translate('Inventory Report')}</option>
              <option value="hr">{translate('HR Report')}</option>
              <option value="asset">{translate('Asset Report')}</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)]">{translate('From Date')}</label>
            <DatePickerField id="custom-report-from" value={dateFrom} onChange={setDateFrom} className="field-control h-10 px-3 text-sm w-full" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[var(--text-secondary)]">{translate('To Date')}</label>
            <DatePickerField id="custom-report-to" value={dateTo} min={dateFrom || undefined} onChange={setDateTo} className="field-control h-10 px-3 text-sm w-full" />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={handleGenerate}
              disabled={isLoading}
              className="btn-primary h-10 px-5 text-sm flex items-center justify-center gap-2 font-bold w-full"
            >
              {isLoading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {translate(isLoading ? 'Generating...' : 'Generate Report')}
            </button>
          </div>
        </div>
        <div className="mt-4">
          <InlineError message={message || (hasError ? 'Unable to generate custom report.' : '')} />
        </div>
      </div>

      {summary && (
      <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">{translate('Generated Report')}</h3>
            <p className="mt-1 text-xs text-[var(--text-muted)]">{dateFrom} {translate('to')} {dateTo}</p>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Object.entries(summary).slice(0, 8).map(([label, value]) => (
            <div key={label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
              <p className="text-xs font-medium text-[var(--text-muted)]">{translate(humanizeReportKey(label))}</p>
              <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                {typeof value === 'number' ? value.toLocaleString(numberLocale) : translate(String(value))}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="btn-secondary h-10 px-4 text-sm flex items-center gap-2"
          >
            <Printer className="h-4 w-4" /> {translate('Print / PDF')}
          </button>
          <button
            type="button"
            onClick={() => downloadCsv(`${generatedType}-report-${dateFrom}-${dateTo}.csv`, rows)}
            disabled={!rows.length}
            className="btn-secondary h-10 px-4 text-sm flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> {translate('Export CSV')}
          </button>
        </div>
      </div>
      )}
    </div>
  )
}
