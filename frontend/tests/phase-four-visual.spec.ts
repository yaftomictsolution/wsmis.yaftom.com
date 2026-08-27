import { expect, test } from '@playwright/test'

const pages = [
  ['/dashboard/finance-transactions', 'Income'],
  ['/dashboard/payroll', 'Payroll'],
  ['/dashboard/shareholders', 'Shareholders'],
  ['/dashboard/reconciliation', 'Cash & Bank Reconciliation'],
  ['/dashboard/month-closing', 'Monthly Closing'],
  ['/dashboard/financial-reports', 'Financial Reports'],
] as const

test.beforeEach(async ({ page, request }) => {
  const response = await request.post('http://127.0.0.1:8000/api/auth/login', {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(response.ok()).toBeTruthy()
  const session = await response.json()
  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
  }, session)
})

test('phase four renders cleanly on desktop and mobile', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.setViewportSize({ width: 1440, height: 960 })
  for (const [path, heading] of pages) {
    await page.goto(`http://127.0.0.1:3000${path}`)
    await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible()
    await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 1440)
  }
  await page.goto('http://127.0.0.1:3000/dashboard/shareholders')
  await page.getByRole('button', { name: 'Add Shareholder', exact: true }).click()
  const shareholderType = page.getByLabel('Shareholder Type *', { exact: true })
  await expect(shareholderType).toHaveValue('individual')
  await expect(shareholderType.locator('option')).toHaveText(['Select an option', 'Individual', 'Company', 'Organization'])
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.goto('http://127.0.0.1:3000/dashboard/financial-reports')
  await expect(page.getByRole('heading', { name: 'Financial Reports', exact: true })).toBeVisible()
  await expect(page.getByText('Generating report...')).toBeHidden({ timeout: 60_000 })
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-phase4-desktop.png', fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('http://127.0.0.1:3000/dashboard/financial-reports')
  await expect(page.getByRole('heading', { name: 'Financial Reports', exact: true })).toBeVisible()
  await expect(page.getByText('Generating report...')).toBeHidden({ timeout: 60_000 })
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-phase4-mobile.png', fullPage: true })

  await page.evaluate(() => localStorage.setItem('language', 'fa'))
  await page.goto('http://127.0.0.1:3000/dashboard/payroll')
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
  await expect(page.getByRole('heading', { name: 'معاشات', exact: true })).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('saved dark theme hydrates and toggles without an error', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'))

  await page.goto('http://127.0.0.1:3000/dashboard')
  const themeButton = page.getByRole('button', { name: 'Toggle theme' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expect(themeButton.locator('svg')).toHaveClass(/lucide-sun/)

  await themeButton.click()
  await expect(page.locator('html')).toHaveClass(/light/)
  await expect(themeButton.locator('svg')).toHaveClass(/lucide-moon/)
  expect(pageErrors).toEqual([])
})
