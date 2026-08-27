import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

test('financial report dashboard switches every report label and chart to Dari', async ({ page, request }) => {
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

  await page.route('**/api/financial-reports**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          filters: { from: '2026-03-01', to: '2026-08-24' },
          summary: {
            total_income: 1500,
            total_expense: 400,
            net_income: 1100,
            cash_balance: 1100,
          },
          income_by_category: [{ name: 'Water Bill Income', amount: 1500 }],
          expense_by_category: [{ name: 'Inventory Purchase', amount: 400 }],
          cash_flow: [{ date: '2026-07-15', income: 1500, outflow: 400, net: 1100 }],
          accounts: [
            { id: 1, name: 'Office Account', code: 'OFFICE', type: 'cash', opening_balance: 0, closing_balance: 1100 },
            { id: 2, name: 'Purchase Acount', code: 'PURCHASE', type: 'cash', opening_balance: 0, closing_balance: 7500 },
          ],
          ledger: [],
          receivables: [],
          supplier_payables: [],
          payroll: [],
          shareholder_distributions: [],
          reconciliations: [],
          closings: [],
          generated_at: '2026-08-24T08:00:00Z',
        },
      }),
    })
  })

  await page.goto('/dashboard/reports/financial', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Financial Reports', exact: true })).toBeVisible({ timeout: 30_000 })

  await page.getByRole('button', { name: 'Language', exact: true }).click()
  await page.getByRole('button', { name: 'Dari', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl')

  const labels = [
    '\u06af\u0632\u0627\u0631\u0634\u200c\u0647\u0627\u06cc \u0645\u0627\u0644\u06cc',
    '\u0645\u0642\u0627\u06cc\u0633\u0647 \u0639\u0648\u0627\u06cc\u062f \u0648 \u0645\u0635\u0627\u0631\u0641\u060c \u0633\u0648\u062f \u0648 \u0632\u06cc\u0627\u0646\u060c \u062c\u0631\u06cc\u0627\u0646 \u0646\u0642\u062f\u06cc \u0648 \u0628\u06cc\u0644\u0627\u0646\u0633 \u062d\u0633\u0627\u0628\u200c\u0647\u0627',
    '\u0631\u0648\u0646\u062f \u0639\u0648\u0627\u06cc\u062f \u0648 \u0645\u0635\u0627\u0631\u0641',
    '\u062c\u0631\u06cc\u0627\u0646 \u0646\u0642\u062f\u06cc',
    '\u0639\u0648\u0627\u06cc\u062f \u0628\u0631 \u0627\u0633\u0627\u0633 \u06a9\u062a\u06af\u0648\u0631\u06cc',
    '\u0645\u0635\u0627\u0631\u0641 \u0628\u0631 \u0627\u0633\u0627\u0633 \u06a9\u062a\u06af\u0648\u0631\u06cc',
    '\u0628\u06cc\u0644\u0627\u0646\u0633 \u062d\u0633\u0627\u0628\u200c\u0647\u0627',
    '\u0639\u0627\u06cc\u062f \u0628\u0644 \u0622\u0628: AFN 1,500',
    '\u062e\u0631\u06cc\u062f \u0645\u0648\u062c\u0648\u062f\u06cc: AFN 400',
  ]
  for (const label of labels) await expect(page.getByText(label, { exact: true }).first()).toBeVisible()

  await expect(page.getByRole('option', { name: '\u06f6 \u0645\u0627\u0647 \u06af\u0630\u0634\u062a\u0647', exact: true })).toBeAttached()
  await expect(page.getByRole('button', { name: '\u062e\u0631\u0648\u062c\u06cc', exact: true })).toBeVisible()
  await expect(page.getByText('\u062d\u0633\u0627\u0628 \u062f\u0641\u062a\u0631 (\u0646\u0642\u062f\u06cc)', { exact: true })).toBeVisible()
  await expect(page.getByText('\u062d\u0633\u0627\u0628 \u062e\u0631\u06cc\u062f (\u0646\u0642\u062f\u06cc)', { exact: true })).toBeVisible()
  await expect(page.getByText(/Office Account|Purchase Acount/, { exact: true })).toHaveCount(0)

  const englishLabels = [
    'Income vs expense, profit & loss, cash flow, and account balances',
    'Income vs Expense Trend',
    'Cash Flow',
    'Income by Category',
    'Expense by Category',
    'Account Balances',
  ]
  for (const label of englishLabels) await expect(page.getByText(label, { exact: true })).toHaveCount(0)
})
