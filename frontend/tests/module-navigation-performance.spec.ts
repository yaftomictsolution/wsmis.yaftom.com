import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test.beforeEach(async ({ page, request }) => {
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
})

test('inventory lookups load only when their tab or modal needs them', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:8000') requests.push(`${url.pathname}${url.search}`)
  })

  await page.goto('/dashboard/inventory-manager')
  await expect(page.getByRole('heading', { name: 'Inventory Manager', exact: true })).toBeVisible()
  await expect.poll(() => requests.some((path) => path.startsWith('/api/inventory-items'))).toBeTruthy()
  await expect.poll(() => requests.some((path) => path.startsWith('/api/warehouses'))).toBeTruthy()

  for (const endpoint of ['/api/suppliers', '/api/customers', '/api/inventory/departments', '/api/goods', '/api/meters', '/api/inventory-requests/purchase-accounts']) {
    expect(requests.some((path) => path.split('?')[0] === endpoint), `${endpoint} should not load on the Items view`).toBeFalsy()
  }
  expect(requests.some((path) => path.startsWith('/api/inventory-requests?'))).toBeFalsy()

  requests.length = 0
  await page.getByRole('button', { name: 'Purchase Goods', exact: true }).first().click()
  await expect.poll(() => requests.some((path) => path.startsWith('/api/inventory-requests?type=purchase'))).toBeTruthy()
  expect(requests.some((path) => path.startsWith('/api/suppliers'))).toBeFalsy()

  await page.getByRole('button', { name: 'New Purchase', exact: true }).click()
  await expect.poll(() => requests.some((path) => path.startsWith('/api/suppliers'))).toBeTruthy()
  await expect.poll(() => requests.some((path) => path.startsWith('/api/goods'))).toBeTruthy()
  await expect.poll(() => requests.some((path) => path.startsWith('/api/inventory-requests/purchase-accounts'))).toBeTruthy()
})

test('HR secondary datasets load only when the user opens their workflow', async ({ page }) => {
  const requests: string[] = []
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.origin === 'http://127.0.0.1:8000') requests.push(`${url.pathname}${url.search}`)
  })

  await page.goto('/dashboard/hr')
  await expect(page.getByRole('heading', { name: 'Human Resources', exact: true })).toBeVisible()
  await expect.poll(() => requests.includes('/api/hr/summary')).toBeTruthy()
  await expect.poll(() => requests.includes('/api/employees')).toBeTruthy()

  for (const endpoint of ['/api/hr/structure', '/api/salary-advances', '/api/employee-adjustments', '/api/hr/reports', '/api/settings', '/api/accounting/accounts']) {
    expect(requests.some((path) => path.split('?')[0] === endpoint), `${endpoint} should not load on the Employees view`).toBeFalsy()
  }

  await page.getByRole('button', { name: 'Add Employee', exact: true }).click()
  await expect.poll(() => requests.includes('/api/hr/structure')).toBeTruthy()
})
