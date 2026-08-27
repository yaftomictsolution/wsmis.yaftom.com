'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from 'react'
import { AlertCircle, LoaderCircle, Printer, X } from 'lucide-react'
import { useParams, useSearchParams } from 'next/navigation'
import { PaktyamawjBillStyles } from '@/components/print/PaktyamawjBillStyles'
import { useCalendar } from '@/context/CalendarContext'
import { useGetInvoiceQuery, type Invoice } from '@/src/store/waternetApi'

type PrintableLine = {
  id: string | number
  description: string
  detail?: string
  quantity: number
  unit?: string
  unitPrice: number
  total: number
}

const documentTypes: Record<Invoice['invoice_type'], { title: string; subtitle: string; contextLabel: string }> = {
  water: {
    title: 'بل آب',
    subtitle: 'صورت‌حساب مصرف آب مشتری',
    contextLabel: 'دوره بل',
  },
  contract: {
    title: 'بل قرارداد',
    subtitle: 'صورت‌حساب فیس اتصال و قرارداد مشتری',
    contextLabel: 'نمبر قرارداد',
  },
  service: {
    title: 'بل خدمات',
    subtitle: 'صورت‌حساب خدمات و هزینه‌های مشتری',
    contextLabel: 'نمبر قرارداد',
  },
  adjustment: {
    title: 'بل تعدیل',
    subtitle: 'صورت‌حساب تعدیل مالی مشتری',
    contextLabel: 'نوع بل',
  },
  inventory: {
    title: 'بل فروش',
    subtitle: 'سند فروش اجناس به مشتری',
    contextLabel: 'نوع بل',
  },
}

const paymentStatuses: Record<Invoice['status'], string> = {
  unpaid: 'پرداخت‌نشده',
  partially_paid: 'قسمتی پرداخت‌شده',
  paid: 'پرداخت‌شده',
  cancelled: 'لغوشده',
}

const money = (value?: string | number | null) => `${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} افغانی`
const textValue = (value?: string | number | null) => String(value ?? '').trim() || '-'
const customerName = (invoice: Invoice) => [invoice.customer?.name, invoice.customer?.last_name].filter(Boolean).join(' ') || '-'

function lineDescription(itemType: string, description?: string): string {
  const labels: Record<string, string> = {
    'water consumption': 'مصرف آب',
    'connection fee': 'فیس اتصال',
    'meter fee': 'فیس میتر',
    'reconnection fee': 'فیس وصل مجدد',
    'late payment penalty': 'جریمه دیرکرد',
    'service charge': 'فیس خدمات',
    'billing correction': 'اصلاح بل',
  }
  const value = textValue(description)
  if (labels[value.toLowerCase()]) return labels[value.toLowerCase()]
  if (itemType === 'water_usage') return 'مصرف آب'
  if (itemType === 'penalty') return 'جریمه'
  if (itemType === 'adjustment') return 'تعدیل بل'
  return value
}

function lineNote(value?: string): string {
  const note = textValue(value)
  const labels: Record<string, string> = {
    'current billing period usage only.': 'تنها مصرف دوره فعلی بل.',
    'current billing period usage only. previous outstanding invoices remain separate.': 'تنها مصرف دوره فعلی بل؛ بل‌های باقی‌مانده قبلی جدا می‌باشند.',
    'issued automatically after the customer contract was confirmed.': 'پس از تأیید قرارداد مشتری به‌صورت خودکار صادر شد.',
    'keep this bill for customer records.': 'این بل را برای سوابق مشتری نگهداری کنید.',
  }
  return labels[note.toLowerCase()] ?? (note === '-' ? '' : note)
}

