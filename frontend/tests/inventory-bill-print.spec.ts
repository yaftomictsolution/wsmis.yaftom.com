import { expect, test, type Page } from '@playwright/test'

const baseRecord = {
  status: 'approved',
  warehouse_id: 1,
  warehouse: { id: 1, name: 'Main Warehouse', code: 'WH-001', status: 'active' },
  account: { id: 1, name: 'Office Cash Account', code: 'CASH-01', type: 'cash', current_balance: 5000, status: 'active' },
  requester: { id: 2, name: 'Warehouse Officer' },
  approver: { id: 1, name: 'System Admin' },
  request_date: '2026-08-24',
  approved_at: '2026-08-24T09:00:00.000000Z',
  document_generated_at: '2026-08-24T09:00:00.000000Z',
  notes: 'Verified goods and quantities.',
}

async function mockRecord(page: Page, id: number, data: Record<string, unknown>) {
  await page.route(`**/api/inventory-requests/${id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data }),
    })
  })
}

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
})

test('approved purchases and customer sales render Paktyamawj branded bills', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1200 })

  await mockRecord(page, 501, {
    ...baseRecord,
    id: 501,
    request_number: 'PO-20260824-00501',
    document_number: 'PB-20260824-00501',
    type: 'purchase',
    supplier_id: 1,
    supplier: { id: 1, name: 'Kabul Pipe Supplier', phone: '0700123456', address: 'Kabul', status: 'active' },
    total_amount: 1500,
    total_items: 3,
    initial_payment_amount: 0,
    requested_by: 2,
    items: [{
      id: 1,
      inventory_request_id: 501,
      good_id: 1,
      good: { id: 1, name: 'PVC Pipe', code: 'PVC-01', category: 'pipe', unit: 'piece', default_cost: 500, default_price: 650, status: 'active' },
      description: 'PVC Pipe',
      quantity: 3,
      unit_price: 500,
      total_price: 1500,
    }],
  })

  await page.goto('/print/inventory-bill/501?autoprint=0')
  await expect(page.getByRole('heading', { name: 'بل خرید', exact: true })).toBeVisible()
  await expect(page.getByText('PB-20260824-00501', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Kabul Pipe Supplier', { exact: true })).toBeVisible()
  await expect(page.getByText('1,500.00 افغانی', { exact: true }).last()).toBeVisible()
  await expect(page.getByRole('img', { name: 'شرکت آبرسانی و ساختمانی پکتیا موج' })).toBeVisible()
  await expect(page.getByRole('img', { name: 'نشان پکتیا موج' })).toBeVisible()
  await page.locator('.bill-sheet').screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-purchase-bill.png' })

  await mockRecord(page, 502, {
    ...baseRecord,
    id: 502,
    request_number: 'SI-20260824-00502',
    document_number: 'INV-I-20260824-00502',
    type: 'issue',
    issue_type: 'customer',
    customer_id: 9,
    customer: { id: 9, name: 'Fatima', last_name: 'Noori', phone: '0799123456', house_number: 'H-12', address: 'Karte Parwan', status: 'active' },
    payment_method: { id: 1, name: 'Cash', code: 'cash', status: 'active' },
    invoice_id: 77,
    total_amount: 700,
    total_items: 2,
    initial_payment_amount: 200,
    requested_by: 2,
    items: [{
      id: 2,
      inventory_request_id: 502,
      inventory_item_id: 3,
      inventory_item: { id: 3, name: 'Water Meter', code: 'WM-01', category: 'meter', unit: 'piece', quantity: 8, unit_cost: 250, unit_price: 350, reorder_level: 2, warehouse_id: 1 },
      description: 'Water Meter',
      quantity: 2,
      unit_price: 350,
      total_price: 700,
      meter_serials: ['WM-TEST-1001', 'WM-TEST-1002'],
    }],
    invoice: {
      id: 77,
      invoice_type: 'inventory',
      customer_id: 9,
      source_type: 'inventory_request',
      source_id: 502,
      invoice_number: 'INV-I-20260824-00502',
      issue_date: '2026-08-24',
      due_date: '2026-08-24',
      previous_balance: 0,
      consumption: 0,
      rate_per_cubic_meter: 0,
      water_amount: 0,
      penalty_amount: 0,
      discount_amount: 0,
      total_amount: 700,
      paid_amount: 200,
      remaining_amount: 500,
      status: 'partially_paid',
      allocations: [{
        id: 1,
        invoice_id: 77,
        payment_id: 1,
        amount: 200,
        payment: { id: 1, receipt_number: 'RCT-00001', amount: 200, paid_at: '2026-08-24', status: 'posted' },
      }],
    },
  })

  await page.goto('/print/inventory-bill/502?autoprint=0')
  await expect(page.getByRole('heading', { name: 'بل فروش', exact: true })).toBeVisible()
  await expect(page.getByText('INV-I-20260824-00502', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Fatima Noori', { exact: true })).toBeVisible()
  await expect(page.getByText('700.00 افغانی', { exact: true }).last()).toBeVisible()
  await expect(page.getByText('200.00 افغانی', { exact: true })).toBeVisible()
  await expect(page.getByText('500.00 افغانی', { exact: true })).toBeVisible()
  await expect(page.getByText('WM-TEST-1001، WM-TEST-1002', { exact: false })).toBeVisible()

  const sheet = page.locator('.bill-sheet')
  const dimensions = await sheet.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth)
  expect(dimensions.scrollHeight).toBeLessThanOrEqual(dimensions.clientHeight)
  await sheet.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-sales-invoice.png' })

  await page.emulateMedia({ media: 'print' })
  await expect(page.getByRole('heading', { name: 'بل فروش', exact: true })).toBeVisible()
  await expect(sheet).toHaveCSS('visibility', 'visible')
  const printablePdf = await page.pdf({ format: 'Letter', printBackground: true, preferCSSPageSize: true })
  expect(printablePdf.byteLength).toBeGreaterThan(30_000)
})
