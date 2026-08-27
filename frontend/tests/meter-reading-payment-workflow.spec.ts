import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page, request }) => {
  const response = await request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(response.ok()).toBeTruthy()
  const session = await response.json()
  await page.addInitScript(({ token, user }) => {
    if (sessionStorage.getItem('wsmis_workflow_test_initialized') === '1') return
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
    sessionStorage.setItem('wsmis_workflow_test_initialized', '1')
  }, session)
})

test('meter reading cascades searchable area, mosque, and customer selectors', async ({ page }) => {
  let readingRequest: Record<string, unknown> | null = null

  await page.route('**/api/billing-periods', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{
      id: 11,
      name: 'August 2026',
      code: '2026-08',
      starts_on: '2026-08-01',
      ends_on: '2026-08-31',
      status: 'open',
    }] }),
  }))
  await page.route('**/api/service-areas', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [
      { id: 1, name: 'Karte Parwan', status: 'inactive', households_count: 10, rate_per_cubic_meter: 10, mosques: [{ id: 101, service_area_id: 1, name: 'Masjid Omar', status: 'inactive' }, { id: 102, service_area_id: 1, name: 'Masjid Empty', status: 'active' }] },
      { id: 2, name: 'Khair Khana', status: 'active', households_count: 10, rate_per_cubic_meter: 10, mosques: [{ id: 201, service_area_id: 2, name: 'Masjid Bilal', status: 'active' }] },
    ] }),
  }))
  await page.route('**/api/customers', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [
      { id: 301, service_area_id: 1, service_area_mosque_id: 101, subscription_code: 'CUS-000301', name: 'Fatima', last_name: 'Noori', phone: '0799000001', house_number: 'H-10', status: 'active' },
      { id: 303, service_area_id: 1, service_area_mosque_id: 101, subscription_code: 'CUS-000303', name: 'Unmetered', last_name: 'Customer', phone: '0799000003', house_number: 'H-11', status: 'registered' },
      { id: 302, service_area_id: 2, service_area_mosque_id: 201, subscription_code: 'CUS-000302', name: 'Ahmad', last_name: 'Karimi', phone: '0799000002', house_number: 'H-20', status: 'active' },
    ] }),
  }))
  await page.route('**/api/meter-assignments', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [
      {
        id: 501,
        customer_id: 301,
        meter_id: 401,
        initial_reading: 20,
        installation_date: '2026-07-01',
        status: 'active',
        customer: { id: 301, service_area_id: 1, service_area_mosque_id: 101, subscription_code: 'CUS-000301', name: 'Fatima', last_name: 'Noori', phone: '0799000001', house_number: 'H-10', agreement_status: 'active' },
        contract: { id: 601, customer_id: 301, contract_number: 'CTR-301', status: 'active', net_amount: 400, remaining_amount: 0 },
        meter: { id: 401, meter_number: 'WM-TEST-0301', status: 'installed' },
      },
      {
        id: 502,
        customer_id: 302,
        meter_id: 402,
        initial_reading: 10,
        installation_date: '2026-07-01',
        status: 'active',
        customer: { id: 302, service_area_id: 2, service_area_mosque_id: 201, subscription_code: 'CUS-000302', name: 'Ahmad', last_name: 'Karimi', phone: '0799000002', house_number: 'H-20', agreement_status: 'active' },
        contract: { id: 602, customer_id: 302, contract_number: 'CTR-302', status: 'active', net_amount: 400, remaining_amount: 0 },
        meter: { id: 402, meter_number: 'WM-TEST-0302', status: 'installed' },
      },
    ] }),
  }))
  await page.route('**/api/meter-readings', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      return
    }
    readingRequest = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ data: { id: 9001, ...readingRequest } }) })
  })

  await page.goto('/dashboard/meter-readings')
  await page.getByRole('button', { name: 'Record Reading', exact: true }).click()

  await expect(page.getByRole('combobox', { name: /Mosque/ })).toBeDisabled()
  await expect(page.getByRole('combobox', { name: /Customer/ })).toBeDisabled()

  await page.getByRole('combobox', { name: /Service Area/ }).click()
  await expect(page.getByRole('option', { name: 'Khair Khana' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search Service Area' }).fill('Parwan')
  await page.getByRole('option', { name: 'Karte Parwan' }).click()

  await page.getByRole('combobox', { name: /Mosque/ }).click()
  await expect(page.getByRole('option', { name: 'Masjid Empty' })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search Mosque' }).fill('Omar')
  await page.getByRole('option', { name: 'Masjid Omar' }).click()

  await page.getByRole('combobox', { name: /Customer/ }).click()
  await expect(page.getByRole('option', { name: /Unmetered Customer/ })).toBeVisible()
  await page.getByRole('searchbox', { name: 'Search Customer' }).fill('Fatima')
  await page.getByRole('option', { name: /Fatima Noori/ }).click()

  await expect(page.getByText('WM-TEST-0301', { exact: false })).toBeVisible()
  await page.getByLabel(/Current Reading/).fill('35')
  await page.getByRole('button', { name: 'Save Reading', exact: true }).click()

  await expect.poll(() => readingRequest).not.toBeNull()
  expect(readingRequest).toMatchObject({
    billing_period_id: 11,
    meter_assignment_id: 501,
    current_reading: 35,
  })
})

test('water payment records authority discount once and sends only the remaining cash', async ({ page }) => {
  let paymentRequest: Record<string, unknown> | null = null
  let postCount = 0

  await page.route('**/api/customers', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ id: 41, name: 'Fatima', last_name: 'Noori', house_number: 'H-10', current_balance: 1000, status: 'active' }] }),
  }))
  await page.route('**/api/customers/41/detail', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: {
      customer: {
        id: 41,
        name: 'Fatima',
        last_name: 'Noori',
        house_number: 'H-10',
        current_balance: 1000,
        agreement_status: 'active',
        status: 'active',
        invoices: [{
          id: 71,
          invoice_type: 'water',
          customer_id: 41,
          invoice_number: 'INV-W-TEST-001',
          issue_date: '2026-08-01',
          total_amount: 1000,
          paid_amount: 0,
          payment_discount_amount: 0,
          remaining_amount: 1000,
          discount_amount: 0,
          status: 'unpaid',
          items: [{ id: 81, invoice_id: 71, item_type: 'water_usage', description: 'August water usage', quantity: 10, unit_price: 100, discount_amount: 0, amount: 1000 }],
        }],
      },
      meter_replacement_history: [],
      ledger: [],
      totals: { charges: 0, invoiced: 1000, paid: 0, balance: 1000, deposits_held: 0 },
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
    body: JSON.stringify({ data: [{ id: 2, name: 'Office Cash', code: 'office_cash', type: 'cash', opening_balance: 0, current_balance: 5000, status: 'active' }] }),
  }))
  await page.route('**/api/authorities/options', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ data: [{ id: 3, authority_number: 'AUT-00003', name: 'Tahir Ahmad', title: 'Shareholder', status: 'active' }] }),
  }))
  await page.route('**/api/payments', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [] }) })
      return
    }
    postCount += 1
    paymentRequest = route.request().postDataJSON() as Record<string, unknown>
    await new Promise((resolve) => setTimeout(resolve, 300))
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ data: { id: 91, receipt_number: 'RCT-TEST-001', amount: 900, discount_amount: 100, status: 'posted', ...paymentRequest } }),
    })
  })

  await page.goto('/dashboard/payments')
  await page.getByRole('button', { name: 'Record Payment', exact: true }).click()
  await page.getByLabel(/^Customer/).selectOption('41')
  await page.getByLabel(/^Payment Method/).selectOption('1')
  await page.getByLabel(/^Receiving Account/).selectOption('2')

  await page.getByRole('combobox', { name: /Discount Given By/ }).click()
  await page.getByRole('searchbox', { name: /Search Discount Given By/ }).fill('Tahir')
  await page.getByRole('option', { name: /Tahir Ahmad/ }).click()

  await page.getByLabel('Discount for August water usage').fill('100')
  await expect(page.getByLabel('Pay now for August water usage')).toHaveValue('900.00')

  const saveButton = page.getByRole('button', { name: 'Save Payment', exact: true })
  await saveButton.dblclick({ delay: 20 })
  await expect.poll(() => postCount).toBe(1)
  await expect.poll(() => paymentRequest).not.toBeNull()

  const submittedPayment: Record<string, unknown> = paymentRequest ?? {}
  expect(submittedPayment).toMatchObject({
    customer_id: 41,
    payment_method_id: 1,
    accounting_account_id: 2,
    discount_authority_id: 3,
    items: [{ type: 'invoice', id: 71, amount: 900, discount_amount: 100 }],
  })
  expect(typeof submittedPayment.idempotency_key).toBe('string')
})
