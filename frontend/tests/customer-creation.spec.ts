import { expect, test } from '@playwright/test'

let customerId = 0
let authHeaders: Record<string, string> = {}
let customerNameForCleanup = ''

test.beforeEach(async ({ page, request }) => {
  const login = await request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()
  authHeaders = { Authorization: `Bearer ${session.token}`, Accept: 'application/json' }

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
  }, session)
})

test.afterEach(async ({ request }) => {
  if (!customerId && customerNameForCleanup) {
    const response = await request.get('http://127.0.0.1:8000/api/customers', { headers: authHeaders })
    if (response.ok()) {
      const customers = (await response.json()).data as Array<{ id: number; name: string }>
      customerId = customers.find((customer) => customer.name === customerNameForCleanup)?.id ?? 0
    }
  }
  if (customerId) await request.delete(`http://127.0.0.1:8000/api/customers/${customerId}`, { headers: authHeaders })
  customerId = 0
  customerNameForCleanup = ''
})

test('customer creation preserves existing rows, validates duplicates, and accepts dropped attachments', async ({ page, request }) => {
  const originalResponse = await request.get('http://127.0.0.1:8000/api/customers', { headers: authHeaders })
  expect(originalResponse.ok()).toBeTruthy()
  const originalCustomers = (await originalResponse.json()).data as Array<{ id: number; name: string; last_name?: string }>
  const unique = Date.now()
  const customerName = `Drop Test ${unique}`
  const customerLastName = `Family ${unique}`
  customerNameForCleanup = customerName
  const customerPhone = '0795550001'

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/dashboard/customers')
  await expect(page.getByRole('heading', { name: 'Customers', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add Customer' }).click()

  const modal = page.locator('.elegant-panel').filter({ has: page.getByRole('heading', { name: 'Add Customer', exact: true }) })
  const field = (label: string) => modal.locator('label').filter({ hasText: new RegExp(`^${label}\\s*\\*?$`) }).locator('..')
  await expect(modal.getByText('Customer Record', { exact: true })).toHaveCount(0)
  await expect(modal.getByText('Subscription Code', { exact: true })).toHaveCount(0)

  await modal.getByRole('button', { name: 'Continue' }).click()
  await expect(modal.getByText('Enter the customer first name.', { exact: true })).toBeVisible()
  await expect(modal.getByText('Enter the customer father name.', { exact: true })).toBeVisible()
  await expect(modal.getByText('Enter the customer primary phone number.', { exact: true })).toBeVisible()

  await field('First Name').locator('input').fill(customerName)
  await field('Last Name').locator('input').fill(customerLastName)
  await field('Father Name').locator('input').fill('Validation Father')
  await field('Phone').locator('input').fill(customerPhone)
  await field('Tazkira Number').locator('input').fill(`UI-${unique}`)
  await modal.getByRole('button', { name: 'Continue' }).click()
  await modal.getByRole('button', { name: 'Continue' }).click()
  await expect(modal.getByText('Enter the customer house number.', { exact: true })).toBeVisible()
  const serviceArea = field('Service Area').locator('select')
  await expect.poll(() => serviceArea.locator('option').count()).toBeGreaterThan(1)
  await serviceArea.selectOption({ index: 1 })
  await field('House Number').locator('input').fill(`DROP-${unique}`)
  await modal.getByRole('button', { name: 'Continue' }).click()

  const dropZone = modal.getByRole('button', { name: /Drop customer documents here or browse files/ })
  await dropZone.evaluate((element) => {
    const transfer = new DataTransfer()
    transfer.items.add(new File(['Customer attachment verification'], 'customer-note.txt', { type: 'text/plain' }))
    element.dispatchEvent(new DragEvent('dragenter', { bubbles: true, dataTransfer: transfer }))
    element.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }))
  })
  await expect(modal.getByText('customer-note.txt', { exact: true })).toBeVisible()
  await dropZone.scrollIntoViewIfNeeded()
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-customer-attachment-drop.png', fullPage: true })

  await modal.getByRole('button', { name: 'Continue' }).click()
  await modal.getByRole('button', { name: 'Save Customer' }).click()
  await expect(modal).toBeHidden({ timeout: 30_000 })

  const customersResponse = await request.get('http://127.0.0.1:8000/api/customers', { headers: authHeaders })
  expect(customersResponse.ok()).toBeTruthy()
  const customers = (await customersResponse.json()).data as Array<{ id: number; name: string; last_name?: string; subscription_code?: string }>
  const created = customers.find((customer) => customer.name === customerName)
  expect(created).toBeTruthy()
  expect(created?.last_name).toBe(customerLastName)
  expect(created?.subscription_code).toMatch(/^CUS-\d{6}(?:-\d+)?$/)
  customerId = created?.id ?? 0
  expect(customers).toHaveLength(originalCustomers.length + 1)
  originalCustomers.forEach((customer) => expect(customers.some((item) => item.id === customer.id)).toBeTruthy())

  await expect(page.getByText(`${customerName} ${customerLastName}`, { exact: true }).first()).toBeVisible()
  if (originalCustomers[0]) {
    const originalName = [originalCustomers[0].name, originalCustomers[0].last_name].filter(Boolean).join(' ')
    await expect(page.getByText(originalName, { exact: true }).first()).toBeVisible()
  }

  const documentsResponse = await request.get(`http://127.0.0.1:8000/api/customers/${customerId}/documents`, { headers: authHeaders })
  expect(documentsResponse.ok()).toBeTruthy()
  const documents = (await documentsResponse.json()).data
  expect(documents).toHaveLength(1)
  expect(documents[0].original_name).toBe('customer-note.txt')

  await page.getByRole('button', { name: 'Add Customer' }).click()
  const duplicateModal = page.locator('.elegant-panel').filter({ has: page.getByRole('heading', { name: 'Add Customer', exact: true }) })
  const duplicateField = (label: string) => duplicateModal.locator('label').filter({ hasText: new RegExp(`^${label}\\s*\\*?$`) }).locator('..')
  await duplicateField('First Name').locator('input').fill('Different Name')
  await duplicateField('Last Name').locator('input').fill('Different Family')
  await duplicateField('Father Name').locator('input').fill('Different Father')
  await duplicateField('Phone').locator('input').fill('+93795550001')
  await duplicateModal.getByRole('button', { name: 'Continue' }).click()
  const duplicateServiceArea = duplicateField('Service Area').locator('select')
  await expect.poll(() => duplicateServiceArea.locator('option').count()).toBeGreaterThan(1)
  await duplicateServiceArea.selectOption({ index: 1 })
  await duplicateField('House Number').locator('input').fill(`OTHER-${unique}`)
  await duplicateModal.getByRole('button', { name: 'Continue' }).click()
  await duplicateModal.getByRole('button', { name: 'Continue' }).click()
  await duplicateModal.getByRole('button', { name: 'Save Customer' }).click()

  await expect(duplicateField('Phone').getByText('This phone number is already registered to another customer.', { exact: true })).toBeVisible()
  await page.waitForTimeout(450)
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-customer-validation-upload.png', fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(450)
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await expect(duplicateField('Phone').getByText('This phone number is already registered to another customer.', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-customer-validation-upload-mobile.png', fullPage: true })
})
