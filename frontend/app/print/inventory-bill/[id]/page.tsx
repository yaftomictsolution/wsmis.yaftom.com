'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef } from 'react'
import { AlertCircle, LoaderCircle, Printer, X } from 'lucide-react'
import { useParams, useSearchParams } from 'next/navigation'
import { PaktyamawjBillStyles } from '@/components/print/PaktyamawjBillStyles'
import { useCalendar } from '@/context/CalendarContext'
import { useGetInventoryRequestQuery, type InventoryRequest } from '@/src/store/waternetApi'

const money = (value?: string | number | null) => `${Number(value ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} افغانی`
const textValue = (value?: string | number | null) => String(value ?? '').trim() || '-'

const statusLabels = {
  unpaid: 'پرداخت‌نشده',
  partially_paid: 'قسمتی پرداخت‌شده',
  paid: 'پرداخت‌شده',
  cancelled: 'لغوشده',
  refunded: 'بازپرداخت‌شده',
} as const

const unitLabels: Record<string, string> = {
  piece: 'عدد',
  pieces: 'عدد',
  unit: 'عدد',
  meter: 'متر',
  kilogram: 'کیلوگرام',
  kg: 'کیلوگرام',
  liter: 'لیتر',
  litre: 'لیتر',
  set: 'ست',
}

function unitLabel(value?: string | null): string {
  const unit = String(value ?? '').trim()
  return unitLabels[unit.toLowerCase()] ?? unit
}

function itemDescription(value?: string | null): string {
  const description = textValue(value)
  const labels: Record<string, string> = {
    'water meter': 'میتر آب',
    'pvc pipe': 'پایپ پی‌وی‌سی',
    'connection fee': 'فیس اتصال',
    'meter fee': 'فیس میتر',
  }
  return labels[description.toLowerCase()] ?? description
}

function noteLabel(value?: string | null): string {
  const note = textValue(value)
  const labels: Record<string, string> = {
    'verified goods and quantities.': 'اجناس و مقادیر بررسی شد.',
    'verified goods and quantities': 'اجناس و مقادیر بررسی شد.',
    'purchase notes': 'یادداشت خرید',
    'sale notes': 'یادداشت فروش',
  }
  return labels[note.toLowerCase()] ?? note
}

function isCustomerSale(record: InventoryRequest): boolean {
  return record.type === 'issue' && (record.issue_type === 'customer' || Boolean(record.customer_id))
}

