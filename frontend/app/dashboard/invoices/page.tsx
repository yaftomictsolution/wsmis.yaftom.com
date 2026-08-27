'use client'

import { useState } from 'react'
import { Eye, Printer } from 'lucide-react'
import { RecordPaymentButton } from '@/components/payments/RecordPaymentButton'
import { PageHeader } from '@/components/ui/PageHeader'
import { DataTable, type Column } from '@/components/ui/DataTable'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { DateText } from '@/components/ui/DateText'
import { useLanguage } from '@/context/LanguageContext'
import { useCalendar } from '@/context/CalendarContext'
import { useGetInvoicesQuery, type Invoice } from '@/src/store/waternetApi'

const statusColor = { unpaid: 'red', partially_paid: 'amber', paid: 'emerald', cancelled: 'slate' } as const
const money = (value: string | number) => `AFN ${Number(value).toLocaleString()}`
const formatReading = (value?: string | number) => `${Number(value ?? 0).toLocaleString()} m3`

export default function InvoicesPage() {
  const { t, translate } = useLanguage()
  const { formatDate } = useCalendar()
  const { data = [], isLoading, isError } = useGetInvoicesQuery()
  const [current, setCurrent] = useState<Invoice | null>(null)
  const showSkeleton = isLoading && data.length === 0
  const canPayInvoice = (invoice: Invoice) => (
    !['paid', 'cancelled'].includes(invoice.status)
    && Number(invoice.remaining_amount) > 0
    && (invoice.invoice_type !== 'contract' || ['installation_pending', 'active'].includes(invoice.contract?.status ?? ''))
  )

  const invoiceTypeLabel: Record<Invoice['invoice_type'], string> = {
    water: t('waterBill'),
    contract: t('connectionContract'),
    service: t('serviceCharge'),
    adjustment: t('billingAdjustment'),
    inventory: t('inventorySale'),
  }

  const columns: Column<Invoice>[] = [
    { key: 'invoice_number', label: t('invoice') },
    { key: 'invoice_type', label: t('invoiceType'), render: (item) => invoiceTypeLabel[item.invoice_type] },
    { key: 'customer', label: t('customer'), render: (item) => item.customer?.name ?? '-' },
    { key: 'billing_period', label: t('period'), render: (item) => item.billing_period?.name ?? '-' },
    { key: 'issue_date', label: t('issued'), render: (item) => <DateText value={item.issue_date} /> },
    { key: 'due_date', label: t('due'), render: (item) => <DateText value={item.due_date} /> },
    { key: 'consumption', label: t('usage'), render: (item) => item.invoice_type === 'water' ? `${Number(item.consumption).toLocaleString()} m3` : '-' },
    { key: 'total_amount', label: t('total'), render: (item) => money(item.total_amount) },
    { key: 'paid_amount', label: t('paid'), render: (item) => money(item.paid_amount) },
    { key: 'remaining_amount', label: t('remaining'), render: (item) => money(item.remaining_amount) },
    { key: 'status', label: t('status'), render: (item) => <Badge color={statusColor[item.status]}>{item.status}</Badge> },
  ]

  const printInvoice = (invoice: Invoice) => {
    const inventoryRequestId = invoice.inventory_request?.id
      ?? (invoice.source_type === 'inventory_request' ? invoice.source_id : undefined)

    if (invoice.invoice_type === 'inventory' && !inventoryRequestId) {
      window.alert(translate('This sales invoice is not linked to its inventory issue record.'))
      return
    }

    const route = invoice.invoice_type === 'inventory'
      ? `/print/inventory-bill/${inventoryRequestId}`
      : `/print/invoice/${invoice.id}`
    const printWindow = window.open(route, '_blank')
    if (printWindow) printWindow.opener = null
  }

  return (
    <div className="p-6 lg:p-8 max-w-[1600px] mx-auto">
      <PageHeader title={t('invoices')} subtitle="Water, contract, service, penalty, and adjustment bills" />
      {isError && <div className="mb-4 rounded-lg border border-[var(--coral)] bg-[var(--coral-soft)] px-4 py-3 text-sm font-bold text-[var(--coral)]">Unable to load invoices.</div>}
      <DataTable
        columns={columns}
        data={data}
        loading={showSkeleton}
        onView={(item) => setCurrent(item)}
        renderActions={(invoice) => canPayInvoice(invoice) ? (
          <RecordPaymentButton customerId={invoice.customer_id} invoiceId={invoice.id} iconOnly />
        ) : null}
        viewLabel={t('invoice')}
        searchKeys={['invoice_number', 'status']}
      />
      <Modal isOpen={Boolean(current)} onClose={() => setCurrent(null)} title={current?.invoice_number ?? t('invoice')} size="lg">
        {current && (
          <div className="space-y-4">
            <div className="invoice-print-area p-1 text-[var(--text-primary)]">
              <div className="flex flex-col gap-4 border-b pb-4 elegant-divider sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.22em] text-[var(--text-muted)]">WSMIS</p>
                  <h2 className="mt-1 text-2xl font-extrabold">{t('waterSupplyManagementSystem')}</h2>
                  <p className="mt-1 text-sm font-bold text-[var(--text-muted)]">{invoiceTypeLabel[current.invoice_type]}</p>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[var(--text-muted)]">{t('invoice')}</p>
                  <p className="mt-1 text-xl font-extrabold">{current.invoice_number}</p>
                  <div className="mt-2 inline-flex">
                    <Badge color={statusColor[current.status]}>{current.status}</Badge>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 border-b py-4 elegant-divider md:grid-cols-2">
                <div>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">{t('billTo')}</p>
                  <p className="mt-2 text-base font-extrabold">{current.customer?.name ?? '-'}</p>
                  <p className="mt-1 text-sm font-bold text-[var(--text-secondary)]">{t('phone')}: {current.customer?.phone ?? '-'}</p>
                  <p className="mt-1 text-sm font-bold text-[var(--text-secondary)]">{t('house')}: {current.customer?.house_number ?? '-'}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    [current.invoice_type === 'water' ? t('period') : t('invoiceType'), current.billing_period?.name ?? invoiceTypeLabel[current.invoice_type]],
                    [t('issued'), formatDate(current.issue_date)],
                    [t('due'), formatDate(current.due_date)],
                    [t('status'), current.status],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
                      <div className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">{label}</div>
                      <div className="mt-1 text-sm font-bold text-[var(--text-secondary)]">{value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {current.invoice_type === 'water' && (
                <div className="grid grid-cols-2 gap-px overflow-hidden border-b bg-[var(--border-subtle)] elegant-divider md:grid-cols-4">
                  {[
                    [t('previousReading'), formatReading(current.meter_reading?.previous_reading)],
                    [t('currentReading'), formatReading(current.meter_reading?.current_reading)],
                    [t('consumption'), formatReading(current.consumption)],
                    [t('rate'), money(current.rate_per_cubic_meter)],
                  ].map(([label, value]) => (
                    <div key={label} className="bg-[var(--bg-elevated)] p-3">
                      <p className="text-[10px] font-extrabold uppercase text-[var(--text-muted)]">{label}</p>
                      <p className="mt-1 text-sm font-extrabold text-[var(--text-primary)]">{value}</p>
                    </div>
                  ))}
                </div>
              )}

              <div className="overflow-hidden py-4">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] text-left text-[10px] font-extrabold uppercase tracking-[0.16em] text-[var(--text-muted)]">
                      <th className="py-3">{t('description')}</th>
                      <th className="py-3 text-right">{t('amount')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {(current.items?.length ? current.items : [{
                      id: 0,
                      description: t('waterConsumption'),
                      quantity: current.consumption,
                      unit_price: current.rate_per_cubic_meter,
                      discount_amount: 0,
                      amount: current.water_amount,
                    }]).map((line) => (
                      <tr key={line.id}>
                        <td className="py-3">
                          <p className="font-extrabold text-[var(--text-primary)]">{line.description}</p>
                          <p className="mt-1 text-xs font-bold text-[var(--text-muted)]">
                            {Number(line.quantity).toLocaleString()} x {money(line.unit_price)}
                            {Number(line.discount_amount) > 0 ? ` | ${t('discount')}: ${money(line.discount_amount)}` : ''}
                          </p>
                        </td>
                        <td className="py-3 text-right font-extrabold">{money(line.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end border-t pt-4 elegant-divider">
                <div className="w-full max-w-sm space-y-2">
                  {[
                    [t('total'), money(current.total_amount)],
                    [t('paid'), money(current.paid_amount)],
                    [t('remaining'), money(current.remaining_amount)],
                  ].map(([label, value], index) => (
                    <div key={label} className={`flex items-center justify-between rounded-lg px-3 py-2 ${index === 2 ? 'bg-[var(--accent-soft)] text-[var(--accent)]' : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)]'}`}>
                      <span className="font-extrabold">{label}</span>
                      <span className="font-extrabold">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 border-t pt-4 text-center text-xs font-bold text-[var(--text-muted)] elegant-divider">
                {t('pleaseKeepInvoice')}
              </div>
            </div>

            <div className="no-print flex flex-wrap justify-end gap-3">
              {!['paid', 'cancelled'].includes(current.status) && Number(current.remaining_amount) > 0 && (
                current.invoice_type === 'contract' && !['installation_pending', 'active'].includes(current.contract?.status ?? '') ? (
                  <Badge color="amber">{t('confirmContract')}</Badge>
                ) : (
                  <RecordPaymentButton
                    customerId={current.customer_id}
                    invoiceId={current.id}
                    onOpen={() => setCurrent(null)}
                  />
                )
              )}
              <button type="button" onClick={() => printInvoice(current)} className="secondary-action">
                <Printer size={16} /> {t('printInvoice')}
              </button>
              <button type="button" onClick={() => setCurrent(null)} className="secondary-action">
                <Eye size={16} /> {t('close')}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
