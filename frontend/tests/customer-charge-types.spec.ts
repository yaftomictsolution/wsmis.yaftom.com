import { expect, test } from '@playwright/test'

let authHeaders: Record<string, string> = {}
let chargeTypePrefix = ''

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
  if (!chargeTypePrefix) return

  const response = await request.get('http://127.0.0.1:8000/api/customer-charge-types', { headers: authHeaders })
  if (response.ok()) {
    const types = (await response.json()).data as Array<{ id: number; name: string }>
    for (const type of types.filter((item) => item.name.startsWith(chargeTypePrefix))) {
      await request.delete(`http://127.0.0.1:8000/api/customer-charge-types/${type.id}`, { headers: authHeaders })
    }
  }

  chargeTypePrefix = ''
  authHeaders = {}
})

test('admin manages charge types and customer charges use the dynamic type without a category', async ({ page, request }) => {
  const customersResponse = await request.get('http://127.0.0.1:8000/api/customers', { headers: authHeaders })
  expect(customersResponse.ok()).toBeTruthy()
  const customers = (await customersResponse.json()).data as Array<{ id: number }>
  expect(customers.length).toBeGreaterThan(0)

  const unique = Date.now()
  chargeTypePrefix = `Browser Charge ${unique}`
  const originalName = `${chargeTypePrefix} Original`
  const editedName = `${chargeTypePrefix} Updated`

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/dashboard/settings/charge-types')

  const section = page.locator('section#charge-types')
  await expect(page.getByRole('heading', { name: 'Customer Charge Types', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add Charge Type' }).click()

  const addModal = page.locator('.elegant-panel').filter({ has: page.getByRole('heading', { name: 'Add Customer Charge Type', exact: true }) })
  const field = (modal: ReturnType<typeof page.locator>, label: string) =>
    modal.locator('label').filter({ hasText: new RegExp(`^${label}\\s*\\*?$`) }).locator('..')

  await field(addModal, 'Type Name').locator('input').fill(originalName)
  await field(addModal, 'Description').locator('textarea').fill('Created by the customer charge type browser test.')
  await addModal.getByRole('button', { name: 'Save Charge Type' }).click()
  await expect(addModal).toBeHidden()

  let typeRow = section.getByRole('row').filter({ hasText: originalName })
  await expect(typeRow).toBeVisible()

  await page.goto(`/dashboard/customers/${customers[0].id}?tab=charges`)
  await page.getByRole('button', { name: 'Add Charge', exact: true }).click()

  const chargeModal = page.locator('.elegant-panel').filter({ has: page.getByRole('heading', { name: 'Add Customer Charge', exact: true }) })
  const typeSelect = field(chargeModal, 'Type').locator('select')
  await expect(typeSelect.locator('option', { hasText: originalName })).toHaveCount(1)
  await expect(chargeModal.locator('label').filter({ hasText: /^Category\s*\*?$/ })).toHaveCount(0)
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-dynamic-customer-charge-type.png', fullPage: true })
  await chargeModal.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.goto('/dashboard/settings/charge-types')
  typeRow = page.locator('section#charge-types').getByRole('row').filter({ hasText: originalName })
  await typeRow.hover()
  await typeRow.getByRole('button', { name: 'Edit' }).click()

  const editModal = page.locator('.elegant-panel').filter({ has: page.getByRole('heading', { name: 'Edit Customer Charge Type', exact: true }) })
  await field(editModal, 'Type Name').locator('input').fill(editedName)
  await editModal.getByRole('button', { name: 'Save Charge Type' }).click()
  await expect(editModal).toBeHidden()

  typeRow = page.locator('section#charge-types').getByRole('row').filter({ hasText: editedName })
  await expect(typeRow).toBeVisible()
  await typeRow.hover()
  await typeRow.getByRole('button', { name: 'Delete' }).click()

  const confirm = page.locator('.elegant-panel').filter({ has: page.getByRole('heading', { name: 'Delete Charge Type', exact: true }) })
  await confirm.getByRole('button', { name: 'Delete', exact: true }).click()
  await expect(page.locator('section#charge-types').getByRole('row').filter({ hasText: editedName })).toHaveCount(0)
})
