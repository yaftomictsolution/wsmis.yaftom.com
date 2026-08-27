import { expect, test, type Page } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

const operationalReport = {
  filters: { type: 'all', from: '2026-03-01', to: '2026-08-24' },
  summary: {
    total_customers: 3,
    new_customers: 1,
    revenue: 4200,
    expenses: 1200,
    inventory_items: 4,
    inventory_quantity: 25,
    active_employees: 2,
    asset_count: 2,
  },
  customer: {
    totals: {
      customers: 3,
      new_customers: 1,
      active_customers: 2,
      pending_customers: 1,
      receivables: 1300,
      payments_received: 2200,
      payments_count: 2,
    },
    status_distribution: [
      { name: 'active', value: 2 },
      { name: 'awaiting_installation', value: 1 },
    ],
    balance_distribution: [
      { range: '0-1,000', count: 2 },
      { range: '1,000-5,000', count: 1 },
    ],
    rows: [{ subscription_code: 'CUS-0001', name: 'Ahmad Karimi', status: 'active' }],
  },
  hr: {
    totals: {
      employees: 2,
      active_employees: 2,
      approved_leave_days: 3,
      pending_leave_requests: 1,
      payroll_runs: 1,
      payroll_cost: 18000,
      attendance_records: 40,
    },
    department_distribution: [{ name: 'Unassigned', count: 1 }, { name: 'Operations', count: 1 }],
    payroll_trend: [{ period: '2026-07', payroll_number: 'PAY-0001', amount: 18000, status: 'approved' }],
    leave_balances: [{ type: 'Annual Leave', entitled: 20, used: 3, remaining: 17 }],
  },
  asset: {
    totals: {
      assets: 2,
      active_assets: 1,
      maintenance_assets: 1,
      asset_value: 50000,
      maintenance_events: 1,
      maintenance_cost: 500,
    },
    type_distribution: [{ name: 'generator', count: 1 }, { name: 'solar_system', count: 1 }],
    status_distribution: [{ name: 'active', value: 1 }, { name: 'maintenance', value: 1 }],
    rows: [{ asset_code: 'AST-0001', name: 'Office Generator', type: 'generator', status: 'active' }],
  },
  generated_at: '2026-08-24T08:00:00Z',
}

const switchToDari = async (page: Page) => {
  await page.getByRole('button', { name: 'Language', exact: true }).click()
  await page.getByRole('button', { name: 'Dari', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')
}

test.beforeEach(async ({ page, request }) => {
  const login = await request.post(`${apiUrl}/auth/login`, {
    data: { email: 'admin@waternet.local', password: 'password' },
  })
  expect(login.ok()).toBeTruthy()
  const session = await login.json()

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, session)

  await page.route('**/api/reports/operational**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: operationalReport }),
    })
  })
})

test('customer report translates summaries, statuses, and chart labels to Dari', async ({ page }) => {
  await page.goto('/dashboard/reports/customer', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Customer Reports', exact: true })).toBeVisible({ timeout: 30_000 })
  await switchToDari(page)

  const expected = [
    '\u06af\u0632\u0627\u0631\u0634\u200c\u0647\u0627\u06cc \u0645\u0634\u062a\u0631\u06cc\u0627\u0646',
    '\u0645\u062c\u0645\u0648\u0639 \u0645\u0634\u062a\u0631\u06cc\u0627\u0646',
    '\u0645\u0634\u062a\u0631\u06cc\u0627\u0646 \u062c\u062f\u06cc\u062f \u062f\u0631 \u062f\u0648\u0631\u0647',
    '\u0645\u062c\u0645\u0648\u0639 \u0645\u0637\u0627\u0644\u0628\u0627\u062a',
    '\u062a\u0648\u0632\u06cc\u0639 \u062d\u0627\u0644\u062a \u0645\u0634\u062a\u0631\u06cc\u0627\u0646',
    '\u062a\u0648\u0632\u06cc\u0639 \u0628\u06cc\u0644\u0627\u0646\u0633 \u0645\u0634\u062a\u0631\u06cc\u0627\u0646',
    '\u0641\u0639\u0627\u0644: 2',
    '\u062f\u0631 \u0627\u0646\u062a\u0638\u0627\u0631 \u0646\u0635\u0628: 1',
  ]
  for (const text of expected) await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Customer Status Distribution', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Customer Balance Distribution', { exact: true })).toHaveCount(0)
})

