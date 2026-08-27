import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test('staff can create an authority and find it in the contract discount dropdown', async ({ page, request }) => {
  const login = await request.post(`${apiUrl}/auth/login`, {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()
  const headers = { Authorization: `Bearer ${session.token}`, Accept: 'application/json' }
  const unique = Date.now()
  const authorityName = `Contract Authority ${unique}`
  let authorityId: number | undefined
  let areaId: number | undefined
  let customerId: number | undefined

  try {
    const areaResponse = await request.post(`${apiUrl}/service-areas`, {
      headers,
      data: { name: `Authority Test Area ${unique}`, rate_per_cubic_meter: 65, status: 'active' },
    })
    expect(areaResponse.ok()).toBeTruthy()
    areaId = (await areaResponse.json()).data.id

    const customerResponse = await request.post(`${apiUrl}/customers`, {
      headers,
      data: {
        service_area_id: areaId,
        name: 'Authority',
        last_name: 'Test Customer',
        father_name: 'Test Father',
        phone: `078${String(unique).slice(-7)}`,
        house_number: `AUTH-${String(unique).slice(-5)}`,
      },
    })
    expect(customerResponse.ok()).toBeTruthy()
    customerId = (await customerResponse.json()).data.id

    await page.addInitScript(({ token, user }) => {
      localStorage.setItem('waternet_token', token)
      localStorage.setItem('waternet_user', JSON.stringify(user))
      localStorage.setItem('language', 'en')
    }, session)

    await page.goto('/dashboard/authorities', { waitUntil: 'domcontentloaded' })
    const addButton = page.getByRole('button', { name: 'Add Authority' })
    await expect(addButton).toBeVisible({ timeout: 30_000 })
    await addButton.click()
    await page.getByLabel('Authority Name').fill(authorityName)
    await page.getByLabel('Title / Position').fill('Board Representative')

    const created = page.waitForResponse((response) => (
      response.url() === `${apiUrl}/authorities` && response.request().method() === 'POST'
    ))
    await page.getByRole('button', { name: 'Save Authority' }).click()
    const createdResponse = await created
    expect(createdResponse.ok()).toBeTruthy()
    const authority = (await createdResponse.json()).data
    authorityId = authority.id
    await expect(page.getByText(authorityName, { exact: true })).toBeVisible()

    await page.goto(`/dashboard/customers/${customerId}`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Contract', exact: true }).click()
    await page.getByRole('button', { name: 'Create Contract' }).click()
    await page.getByLabel('Connection Fee').fill('300')
    await page.getByLabel('Meter Fee').fill('100')

    const authoritySelect = page.getByRole('combobox', { name: 'Discount Given By (Authority)' })
    await expect(authoritySelect).toBeEnabled()
    await authoritySelect.click()
    const search = page.getByRole('searchbox', { name: 'Search Discount Given By (Authority)' })
    await search.fill(String(unique))
    const authorityOption = page.getByRole('option', { name: new RegExp(authorityName) })
    await expect(authorityOption).toBeVisible()
    await authorityOption.click()
    await expect(authoritySelect).toContainText(authorityName)
    await expect(authoritySelect).toContainText(authority.authority_number)
    await page.getByLabel('Discount', { exact: true }).fill('100')
    await expect(authoritySelect).toContainText(authorityName)
  } finally {
    if (customerId) await request.delete(`${apiUrl}/customers/${customerId}`, { headers })
    if (areaId) await request.delete(`${apiUrl}/service-areas/${areaId}`, { headers })
    if (authorityId) await request.delete(`${apiUrl}/authorities/${authorityId}`, { headers })
  }
})
