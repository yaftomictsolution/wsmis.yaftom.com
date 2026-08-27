import { expect, test } from '@playwright/test'

const apiUrl = 'http://127.0.0.1:8000/api'

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
    localStorage.setItem('wsmis-calendar-system', 'shamsi')
    localStorage.setItem('wsmis-show-gregorian-secondary', 'false')
  }, session)
})

test('Shamsi calendar setting drives the shared date picker', async ({ page }) => {
  const pageErrors: string[] = []
  page.on('pageerror', (error) => pageErrors.push(error.message))

  await page.goto('/dashboard/settings', { waitUntil: 'domcontentloaded' })
  await expect(page.getByRole('heading', { name: 'Date & Calendar' })).toBeVisible({ timeout: 30_000 })
  await expect(page.getByRole('button', { name: 'Hijri Shamsi' })).toBeVisible()

  await page.goto('/dashboard/billing-periods', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Add Period' }).click()
  const modal = page.locator('.elegant-panel').filter({
    has: page.getByRole('heading', { name: 'Add Billing Period' }),
  })
  await expect(modal).toBeVisible()

  const startsOn = modal.getByLabel(/^Starts On/)
  await expect(startsOn).toHaveAttribute('aria-haspopup', 'dialog')
  await startsOn.click()
  const calendar = page.getByRole('dialog', { name: 'Select Hijri Shamsi date' })
  await expect(calendar).toBeVisible()
  await expect(page.getByText('Hijri Shamsi Calendar', { exact: true })).toBeVisible()
  const captionButtons = calendar.locator('button[aria-haspopup="listbox"]')
  await expect(captionButtons).toHaveCount(2)
  await captionButtons.nth(0).click()
  const monthMenu = calendar.getByRole('listbox', { name: 'Month' })
  await expect(monthMenu).toBeVisible()
  await expect(monthMenu.getByRole('option')).toHaveCount(12)
  await captionButtons.nth(0).click()
  await captionButtons.nth(1).click()
  const yearMenu = calendar.getByRole('listbox', { name: 'Year' })
  await expect(yearMenu).toBeVisible()
  expect(await yearMenu.getByRole('option').count()).toBeGreaterThan(100)

  await page.setViewportSize({ width: 390, height: 844 })
  await page.evaluate(() => {
    localStorage.setItem('language', 'fa')
    window.dispatchEvent(new Event('wsmis-language-change'))
  })
  const dariCalendar = page.getByRole('dialog', { name: 'انتخاب تاریخ هجری شمسی' })
  await expect(dariCalendar).toBeVisible()
  await expect(dariCalendar).toHaveAttribute('dir', 'rtl')
  const calendarBox = await dariCalendar.boundingBox()
  expect(calendarBox).not.toBeNull()
  expect(calendarBox!.x).toBeGreaterThanOrEqual(0)
  expect(calendarBox!.x + calendarBox!.width).toBeLessThanOrEqual(390)
  await dariCalendar.locator('button[aria-haspopup="listbox"]').nth(0).click()
  await expect(dariCalendar.getByRole('listbox', { name: 'ماه' })).toBeVisible()
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390)
  expect(pageErrors).toEqual([])
})
