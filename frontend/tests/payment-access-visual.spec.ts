import { expect, test } from '@playwright/test'

test('technician sees the correct payment access boundary', async ({ page, request }) => {
  const login = await request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { email: 'technician@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
  }, session)

  await page.goto('/dashboard')
  await expect(page.getByRole('link', { name: 'Payments' })).toHaveCount(0)

  await page.goto('/dashboard/payments')
  await expect(page.getByRole('heading', { name: 'Payment access is restricted' })).toBeVisible()
  await expect(page.getByText('Meter readings generate invoices. A Collector, Accountant, Manager, or Admin must record the customer payment.')).toBeVisible()
})

test('authorized payment form loads receiving accounts and owns the receiver identity', async ({ page, request }) => {
  const login = await request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
  }, session)

  await page.goto('/dashboard/payments')
  await page.getByRole('button', { name: 'Record Payment' }).click()

  const modal = page.locator('.elegant-panel').filter({
    has: page.getByRole('heading', { name: 'Record Payment' }),
  })
  const paymentMethod = modal.getByLabel('Payment Method')
  await expect(paymentMethod.locator('option', { hasText: 'Cash' })).toHaveCount(1)
  await paymentMethod.selectOption({ label: 'Cash' })
  await expect(modal.getByLabel('Receiving Account')).toContainText('Main Cash Account')
  await expect(modal.getByText('Receiver', { exact: true })).toHaveCount(0)
  await expect(modal.getByText(/No active .* account exists/)).toHaveCount(0)
})

test('a single unpaid invoice is ready for full or partial payment', async ({ page, request }) => {
  const login = await request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()
  const customerId = 987654
  const invoiceNumber = 'INV-PAYMENT-FIXTURE'

  await page.route('**/api/customers', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: customerId,
          name: 'Payment',
          last_name: 'Fixture',
          current_balance: '243800.00',
          status: 'active',
          agreement_status: 'active',
        }],
      }),
    })
  })
  await page.route(`**/api/customers/${customerId}/detail`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          customer: {
            id: customerId,
            name: 'Payment',
            last_name: 'Fixture',
            current_balance: '243800.00',
            status: 'active',
            agreement_status: 'active',
            invoices: [{
              id: 765432,
              customer_id: customerId,
              billing_period_id: 1,
              invoice_type: 'water',
              invoice_number: invoiceNumber,
              total_amount: '243800.00',
              paid_amount: '0.00',
              remaining_amount: '243800.00',
              status: 'unpaid',
            }],
            charges: [],
          },
          meter_replacement_history: [],
          ledger: [],
          totals: {
            charges: 0,
            invoiced: 243800,
            paid: 0,
            balance: 243800,
            deposits_held: 0,
          },
        },
      }),
    })
  })

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
  }, session)

  await page.goto('/dashboard/payments')
  await page.getByRole('button', { name: 'Record Payment' }).click()

  const modal = page.locator('.elegant-panel').filter({
    has: page.getByRole('heading', { name: 'Record Payment' }),
  })
  await modal.getByLabel('Customer').selectOption(String(customerId))

  const payNow = modal.getByLabel(`Pay now for ${invoiceNumber}`)
  const invoiceSelection = modal.getByLabel(`Select ${invoiceNumber} for payment`)
  await expect(payNow).toHaveValue('243800.00')
  await expect(invoiceSelection).toBeChecked()

  await modal.getByLabel('Payment Method').selectOption({ label: 'Cash' })
  const account = modal.getByLabel('Receiving Account')
  if (await account.inputValue() === '') {
    await account.selectOption({ index: 1 })
  }
  await expect(modal.getByRole('button', { name: 'Save Payment' })).toBeEnabled()

  await payNow.fill('200')
  await expect(payNow).toHaveValue('200')
  await expect(modal.getByRole('button', { name: 'Save Payment' })).toBeEnabled()

  await modal.getByRole('button', { name: 'Clear' }).click()
  await expect(invoiceSelection).not.toBeChecked()
  await expect(payNow).toHaveValue('')
  await expect(modal.getByRole('button', { name: 'Save Payment' })).toBeDisabled()
})
