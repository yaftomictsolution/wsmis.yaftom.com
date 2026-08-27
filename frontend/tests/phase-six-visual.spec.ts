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

test('phase six HR, attendance, and payroll pages render cleanly', async ({ page }) => {
  test.setTimeout(180_000)
  const pageErrors: string[] = []
  const serverErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  page.on('response', (response) => {
    if (response.status() >= 500) serverErrors.push(`${response.status()} ${response.url()}`)
  })

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/dashboard/settings')
  await expect(page.getByRole('heading', { name: 'Leave Settings', exact: true })).toBeVisible({ timeout: 45_000 })
  await expect(page.getByLabel(/^Annual Leave Days/)).toHaveValue('20')
  await expect(page.getByLabel(/^Maximum Carry-Over/)).toHaveValue('5')
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-leave-settings.png' })

  for (const [path, heading] of [
    ['/dashboard/hr', 'Human Resources'],
    ['/dashboard/attendance', 'Attendance & Leave'],
    ['/dashboard/payroll', 'Payroll'],
  ] as const) {
    await page.goto(path)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1440)
  }
  await page.goto('/dashboard/hr')
  await page.getByRole('button', { name: 'Add Employee', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Register Employee', exact: true })).toBeVisible()
  await expect(page.getByLabel('Allow Login', { exact: true })).toHaveCount(0)
  await page.getByLabel(/^First Name/).fill('Visual Test')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByLabel('Allow Login', { exact: true })).not.toBeChecked()
  await expect(page.getByLabel(/^System Role/)).toHaveCount(0)
  await expect(page.getByLabel(/^Login Password/)).toHaveCount(0)
  await expect(page.getByLabel('System Login', { exact: true })).toHaveCount(0)
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-phase6-employee-login.png' })
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Leave Policies', exact: true })).toHaveCount(0)
  await page.getByRole('combobox', { name: 'More HR Tools', exact: true }).selectOption('deductions')
  await expect(page.getByRole('heading', { name: 'Deduction Rules', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'More HR Tools', exact: true }).selectOption('terminations')
  await expect(page.getByRole('heading', { name: 'Employee Final Settlements', exact: true })).toBeVisible()
  await page.getByRole('combobox', { name: 'More HR Tools', exact: true }).selectOption('reports')
  await expect(page.getByRole('button', { name: 'Generate Report', exact: true })).toBeVisible()
  await expect(page.getByText('Employees In Report', { exact: true })).toBeVisible()
  await expect(page.locator('table tbody tr').first()).toBeVisible()
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1440)
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-phase6-hr-report.png' })

  await page.goto('/dashboard/attendance')
  await page.getByRole('button', { name: 'Leave Requests', exact: true }).click()
  await page.getByRole('button', { name: 'Request Leave', exact: true }).click()
  await expect(page.getByLabel(/^Leave Type/).locator('option')).toHaveCount(5, { timeout: 45_000 })
  await expect(page.getByLabel(/^Leave Type/).locator('option', { hasText: 'Other Leave' })).toHaveCount(0)
  await page.getByLabel(/^Leave Type/).selectOption({ label: 'Unpaid Leave' })
  await expect(page.getByText('No yearly limit', { exact: true })).toBeVisible()
  await expect(page.getByText('Approved days will be unpaid.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Schedule & Holidays', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Employee Roster', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Biometric Import', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Biometric Attendance Import', exact: true })).toBeVisible()

  await page.goto('/dashboard/payroll')
  await page.getByRole('button', { name: 'Monthly Reports', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Monthly Summary', exact: true })).toBeVisible()
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-phase6-payroll.png', fullPage: true })

  await page.evaluate(() => {
    localStorage.setItem('language', 'fa')
    window.dispatchEvent(new Event('wsmis-language-change'))
  })
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'معاشات', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'گزارش‌های ماهانه', exact: true })).toBeVisible()
  await page.evaluate(() => {
    localStorage.setItem('language', 'en')
    window.dispatchEvent(new Event('wsmis-language-change'))
  })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/dashboard/hr')
  await expect(page.getByRole('heading', { name: 'Human Resources', exact: true })).toBeVisible()
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-phase6-mobile.png', fullPage: true })

  expect(pageErrors).toEqual([])
  expect(serverErrors).toEqual([])
})