function buildLines(invoice: Invoice): PrintableLine[] {
  const lines: PrintableLine[] = (invoice.items ?? []).map((item) => ({
    id: item.id,
    description: lineDescription(item.item_type, item.description),
    detail: [
      item.item_type === 'water_usage'
        ? `قرائت قبلی: ${Number(invoice.meter_reading?.previous_reading ?? 0).toLocaleString()} متر مکعب، قرائت فعلی: ${Number(invoice.meter_reading?.current_reading ?? 0).toLocaleString()} متر مکعب`
        : '',
      lineNote(item.notes),
      Number(item.discount_amount) > 0 ? `تخفیف: ${money(item.discount_amount)}` : '',
    ].filter(Boolean).join('، '),
    quantity: Number(item.quantity),
    unit: item.item_type === 'water_usage' ? 'متر مکعب' : '',
    unitPrice: Number(item.unit_price),
    total: Number(item.amount),
  }))

  if (lines.length === 0 && invoice.invoice_type === 'water') {
    lines.push({
      id: 'water-usage',
      description: 'مصرف آب',
      detail: `قرائت قبلی: ${Number(invoice.meter_reading?.previous_reading ?? 0).toLocaleString()} متر مکعب، قرائت فعلی: ${Number(invoice.meter_reading?.current_reading ?? 0).toLocaleString()} متر مکعب`,
      quantity: Number(invoice.consumption),
      unit: 'متر مکعب',
      unitPrice: Number(invoice.rate_per_cubic_meter),
      total: Number(invoice.water_amount),
    })
  }

  const itemTypes = new Set((invoice.items ?? []).map((item) => item.item_type))

  if (Number(invoice.previous_balance) > 0 && !itemTypes.has('previous_balance')) {
    lines.push({
      id: 'previous-balance',
      description: 'باقی‌مانده قبلی',
      quantity: 1,
      unitPrice: Number(invoice.previous_balance),
      total: Number(invoice.previous_balance),
    })
  }

  if (Number(invoice.penalty_amount) > 0 && !itemTypes.has('penalty')) {
    lines.push({
      id: 'penalty',
      description: 'جریمه',
      quantity: 1,
      unitPrice: Number(invoice.penalty_amount),
      total: Number(invoice.penalty_amount),
    })
  }

  if (lines.length === 0) {
    lines.push({
      id: 'invoice-total',
      description: documentTypes[invoice.invoice_type].title,
      detail: invoice.notes,
      quantity: 1,
      unitPrice: Number(invoice.total_amount),
      total: Number(invoice.total_amount),
    })
  }

  return lines
}

function PrintState({ kind, message }: { kind: 'loading' | 'error'; message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#e8edf2] p-6">
      <div className="flex max-w-lg items-center gap-3 border border-[#9fb0c2] bg-white px-5 py-4 font-bold text-[#2d0808] shadow-lg">
        {kind === 'loading'
          ? <LoaderCircle className="h-5 w-5 animate-spin text-[#305477]" />
          : <AlertCircle className="h-5 w-5 text-[#9e372d]" />}
        <span>{message}</span>
      </div>
    </main>
  )
}

