import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test('financial reports clearly restrict users without finance access', async ({ page, request }) => {
  const login = await request.post(`${apiUrl}/auth/login`, {
    data: { email: 'reader@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()
  let reportRequests = 0

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, session)
  page.on('request', (requestEvent) => {
    if (requestEvent.url().includes('/api/financial-reports')) reportRequests += 1
  })

  await page.goto('/dashboard/reports/financial', { waitUntil: 'domcontentloaded' })

  await expect(page.getByText('Financial report access is restricted', { exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByText(/Only an Accountant, Manager, Admin/)).toBeVisible()
  expect(reportRequests).toBe(0)

  await page.goto('/dashboard/reports', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('a[href="/dashboard/reports/financial"]')).toHaveCount(0)
})
