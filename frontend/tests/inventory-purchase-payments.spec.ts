import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page, request }) => {
  const response = await request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(response.ok()).toBeTruthy()
  const session = await response.json()

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, session)
})

test('purchase form supports unpaid partial and full supplier payments', async ({ page }) => {
  const pageErrors: string[] = []
  const serverErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`)
  })

  await page.goto('/dashboard/inventory-manager?view=purchase')
  await expect(page.getByRole('heading', { name: 'Inventory Manager', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Paid', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Show Details', exact: true }).first().click()
  await expect(page.getByText('Remaining', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Payment', { exact: true }).first()).toBeVisible()

  await page.getByRole('button', { name: 'New Purchase', exact: true }).click()
  const modal = page.locator('.elegant-panel').filter({
    has: page.getByRole('heading', { name: 'Purchase Goods', exact: true }),
  })

  const supplier = modal.getByText('Supplier', { exact: true }).locator('..').locator('select')
  const warehouse = modal.getByText('Warehouse', { exact: true }).locator('..').locator('select')
  const good = modal.getByText('Good', { exact: true }).locator('..').locator('select')
  await expect(supplier.locator('option')).not.toHaveCount(1)
  await expect(warehouse.locator('option')).not.toHaveCount(1)
  await expect(good.locator('option')).not.toHaveCount(1)
  await supplier.selectOption({ index: 1 })
  await warehouse.selectOption({ index: 1 })
  await good.selectOption({ index: 1 })

  await modal.getByText('Quantity', { exact: true }).locator('..').locator('input').fill('2')
  await modal.getByText('Unit Cost', { exact: true }).locator('..').locator('input').fill('100')
  await expect(modal.getByText('AFN 200', { exact: true })).toHaveCount(2)
  await expect(modal.getByText('Payment Method', { exact: true })).toHaveCount(0)

  await modal.getByText('Amount Paid Now (AFN)', { exact: true }).locator('..').locator('input').fill('80')
  await expect(modal.getByText('AFN 120', { exact: true })).toBeVisible()
  await expect(modal.getByText('Payment Method', { exact: true })).toBeVisible()
  await expect(modal.getByText('Paying Account', { exact: true })).toBeVisible()

  const paymentMethod = modal.getByText('Payment Method', { exact: true }).locator('..').locator('select')
  await expect(paymentMethod.locator('option')).not.toHaveCount(1)
  await paymentMethod.selectOption({ index: 1 })
  const payingAccount = modal.getByText('Paying Account', { exact: true }).locator('..').locator('select')
  await expect(payingAccount.locator('option')).not.toHaveCount(1)

  await modal.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.getByRole('button', { name: 'Asset Purchases', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Asset Purchases', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Purchase Asset', exact: true })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Asset Purchases', exact: true })).toHaveCount(0)

  await page.goto('/dashboard/asset-purchases')
  await expect(page).toHaveURL(/\/dashboard\/inventory-manager\?view=asset-purchases$/)
  await expect(page.getByRole('heading', { name: 'Asset Purchases', exact: true })).toBeVisible()
  expect(pageErrors).toEqual([])
  expect(serverErrors).toEqual([])
})
