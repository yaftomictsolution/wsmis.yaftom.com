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

test('HR save and delete actions remain visibly busy until the API finishes', async ({ page }) => {
  let finishCreate!: () => void
  let finishDelete!: () => void
  let createAttempts = 0
  const createGate = new Promise<void>((resolve) => { finishCreate = resolve })
  const deleteGate = new Promise<void>((resolve) => { finishDelete = resolve })
  const department = {
    id: 99001,
    code: 'QA',
    name: 'Quality Assurance',
    description: '',
    status: 'active',
    positions_count: 0,
  }
  const newestDepartment = { ...department, id: 99003, code: 'NEW', name: 'Newest Department' }
  const middleDepartment = { ...department, id: 99002, code: 'MID', name: 'Middle Department' }

  await page.route('**/api/hr/structure', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          departments: [department, newestDepartment, middleDepartment],
          positions: [],
          roles: [],
          service_areas: [],
          shareholders: [],
        },
      }),
    })
  })
  await page.route(/\/api\/hr\/departments(?:\/\d+)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      createAttempts += 1
      if (createAttempts > 1) {
        await route.fulfill({
          status: 422,
          contentType: 'application/json',
          body: JSON.stringify({
            message: 'The given data was invalid.',
            errors: { name: ['The department name has already been taken.'] },
          }),
        })
        return
      }
      await createGate
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { ...department, id: 99002, code: 'OPS', name: 'Operations' } }),
      })
      return
    }
    if (route.request().method() === 'DELETE') {
      await deleteGate
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Department deleted.' }),
      })
      return
    }
    await route.continue()
  })

  await page.goto('/dashboard/hr')
  await page.getByRole('button', { name: 'Departments & Positions', exact: true }).click()
  const departmentsPanel = page.getByRole('heading', { name: 'Departments', exact: true }).locator('../../..')
  await expect(departmentsPanel.locator('div.divide-y').locator(':scope > div').first()).toContainText('Newest Department')

  await page.getByRole('button', { name: 'Department', exact: true }).click()
  await page.getByLabel(/^Code/).fill('OPS')
  await page.getByLabel(/^Name/).fill('Operations')

  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const saving = page.getByRole('button', { name: 'Saving...', exact: true })
  await expect(saving).toBeVisible()
  await expect(saving).toBeDisabled()
  finishCreate()
  await expect(page.getByRole('heading', { name: 'New Department', exact: true })).toBeHidden()

  await page.getByRole('button', { name: 'Department', exact: true }).click()
  await page.getByLabel(/^Code/).fill('QA')
  await page.getByLabel(/^Name/).fill('Quality Assurance')
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  const departmentModal = page.getByRole('heading', { name: 'New Department', exact: true }).locator('../..')
  await expect(departmentModal.getByText('The department name has already been taken.', { exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'New Department', exact: true })).toBeVisible()
  await departmentModal.getByRole('button', { name: 'Cancel', exact: true }).click()

  await page.getByTitle('Delete department').first().click()
  await expect(page.getByRole('heading', { name: 'Confirm Delete', exact: true })).toBeVisible()
  await expect(page.getByText('Delete Newest Department? This cannot be undone.', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Delete', exact: true }).click()
  const deleting = page.getByRole('button', { name: 'Deleting...', exact: true })
  await expect(deleting).toBeVisible()
  await expect(deleting).toBeDisabled()
  finishDelete()
  await expect(page.getByRole('heading', { name: 'Confirm Delete', exact: true })).toBeHidden()
})

test('attendance approval asks first and stays busy until approval succeeds', async ({ page }) => {
  let finishApproval!: () => void
  const approvalGate = new Promise<void>((resolve) => { finishApproval = resolve })
  const attendance = {
    id: 99001,
    employee_id: 99001,
    attendance_date: '2026-07-23',
    check_in: '08:00:00',
    check_out: '17:00:00',
    attendance_status: 'present',
    is_paid: true,
    worked_minutes: 480,
    late_minutes: 0,
    overtime_minutes: 0,
    source: 'manual',
    approval_status: 'pending',
    notes: 'UI interaction test',
    employee: {
      id: 99001,
      user_id: null,
      employee_number: 'EMP-QA',
      first_name: 'Test',
      last_name: 'Employee',
      full_name: 'Test Employee',
    },
  }
  const newestAttendance = {
    ...attendance,
    id: 99003,
    employee_id: 99003,
    employee: {
      ...attendance.employee,
      id: 99003,
      employee_number: 'EMP-NEW',
      first_name: 'Newest',
      full_name: 'Newest Employee',
    },
  }

  await page.route('**/api/attendance?*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [attendance, newestAttendance] }),
    })
  })
  await page.route('**/api/attendance/*/resolve', async (route) => {
    await approvalGate
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: { ...newestAttendance, approval_status: 'approved' } }),
    })
  })

  await page.goto('/dashboard/attendance')
  await expect(page.locator('table tbody tr').first()).toContainText('Newest Employee')
  await page.getByTitle('Approve').first().click()
  const approvalHeading = page.getByRole('heading', { name: 'Approve Attendance', exact: true })
  const approvalDialog = approvalHeading.locator('../..')
  await expect(approvalHeading).toBeVisible()
  await expect(approvalDialog.getByText('Approve attendance for Newest Employee on 2026-07-23?', { exact: true })).toBeVisible()
  await approvalDialog.getByRole('button', { name: 'Approve', exact: true }).click()
  const approving = page.getByRole('button', { name: 'Approving...', exact: true })
  await expect(approving).toBeVisible()
  await expect(approving).toBeDisabled()
  finishApproval()
  await expect(page.getByRole('heading', { name: 'Approve Attendance', exact: true })).toBeHidden()
})
