import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test('staff can add multiple mosques and select them for a customer', async ({ page, request }) => {
  const login = await request.post(`${apiUrl}/auth/login`, {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()
  const areaName = `Mosque Test Area ${Date.now()}`
  let areaId: number | undefined

  await page.goto('/login', { waitUntil: 'domcontentloaded' })
  await page.evaluate(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, session)

  try {
    await page.setViewportSize({ width: 1440, height: 960 })
    await page.goto('/dashboard/service-areas', { waitUntil: 'commit' })
    await page.waitForTimeout(1_000)
    await page.evaluate(() => window.dispatchEvent(new Event('wsmis-auth-session-change')))
    const addAreaButton = page.getByRole('button', { name: 'Add Area' })
    await expect(addAreaButton).toBeVisible({ timeout: 30_000 })
    await addAreaButton.click({ noWaitAfter: true })

    await page.getByLabel('Area Name').fill(areaName)
    await page.getByLabel('Mosque 1', { exact: true }).fill('Abu Bakr Mosque')
    await page.getByRole('button', { name: 'Add Mosque' }).click()
    await page.getByLabel('Mosque 2', { exact: true }).fill('Bilal Mosque')

    const created = page.waitForResponse((response) => (
      response.url() === `${apiUrl}/service-areas` && response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: 'Save Area' }).click()
    const response = await created
    expect(response.ok()).toBeTruthy()
    areaId = (await response.json()).data.id

    await expect(page.getByText(areaName, { exact: true })).toBeVisible()
    await expect(page.getByText('Abu Bakr Mosque', { exact: true })).toBeVisible()
    await expect(page.getByText('Bilal Mosque', { exact: true })).toBeVisible()

    await page.goto('/dashboard/customers', { waitUntil: 'commit' })
    const addCustomerButton = page.getByRole('button', { name: 'Add Customer' })
    await expect(addCustomerButton).toBeVisible({ timeout: 30_000 })
    await addCustomerButton.click({ noWaitAfter: true })
    await page.getByLabel('First Name').fill('Mosque Test')
    await page.getByRole('textbox', { name: 'Father Name *', exact: true }).fill('Customer Father')
    await page.getByRole('textbox', { name: 'Phone *', exact: true }).fill(`079${String(Date.now()).slice(-7)}`)
    await page.getByRole('button', { name: 'Continue' }).click()
    await page.getByLabel('Service Area').selectOption(String(areaId))

    const mosqueSelect = page.getByLabel('Mosque')
    await expect(mosqueSelect.locator('option', { hasText: 'Abu Bakr Mosque' })).toHaveCount(1)
    await expect(mosqueSelect.locator('option', { hasText: 'Bilal Mosque' })).toHaveCount(1)
    await mosqueSelect.selectOption({ label: 'Bilal Mosque' })
    await expect(mosqueSelect).toHaveValue(/\d+/)
  } finally {
    if (areaId) {
      await request.delete(`${apiUrl}/service-areas/${areaId}`, {
        headers: { Authorization: `Bearer ${session.token}`, Accept: 'application/json' },
      })
    }
  }
})

test('a service area with customers is deactivated instead of deleted', async ({ page, request }) => {
  const login = await request.post(`${apiUrl}/auth/login`, {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()
  const headers = { Authorization: `Bearer ${session.token}`, Accept: 'application/json' }
  const unique = Date.now()
  let areaId: number | undefined
  let customerId: number | undefined

  try {
    const areaResponse = await request.post(`${apiUrl}/service-areas`, {
      headers,
      data: {
        name: `Protected Area ${unique}`,
        status: 'active',
        rate_per_cubic_meter: 65,
      },
    })
    expect(areaResponse.ok()).toBeTruthy()
    const area = (await areaResponse.json()).data
    areaId = area.id

    const customerResponse = await request.post(`${apiUrl}/customers`, {
      headers,
      data: {
        service_area_id: areaId,
        name: 'Protected',
        last_name: 'Customer',
        father_name: 'Test',
        phone: `079${String(unique).slice(-7)}`,
        house_number: `H-${String(unique).slice(-5)}`,
      },
    })
    expect(customerResponse.ok()).toBeTruthy()
    customerId = (await customerResponse.json()).data.id

    await page.goto('/login', { waitUntil: 'domcontentloaded' })
    await page.evaluate(({ token, user }) => {
      localStorage.setItem('waternet_token', token)
      localStorage.setItem('waternet_user', JSON.stringify(user))
      localStorage.setItem('language', 'en')
    }, session)
    await page.goto('/dashboard/service-areas', { waitUntil: 'domcontentloaded' })

    const row = page.getByRole('row').filter({ hasText: area.name })
    await expect(row).toBeVisible({ timeout: 30_000 })
    await row.hover()
    await row.getByRole('button', { name: 'Delete' }).click()

    await expect(page.getByRole('heading', { name: 'Deactivate Service Area' })).toBeVisible()
    await expect(page.getByText(/cannot be deleted.*preserving all customer history/i)).toBeVisible()

    const deactivated = page.waitForResponse((response) => (
      response.url() === `${apiUrl}/service-areas/${areaId}` && response.request().method() === 'PUT'
    ))
    await page.getByRole('button', { name: 'Deactivate', exact: true }).click()
    expect((await deactivated).ok()).toBeTruthy()

    const refreshedArea = await request.get(`${apiUrl}/service-areas/${areaId}`, { headers })
    expect(refreshedArea.ok()).toBeTruthy()
    expect((await refreshedArea.json()).data.status).toBe('inactive')
  } finally {
    if (customerId) await request.delete(`${apiUrl}/customers/${customerId}`, { headers })
    if (areaId) await request.delete(`${apiUrl}/service-areas/${areaId}`, { headers })
  }
})
