'use client'

/* eslint-disable @next/next/no-img-element */

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, LoaderCircle, Printer, X } from 'lucide-react'
import { useParams, useSearchParams } from 'next/navigation'
import { API_BASE_URL, getAuthToken } from '@/lib/api'
import {
  useGetCustomerDetailQuery,
  useGetSettingsQuery,
  type Customer,
  type CustomerContract,
  type MeterAssignment,
} from '@/src/store/waternetApi'

type DateParts = { year: string; month: string; day: string }

const emptyDate: DateParts = { year: '1405', month: '', day: '' }

const contractMoney = (value?: string | number | null) => Number(value ?? 0).toLocaleString('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const textValue = (value?: string | number | null) => {
  const valueText = String(value ?? '').trim()
  return valueText || ' '
}

const persianDateParts = (value?: string): DateParts => {
  if (!value) return emptyDate

  const normalized = value.slice(0, 10)
  const date = new Date(`${normalized}T00:00:00Z`)
  if (Number.isNaN(date.getTime())) return emptyDate

  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', {
      timeZone: 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date)

    return {
      year: parts.find((part) => part.type === 'year')?.value ?? '1405',
      month: parts.find((part) => part.type === 'month')?.value ?? '',
      day: parts.find((part) => part.type === 'day')?.value ?? '',
    }
  } catch {
    return { year: normalized.slice(0, 4), month: normalized.slice(5, 7), day: normalized.slice(8, 10) }
  }
}

const currentContractFor = (customer: Customer): CustomerContract | undefined =>
  customer.latest_contract ?? customer.contracts?.[0]

const activeAssignmentFor = (customer: Customer, current?: MeterAssignment): MeterAssignment | undefined =>
  current ?? customer.meter_assignments?.find((assignment) => assignment.status === 'active')

const companyResponsibilities = [
  'شرکت مکلف است آب آشامیدنی مورد ضرورت مشترکین خویش را در صورتیکه مشکلات تخنیکی، خشک سالی و سایر موارد قانونی وجود نداشته باشد، مطابق ظرفیت شبکه به شکل منظم فراهم نماید.',
  'چون آب ارتباط مستقیم با حیات انسان‌ها دارد، هر نوع دخالت و دست‌برد در امور نلدوانی، تولید و توزیع آب، پیپ‌های شبکه، میتر آب و سنجش مصارف از طرف مشتری جداً ممنوع بوده و مسئولیت آن مربوط شرکت است.',
  'ثبت راجستر و توزیع فورم شمولیت شبکه آبرسانی مطابق شرایط و پالیسی شرکت و به موافقه متقاضی به دوش شرکت می‌باشد.',
  'پول حق العضویت یا امتیاز در آینده غیر قابل برگشت است. شرکت در بدل آن، وصل نل آب خانه مشترک به شبکه، کندن‌کاری پیپ نیم انچ از یک تا پانزده متر، نصب میتر، بکسه میتر و وسایل ضروری کنکشن جدید را انجام می‌دهد.',
  'قیمت فعلی هر متر مکعب آب آشامیدنی یعنی ۱۰۰۰ لیتر برای مشترک رهایشی ۷۵ افغانی و تجارتی ۸۵ افغانی است و در آینده نظر به مصارف شرکت، شرایط اقتصادی و وضعیت بازار قابل تغییر می‌باشد.',
  'شرکت مکلف است هر ماه یک مرتبه توسط مأمور موظف، میتر آب مشترکین را قرائت و مصارف آب را در کتاب میترخوانی و کتابچه صرفیه آب درج نماید.',
  'حفظ و مراقبت، ترمیم و نگهداری شبکه آبرسانی، جلوگیری از ضایعات آب و قطع خدمات مطابق اصول، مسئولیت شرکت می‌باشد.',
  'شرکت به شکایات، مشکلات و درخواست‌های قانونی مشترکین رسیدگی می‌نماید.',
  'شرکت برای توسعه شبکه و وصل خدمات به ساحات جدید مطابق پلان شرکت آبرسانی تلاش می‌نماید.',
  'شرکت می‌تواند مطابق اصول و پالیسی خویش، لوایح جدید برای جلوگیری از تخلفات، جبران خساره، جریمه نقدی و قطع خدمات طرح و تطبیق نماید.',
]

