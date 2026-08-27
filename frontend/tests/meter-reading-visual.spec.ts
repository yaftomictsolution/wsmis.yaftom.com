import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page, request }) => {
  const login = await request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
  }, session)
})

test('meter reading form uses the authenticated user as reader', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/dashboard/meter-readings')
  await page.getByRole('button', { name: 'Record Reading' }).click()

  const modal = page.locator('.elegant-panel').filter({
    has: page.getByRole('heading', { name: 'Record Meter Reading' }),
  })
  await expect(modal).toBeVisible()
  await expect(modal.getByText('Reader', { exact: true })).toHaveCount(0)
  await expect(modal.getByRole('button', { name: 'Save Reading' })).toBeVisible()
  expect(pageErrors).toEqual([])
})
