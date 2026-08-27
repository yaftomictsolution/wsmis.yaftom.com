import { expect, test, type APIRequestContext, type Page } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

async function login(page: Page, request: APIRequestContext) {
  return loginAs(page, request, 'admin@waternet.local')
}

async function loginAs(page: Page, request: APIRequestContext, email: string) {
  const response = await request.post(`${apiUrl}/auth/login`, {
    data: { email, password: 'password' },
  })
  expect(response.ok()).toBeTruthy()
  const session = await response.json()

  await page.addInitScript(({ token, user }) => {
    localStorage.setItem('waternet_token', token)
    localStorage.setItem('waternet_user', JSON.stringify(user))
    localStorage.setItem('language', 'en')
  }, session)

  return session as { token: string }
}

function authHeaders(token: string) {
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

function dateValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

test('finance accounts can be edited and purchase approval timing is clear', async ({ page, request }) => {
  const session = await login(page, request)
  const code = `e2e_edit_${Date.now()}`
  const createResponse = await request.post(`${apiUrl}/accounting/accounts`, {
    headers: authHeaders(session.token),
    data: {
      name: 'Temporary Edit Account',
      code,
      type: 'cash',
      opening_balance: 0,
      status: 'active',
    },
  })
  expect(createResponse.ok()).toBeTruthy()
  const accountId = (await createResponse.json()).data.id as number

  try {
    await page.goto('/dashboard/accounting')
    await expect(page.getByRole('heading', { name: 'Accounting', exact: true })).toBeVisible()
    const originalRow = page.locator('tbody tr').filter({ hasText: 'Temporary Edit Account' })
    await expect(originalRow).toBeVisible()
    await originalRow.getByRole('button', { name: 'Edit', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Update Account', exact: true })).toBeVisible()
    await page.getByLabel(/^Account Name/).fill('Edited Finance Account')
    await page.getByLabel(/^Status/).selectOption('inactive')
    await page.getByLabel(/^Notes/).fill('Verified through the account edit workflow.')
    await page.getByRole('button', { name: 'Update', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Update Account', exact: true })).toBeHidden()
    const updatedRow = page.locator('tbody tr').filter({ hasText: 'Edited Finance Account' })
    await expect(updatedRow).toBeVisible()
    await updatedRow.getByRole('button', { name: 'Show Details', exact: true }).click()
    await expect(page.locator('tbody tr').filter({ hasText: code })).toContainText('inactive')

    const accountsResponse = await request.get(`${apiUrl}/accounting/accounts`, {
      headers: authHeaders(session.token),
    })
    const accounts = (await accountsResponse.json()).data as Array<{ id: number; name: string; status: string }>
    expect(accounts.find((account) => account.id === accountId)).toMatchObject({
      name: 'Edited Finance Account',
      status: 'inactive',
    })

    await page.goto('/dashboard/inventory-manager')
    await page.getByRole('button', { name: 'Purchase Goods', exact: true }).click()
    await page.getByRole('button', { name: 'New Purchase', exact: true }).click()
    await expect(page.getByText(
      'No money is deducted now. After admin approval, the goods are received and the selected account is debited.',
      { exact: true },
    )).toBeVisible()
  } finally {
    await request.delete(`${apiUrl}/accounting/accounts/${accountId}`, {
      headers: authHeaders(session.token),
    })
  }
})

test('warehouse officer can select an active account for a purchase request', async ({ page, request }) => {
  const session = await loginAs(page, request, 'warehouse@waternet.local')

  const fullAccountingResponse = await request.get(`${apiUrl}/accounting/accounts`, {
    headers: authHeaders(session.token),
  })
  expect(fullAccountingResponse.status()).toBe(403)

  const purchaseAccountsResponse = await request.get(`${apiUrl}/inventory-requests/purchase-accounts`, {
    headers: authHeaders(session.token),
  })
  expect(purchaseAccountsResponse.ok()).toBeTruthy()
  const purchaseAccounts = (await purchaseAccountsResponse.json()).data as Array<{ id: number; status: string }>
  expect(purchaseAccounts.length).toBeGreaterThan(0)
  expect(purchaseAccounts.every((account) => account.status === 'active')).toBeTruthy()

  await page.route(`${apiUrl}/**`, async (route) => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname.endsWith('/auth/me') || pathname.endsWith('/inventory-requests/purchase-accounts')) {
      await route.continue()
      return
    }

    await route.abort()
  })
  const browserAccountsResponsePromise = page.waitForResponse(
    (response) => response.url() === `${apiUrl}/inventory-requests/purchase-accounts`
      && response.request().method() === 'GET',
    { timeout: 90_000 },
  )
  await page.goto('/dashboard/inventory-manager?view=purchase')
  expect((await browserAccountsResponsePromise).ok()).toBeTruthy()
  await page.getByRole('button', { name: 'New Purchase', exact: true }).click()
  const accountSelect = page.getByLabel('Payment Account', { exact: true })
  await expect(accountSelect).toBeEnabled()
  await expect(accountSelect.locator('option')).toHaveCount(purchaseAccounts.length + 1)
  await accountSelect.selectOption(String(purchaseAccounts[0].id))
  await expect(accountSelect).toHaveValue(String(purchaseAccounts[0].id))
})

test('an approved attendance row can be deleted before payroll uses it', async ({ page, request }) => {
  const session = await login(page, request)
  const headers = authHeaders(session.token)
  const employeesResponse = await request.get(`${apiUrl}/employees`, { headers })
  expect(employeesResponse.ok()).toBeTruthy()
  const employeePayload = await employeesResponse.json()
  const employees = (employeePayload.data?.data ?? employeePayload.data) as Array<{
    id: number
    full_name: string
    hire_date: string
    status: string
  }>
  const activeEmployees = employees.filter((employee) => employee.status === 'active')
  expect(activeEmployees.length).toBeGreaterThan(0)

  const from = new Date()
  from.setDate(from.getDate() - 120)
  const attendanceResponse = await request.get(
    `${apiUrl}/attendance?from=${dateValue(from)}&to=${dateValue(new Date())}`,
    { headers },
  )
  expect(attendanceResponse.ok()).toBeTruthy()
  const used = new Set(
    ((await attendanceResponse.json()).data as Array<{ employee_id: number; attendance_date: string }>)
      .map((record) => `${record.employee_id}-${record.attendance_date.slice(0, 10)}`),
  )

  let selected: { employee: (typeof activeEmployees)[number]; date: string } | undefined
  for (const employee of activeEmployees) {
    for (let offset = 0; offset <= 120; offset += 1) {
      const candidate = new Date()
      candidate.setDate(candidate.getDate() - offset)
      const candidateDate = dateValue(candidate)
      if (candidateDate >= employee.hire_date.slice(0, 10) && !used.has(`${employee.id}-${candidateDate}`)) {
        selected = { employee, date: candidateDate }
        break
      }
    }
    if (selected) break
  }
  expect(selected).toBeTruthy()
  if (!selected) return

  const createResponse = await request.post(`${apiUrl}/attendance`, {
    headers,
    data: {
      employee_id: selected.employee.id,
      attendance_date: selected.date,
      attendance_status: 'present',
      check_in: '08:00',
      check_out: '16:00',
      notes: 'Temporary browser regression record',
    },
  })
  expect(createResponse.ok()).toBeTruthy()
  const attendanceId = (await createResponse.json()).data.id as number

  try {
    const approvalResponse = await request.post(`${apiUrl}/attendance/${attendanceId}/resolve`, {
      headers,
      data: { action: 'approve' },
    })
    expect(approvalResponse.ok()).toBeTruthy()

    await page.goto('/dashboard/attendance')
    await page.getByRole('textbox', { name: 'From', exact: true }).fill(selected.date)
    await page.getByRole('textbox', { name: 'To', exact: true }).fill(dateValue(new Date()))
    const row = page.locator('tbody tr').filter({
      hasText: selected.employee.full_name,
    }).filter({
      hasText: selected.date,
    })
    await expect(row).toBeVisible()
    await expect(row).toContainText('approved')
    await row.getByRole('button', { name: 'Delete', exact: true }).click()
    await expect(page.getByText('This is allowed only before payroll uses it.', { exact: false })).toBeVisible()
    await page.getByRole('button', { name: 'Delete', exact: true }).last().click()
    await expect(row).toBeHidden()
  } finally {
    await request.delete(`${apiUrl}/attendance/${attendanceId}`, { headers })
  }
})