const customerResponsibilities = [
  'پرداخت به موقع پول صرفیه آب بعد از میترخوانی و سایر مصارف تعیین‌شده. در صورت تأخیر، جریمه اخذ و در دوره سوم نل آب مشتری قطع می‌گردد.',
  'خودداری از دست‌کاری میتر آب، تخریب مهر و لاک، پایپ‌ها، وصل یا کنکشن غیرقانونی، استفاده بدون میتر، انتقال آب به شخص ثالث و نصب میتر فرعی. خساره تخلف مطابق پالیسی شرکت اخذ می‌گردد.',
  'استفاده قانونی و درست از آب شبکه، جلوگیری از مصرف بی‌رویه، حفظ میتر و مهر و لاک، همکاری با کارمندان شرکت و اطلاع فوری لیکی آب به شرکت.',
  'مشتری حق نصب و استفاده پمپ مستقیم را در شبکه ندارد.',
  'پرداخت جبران خساره واردشده از طرف مشتری به شبکه و شرکت.',
  'مشتری مکلف است تمام شرایط، لوایح، قرارداد، اصول و پالیسی شرکت آبرسانی پکتیا موج را رعایت کند.',
  'احترام به نوبت توزیع آب و حقوق سایر مشترکین شبکه.',
]

const contractMetaWidth = (value?: string | number | null) => {
  const length = Array.from(String(value ?? '').trim()).length
  if (length > 48) return 'meta-full'
  if (length > 24) return 'meta-wide'
  return ''
}

function ContractMetaItem({
  label,
  value,
  className = '',
}: {
  label: string
  value?: string | number | null
  className?: string
}) {
  return (
    <div className={[contractMetaWidth(value), className].filter(Boolean).join(' ')}>
      <b>{label}:</b>
      <span>{textValue(value)}</span>
    </div>
  )
}

function ContractMeta({ customer, assignment, date }: { customer: Customer; assignment?: MeterAssignment; date: DateParts }) {
  const area = customer.service_area
  const mosque = customer.service_area_mosque?.name || area?.mosque_name || area?.name
  const subscriptionDate = `${date.year} / ${date.month} / ${date.day}`

  return (
    <div className="contract-meta">
      <ContractMetaItem label="کد اشتراک" value={customer.subscription_code} className="meta-identifier" />
      <ContractMetaItem label="سریال میتر" value={assignment?.meter?.meter_number} className="meta-identifier" />
      <ContractMetaItem label="نمبر خانه" value={customer.house_number} className="meta-identifier" />
      <ContractMetaItem label="نمبر نزدیک خانه" value={customer.nearest_house_number} className="meta-identifier" />
      <ContractMetaItem label="سکونت اصلی" value={customer.original_residence} />
      <ContractMetaItem label="سکونت فعلی" value={customer.current_residence} />
      <ContractMetaItem label="سرک" value={customer.street_number || area?.street_block_village} />
      <ContractMetaItem label="کوچه" value={customer.street_number} />
      <ContractMetaItem label="مسجد" value={mosque} className="meta-mosque" />
      <ContractMetaItem label="ناحیه" value={area?.district} />
      <ContractMetaItem label="تاریخ اشتراک" value={subscriptionDate} className="contract-date" />
    </div>
  )
}