function customerName(record: InventoryRequest): string {
  return [record.customer?.name, record.customer?.last_name].filter(Boolean).join(' ') || '-'
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

export default function InventoryBillPrintPage() {
  const { formatDate: dateValue } = useCalendar()
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const requestId = Number(params.id)
  const shouldAutoPrint = searchParams.get('autoprint') !== '0'
  const printStartedRef = useRef(false)
  const { data: record, isLoading, isError } = useGetInventoryRequestQuery(requestId, {
    skip: !Number.isFinite(requestId) || requestId <= 0,
  })

  const purchase = record?.type === 'purchase'
  const sale = record ? isCustomerSale(record) : false
  const printable = Boolean(record && record.status === 'approved' && (purchase || sale) && record.document_number)

  useEffect(() => {
    if (!printable || !shouldAutoPrint || printStartedRef.current) return
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
  }, [printable, shouldAutoPrint])

  if (isLoading) return <PrintState kind="loading" message="بل در حال آماده‌شدن است..." />
  if (isError || !record) return <PrintState kind="error" message="معلومات این بل دریافت نشد." />
  if (!printable) {
    return <PrintState kind="error" message="بل پس از تأیید خرید یا فروش مشتری ایجاد می‌شود." />
  }

  const invoice = record.invoice
  const documentTitle = purchase ? 'بل خرید' : 'بل فروش'
  const documentSubtitle = purchase ? 'سند خرید اجناس از تأمین‌کننده' : 'سند فروش اجناس به مشتری'
  const partyLabel = purchase ? 'تأمین‌کننده' : 'مشتری'
  const partyName = purchase ? textValue(record.supplier?.name) : customerName(record)
  const partyPhone = purchase ? textValue(record.supplier?.phone) : textValue(record.customer?.phone)
  const partyAddress = purchase
    ? textValue(record.supplier?.address)
    : [record.customer?.address, record.customer?.house_number ? `خانه ${record.customer.house_number}` : ''].filter(Boolean).join('، ') || '-'
  const total = Number(record.total_amount ?? 0)
  const paid = purchase ? Number(record.paid_amount ?? 0) : Number(invoice?.paid_amount ?? 0)
  const remaining = purchase ? Number(record.remaining_amount ?? total) : Number(invoice?.remaining_amount ?? total)
  const paymentStatus = statusLabels[purchase ? record.payment_status : (invoice?.status ?? 'unpaid')]
  const receipts = purchase
    ? record.purchase_payments?.filter((payment) => payment.status === 'posted').map((payment) => payment.receipt_number).join('، ') || '-'
    : invoice?.allocations?.map((allocation) => allocation.payment?.receipt_number).filter(Boolean).join('، ') || '-'

  return (
    <main className="paktyamawj-bill-print-root">
      <div className="print-toolbar" dir="rtl">
        <div>
          <p className="toolbar-title">{documentTitle}</p>
          <p className="toolbar-number">{record.document_number}</p>
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
                <b dir="ltr">{record.document_number}</b>
              </div>
              <img className="company-logo" src="/images/contracts/paktyamawj-logo.jpg" alt="نشان پکتیا موج" />
              <div className="approval-box">
                <span>حالت سند</span>
                <b>تأیید‌شده</b>
                <small>سند نهایی</small>
              </div>
            </div>

            <div className="document-heading">
              <h1>{documentTitle}</h1>
              <p>{documentSubtitle}</p>
            </div>

            <table className="meta-table">
              <tbody>
                <tr>
                  <th>نمبر درخواست</th>
                  <td dir="ltr">{record.request_number}</td>
                  <th>تاریخ</th>
                  <td dir="ltr">{dateValue(record.request_date)}</td>
                </tr>
                <tr>
                  <th>{partyLabel}</th>
                  <td>{partyName}</td>
                  <th>شماره تماس</th>
                  <td dir="ltr">{partyPhone}</td>
                </tr>
                <tr>
                  <th>آدرس</th>
                  <td>{partyAddress}</td>
                  <th>گدام</th>
                  <td>{textValue(record.warehouse?.name)}</td>
                </tr>
              </tbody>
            </table>

            <table className="items-table">
              <thead>
                <tr>
                  <th className="line-number">#</th>
                  <th>شرح جنس</th>
                  <th>تعداد</th>
                  <th>قیمت فی واحد</th>
                  <th>مجموع</th>
                </tr>
              </thead>
              <tbody>
                {record.items?.map((item, index) => (
                  <tr key={item.id}>
                    <td className="line-number">{index + 1}</td>
                    <td>
                      <b>{itemDescription(item.description)}</b>
                      {item.meter_serials?.length ? <small><span>سریال‌ها: </span><span dir="ltr">{item.meter_serials.join('، ')}</span></small> : null}
                    </td>
                    <td>{Number(item.quantity).toLocaleString()} {unitLabel(item.good?.unit ?? item.inventory_item?.unit)}</td>
                    <td dir="ltr">{money(item.unit_price)}</td>
                    <td dir="ltr">{money(item.total_price)}</td>
                  </tr>
                ))}
                {Array.from({ length: Math.max(0, 6 - (record.items?.length ?? 0)) }).map((_, index) => (
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
                <p><b>تاریخ ایجاد سند:</b> <span dir="ltr">{dateValue(record.document_generated_at)}</span></p>
              </div>
              <table>
                <tbody>
                  <tr><th>مبلغ مجموع</th><td dir="ltr">{money(total)}</td></tr>
                  <tr><th>پرداخت‌شده</th><td dir="ltr">{money(paid)}</td></tr>
                  <tr className="remaining-row"><th>باقی‌مانده</th><td dir="ltr">{money(remaining)}</td></tr>
                </tbody>
              </table>
            </div>

            <div className="notes-box">
              <b>تشریحات:</b>
              <span>{noteLabel(record.notes)}</span>
            </div>

            <div className="signatures">
              <div><span>{purchase ? 'مهر و امضای تأمین‌کننده' : 'شصت و یا امضای مشتری'}</span><b>محل امضا</b></div>
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
