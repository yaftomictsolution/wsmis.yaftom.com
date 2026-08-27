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

test('assets and inventory workflows render with the correct financial controls and history', async ({ page }) => {
  const pageErrors: string[] = []
  const serverErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`)
  })

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/dashboard/inventory-manager')
  await expect(page.getByRole('heading', { name: 'Inventory Manager', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Issue Goods', exact: true }).first().click()
  await page.getByRole('button', { name: 'New Issue', exact: true }).first().click()

  const issueModal = page.locator('.elegant-panel').filter({
    has: page.getByRole('heading', { name: 'Issue Goods', exact: true }),
  })
  await expect(issueModal.getByText('Internal use records material expense only. No cash account changes.', { exact: true })).toBeVisible()
  await expect(issueModal.getByText('Receiving Account', { exact: true })).toHaveCount(0)

  const issueType = issueModal.locator('select').first()
  const warehouseSelect = issueModal.getByText('Warehouse', { exact: true }).locator('..').locator('select')
  await warehouseSelect.selectOption({ label: 'Main Warehouse (WH-MAIN)' })
  const itemSelect = issueModal.getByText('Item', { exact: true }).locator('..').locator('select')
  await expect(itemSelect.locator('option')).toHaveCount(2)
  const stockedOption = itemSelect.locator('option').nth(1)
  const stockedLabel = await stockedOption.textContent()
  const stockedValue = await stockedOption.getAttribute('value')
  const stockMatch = stockedLabel?.match(/\(([\d,.]+) ([^)]+) available\)$/)
  expect(stockedValue).toBeTruthy()
  expect(stockMatch).toBeTruthy()
  await itemSelect.selectOption(stockedValue!)
  const available = Number(stockMatch![1].replaceAll(',', ''))
  const unit = stockMatch![2]
  const availableQuantity = issueModal.getByText('Available Quantity', { exact: true }).locator('..').locator('.field-control')
  await expect(availableQuantity).toHaveText(`${available.toLocaleString()} ${unit}`)
  await issueModal.getByText('Issue Quantity', { exact: true }).locator('..').locator('input').fill('1')
  await expect(issueModal.getByText(`Remaining: ${(available - 1).toLocaleString()} ${unit}`, { exact: true })).toBeVisible()
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-issue-availability.png', fullPage: true })

  await issueType.selectOption('customer')
  await expect(issueModal.getByText('Approval issues one invoice. The customer can pay now, partly, or later.', { exact: true })).toBeVisible()
  await expect(issueModal.getByText('Customer', { exact: true })).toBeVisible()
  const amountPaid = issueModal.getByText('Amount Paid Now (AFN)', { exact: true }).locator('..').locator('input')
  await amountPaid.fill('10')
  await expect(issueModal.getByText('Payment Method', { exact: true })).toBeVisible()
  await expect(issueModal.getByText('Receiving Account', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-inventory-customer-issue.png', fullPage: true })
  await issueModal.getByRole('button', { name: 'Cancel', exact: true }).click()

  await expect(page.getByRole('link', { name: 'Requests', exact: true })).toHaveCount(0)
  await expect(page.getByText(/^SI-\d{8}-\d{5}$/).first()).toBeVisible()
  await page.getByRole('button', { name: 'Purchase Goods', exact: true }).click()
  await expect(page.getByText(/^PO-\d{8}-\d{5}$/).first()).toBeVisible()
  await page.goto('/dashboard/inventory-requests')
  await expect(page).toHaveURL(/\/dashboard\/inventory-manager$/)
  await expect(page.getByRole('heading', { name: 'Inventory Manager', exact: true })).toBeVisible()

  await page.goto('/dashboard/warehouses')
  await expect(page.getByRole('heading', { name: 'Warehouses', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Products', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Total Quantity', exact: true })).toBeVisible()
  await expect(page.getByRole('columnheader', { name: 'Stock Value', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Show Details', exact: true }).first().click()
  await expect(page.getByText('Water Meter - Half Inch', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'View inventory', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Field Warehouse', exact: true })).toBeVisible()
  await expect(page.getByText('METER-HALF-DEMO', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Movements', exact: true }).click()
  await expect(page.getByText('Water Meter - Half Inch', { exact: true }).first()).toBeVisible()
  await page.waitForTimeout(450)
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-warehouse-explorer.png', fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.getByRole('button', { name: 'Expand sidebar', exact: true })).toBeVisible()
  await page.waitForTimeout(450)
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-warehouse-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 960 })

  await page.goto('/dashboard/assets')
  await expect(page.getByRole('heading', { name: 'Assets', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Maintenance', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Schedule Maintenance', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Schedule Maintenance', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Schedule Maintenance', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Maintenance Type', exact: true })).toBeVisible()
  await expect(page.getByRole('textbox', { name: 'Next Due', exact: true })).toBeVisible()
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-assets-maintenance.png', fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-assets-mobile.png', fullPage: true })

  expect(pageErrors).toEqual([])
  expect(serverErrors).toEqual([])
})