function IdentityFinanceTable({
  customer,
  contract,
  assignment,
  compact = false,
}: {
  customer: Customer
  contract?: CustomerContract
  assignment?: MeterAssignment
  compact?: boolean
}) {
  const connectionFee = contract?.connection_fee ?? customer.connection_fee
  const meterFee = contract?.meter_fee ?? customer.meter_fee
  const paid = contract?.paid_amount ?? contract?.applied_amount ?? customer.agreement_paid_amount
  const discount = contract?.discount_amount ?? customer.agreement_discount_amount
  const remaining = contract?.remaining_amount ?? customer.agreement_remaining_amount
  const discountBy = contract?.discount_approved_by ?? customer.discount_approved_by
  const meterSize = contract?.meter_size ?? customer.meter_size ?? 'نیم انچ'
  const notes = contract?.notes ?? customer.notes

  return (
    <table className={`identity-finance-table ${compact ? 'compact' : ''}`} dir="ltr">
      <colgroup>
        <col className="financial-value-column" />
        <col className="financial-label-column" />
        <col className="identity-value-column" />
        <col className="identity-label-column" />
      </colgroup>
      <thead>
        <tr>
          <th colSpan={2}>حق الانشعاب مشترکین</th>
          <th colSpan={2}>شهرت</th>
        </tr>
      </thead>
      <tbody>
        <tr><td>{contractMoney(connectionFee)}</td><th>حق الشمول:</th><td>{textValue(customer.name)}</td><th>اسم</th></tr>
        <tr><td>{contractMoney(meterFee)}</td><th>درآمد میتر:</th><td>{textValue(customer.last_name)}</td><th>تخلص</th></tr>
        <tr><td>{contractMoney(paid)}</td><th>دریافتی نقدی:</th><td>{textValue(customer.father_name)}</td><th>ولد</th></tr>
        <tr><td>{textValue(discountBy)}</td><th>تخفیف دهنده:</th><td>{textValue(customer.grandfather_name)}</td><th>ولدیت</th></tr>
        <tr><td>{contractMoney(discount)}</td><th>مقدار تخفیف:</th><td>{textValue(customer.tazkira_number)}</td><th>نمبر تذکره</th></tr>
        <tr><td>{contractMoney(remaining)}</td><th>باقی مانده:</th><td>{textValue(customer.phone)}</td><th>نمبر مبایل</th></tr>
        <tr>
          <td rowSpan={2} className="notes-value">{textValue(notes)}</td>
          <th rowSpan={2} className="notes-label">تشریحات:</th>
          <td>{textValue(meterSize)}</td>
          <th>سایز نل</th>
        </tr>
        <tr><td>{textValue(assignment?.installer?.name)}</td><th>نام نلدوان وصل کننده</th></tr>
      </tbody>
    </table>
  )
}

function HeaderArtwork() {
  return <img className="brand-header" src="/images/contracts/paktyamawj-header.jpg" alt="Paktyamawj Water Supply and Construction Company" />
}

