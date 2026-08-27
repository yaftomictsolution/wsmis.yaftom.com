import { expect, test } from '@playwright/test'

const baseInvoice = {
  customer_id: 11,
  customer: {
    id: 11,
    name: 'Ahmad',
    last_name: 'Karimi',
    phone: '0799001122',
    house_number: 'H-14',
    subscription_code: 'CUS-000011',
    address: 'Karte Parwan',
    service_area: { id: 1, name: 'Karte Parwan' },
  },
  contract: {
    id: 21,
    contract_number: 'CTR-20260824-00021',
    status: 'active',
    net_amount: 400,
    remaining_amount: 200,
  },
  billing_period: { id: 8, name: 'August 2026', code: '2026-08' },
  meter_reading: {
    id: 31,
    previous_reading: 100,
    current_reading: 112,
    consumption: 12,
    meter: { id: 4, meter_number: 'WM-1004' },
  },
  issue_date: '2026-08-24',
  due_date: '2026-09-08',
  previous_balance: 0,
  consumption: 0,
  rate_per_cubic_meter: 0,
  water_amount: 0,
  penalty_amount: 0,
  discount_amount: 0,
  total_amount: 400,
  paid_amount: 200,
  remaining_amount: 200,
  status: 'partially_paid',
  notes: 'Keep this bill for customer records.',
  payments: [{
    id: 1,
    receipt_number: 'RCT-20260824-00001',
    amount: 200,
    paid_at: '2026-08-24',
    status: 'posted',
  }],
}

const invoices = {
  601: {
    ...baseInvoice,
    id: 601,
    invoice_type: 'water',
    invoice_number: 'INV-W-20260824-00601',
    consumption: 12,
    rate_per_cubic_meter: 65,
    water_amount: 780,
    total_amount: 780,
    paid_amount: 300,
    remaining_amount: 480,
    items: [{
      id: 1,
      invoice_id: 601,
      item_type: 'water_usage',
      description: 'Water consumption',
      quantity: 12,
      unit_price: 65,
      discount_amount: 0,
      amount: 780,
      notes: 'Current billing period usage only.',
    }],
  },
  602: {
    ...baseInvoice,
    id: 602,
    invoice_type: 'contract',
    invoice_number: 'INV-C-20260824-00602',
    items: [{
      id: 2,
      invoice_id: 602,
      item_type: 'contract_fee',
      description: 'Connection Fee',
      quantity: 1,
      unit_price: 500,
      discount_amount: 100,
      amount: 400,
    }],
  },
  603: {
    ...baseInvoice,
    id: 603,
    invoice_type: 'service',
    invoice_number: 'INV-S-20260824-00603',
    penalty_amount: 150,
    total_amount: 150,
    paid_amount: 0,
    remaining_amount: 150,
    status: 'unpaid',
    items: [{
      id: 3,
      invoice_id: 603,
      item_type: 'penalty',
      description: 'Late payment penalty',
      quantity: 1,
      unit_price: 150,
      discount_amount: 0,
      amount: 150,
    }],
  },
  604: {
    ...baseInvoice,
    id: 604,
    invoice_type: 'adjustment',
    invoice_number: 'INV-A-20260824-00604',
    total_amount: 80,
    paid_amount: 0,
    remaining_amount: 80,
    status: 'unpaid',
    items: [{
      id: 4,
      invoice_id: 604,
      item_type: 'adjustment',
      description: 'Billing correction',
      quantity: 1,
      unit_price: 80,
      discount_amount: 0,
      amount: 80,
    }],
  },
} as const

test.beforeEach(async ({ page, request }) => {
  const response = await request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(response.ok()).toBeTruthy()
  const session = await response.json()

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
  }, session)

  await page.route('**/api/invoices/*', async (route) => {
    const id = Number(new URL(route.request().url()).pathname.split('/').pop()) as keyof typeof invoices
    const invoice = invoices[id]
    await route.fulfill({
      status: invoice ? 200 : 404,
      contentType: 'application/json',
      body: JSON.stringify(invoice ? { data: invoice } : { message: 'Not found' }),
    })
  })
})

test('all customer invoice types use the Paktyamawj printable design', async ({ page }) => {
  const cases = [
    [601, 'بل آب'],
    [602, 'بل قرارداد'],
    [603, 'بل جریمه'],
    [604, 'بل تعدیل'],
  ] as const

  for (const [id, title] of cases) {
    await page.emulateMedia({ media: 'screen' })
    await page.goto(`/print/invoice/${id}?autoprint=0`)
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await expect(page.getByText('Ahmad Karimi', { exact: true })).toBeVisible()
    await expect(page.getByRole('img', { name: 'شرکت آبرسانی و ساختمانی پکتیا موج' })).toBeVisible()
    await expect(page.getByRole('img', { name: 'نشان پکتیا موج' })).toBeVisible()
  }

  await page.goto('/print/invoice/601?autoprint=0')
  await expect(page.getByText('قرائت قبلی: 100 متر مکعب، قرائت فعلی: 112 متر مکعب', { exact: false })).toBeVisible()
  await expect(page.getByText('RCT-20260824-00001', { exact: true })).toBeVisible()
  await expect(page.getByText('480.00 افغانی', { exact: true })).toBeVisible()

  const sheet = page.locator('.bill-sheet')
  const dimensions = await sheet.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight)
  await sheet.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-water-invoice.png' })

  await page.emulateMedia({ media: 'print' })
  await expect(sheet).toHaveCSS('visibility', 'visible')
  const printablePdf = await page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true })
  expect(printablePdf.byteLength).toBeGreaterThan(30_000)
})