test('asset report translates asset types, statuses, metrics, and charts to Dari', async ({ page }) => {
  await page.goto('/dashboard/reports/asset', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Asset Reports', exact: true })).toBeVisible({ timeout: 30_000 })
  await switchToDari(page)

  const expected = [
    '\u06af\u0632\u0627\u0631\u0634\u200c\u0647\u0627\u06cc \u062f\u0627\u0631\u0627\u06cc\u06cc',
    '\u0645\u062c\u0645\u0648\u0639 \u062f\u0627\u0631\u0627\u06cc\u06cc\u200c\u0647\u0627',
    '\u062a\u062d\u062a \u062d\u0641\u0638 \u0648 \u0645\u0631\u0627\u0642\u0628\u062a',
    '\u0627\u0631\u0632\u0634 \u0645\u062c\u0645\u0648\u0639\u06cc',
    '\u062f\u0627\u0631\u0627\u06cc\u06cc\u200c\u0647\u0627 \u0628\u0631 \u0627\u0633\u0627\u0633 \u0646\u0648\u0639',
    '\u062a\u0648\u0632\u06cc\u0639 \u062d\u0627\u0644\u062a \u062f\u0627\u0631\u0627\u06cc\u06cc\u200c\u0647\u0627',
    '\u062c\u0646\u0631\u0627\u062a\u0648\u0631',
    '\u0633\u06cc\u0633\u062a\u0645 \u0633\u0648\u0644\u0631',
  ]
  for (const text of expected) await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Assets by Type', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Asset Status Distribution', { exact: true })).toHaveCount(0)
})

test('HR report translates payroll, department, and leave charts to Dari', async ({ page }) => {
  await page.goto('/dashboard/reports/hr', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'HR Reports', exact: true })).toBeVisible({ timeout: 30_000 })
  await switchToDari(page)

  const expected = [
    '\u06af\u0632\u0627\u0631\u0634\u200c\u0647\u0627\u06cc \u0645\u0646\u0627\u0628\u0639 \u0628\u0634\u0631\u06cc',
    '\u0645\u062c\u0645\u0648\u0639 \u06a9\u0627\u0631\u0645\u0646\u062f\u0627\u0646',
    '\u0631\u0648\u0632\u0647\u0627\u06cc \u0631\u062e\u0635\u062a\u06cc \u062a\u0623\u06cc\u06cc\u062f\u0634\u062f\u0647',
    '\u0622\u062e\u0631\u06cc\u0646 \u0645\u0639\u0627\u0634\u0627\u062a',
    '\u06a9\u0627\u0631\u0645\u0646\u062f\u0627\u0646 \u0628\u0631 \u0627\u0633\u0627\u0633 \u062f\u06cc\u067e\u0627\u0631\u062a\u0645\u0646\u062a',
    '\u0631\u0648\u0646\u062f \u0647\u0632\u06cc\u0646\u0647 \u0645\u0639\u0627\u0634\u0627\u062a',
    '\u0628\u06cc\u0644\u0627\u0646\u0633 \u0631\u062e\u0635\u062a\u06cc',
    '\u062a\u0639\u06cc\u06cc\u0646\u200c\u0646\u0634\u062f\u0647: 1',
    '\u0631\u062e\u0635\u062a\u06cc \u0633\u0627\u0644\u0627\u0646\u0647',
    '\u0631\u0648\u0632\u0647\u0627\u06cc \u0627\u0633\u062a\u0641\u0627\u062f\u0647\u200c\u0634\u062f\u0647',
    '\u0631\u0648\u0632\u0647\u0627\u06cc \u0628\u0627\u0642\u06cc\u200c\u0645\u0627\u0646\u062f\u0647',
  ]
  for (const text of expected) await expect(page.getByText(text, { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Payroll Cost Trend', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Leave Balance', { exact: true })).toHaveCount(0)
})

test('custom report translates configuration, validation, and generated summary labels to Dari', async ({ page }) => {
  await page.goto('/dashboard/reports/custom', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Custom Reports', exact: true })).toBeVisible({ timeout: 30_000 })
  await switchToDari(page)

  await expect(page.getByText('\u062a\u0646\u0638\u06cc\u0645\u0627\u062a \u06af\u0632\u0627\u0631\u0634', { exact: true })).toBeVisible()
  await expect(page.getByRole('option', { name: '\u06af\u0632\u0627\u0631\u0634 \u0645\u0634\u062a\u0631\u06cc\u0627\u0646', exact: true })).toBeAttached()

  const generate = page.getByRole('button', { name: '\u0627\u06cc\u062c\u0627\u062f \u06af\u0632\u0627\u0631\u0634', exact: true })
  await generate.click()
  await expect(page.getByText('\u062a\u0627\u0631\u06cc\u062e \u0634\u0631\u0648\u0639 \u0648 \u062e\u062a\u0645 \u0645\u0639\u062a\u0628\u0631 \u0631\u0627 \u0627\u0646\u062a\u062e\u0627\u0628 \u06a9\u0646\u06cc\u062f.', { exact: true })).toBeVisible()

  await page.locator('select').selectOption('customer')
  const dates = page.locator('input[type="date"]')
  await dates.nth(0).fill('2026-07-01')
  await dates.nth(1).fill('2026-07-31')
  await generate.click()

  await expect(page.getByText('\u06af\u0632\u0627\u0631\u0634 \u0627\u06cc\u062c\u0627\u062f\u0634\u062f\u0647', { exact: true })).toBeVisible()
  await expect(page.getByText('\u0645\u0634\u062a\u0631\u06cc\u0627\u0646', { exact: true }).first()).toBeVisible()
  await expect(page.getByRole('button', { name: '\u0686\u0627\u067e / PDF', exact: true })).toBeVisible()
  await expect(page.getByText('Report Configuration', { exact: true })).toHaveCount(0)
  await expect(page.getByText('Generated Report', { exact: true })).toHaveCount(0)
})