export default function CustomerContractPrintPage() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const customerId = Number(params.id)
  const shouldAutoPrint = searchParams.get('autoprint') !== '0'
  const { data, isLoading, isError } = useGetCustomerDetailQuery(customerId, { skip: !Number.isFinite(customerId) || customerId <= 0 })
  const { data: settings } = useGetSettingsQuery()
  const [loadedPhoto, setLoadedPhoto] = useState<{ customerId: number; url: string | null } | null>(null)
  const printStartedRef = useRef(false)

  const customer = data?.customer
  const contract = customer ? currentContractFor(customer) : undefined
  const assignment = customer ? activeAssignmentFor(customer, data?.current_meter_assignment) : undefined
  const subscriptionDate = persianDateParts(contract?.subscription_date ?? customer?.subscription_date)
  const companyPhone = settings?.system.system_profile?.phone || '0767300900'
  const photoUrl = customer && loadedPhoto?.customerId === customer.id ? loadedPhoto.url : null
  const photoReady = Boolean(customer && (!customer.has_photo || loadedPhoto?.customerId === customer.id))

  useEffect(() => {
    if (!customer) return
    if (!customer.has_photo) return

    const controller = new AbortController()
    let objectUrl: string | null = null
    const loadPhoto = async () => {
      const token = getAuthToken()
      const response = await fetch(`${API_BASE_URL}/customers/${customer.id}/photo`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('Unable to load customer photo.')
      objectUrl = URL.createObjectURL(await response.blob())
      setLoadedPhoto({ customerId: customer.id, url: objectUrl })
    }

    loadPhoto()
      .catch(() => {
        if (!controller.signal.aborted) setLoadedPhoto({ customerId: customer.id, url: null })
      })

    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [customer])

  useEffect(() => {
    if (!customer || !photoReady || !shouldAutoPrint || printStartedRef.current) return
    printStartedRef.current = true

    const waitForImages = Promise.all(Array.from(document.images).map((image) => {
      if (image.complete) return Promise.resolve()
      return new Promise<void>((resolve) => {
        image.addEventListener('load', () => resolve(), { once: true })
        image.addEventListener('error', () => resolve(), { once: true })
      })
    }))

    waitForImages.then(() => window.setTimeout(() => window.print(), 250))
  }, [customer, photoReady, shouldAutoPrint])

  const title = useMemo(() => contract?.contract_number || customer?.subscription_code || 'Customer Contract', [contract, customer])

  useEffect(() => {
    document.title = title
  }, [title])

  if (isLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-700">
        <LoaderCircle className="mr-2 h-5 w-5 animate-spin" /> Loading customer contract...
      </main>
    )
  }

  if (isError || !customer) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
        <div className="flex max-w-lg items-center gap-3 border border-red-200 bg-white p-5 text-sm font-bold text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" /> Unable to load the customer contract. Sign in again and retry from the customer page.
        </div>
      </main>
    )
  }

  const mosque = customer.service_area_mosque?.name || customer.service_area?.mosque_name || customer.service_area?.name
  const district = customer.service_area?.district || customer.service_area?.name
  const workerName = assignment?.installer?.name

  return (
    <main className="contract-print-root">
      <div className="print-toolbar" dir="ltr">
        <strong>{title}</strong>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => window.print()} className="print-command">
            <Printer className="h-4 w-4" /> Print
          </button>
          <button type="button" onClick={() => window.close()} className="close-command" title="Close print view" aria-label="Close print view">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="contract-document" dir="rtl">
        <section className="contract-sheet license-sheet">
          <div className="license-frame">
            <HeaderArtwork />
            <div className="license-visual">
              <div className="customer-photo-box">
                {photoUrl ? <img src={photoUrl} alt="Customer" /> : <span>محل نصب<br />فوتو</span>}
              </div>
              <img className="company-logo" src="/images/contracts/paktyamawj-logo.jpg" alt="Paktyamawj logo" />
            </div>
            <h1 className="document-title">جواز اشتراک در شبکه آبرسانی</h1>
            <ContractMeta customer={customer} assignment={assignment} date={subscriptionDate} />
            <IdentityFinanceTable customer={customer} contract={contract} assignment={assignment} />
            <div className="license-signatures">
              <div>امضاء و مهر<br /><b>مدیر مالی و اداری</b></div>
              <div>مهر و امضاء<br /><b>ریاست شرکت</b></div>
              <div>شصت و یا امضاء<br /><b>مشتری</b></div>
            </div>
          </div>
        </section>

        <section className="contract-sheet terms-sheet">
          <h1>مکلفیت های شرکت آبرسانی پکتیا موج</h1>
          <ol>
            {companyResponsibilities.map((item) => <li key={item}>{item}</li>)}
          </ol>

          <h2>مکلفیت های مشتری:</h2>
          <ol>
            {customerResponsibilities.map((item) => <li key={item}>{item}</li>)}
          </ol>

          <p className="terms-closing">
            این قرارداد شامل دو بخش و داخل (۱۷) ماده، در (۲) نسخه متحدالمتن ترتیب گردیده و بعد از امضاء، مهر و شصت طرفین، هر نسخه دارای اعتبار مساوی و قابل تطبیق می‌باشد.
          </p>
          <div className="terms-signature">شصت و یا امضاء مشتری ( &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; )</div>
          <div className="customer-service-phone">شماره تماس خدمات مشتریان: <span dir="ltr">{companyPhone}</span></div>
        </section>

        <section className="contract-sheet plumbing-sheet">
          <HeaderArtwork />
          <h1 className="plumbing-title">پارچه نلدوانی شرکت آبرسانی پکتیا موج</h1>
          <ContractMeta customer={customer} assignment={assignment} date={subscriptionDate} />
          <IdentityFinanceTable customer={customer} contract={contract} assignment={assignment} compact />
          <div className="office-signature">اسم و امضاء مسئول دفتر</div>

          <div className="digging-rules">
            <p>۱_ بعد از ختم کندنکاری، ساحه کندنکاری را به حساب طول آن متر نموده و بعداً به شماره ذیل به تماس شوید.</p>
            <p>۲_ از ۱ الی ۱۵ متر پیپ نیم انچ به دوش شرکت بوده و متباقی به دوش خود مشتری می‌باشد.</p>
          </div>

          <div className="slip-divider" />
          <div className="work-slips" dir="ltr">
            <section dir="rtl">
              <h2>پارچه توزیع چک &nbsp;&nbsp; {subscriptionDate.year} / {subscriptionDate.month} / {subscriptionDate.day}</h2>
              <p><b>انتقال چک از دفتر به دوش خود مشتری می‌باشد.</b></p>
              <p>برای محترم ( {textValue(customer.name)} ) ولد ( {textValue(customer.father_name)} )</p>
              <p>یک عدد چک داده شود.</p>
              <p>آدرس کوچه ( {textValue(customer.street_number)} ) مسجد ( {textValue(mosque)} )</p>
              <p>مشتری محترم از آدرس ذیل چک خود را تسلیم شوند.</p>
              <div className="slip-signature">مهر و امضاء<br />مسئول دفتر</div>
            </section>

            <section dir="rtl">
              <h2>پارچه کندنکار جای نل آب ناحیه ({textValue(district)})</h2>
              <p><b>نمبر ثبت ( {textValue(customer.subscription_code)} ) تاریخ {subscriptionDate.year} / {subscriptionDate.month} / {subscriptionDate.day}</b></p>
              <p>برای محترم ( {textValue(customer.name)} ) ولد ( {textValue(customer.father_name)} )</p>
              <p>کوچه ( {textValue(customer.street_number)} ) مسجد ( {textValue(mosque)} )</p>
              <p>از یک الی پانزده متر طبق ضرورت، جای نل آب از پیپ عمومی الی منزل مسکونی‌اش کندنکاری شود که به دوش شرکت می‌باشد؛ اضافه‌تر آن به دوش خود مشتری محترم است.</p>
              <p className="worker-name">اسم کاریگر: {textValue(workerName)}</p>
              <div className="slip-signature">مهر و امضاء<br />مسئول دفتر</div>
            </section>
          </div>
        </section>
      </div>

      <style jsx global>{`
        @page { size: Letter portrait; margin: 0; }
        * { box-sizing: border-box; letter-spacing: 0; }
        html, body { margin: 0; padding: 0; }
        body { background: #e8edf2; }
        .contract-print-root { min-height: 100vh; color: #250606; font-family: Tahoma, Arial, sans-serif; }
        .print-toolbar { position: sticky; top: 0; z-index: 20; display: flex; min-height: 56px; align-items: center; justify-content: space-between; border-bottom: 1px solid #d5dbe3; background: rgba(255,255,255,.96); padding: 8px 20px; color: #172033; box-shadow: 0 4px 16px rgba(15,23,42,.08); }
        .print-command, .close-command { display: inline-flex; height: 38px; align-items: center; justify-content: center; gap: 8px; border: 1px solid #c9d2df; background: #fff; padding: 0 14px; color: #172033; font-weight: 800; cursor: pointer; }
        .print-command { border-color: #087f8c; background: #087f8c; color: #fff; }
        .close-command { width: 38px; padding: 0; }
        .contract-document { display: flex; flex-direction: column; align-items: center; gap: 24px; padding: 24px; }
        .contract-sheet { position: relative; width: 215.9mm; height: 279.4mm; flex: 0 0 auto; overflow: hidden; background: #fff; color: #2d0808; box-shadow: 0 10px 30px rgba(15,23,42,.16); font-family: Tahoma, Arial, sans-serif; }
        .license-sheet { padding: 14.5mm 10.5mm 13.5mm; }
        .license-frame { height: 251.4mm; border: .45mm solid #161616; padding: 0 8.5mm 8mm; }
        .brand-header { display: block; width: 100%; height: 25mm; object-fit: fill; }
        .license-frame > .brand-header { margin: 0; }
        .license-visual { position: relative; height: 36mm; }
        .customer-photo-box { position: absolute; top: 1mm; left: 0; display: flex; width: 31mm; height: 35mm; align-items: center; justify-content: center; overflow: hidden; border: .5mm double #305477; color: #111; font-size: 12pt; line-height: 1.7; text-align: center; }
        .customer-photo-box img { width: 100%; height: 100%; object-fit: cover; }
        .company-logo { position: absolute; top: 0; left: 50%; width: 38mm; height: 38mm; transform: translateX(-50%); object-fit: contain; }
        .document-title, .plumbing-title { margin: 0 0 1.5mm; color: #111; font-size: 17pt; font-weight: 900; line-height: 1.15; text-align: center; }
        .contract-meta { display: grid; min-height: 26mm; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: minmax(7.5mm, auto); direction: rtl; border: .35mm solid #2c1a1a; padding: 1mm 3mm; color: #310909; font-size: 10pt; font-weight: 700; }
        .contract-meta > div { display: flex; min-width: 0; align-items: flex-start; gap: 1.5mm; padding: .8mm 0; line-height: 1.3; white-space: normal; }
        .contract-meta b { flex: 0 0 auto; padding-top: .1mm; font-weight: 900; white-space: nowrap; }
        .contract-meta span { min-width: 0; overflow: visible; overflow-wrap: anywhere; text-overflow: clip; word-break: break-word; font-weight: 700; white-space: normal; }
        .contract-meta .meta-identifier { gap: .6mm; font-size: 9.2pt; }
        .contract-meta .meta-identifier span { flex: 0 0 auto; overflow-wrap: normal; word-break: normal; white-space: nowrap; }
        .contract-meta .contract-date { align-items: center; }
        .contract-meta .contract-date span { white-space: nowrap; }
        .contract-meta .meta-wide, .contract-meta .meta-mosque { grid-column: span 2; }
        .contract-meta .meta-full { grid-column: 1 / -1; }
        .contract-meta .contract-date { grid-column: span 1; }
        .identity-finance-table { width: 100%; margin-top: 5mm; table-layout: fixed; border-collapse: collapse; color: #310909; font-size: 9.5pt; line-height: 1.15; }
        .identity-finance-table col.financial-value-column { width: 39%; }
        .identity-finance-table col.financial-label-column { width: 12%; }
        .identity-finance-table col.identity-value-column { width: 31%; }
        .identity-finance-table col.identity-label-column { width: 18%; }
        .identity-finance-table th, .identity-finance-table td { height: 7mm; border: .35mm solid #242424; padding: .8mm 1.5mm; direction: rtl; text-align: right; vertical-align: middle; }
        .identity-finance-table thead th { height: 10mm; color: #111; font-size: 14pt; text-align: center; }
        .identity-finance-table tbody th { font-weight: 900; }
        .identity-finance-table tbody td { color: #111; font-weight: 700; }
        .identity-finance-table .notes-value, .identity-finance-table .notes-label { height: 14mm; vertical-align: top; }
        .license-signatures { display: grid; min-height: 14mm; grid-template-columns: repeat(3, 1fr); align-items: center; border: .35mm solid #242424; border-top: 0; color: #310909; font-size: 9pt; line-height: 1.3; text-align: center; }
        .license-signatures b { font-weight: 800; }
        .terms-sheet { padding: 17mm 14mm 10mm; color: #111; font-family: Tahoma, Arial, sans-serif; }
        .terms-sheet h1 { margin: 0 0 1.5mm; font-size: 16.5pt; font-weight: 900; text-align: center; }
        .terms-sheet h2 { margin: 2mm 0 1mm; font-size: 16pt; font-weight: 900; }
        .terms-sheet ol { margin: 0; padding: 0; counter-reset: contract-item; list-style: none; font-size: 10.7pt; font-weight: 700; line-height: 1.64; }
        .terms-sheet li { position: relative; padding-right: 7mm; color: #111 !important; opacity: 1 !important; text-align: justify; }
        .terms-sheet li::before { position: absolute; top: 0; right: 0; counter-increment: contract-item; content: counter(contract-item) '-'; font-weight: 900; }
        .terms-closing { margin: 1.5mm 0 0; font-size: 11pt; font-weight: 900; line-height: 1.55; text-align: justify; }
        .terms-signature { margin-top: 1mm; padding-right: 0; font-size: 11pt; font-weight: 800; text-align: right; }
        .customer-service-phone { margin-top: 1mm; font-size: 12pt; font-weight: 700; text-align: left; }
        .plumbing-sheet { padding: 13.5mm 11.5mm 10mm; color: #260707; }
        .plumbing-sheet > .brand-header { height: 27mm; }
        .plumbing-title { position: relative; z-index: 1; margin-top: 14mm; margin-bottom: 1mm; color: #111 !important; font-size: 16pt; opacity: 1 !important; }
        .plumbing-sheet .contract-meta { min-height: 27mm; grid-auto-rows: minmax(8mm, auto); font-size: 9.7pt; }
        .plumbing-sheet .identity-finance-table { margin-top: 5mm; font-size: 9.3pt; }
        .identity-finance-table.compact th, .identity-finance-table.compact td { height: 7.1mm; padding: .8mm 1.5mm; }
        .identity-finance-table.compact thead th { height: 9mm; font-size: 13pt; }
        .identity-finance-table.compact .notes-value, .identity-finance-table.compact .notes-label { height: 13mm; }
        .office-signature { height: 15mm; border: .35mm solid #242424; border-top: 0; padding-top: 4mm; font-size: 11pt; text-align: center; }
        .digging-rules { padding: 2mm 1mm 1mm; color: #2f0909; font-size: 9.7pt; font-weight: 900; line-height: 1.55; }
        .digging-rules p { margin: 0 0 1mm; }
        .slip-divider { height: .35mm; margin: 2mm 0; background: #8fbce6; }
        .work-slips { display: grid; height: 51mm; grid-template-columns: 1fr 1.16fr; gap: 10mm; color: #111; }
        .work-slips section { position: relative; display: flex; flex-direction: column; border: .35mm solid #222; padding: 0 3mm 2mm; overflow: hidden; }
        .work-slips h2 { margin: 0 -3mm 1.5mm; border-bottom: .35mm solid #222; padding: 1mm 2mm; font-size: 11.5pt; font-weight: 900; line-height: 1.2; text-align: center; }
        .work-slips p { margin: .4mm 0; font-size: 8.2pt; font-weight: 700; line-height: 1.34; }
        .work-slips .worker-name { font-weight: 900; }
        .slip-signature { margin-top: auto; font-size: 8.4pt; font-weight: 800; line-height: 1.3; text-align: center; }
        @media print {
          html, body { width: 215.9mm; min-width: 215.9mm; background: #fff !important; }
          .contract-print-root, .contract-print-root * { visibility: visible !important; }
          .print-toolbar { display: none !important; }
          .contract-document { display: block; padding: 0; }
          .contract-sheet { margin: 0; box-shadow: none; break-after: page; page-break-after: always; }
          .contract-sheet:last-child { break-after: auto; page-break-after: auto; }
          .contract-print-root, .contract-sheet { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
        }
      `}</style>
    </main>
  )
}
