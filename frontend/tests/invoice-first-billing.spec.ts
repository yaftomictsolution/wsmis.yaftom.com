import { expect, test } from '@playwright/test'

test('service invoice opens payment on the invoice page', async ({ page, request }) => {
  const login = await request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()
  const invoice = {
    id: 71,
    invoice_type: 'service',
    customer_id: 41,
    invoice_number: 'INV-S-TEST-001',
    issue_date: '2026-08-20',
    due_date: '2026-08-30',
    previous_balance: 0,
    consumption: 0,
    rate_per_cubic_meter: 0,
    water_amount: 0,
    penalty_amount: 0,
    discount_amount: 0,
    payment_discount_amount: 0,
    total_amount: 500,
    paid_amount: 0,
    remaining_amount: 500,
    status: 'unpaid',
    customer: {
      id: 41,
      name: 'Fatima',
      last_name: 'Noori',
      phone: '0799000001',
      house_number: 'H-10',
    },
    items: [{
      id: 81,
      invoice_id: 71,
      item_type: 'service_charge',
      description: 'Pipe repair service',
      quantity: 1,
      unit_price: 500,
      discount_amount: 0,
      amount: 500,
    }],
  }

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, session)
  await page.route('**/api/invoices', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [invoice] }),
  }))
  await page.route('**/api/customers', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ ...invoice.customer, current_balance: 500, status: 'active' }] }),
  }))
  await page.route('**/api/customers/41/detail', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: {
      customer: { ...invoice.customer, current_balance: 500, status: 'active', agreement_status: 'active', invoices: [invoice] },
      meter_replacement_history: [],
      ledger: [],
      totals: { charges: 0, invoiced: 500, paid: 0, balance: 500, deposits_held: 0 },
    } }),
  }))
  await page.route('**/api/settings', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: {
      system: {},
      payment_methods: [{ id: 1, name: 'Cash', code: 'cash', status: 'active' }],
      financial_categories: [],
      customer_charge_types: [],
    } }),
  }))
  await page.route('**/api/payments/receiving-accounts', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ id: 2, name: 'Office Cash', code: 'office_cash', type: 'cash', current_balance: 5000, status: 'active' }] }),
  }))
  await page.route('**/api/authorities/options', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [] }),
  }))

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/dashboard/invoices')
  const row = page.getByRole('row').filter({ hasText: invoice.invoice_number })
  await expect(row.getByText('Service Charge', { exact: true })).toBeVisible()
  await row.getByRole('button', { name: 'Invoice', exact: true }).click()

  const invoiceModal = page.locator('.elegant-panel').filter({
    has: page.getByRole('heading', { name: invoice.invoice_number }),
  })
  await expect(invoiceModal.getByText(invoice.items[0].description, { exact: true })).toBeVisible()
  await invoiceModal.getByRole('button', { name: 'Record Payment' }).click()

  await expect(page).toHaveURL('/dashboard/invoices')
  const paymentModal = page.locator('.elegant-panel').filter({
    has: page.getByRole('heading', { name: 'Record Payment' }),
  })
  await expect(paymentModal).toBeVisible()
  await expect(paymentModal.getByText(invoice.invoice_number, { exact: true })).toBeVisible()
  await expect(paymentModal.getByLabel('Customer')).toBeDisabled()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(300)
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
})
