import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test('groups related modules into simple work areas and guides customer work', async ({ page, request }) => {
  const login = await request.post(`${apiUrl}/auth/login`, {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()

  const customersResponse = await request.get(`${apiUrl}/customers`, {
    headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
  })
  expect(customersResponse.ok()).toBeTruthy()
  const customerPayload = await customersResponse.json()
  const customers = customerPayload.data ?? []
  let customer = customers[0]
  for (const candidate of customers) {
    const detail = await request.get(`${apiUrl}/customers/${candidate.id}/detail`, {
      headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
    })
    if (detail.ok() && (await detail.json()).data?.current_meter_assignment) {
      customer = candidate
      break
    }
  }

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, session)

  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Daily Workspace', exact: true })).toBeVisible()
  const shortcutRegion = page.getByRole('region', { name: 'Module Shortcuts' })
  await expect(shortcutRegion).toBeVisible()
  expect(await shortcutRegion.getByRole('link').count()).toBeGreaterThanOrEqual(8)
  await expect(page.getByRole('region', { name: 'Monthly Cash Movement' })).toBeVisible()
  await expect(page.getByTestId('cash-movement-chart')).toBeVisible()
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-dashboard-shortcuts-chart.png', fullPage: true })
  await page.getByRole('region', { name: 'Monthly Cash Movement' }).screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-dashboard-cash-chart.png' })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(400)
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await expect(shortcutRegion).toBeVisible()
  await expect(page.getByTestId('cash-movement-chart')).toBeVisible()
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-dashboard-shortcuts-chart-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 960 })

  const sidebar = page.locator('.app-sidebar')
  for (const workArea of ['Dashboard', 'Customer Desk', 'Field Operations', 'Inventory & Assets', 'Finance', 'People & Payroll', 'Reports', 'Administration']) {
    await expect(sidebar.getByRole('link', { name: workArea, exact: true })).toBeVisible()
  }
  await expect(sidebar.getByRole('link', { name: 'Meters', exact: true })).toHaveCount(0)

  await sidebar.getByRole('link', { name: 'Customer Desk', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard\/customers$/)

  const customerNavigation = page.getByRole('navigation', { name: 'Customer Desk navigation' })
  await expect(customerNavigation.getByRole('link', { name: 'Customers', exact: true })).toBeVisible()
  await expect(customerNavigation.getByRole('link', { name: 'All Invoices', exact: true })).toBeVisible()
  await expect(customerNavigation.getByRole('link', { name: 'All Payments', exact: true })).toBeVisible()

  await customerNavigation.getByRole('link', { name: 'All Invoices', exact: true }).click()
  await expect(page).toHaveURL(/\/dashboard\/invoices$/)
  await expect(sidebar.getByRole('link', { name: 'Customer Desk', exact: true })).toHaveAttribute('aria-current', 'page')

  if (customer) {
    const detailResponse = page.waitForResponse((response) => response.url().endsWith(`/api/customers/${customer.id}/detail`))
    await page.goto(`/dashboard/customers/${customer.id}`)
    expect((await detailResponse).ok()).toBeTruthy()
    await expect(page.getByText('Next Action', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: 'Reading History', exact: true }).click()
    const recordReading = page.getByRole('button', { name: 'Record Meter Reading', exact: true })
    await expect(recordReading).toBeVisible()
    const customerUrl = page.url()
    await recordReading.click()
    await expect(page.getByRole('heading', { name: 'Record Meter Reading', exact: true })).toBeVisible()
    await expect(page).toHaveURL(customerUrl)
  }
})

test('shows only relevant work areas to a meter reader', async ({ page, request }) => {
  const login = await request.post(`${apiUrl}/auth/login`, {
    data: { email: 'reader@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, session)

  await page.goto('/dashboard')
  await expect(page.getByRole('heading', { name: 'Daily Workspace', exact: true })).toBeVisible()
  const sidebar = page.locator('.app-sidebar')
  await expect(sidebar.getByRole('link', { name: 'Field Operations', exact: true })).toBeVisible()
  await expect(sidebar.getByRole('link', { name: 'Finance', exact: true })).toHaveCount(0)
  await expect(sidebar.getByRole('link', { name: 'Administration', exact: true })).toHaveCount(0)
})
