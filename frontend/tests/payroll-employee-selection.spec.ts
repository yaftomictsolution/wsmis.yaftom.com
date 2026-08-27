import { expect, test, type Page } from '@playwright/test'

const notifyAuthSession = async (page: Page) => {
  await page.evaluate(() => window.dispatchEvent(new Event('wsmis-auth-session-change')))
}

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

  await page.route('**/api/payroll-runs/eligible-employees**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [
          {
            id: 901,
            employee_number: 'EMP-00901',
            full_name: 'Ahmad Karimi',
            status: 'active',
            salary_type: 'fixed',
            base_salary: '18000.00',
            daily_rate: '0.00',
            attendance_ready: true,
            incomplete_attendance_count: 0,
            incomplete_attendance: [],
            position: { id: 1, title: 'Technician' },
          },
          {
            id: 902,
            employee_number: 'EMP-00902',
            full_name: 'Fatima Noori',
            status: 'active',
            salary_type: 'daily',
            base_salary: '0.00',
            daily_rate: '750.00',
            attendance_ready: true,
            incomplete_attendance_count: 0,
            incomplete_attendance: [],
            position: { id: 2, title: 'Accountant' },
          },
        ],
      }),
    })
  })
})

test('payroll modal supports one or multiple employee selection', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/dashboard/payroll')
  await notifyAuthSession(page)
  await page.getByRole('button', { name: 'Generate Payroll', exact: true }).click()

  await expect(page.getByRole('heading', { name: 'Generate Monthly Payroll', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'All Employees', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('2 of 2 employees have complete attendance', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Selected Employees', exact: true }).click()
  await page.getByRole('checkbox', { name: /Ahmad Karimi/ }).check()
  await expect(page.getByText('1 selected', { exact: true })).toBeVisible()

  await page.getByRole('searchbox', { name: 'Search employees' }).fill('Fatima')
  await expect(page.getByText('Ahmad Karimi', { exact: true })).toHaveCount(0)
  await page.getByRole('checkbox', { name: 'Select all shown', exact: true }).check()
  await expect(page.getByText('2 selected', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-payroll-multiple-employees.png' })

  await page.setViewportSize({ width: 390, height: 844 })
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await expect(page.getByText('Fatima Noori', { exact: true })).toBeVisible()
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-payroll-multiple-employees-mobile.png' })

  expect(pageErrors).toEqual([])
})

test('payroll validation errors are translated when Dari is active', async ({ page }) => {
  await page.goto('/dashboard/payroll')
  await notifyAuthSession(page)
  await page.getByRole('button', { name: 'Generate Payroll', exact: true }).click()

  await page.getByRole('button', { name: 'Language', exact: true }).click()
  await page.getByRole('button', { name: 'Dari', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

  const modal = page.locator('.elegant-panel').filter({ has: page.locator('h2') }).last()
  await modal.locator('button').last().click()
  await modal.locator('button').last().click()

  const dariMessage = '\u062f\u0648\u0631\u0647 \u0645\u0639\u0627\u0634\u060c \u0631\u0648\u0634 \u067e\u0631\u062f\u0627\u062e\u062a \u0648 \u062d\u0633\u0627\u0628 \u067e\u0631\u062f\u0627\u062e\u062a \u0631\u0627 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u06cc\u062f.'
  await expect(modal.getByText(dariMessage, { exact: true })).toBeVisible()
  await expect(modal.getByText('Select the payroll period, payment method, and payment account.', { exact: true })).toHaveCount(0)
})

test('payroll refreshes and displays the latest available account balance', async ({ page }) => {
  let accountRequests = 0
  await page.route('**/api/settings', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          system: { system_profile: {} },
          payment_methods: [{ id: 1, name: 'Cash', code: 'cash', status: 'active' }],
        },
      }),
    })
  })
  await page.route('**/api/accounting/accounts', async (route) => {
    accountRequests += 1
    if (accountRequests > 1) await new Promise((resolve) => setTimeout(resolve, 600))
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 11,
          name: 'Office Test Account',
          code: 'office_test',
          type: 'cash',
          opening_balance: '0.00',
          current_balance: accountRequests === 1 ? '0.00' : '399.99',
          status: 'active',
        }],
      }),
    })
  })

  await page.goto('/dashboard/payroll')
  await notifyAuthSession(page)
  await expect.poll(() => accountRequests).toBeGreaterThanOrEqual(1)
  await page.getByRole('button', { name: 'Generate Payroll', exact: true }).click()
  const accountSelect = page.getByLabel(/^Payment Account/)
  await expect.poll(() => accountRequests).toBeGreaterThanOrEqual(2)
  await page.getByRole('button', { name: 'Continue', exact: true }).click()

  await page.getByLabel(/^Payment Method/).selectOption('1')
  await expect(accountSelect).toBeEnabled()
  await expect(accountSelect.locator('option[value="11"]')).toHaveText('Office Test Account - Available AFN 399.99')
  await accountSelect.selectOption('11')

  await expect(page.getByText('Available Balance in Office Test Account', { exact: true })).toBeVisible()
  await expect(page.getByText('AFN 399.99', { exact: true })).toBeVisible()
})

test('sidebar workspaces follow the simplified operational order', async ({ page }) => {
  await page.goto('/dashboard')
  await notifyAuthSession(page)
  await expect(page.locator('.app-sidebar a[href="/dashboard/customers"]')).toBeVisible()

  const hrefs = await page.locator('.app-sidebar a[href^="/dashboard"]').evaluateAll((links) =>
    links.map((link) => link.getAttribute('href')),
  )

  expect(hrefs).toEqual([
    '/dashboard',
    '/dashboard/customers',
    '/dashboard/meter-readings',
    '/dashboard/inventory-manager',
    '/dashboard/accounting',
    '/dashboard/hr',
    '/dashboard/reports',
    '/dashboard/settings',
  ])
})

test('number fields do not change while the page is scrolled', async ({ page }) => {
  await page.goto('/dashboard/hr')
  await notifyAuthSession(page)
  await page.getByRole('button', { name: 'Add Employee', exact: true }).click()
  await page.getByLabel(/^First Name/).fill('Number Field Test')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  const salary = page.getByLabel(/^Monthly Salary/)
  await salary.fill('10000')
  await salary.hover()
  await salary.focus()
  await salary.dispatchEvent('wheel', { deltaY: 300 })

  await expect(salary).toHaveValue('10000')
  await expect(salary).not.toBeFocused()
})

test('payroll selector identifies every incomplete attendance date', async ({ page }) => {
  await page.unroute('**/api/payroll-runs/eligible-employees**')
  await page.route('**/api/payroll-runs/eligible-employees**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{
          id: 901,
          employee_number: 'EMP-00901',
          full_name: 'Ahmad Karimi',
          status: 'active',
          salary_type: 'fixed',
          base_salary: '18000.00',
          daily_rate: '0.00',
          attendance_ready: false,
          incomplete_attendance_count: 2,
          incomplete_attendance: [
            { date: '2026-07-22', reason: 'missing' },
            { date: '2026-07-23', reason: 'pending' },
          ],
          position: { id: 1, title: 'Technician' },
        }],
      }),
    })
  })

  await page.goto('/dashboard/payroll')
  await notifyAuthSession(page)
  await page.getByRole('button', { name: 'Generate Payroll', exact: true }).click()
  await page.getByRole('button', { name: 'Selected Employees', exact: true }).click()

  await expect(page.getByRole('checkbox', { name: /Ahmad Karimi.*missing.*pending/ })).toBeDisabled()
})
