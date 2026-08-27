import { expect, test } from '@playwright/test'

test.beforeEach(async ({ page, request }) => {
  const response = await request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(response.ok()).toBeTruthy()
  const session = await response.json()
  await page.addInitScript(({ token, user }) => {
    if (sessionStorage.getItem('wsmis_test_session_initialized') === '1') return

    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
    sessionStorage.setItem('wsmis_test_session_initialized', '1')
  }, session)
})

test('employee registration ignores login credentials when Allow Login is off', async ({ page }) => {
  let submittedBody: Record<string, unknown> | null = null

  await page.route('**/api/employees', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }

    submittedBody = route.request().postDataJSON() as Record<string, unknown>
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 99001,
          employee_number: 'EMP-99001',
          full_name: 'No Login Employee',
          user: null,
          ...submittedBody,
        },
      }),
    })
  })

  await page.goto('/dashboard/hr')
  await page.getByRole('button', { name: 'Add Employee', exact: true }).click()
  await page.getByLabel(/^First Name/).fill('No Login')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  const allowLogin = page.getByLabel('Allow Login', { exact: true })
  await expect(allowLogin).not.toBeChecked()
  await allowLogin.check()
  await page.getByLabel(/^Login Password/).fill('Password123')
  await page.getByLabel(/^Confirm Login Password/).fill('Different123')
  await allowLogin.uncheck()

  await expect(page.getByLabel(/^Login Password/)).toHaveCount(0)
  await page.getByRole('button', { name: 'Save Employee', exact: true }).click()

  await expect.poll(() => submittedBody).not.toBeNull()
  expect(submittedBody).toMatchObject({
    first_name: 'No Login',
    login_enabled: false,
  })
  expect(submittedBody).not.toHaveProperty('login_password')
  expect(submittedBody).not.toHaveProperty('login_password_confirmation')
  expect(submittedBody).not.toHaveProperty('login_role')
  await expect(page.getByRole('heading', { name: 'Register Employee', exact: true })).toHaveCount(0)
})

test('expired session during employee save redirects clearly and remembers the HR page', async ({ page }) => {
  await page.route('**/api/employees', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Unauthenticated.' }),
    })
  })

  await page.goto('/dashboard/hr')
  await page.getByRole('button', { name: 'Add Employee', exact: true }).click()
  await page.getByLabel(/^First Name/).fill('Expired Session')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Save Employee', exact: true }).click()

  await expect(page).toHaveURL(/\/login\?reason=session_expired$/)
  await expect(page.getByText('Your session expired. Please sign in again.', { exact: true })).toBeVisible()
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('wsmis_auth_next'))).toBe('/dashboard/hr')
  await expect.poll(() => page.evaluate(() => localStorage.getItem('waternet_token'))).toBeNull()
})