export default function InvoicePrintPage() {
  const { formatDate: dateValue } = useCalendar()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const invoiceId = Number(params.id)
  const shouldAutoPrint = searchParams.get('autoprint') !== '0'
  const printStartedRef = useRef(false)
  const { data: invoice, isLoading, isError } = useGetInvoiceQuery(invoiceId, {
    skip: !Number.isFinite(invoiceId) || invoiceId <= 0,
  })

  useEffect(() => {
    if (!invoice || !shouldAutoPrint || printStartedRef.current) return
    printStartedRef.current = true

    const timer = window.setTimeout(async () => {
      await Promise.all(Array.from(document.images).map((image) => {
        if (image.complete) return Promise.resolve()
        return new Promise<void>((resolve) => {
          image.addEventListener('load', () => resolve(), { once: true })
          image.addEventListener('error', () => resolve(), { once: true })
        })
      }))
      window.print()
    }, 350)

    return () => window.clearTimeout(timer)
  }, [invoice, shouldAutoPrint])

  if (isLoading) return <PrintState kind="loading" message="بل مشتری در حال آماده‌شدن است..." />
  if (isError || !invoice) return <PrintState kind="error" message="معلومات بل مشتری دریافت نشد." />

  const penaltyInvoice = invoice.invoice_type === 'service'
    && (invoice.items?.some((item) => item.item_type === 'penalty') || Number(invoice.penalty_amount) > 0)
  const documentMeta = penaltyInvoice
    ? {
        title: 'بل جریمه',
        subtitle: 'صورت‌حساب جریمه مشتری',
        contextLabel: 'نمبر قرارداد',
      }
    : documentTypes[invoice.invoice_type]
  const paymentStatus = paymentStatuses[invoice.status]
  const lines = buildLines(invoice)
  const contextValue = invoice.invoice_type === 'water'
    ? textValue(invoice.billing_period?.code)
    : invoice.contract?.contract_number
      ? textValue(invoice.contract.contract_number)
      : documentMeta.title
  const receipts = (invoice.payments ?? [])
    .filter((payment) => payment.status === 'posted')
    .map((payment) => payment.receipt_number)
    .filter(Boolean)
    .join('، ') || '-'

  return (
    <main className="paktyamawj-bill-print-root">
      <div className="print-toolbar" dir="rtl">
        <div>
          <p className="toolbar-title">{documentMeta.title}</p>
          <p className="toolbar-number">{invoice.invoice_number}</p>
        </div>
        <div className="toolbar-actions">
          <button type="button" onClick={() => window.print()} className="print-command">
            <Printer className="h-4 w-4" /> چاپ بل
          </button>
          <button type="button" onClick={() => window.close()} className="close-command" title="بستن صفحه چاپ" aria-label="بستن صفحه چاپ">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="bill-document">
        <section className="bill-sheet" dir="rtl">
          <div className="bill-frame">
            <img className="brand-header" src="/images/contracts/paktyamawj-header.jpg" alt="شرکت آبرسانی و ساختمانی پکتیا موج" />

            <div className="bill-visual">
              <div className="document-box">
                <span>نمبر بل</span>
                <b dir="ltr">{invoice.invoice_number}</b>
              </div>
              <img className="company-logo" src="/images/contracts/paktyamawj-logo.jpg" alt="نشان پکتیا موج" />
              <div className="approval-box">
                <span>حالت پرداخت</span>
                <b>{paymentStatus}</b>
                <small>وضعیت فعلی</small>
              </div>
            </div>

            <div className="document-heading">
              <h1>{documentMeta.title}</h1>
              <p>{documentMeta.subtitle}</p>
            </div>

            <table className="meta-table">
              <tbody>
                <tr>
                  <th>نمبر بل</th>
                  <td dir="ltr">{invoice.invoice_number}</td>
                  <th>تاریخ صدور</th>
                  <td dir="ltr">{dateValue(invoice.issue_date)}</td>
                </tr>
                <tr>
                  <th>مشتری</th>
                  <td>{customerName(invoice)}</td>
                  <th>شماره تماس</th>
                  <td dir="ltr">{textValue(invoice.customer?.phone)}</td>
                </tr>
                <tr>
                  <th>کد اشتراک</th>
                  <td dir="ltr">{textValue(invoice.customer?.subscription_code)}</td>
                  <th>نمبر خانه</th>
                  <td>{textValue(invoice.customer?.house_number)}</td>
                </tr>
                <tr>
                  <th>ناحیه خدمات</th>
                  <td>{textValue(invoice.customer?.service_area?.name)}</td>
                  <th>تاریخ سررسید</th>
                  <td dir="ltr">{dateValue(invoice.due_date)}</td>
                </tr>
                <tr>
                  <th>{documentMeta.contextLabel}</th>
                  <td>{contextValue}</td>
                  <th>سریال میتر</th>
                  <td dir="ltr">{textValue(invoice.meter_reading?.meter?.meter_number)}</td>
                </tr>
              </tbody>
            </table>

            <table className="items-table">
              <thead>
                <tr>
                  <th className="line-number">#</th>
                  <th>شرح</th>
                  <th>مقدار</th>
                  <th>قیمت فی واحد</th>
                  <th>مجموع</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id}>
                    <td className="line-number">{index + 1}</td>
                    <td>
                      <b>{line.description}</b>
                      {line.detail ? <small>{line.detail}</small> : null}
                    </td>
                    <td>{line.quantity.toLocaleString()} {line.unit}</td>
                    <td dir="ltr">{money(line.unitPrice)}</td>
                    <td dir="ltr">{money(line.total)}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 5 - lines.length) }).map((_, index) => (
                  <tr key={`empty-${index}`} className="empty-row">
                    <td>&nbsp;</td><td /><td /><td /><td />
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="bill-summary">
              <div className="payment-reference">
                <p><b>حالت پرداخت:</b> {paymentStatus}</p>
                <p><b>رسیدها:</b> <span dir="ltr">{receipts}</span></p>
                <p><b>تاریخ ایجاد سند:</b> <span dir="ltr">{dateValue(invoice.issue_date)}</span></p>
              </div>
              <table>
                <tbody>
                  <tr><th>مبلغ مجموع</th><td dir="ltr">{money(invoice.total_amount)}</td></tr>
                  <tr><th>پرداخت‌شده</th><td dir="ltr">{money(invoice.paid_amount)}</td></tr>
                  {Number(invoice.payment_discount_amount ?? 0) > 0 && (
                    <tr><th>تخفیف هنگام پرداخت</th><td dir="ltr">{money(invoice.payment_discount_amount ?? 0)}</td></tr>
                  )}
                  <tr className="remaining-row"><th>باقی‌مانده</th><td dir="ltr">{money(invoice.remaining_amount)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="notes-box">
              <b>تشریحات:</b>
              <span>{lineNote(invoice.notes)}</span>
            </div>

            <div className="signatures">
              <div><span>شصت و یا امضای مشتری</span><b>محل امضا</b></div>
              <div><span>مهر و امضای مسئول شرکت</span><b>محل امضا</b></div>
              <div><span>مهر و امضای مالی و اداری</span><b>محل امضا</b></div>
            </div>

            <div className="bill-footer">
              <span>شرکت آبرسانی و ساختمانی پکتیا موج</span>
              <span>آبرسانی، ساختمان‌سازی و تولید مواد ساختمانی</span>
            </div>
          </div>
        </section>
      </div>

      <PaktyamawjBillStyles />
    </main>
  )
}
