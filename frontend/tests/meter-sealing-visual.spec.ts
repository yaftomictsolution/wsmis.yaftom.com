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

test('install and seal form exposes the complete audited sealing controls', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.route('**/api/meter-assignments/assigners', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ data: [{ id: 17, user_id: 27, employee_number: 'EMP-00017', name: 'Farid Ahmadi', email: 'farid@example.test', position: 'Field Installer' }] }),
    })
  })
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.goto('/dashboard/meter-assignments')
  await page.getByRole('button', { name: 'Assign Meter' }).click()

  const installModal = page.locator('.elegant-panel').filter({ has: page.getByRole('heading', { name: 'Install and Seal Meter' }) })
  await expect(installModal).toBeVisible()
  const assignerSelect = installModal.getByRole('combobox', { name: /Meter Assigner/ })
  await expect(assignerSelect).toBeVisible()
  await assignerSelect.click()
  await expect(installModal.getByRole('option', { name: /EMP-00017 - Farid Ahmadi/ })).toBeVisible()
  await installModal.getByRole('option', { name: /EMP-00017 - Farid Ahmadi/ }).click()
  await expect(installModal.getByText('Installer', { exact: true })).toHaveCount(0)
  await expect(installModal.getByText('Sealed By', { exact: true })).toHaveCount(0)
  await expect(installModal.getByText(/^Seal Number/)).toBeVisible()
  await expect(installModal.getByText(/^Sealing Date/)).toBeVisible()
  await expect(installModal.getByText('Drop a seal photo here or click to select')).toBeVisible()
  await expect(installModal.getByRole('button', { name: 'Install and Seal' })).toBeVisible()
  expect(pageErrors).toEqual([])

  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-install-and-seal.png', fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.waitForTimeout(350)
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  await expect(page.getByText('Drop a seal photo here or click to select')).toBeVisible()
  await page.screenshot({ path: 'C:/Users/Yaftom/AppData/Local/Temp/wsmis-install-and-seal-mobile.png', fullPage: true })
})
