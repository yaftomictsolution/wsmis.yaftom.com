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

test('warehouse creation does not expose or request a service area', async ({ page }) => {
  const serviceAreaRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/service-areas')) serviceAreaRequests.push(request.url())
  })

  await page.goto('/dashboard/warehouses')
  await expect(page.getByRole('heading', { name: 'Warehouses', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Add Warehouse', exact: true }).click()

  const modal = page.locator('.elegant-panel').filter({
    has: page.getByRole('heading', { name: 'Add Warehouse', exact: true }),
  })
  await expect(modal).toBeVisible()
  await expect(modal.getByText('Service Area', { exact: true })).toHaveCount(0)
  await expect(modal.getByText('No service area', { exact: true })).toHaveCount(0)
  expect(serviceAreaRequests).toEqual([])
})
