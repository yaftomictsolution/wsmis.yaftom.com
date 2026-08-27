import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test('customer goods clearly separate contract materials from ordinary sales', async ({ page, request }) => {
  const login = await request.post(`${apiUrl}/auth/login`, {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, session)

  await page.route(`${apiUrl}/customers`, async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 99001,
          service_area_id: 1,
          subscription_code: 'CUS-TEST-RETURN',
          name: 'Return Workflow',
          last_name: 'Customer',
          status: 'active',
          opening_balance: 0,
          current_balance: 0,
          latest_contract: {
            id: 88001,
            customer_id: 99001,
            contract_number: 'CTR-TEST-RETURN',
            status: 'active',
            connection_fee: 0,
            meter_fee: 0,
            discount_amount: 0,
            net_amount: 0,
            required_initial_payment: 0,
            paid_amount: 0,
            remaining_amount: 0,
            payment_status: 'paid',
            subscription_date: '2026-08-25',
          },
        }],
      }),
    })
  })

  await page.goto('/dashboard/inventory-manager')
  await page.getByRole('button', { name: 'Issue Goods', exact: true }).click()
  await page.getByRole('button', { name: 'New Issue', exact: true }).click()

  const modalHeading = page.getByRole('heading', { name: 'Issue Goods', exact: true }).last()
  const modal = modalHeading.locator('xpath=ancestor::div[contains(@class,"elegant-panel")][1]')
  const selects = modal.locator('select')

  await selects.nth(0).selectOption('customer')
  await expect(selects.nth(1)).toContainText('Return Workflow Customer')
  await selects.nth(1).selectOption('99001')

  const contractMaterial = modal.getByRole('button', { name: 'Contract Material', exact: true })
  const separateSale = modal.getByRole('button', { name: 'Separate Customer Sale', exact: true })
  await expect(contractMaterial).toBeEnabled()
  await expect(separateSale).toHaveClass(/bg-\[var\(--accent\)\]/)
  await expect(modal.getByText('Independent from the customer contract', { exact: true })).toBeVisible()

  await contractMaterial.click()
  await expect(contractMaterial).toHaveClass(/bg-\[var\(--accent\)\]/)
  await expect(modal.getByText('Linked to contract CTR-TEST-RETURN', { exact: true })).toBeVisible()
})
